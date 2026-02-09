import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stripe mocks ──────────────────────────────────────────────────────────

const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: { create: mockCustomersCreate },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
      webhooks: { constructEvent: mockWebhooksConstructEvent },
    })),
  };
});

// ── Firestore mocks ────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockUpdateFn = vi.fn().mockResolvedValue(undefined);
const mockWhere = vi.fn();

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
  where: mockWhere,
};

const mockStripeEventsDocRef: any = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
};

const mockStripeEventsCollectionRef: any = {
  doc: vi.fn().mockReturnValue(mockStripeEventsDocRef),
};

const mockFirestoreInstance = {
  collection: vi.fn((name: string) => {
    if (name === "users") return mockUsersCollectionRef;
    if (name === "stripeEvents") return mockStripeEventsCollectionRef;
    return { doc: vi.fn().mockReturnValue({ get: mockGet, set: mockSet }) };
  }),
};

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockFirestoreInstance,
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    increment: (n: number) => `INCREMENT_${n}`,
    delete: () => "FIELD_DELETE",
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => `mock-${name}` }),
}));

import {
  getOrCreateUserProfile,
  getUserProfile,
  updateUserProfile,
  findUidByCustomerId,
} from "../utils/billing";
import { UserTier } from "../types/pipeline";

// ── Helper to replicate createCheckoutSession logic ───────────────────────

async function createCheckoutSessionLogic(
  uid: string,
  email: string,
  displayName: string,
  interval?: "monthly" | "yearly"
) {
  const profile = await getOrCreateUserProfile(uid, email, displayName);

  let customerId = profile.stripeCustomerId;
  if (!customerId) {
    const customer = await mockCustomersCreate({
      email,
      name: displayName,
      metadata: { firebaseUid: uid },
    });
    customerId = customer.id;
    await updateUserProfile(uid, { stripeCustomerId: customerId });
  }

  const priceId =
    interval === "yearly" ? "price_pro_yearly_290" : "price_pro_monthly_29";

  const session = await mockCheckoutSessionsCreate({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { firebaseUid: uid },
  });

  return { sessionId: session.id, url: session.url };
}

// ── Helper to replicate createPortalSession logic ─────────────────────────

async function createPortalSessionLogic(uid: string) {
  const profile = await getUserProfile(uid);

  if (!profile?.stripeCustomerId) {
    throw new Error("No billing account found. Please subscribe first.");
  }

  const session = await mockBillingPortalSessionsCreate({
    customer: profile.stripeCustomerId,
  });

  return { url: session.url };
}

// ── Helper to replicate stripeWebhook logic ───────────────────────────────

