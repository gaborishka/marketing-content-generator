import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mocks ────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdateFn = vi.fn().mockResolvedValue(undefined);

const mockUsageDocRef = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
};

const mockUsageCollectionRef = {
  doc: vi.fn().mockReturnValue(mockUsageDocRef),
};

const mockCreate = vi.fn().mockResolvedValue(undefined);

const mockDocWithSubcollection: any = {
  get: mockGet,
  set: mockSet,
  create: mockCreate,
  update: mockUpdateFn,
  collection: vi.fn().mockReturnValue(mockUsageCollectionRef),
};

const mockUsersCollectionRef: any = {
  doc: vi.fn().mockReturnValue(mockDocWithSubcollection),
  where: vi.fn(),
};

// Transaction mock: captures reads/writes and executes the callback
const mockTxGet = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxSet = vi.fn();

const mockRunTransaction = vi.fn(async (callback: any) => {
  const tx = {
    get: mockTxGet,
    update: mockTxUpdate,
    set: mockTxSet,
  };
  return callback(tx);
});

const mockFirestoreInstance = {
  collection: vi.fn((name: string) => {
    if (name === "users") return mockUsersCollectionRef;
    return { doc: vi.fn().mockReturnValue({ get: mockGet, set: mockSet }) };
  }),
  runTransaction: mockRunTransaction,
};

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockFirestoreInstance,
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT_${n}`,
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => `mock-${name}` }),
}));

import {
  getOrCreateUserProfile,
  checkAndIncrementQuota,
  incrementUsage,
} from "../utils/billing";
import { TIER_LIMITS } from "../types/pipeline";

describe("checkAndIncrementQuota (transactional)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows and increments when free user is under limit", async () => {
    // Transaction reads: profile then usage
    mockTxGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ tier: "free" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 5 }),
      });

    const result = await checkAndIncrementQuota("user-1");
    expect(result).toEqual({
      allowed: true,
      current: 6,
      limit: 10,
      tier: "free",
    });
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ generationCount: "INCREMENT_1" })
    );
  });

  it("blocks when free user is at limit (no increment)", async () => {
    mockTxGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ tier: "free" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 10 }),
      });

    const result = await checkAndIncrementQuota("user-1");
    expect(result).toEqual({
      allowed: false,
      current: 10,
      limit: 10,
      tier: "free",
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("allows pro user with high usage under limit", async () => {
    mockTxGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ tier: "pro" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 50 }),
      });

    const result = await checkAndIncrementQuota("user-1");
    expect(result).toEqual({
      allowed: true,
      current: 51,
      limit: 100,
      tier: "pro",
    });
    expect(mockTxUpdate).toHaveBeenCalled();
  });

  it("blocks pro user at limit", async () => {
    mockTxGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ tier: "pro" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 100 }),
      });

    const result = await checkAndIncrementQuota("user-1");
    expect(result).toEqual({
      allowed: false,
      current: 100,
      limit: 100,
      tier: "pro",
    });
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("creates usage doc via tx.set when no usage exists yet", async () => {
    mockTxGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ tier: "free" }),
      })
      .mockResolvedValueOnce({
        exists: false,
        data: () => undefined,
      });

    const result = await checkAndIncrementQuota("new-user");
    expect(result).toEqual({
      allowed: true,
      current: 1,
      limit: 10,
      tier: "free",
    });
    expect(mockTxSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ generationCount: 1, uid: "new-user" })
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("defaults to free tier when profile does not exist", async () => {
    mockTxGet
      .mockResolvedValueOnce({
        exists: false,
        data: () => undefined,
      })
      .mockResolvedValueOnce({
        exists: false,
        data: () => undefined,
      });

    const result = await checkAndIncrementQuota("new-user");
    expect(result).toEqual({
      allowed: true,
      current: 1,
      limit: 10,
      tier: "free",
    });
  });
});

describe("enforceQuotaAndIncrement integration pattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates profile then atomically checks+increments quota", async () => {
    // getOrCreateUserProfile: user doesn't exist, create() succeeds, then get()
    mockCreate.mockResolvedValueOnce(undefined);
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: "user-1", email: "a@b.com", displayName: "Test", tier: "free" }),
    });

    await getOrCreateUserProfile("user-1", "a@b.com", "Test");
    expect(mockCreate).toHaveBeenCalled();

    // Now checkAndIncrementQuota (transactional)
    mockTxGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ tier: "free" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 5 }),
      });

    const quota = await checkAndIncrementQuota("user-1");
    expect(quota.allowed).toBe(true);
    expect(quota.current).toBe(6);
  });
});

describe("incrementUsage called before work", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments usage count atomically", async () => {
    mockUsageDocRef.set.mockResolvedValueOnce(undefined);
    mockUsageDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: "user-1", date: "2026-02-09", generationCount: 6 }),
    });

    const count = await incrementUsage("user-1");
    expect(count).toBe(6);
    expect(mockUsageDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "user-1",
        generationCount: "INCREMENT_1",
      }),
      { merge: true }
    );
  });
});
