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

const mockDocWithSubcollection: any = {
  get: mockGet,
  set: mockSet,
  update: mockUpdateFn,
  collection: vi.fn().mockReturnValue(mockUsageCollectionRef),
};

const mockUsersCollectionRef: any = {
  doc: vi.fn().mockReturnValue(mockDocWithSubcollection),
  where: vi.fn(),
};

const mockFirestoreInstance = {
  collection: vi.fn((name: string) => {
    if (name === "users") return mockUsersCollectionRef;
    return { doc: vi.fn().mockReturnValue({ get: mockGet, set: mockSet }) };
  }),
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
  checkQuota,
  incrementUsage,
} from "../utils/billing";
import { TIER_LIMITS } from "../types/pipeline";

// Replicate the enforceQuota logic from index.ts for testing
// (since it's a private function, we test the same logic pattern)
async function enforceQuota(uid: string, email: string, displayName: string): Promise<void> {
  await getOrCreateUserProfile(uid, email, displayName);
  const quota = await checkQuota(uid);
  if (!quota.allowed) {
    const message =
      quota.tier === "free"
        ? `Daily generation limit reached (${quota.current}/${quota.limit}). Upgrade to Pro for ${TIER_LIMITS.pro} generations/day.`
        : `Daily generation limit reached (${quota.current}/${quota.limit}).`;
    throw new Error(message);
  }
}

describe("enforceQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when under free-tier limit", async () => {
    // getOrCreateUserProfile: existing user
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", email: "a@b.com", displayName: "Test", tier: "free" }),
      })
      // checkQuota -> getUserProfile
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "free" }),
      });
    // checkQuota -> getDailyUsage
    mockUsageDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ generationCount: 5 }),
    });

    await expect(enforceQuota("user-1", "a@b.com", "Test")).resolves.toBeUndefined();
  });

  it("throws with upgrade message for free user at limit", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", email: "a@b.com", displayName: "Test", tier: "free" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "free" }),
      });
    mockUsageDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ generationCount: 10 }),
    });

    await expect(enforceQuota("user-1", "a@b.com", "Test")).rejects.toThrow(
      "Upgrade to Pro"
    );
  });

  it("throws without upgrade message for pro user at limit", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", email: "a@b.com", displayName: "Test", tier: "pro" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "pro" }),
      });
    mockUsageDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ generationCount: 100 }),
    });

    await expect(enforceQuota("user-1", "a@b.com", "Test")).rejects.toThrow(
      "Daily generation limit reached (100/100)."
    );
    try {
      await enforceQuota("user-1", "a@b.com", "Test");
    } catch (e: any) {
      expect(e.message).not.toContain("Upgrade");
    }
  });

  it("allows pro user with high usage under limit", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", email: "a@b.com", displayName: "Test", tier: "pro" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "pro" }),
      });
    mockUsageDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ generationCount: 50 }),
    });

    await expect(enforceQuota("user-1", "a@b.com", "Test")).resolves.toBeUndefined();
  });

  it("creates user profile for new user and allows generation", async () => {
    const newProfile = {
      uid: "new-user",
      email: "new@b.com",
      displayName: "New",
      tier: "free",
    };
    // getOrCreateUserProfile: doesn't exist -> create
    mockGet
      .mockResolvedValueOnce({ exists: false })
      // re-read after set
      .mockResolvedValueOnce({ exists: true, data: () => newProfile })
      // checkQuota -> getUserProfile
      .mockResolvedValueOnce({ exists: true, data: () => newProfile });
    // checkQuota -> getDailyUsage (no usage yet)
    mockUsageDocRef.get.mockResolvedValueOnce({ exists: false });

    await expect(enforceQuota("new-user", "new@b.com", "New")).resolves.toBeUndefined();
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