async function processWebhookEvent(eventType: string, eventData: any, eventId: string) {
  // Check idempotency
  const eventDoc = await mockStripeEventsDocRef.get();
  if (eventDoc.exists) {
    return { received: true, duplicate: true };
  }

  // Mark as processing
  await mockStripeEventsDocRef.set({
    type: eventType,
    processedAt: "SERVER_TIMESTAMP",
  });

  switch (eventType) {
    case "checkout.session.completed": {
      const customerId = eventData.customer;
      const subscriptionId = eventData.subscription;

      const uid = await findUidByCustomerId(customerId);
      if (uid && subscriptionId) {
        await updateUserProfile(uid, {
          tier: "pro" as UserTier,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionStatus: "active",
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const customerId = eventData.customer;
      const uid = await findUidByCustomerId(customerId);

      if (uid) {
        const status = eventData.status;
        const tier: UserTier = (status === "active" || status === "trialing") ? "pro" : "free";
        await updateUserProfile(uid, {
          tier,
          stripeSubscriptionId: eventData.id,
          stripeSubscriptionStatus: status,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const customerId = eventData.customer;
      const uid = await findUidByCustomerId(customerId);

      if (uid) {
        // Match production code: use direct Firestore update with FieldValue.delete()
        const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
        const userRef = getFirestore().collection("users").doc(uid);
        await userRef.update({
          tier: "free" as UserTier,
          stripeSubscriptionId: FieldValue.delete(),
          stripeSubscriptionStatus: "canceled",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      break;
    }
  }

  return { received: true };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new Stripe customer when user has no customerId", async () => {
    // getOrCreateUserProfile: existing user without stripeCustomerId
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ uid: "user-1", email: "a@b.com", displayName: "Test", tier: "free" }),
      });

    mockCustomersCreate.mockResolvedValueOnce({ id: "cus_new_123" });
    mockCheckoutSessionsCreate.mockResolvedValueOnce({
      id: "cs_test_session",
      url: "https://checkout.stripe.com/pay/cs_test_session",
    });

    const result = await createCheckoutSessionLogic("user-1", "a@b.com", "Test");

    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "a@b.com",
      name: "Test",
      metadata: { firebaseUid: "user-1" },
    });
    expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
      stripeCustomerId: "cus_new_123",
      updatedAt: "SERVER_TIMESTAMP",
    });
    expect(result.sessionId).toBe("cs_test_session");
    expect(result.url).toBe("https://checkout.stripe.com/pay/cs_test_session");
  });

  it("reuses existing Stripe customer", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        uid: "user-1",
        email: "a@b.com",
        displayName: "Test",
        tier: "free",
        stripeCustomerId: "cus_existing",
      }),
    });

    mockCheckoutSessionsCreate.mockResolvedValueOnce({
      id: "cs_test_2",
      url: "https://checkout.stripe.com/pay/cs_test_2",
    });

    const result = await createCheckoutSessionLogic("user-1", "a@b.com", "Test");

    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
    expect(result.sessionId).toBe("cs_test_2");
  });

  it("uses monthly price by default", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        uid: "user-1",
        email: "a@b.com",
        tier: "free",
        stripeCustomerId: "cus_1",
      }),
    });

    mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_m", url: "url" });

    await createCheckoutSessionLogic("user-1", "a@b.com", "Test");

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_pro_monthly_29", quantity: 1 }],
      })
    );
  });

  it("uses yearly price when interval is yearly", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        uid: "user-1",
        email: "a@b.com",
        tier: "free",
        stripeCustomerId: "cus_1",
      }),
    });

    mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_y", url: "url" });

    await createCheckoutSessionLogic("user-1", "a@b.com", "Test", "yearly");

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_pro_yearly_290", quantity: 1 }],
      })
    );
  });
});

describe("createPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates portal session for user with stripeCustomerId", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        uid: "user-1",
        tier: "pro",
        stripeCustomerId: "cus_portal",
      }),
    });

    mockBillingPortalSessionsCreate.mockResolvedValueOnce({
      url: "https://billing.stripe.com/session/portal_123",
    });

    const result = await createPortalSessionLogic("user-1");

    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_portal",
    });
    expect(result.url).toBe("https://billing.stripe.com/session/portal_123");
  });

  it("throws when user has no stripeCustomerId", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: "user-1", tier: "free" }),
    });

    await expect(createPortalSessionLogic("user-1")).rejects.toThrow(
      "No billing account found"
    );
  });

  it("throws when user profile does not exist", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    await expect(createPortalSessionLogic("unknown")).rejects.toThrow(
      "No billing account found"
    );
  });
});

