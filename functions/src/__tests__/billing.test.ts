import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mocks ────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdateFn = vi.fn().mockResolvedValue(undefined);
const mockWhere = vi.fn();
const mockLimit = vi.fn();

const mockDocRef = {
  get: mockGet,
  set: mockSet,
  update: mockUpdateFn,
};

const mockQuerySnap = {
  empty: true,
  docs: [] as any[],
};

const mockCollectionRef: any = {
  doc: vi.fn().mockReturnValue(mockDocRef),
  where: mockWhere,
};

// Subcollection support: collection("users").doc(uid).collection("usage").doc(date)
const mockUsageDocRef = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
};

const mockUsageCollectionRef = {
  doc: vi.fn().mockReturnValue(mockUsageDocRef),
};

const mockCreate = vi.fn().mockResolvedValue(undefined);

// Make doc() return an object that also has .collection() for subcollections
const mockDocWithSubcollection: any = {
  get: mockGet,
  set: mockSet,
  create: mockCreate,
  update: mockUpdateFn,
  collection: vi.fn().mockReturnValue(mockUsageCollectionRef),
};

// When collection("users") is accessed, doc() should return mockDocWithSubcollection
const mockUsersCollectionRef: any = {
  doc: vi.fn().mockReturnValue(mockDocWithSubcollection),
  where: mockWhere,
};

// Route different collections
const mockFirestoreInstance = {
  collection: vi.fn((name: string) => {
    if (name === "users") return mockUsersCollectionRef;
    return mockCollectionRef;
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
  getUserProfile,
  updateUserProfile,
  getDailyUsage,
  incrementUsage,
  checkQuota,
  findUidByCustomerId,
} from "../utils/billing";

describe("Billing Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default returns
    mockWhere.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockReturnValue({
      get: vi.fn().mockResolvedValue(mockQuerySnap),
    });
  });

  // ── getOrCreateUserProfile ───────────────────────────────────────────

  describe("getOrCreateUserProfile", () => {
    it("returns existing profile when user doc exists", async () => {
      const existingProfile = {
        uid: "user-1",
        email: "test@example.com",
        displayName: "Test User",
        tier: "pro",
        stripeCustomerId: "cus_123",
      };
      // create() throws ALREADY_EXISTS, then get() returns existing profile
      mockCreate.mockRejectedValueOnce({ code: 6 });
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => existingProfile,
      });

      const result = await getOrCreateUserProfile("user-1", "test@example.com", "Test User");
      expect(result).toEqual(existingProfile);
    });

    it("creates new free-tier profile when user doc does not exist", async () => {
      const newProfile = {
        uid: "user-2",
        email: "new@example.com",
        displayName: "New User",
        tier: "free",
        createdAt: "SERVER_TIMESTAMP",
        updatedAt: "SERVER_TIMESTAMP",
      };

      // create() succeeds, then get() returns created doc
      mockCreate.mockResolvedValueOnce(undefined);
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => newProfile,
      });

      const result = await getOrCreateUserProfile("user-2", "new@example.com", "New User");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "user-2",
          email: "new@example.com",
          displayName: "New User",
          tier: "free",
        })
      );
      expect(result.tier).toBe("free");
      expect(result.uid).toBe("user-2");
    });
  });

  // ── getUserProfile ──────────────────────────────────────────────────

  describe("getUserProfile", () => {
    it("returns null when user does not exist", async () => {
      mockDocWithSubcollection.get.mockResolvedValueOnce({ exists: false });
      const result = await getUserProfile("nonexistent");
      expect(result).toBeNull();
    });

    it("returns profile when user exists", async () => {
      const profile = { uid: "user-1", tier: "pro", email: "a@b.com" };
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => profile,
      });
      const result = await getUserProfile("user-1");
      expect(result).toEqual(profile);
    });
  });

  // ── updateUserProfile ───────────────────────────────────────────────

  describe("updateUserProfile", () => {
    it("updates profile with server timestamp", async () => {
      await updateUserProfile("user-1", { tier: "pro", stripeSubscriptionId: "sub_123" });
      expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
        tier: "pro",
        stripeSubscriptionId: "sub_123",
        updatedAt: "SERVER_TIMESTAMP",
      });
    });
  });

  // ── getDailyUsage ──────────────────────────────────────────────────

  describe("getDailyUsage", () => {
    it("returns null when no usage doc exists for today", async () => {
      mockUsageDocRef.get.mockResolvedValueOnce({ exists: false });
      const result = await getDailyUsage("user-1");
      expect(result).toBeNull();
    });

    it("returns usage doc when it exists", async () => {
      const usage = { uid: "user-1", date: "2026-02-09", generationCount: 5 };
      mockUsageDocRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => usage,
      });
      const result = await getDailyUsage("user-1");
      expect(result).toEqual(usage);
    });
  });

  // ── incrementUsage ─────────────────────────────────────────────────

  describe("incrementUsage", () => {
    it("performs atomic increment and returns new count", async () => {
      mockUsageDocRef.set.mockResolvedValueOnce(undefined);
      mockUsageDocRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", date: "2026-02-09", generationCount: 3 }),
      });

      const count = await incrementUsage("user-1");
      expect(count).toBe(3);
      expect(mockUsageDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "user-1",
          generationCount: "INCREMENT_1",
        }),
        { merge: true }
      );
    });
  });

  // ── checkQuota ─────────────────────────────────────────────────────

  describe("checkQuota", () => {
    it("allows generation when under free-tier limit", async () => {
      // getUserProfile
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "free" }),
      });
      // getDailyUsage
      mockUsageDocRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 5 }),
      });

      const result = await checkQuota("user-1");
      expect(result).toEqual({
        allowed: true,
        current: 5,
        limit: 10,
        tier: "free",
      });
    });

    it("blocks generation when at free-tier limit", async () => {
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "free" }),
      });
      mockUsageDocRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 10 }),
      });

      const result = await checkQuota("user-1");
      expect(result).toEqual({
        allowed: false,
        current: 10,
        limit: 10,
        tier: "free",
      });
    });

    it("allows generation for pro user with high usage", async () => {
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "pro" }),
      });
      mockUsageDocRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 50 }),
      });

      const result = await checkQuota("user-1");
      expect(result).toEqual({
        allowed: true,
        current: 50,
        limit: 100,
        tier: "pro",
      });
    });

    it("defaults to free tier when user profile does not exist", async () => {
      mockDocWithSubcollection.get.mockResolvedValueOnce({ exists: false });
      mockUsageDocRef.get.mockResolvedValueOnce({ exists: false });

      const result = await checkQuota("new-user");
      expect(result).toEqual({
        allowed: true,
        current: 0,
        limit: 10,
        tier: "free",
      });
    });

    it("blocks pro user when at pro-tier limit", async () => {
      mockDocWithSubcollection.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", tier: "pro" }),
      });
      mockUsageDocRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ generationCount: 100 }),
      });

      const result = await checkQuota("user-1");
      expect(result).toEqual({
        allowed: false,
        current: 100,
        limit: 100,
        tier: "pro",
      });
    });
  });

  // ── findUidByCustomerId ────────────────────────────────────────────

  describe("findUidByCustomerId", () => {
    it("returns null when no user has the customer ID", async () => {
      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      });

      const result = await findUidByCustomerId("cus_nonexistent");
      expect(result).toBeNull();
    });

    it("returns uid when customer ID matches", async () => {
      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: "user-1", data: () => ({ uid: "user-1", stripeCustomerId: "cus_123" }) }],
          }),
        }),
      });

      const result = await findUidByCustomerId("cus_123");
      expect(result).toBe("user-1");
    });
  });
});