describe("stripeWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no user found for customer ID
    mockWhere.mockReturnValue({
      limit: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
    });
  });

  it("skips duplicate events (idempotency)", async () => {
    mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: true });

    const result = await processWebhookEvent(
      "checkout.session.completed",
      { customer: "cus_1", subscription: "sub_1" },
      "evt_dup"
    );

    expect(result).toEqual({ received: true, duplicate: true });
    expect(mockStripeEventsDocRef.set).not.toHaveBeenCalled();
  });

  it("records event for idempotency before processing", async () => {
    mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

    await processWebhookEvent(
      "some.unhandled.event",
      {},
      "evt_new"
    );

    expect(mockStripeEventsDocRef.set).toHaveBeenCalledWith({
      type: "some.unhandled.event",
      processedAt: "SERVER_TIMESTAMP",
    });
  });

  describe("checkout.session.completed", () => {
    it("upgrades user to pro tier", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      // findUidByCustomerId
      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: "user-1", data: () => ({ uid: "user-1", stripeCustomerId: "cus_checkout" }) }],
          }),
        }),
      });

      await processWebhookEvent(
        "checkout.session.completed",
        { customer: "cus_checkout", subscription: "sub_new_123" },
        "evt_checkout"
      );

      expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
        tier: "pro",
        stripeSubscriptionId: "sub_new_123",
        stripeSubscriptionStatus: "active",
        updatedAt: "SERVER_TIMESTAMP",
      });
    });

    it("does nothing when user not found for customerId", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      await processWebhookEvent(
        "checkout.session.completed",
        { customer: "cus_unknown", subscription: "sub_1" },
        "evt_orphan"
      );

      // update should not be called (only the idempotency set)
      expect(mockDocWithSubcollection.update).not.toHaveBeenCalled();
    });
  });

  describe("customer.subscription.updated", () => {
    it("keeps pro tier when subscription is active", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: "user-1", data: () => ({ uid: "user-1", stripeCustomerId: "cus_sub" }) }],
          }),
        }),
      });

      await processWebhookEvent(
        "customer.subscription.updated",
        { id: "sub_123", customer: "cus_sub", status: "active" },
        "evt_sub_active"
      );

      expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
        tier: "pro",
        stripeSubscriptionId: "sub_123",
        stripeSubscriptionStatus: "active",
        updatedAt: "SERVER_TIMESTAMP",
      });
    });

    it("downgrades to free when subscription is past_due", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: "user-1", data: () => ({ uid: "user-1", stripeCustomerId: "cus_pastdue" }) }],
          }),
        }),
      });

      await processWebhookEvent(
        "customer.subscription.updated",
        { id: "sub_456", customer: "cus_pastdue", status: "past_due" },
        "evt_past_due"
      );

      expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
        tier: "free",
        stripeSubscriptionId: "sub_456",
        stripeSubscriptionStatus: "past_due",
        updatedAt: "SERVER_TIMESTAMP",
      });
    });

    it("downgrades to free when subscription is canceled", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: "user-1", data: () => ({ uid: "user-1", stripeCustomerId: "cus_cancel" }) }],
          }),
        }),
      });

      await processWebhookEvent(
        "customer.subscription.updated",
        { id: "sub_789", customer: "cus_cancel", status: "canceled" },
        "evt_canceled"
      );

      expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
        tier: "free",
        stripeSubscriptionId: "sub_789",
        stripeSubscriptionStatus: "canceled",
        updatedAt: "SERVER_TIMESTAMP",
      });
    });
  });

  describe("customer.subscription.deleted", () => {
    it("downgrades to free and clears subscription ID", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      mockWhere.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [{ id: "user-1", data: () => ({ uid: "user-1", stripeCustomerId: "cus_del" }) }],
          }),
        }),
      });

      await processWebhookEvent(
        "customer.subscription.deleted",
        { id: "sub_dead", customer: "cus_del" },
        "evt_deleted"
      );

      expect(mockDocWithSubcollection.update).toHaveBeenCalledWith({
        tier: "free",
        stripeSubscriptionId: "FIELD_DELETE",
        stripeSubscriptionStatus: "canceled",
        updatedAt: "SERVER_TIMESTAMP",
      });
    });
  });

  describe("unhandled events", () => {
    it("acknowledges unhandled event types without error", async () => {
      mockStripeEventsDocRef.get.mockResolvedValueOnce({ exists: false });

      const result = await processWebhookEvent(
        "invoice.payment_succeeded",
        { customer: "cus_1" },
        "evt_invoice"
      );

      expect(result).toEqual({ received: true });
      // Should not try to update any user profile
      expect(mockDocWithSubcollection.update).not.toHaveBeenCalled();
    });
  });
});
