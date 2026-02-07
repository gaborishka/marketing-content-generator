import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Firestore mocks ─────────────────────────────────────────────────────────

const mockGetCampaign = vi.fn();
const mockGetProduct = vi.fn();
const mockGetProducts = vi.fn();
const mockGetComplianceRule = vi.fn();
const mockGetContentForCampaign = vi.fn();

vi.mock("../utils/firestore", () => ({
  getCampaign: (...args: any[]) => mockGetCampaign(...args),
  getProduct: (...args: any[]) => mockGetProduct(...args),
  getProducts: (...args: any[]) => mockGetProducts(...args),
  getComplianceRule: (...args: any[]) => mockGetComplianceRule(...args),
  getContentForCampaign: (...args: any[]) => mockGetContentForCampaign(...args),
}));

import { runPlanner } from "../agents/planner";

// ── Fixtures ────────────────────────────────────────────────────────────────

const campaignDoc = {
  id: "camp-1",
  userId: "user-1",
  name: "Summer Sale",
  description: "Drive summer sales",
  status: "draft",
  primaryProductId: "prod-1",
  secondaryProductIds: ["prod-2"],
  context: "Annual summer promotion",
  attachments: [],
  targetAudiences: ["Gen Z", "Millennials"],
  channels: ["Twitter", "Email Newsletter"],
  languages: ["en"],
  keyMessage: "50% off everything",
  startDate: "2025-06-01",
  budget: 5000,
  progress: 0,
  complianceRuleId: "rule-1",
};

const productDoc = {
  id: "prod-1",
  userId: "user-1",
  name: "Widget X",
  sku: "WX-001",
  brand: "Acme",
  category: "Widgets",
  description: "A great widget",
  price: 29.99,
  features: ["Fast", "Durable"],
  imageUrl: "",
  complianceFiles: [],
  marketingTags: ["premium", "best-seller"],
};

const secondaryProductDoc = {
  id: "prod-2",
  userId: "user-1",
  name: "Gadget Y",
  sku: "GY-001",
  brand: "Acme",
  category: "Gadgets",
  description: "A nice gadget",
  price: 19.99,
  features: [],
  imageUrl: "",
  complianceFiles: [],
  marketingTags: [],
};

const complianceRuleDoc = {
  id: "rule-1",
  userId: "user-1",
  name: "FTC Advertising",
  description: "FTC compliance rules",
  ruleText: "No unsubstantiated claims",
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

describe("runPlanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCampaign.mockResolvedValue(campaignDoc);
    mockGetProduct.mockResolvedValue(productDoc);
    mockGetProducts.mockResolvedValue([secondaryProductDoc]);
    mockGetComplianceRule.mockResolvedValue(complianceRuleDoc);
    mockGetContentForCampaign.mockResolvedValue([]);
  });

  it("returns success with full PlannerContext", async () => {
    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.campaign.name).toBe("Summer Sale");
    expect(result.data!.campaign.keyMessage).toBe("50% off everything");
    expect(result.data!.primaryProduct?.name).toBe("Widget X");
    expect(result.data!.primaryProduct?.features).toEqual(["Fast", "Durable"]);
    expect(result.data!.secondaryProducts).toEqual([{ name: "Gadget Y", brand: "Acme" }]);
    expect(result.data!.complianceRule?.name).toBe("FTC Advertising");
    expect(result.data!.combinations).toHaveLength(4); // 2 channels x 2 audiences
    expect(result.data!.existingCombinations).toEqual([]);
  });

  it("returns error when campaign not found", async () => {
    mockGetCampaign.mockResolvedValue(null);
    const result = await runPlanner("nonexistent", "user-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error when campaign belongs to another user", async () => {
    const result = await runPlanner("camp-1", "other-user");

    expect(result.success).toBe(false);
    expect(result.error).toContain("does not belong");
  });

  it("handles brand campaign without primary product", async () => {
    mockGetCampaign.mockResolvedValue({ ...campaignDoc, primaryProductId: undefined });
    mockGetProduct.mockResolvedValue(null);

    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(true);
    expect(result.data!.primaryProduct).toBeUndefined();
  });

  it("handles campaign without compliance rule", async () => {
    mockGetCampaign.mockResolvedValue({ ...campaignDoc, complianceRuleId: undefined });

    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(true);
    expect(result.data!.complianceRule).toBeUndefined();
  });

  it("deduplicates existing combinations", async () => {
    mockGetContentForCampaign.mockResolvedValue([
      { channel: "Twitter", audience: "Gen Z" },
    ]);

    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(true);
    // 4 total - 1 existing = 3 new combinations
    expect(result.data!.combinations).toHaveLength(3);
    expect(result.data!.combinations).not.toContainEqual({
      channel: "Twitter",
      audience: "Gen Z",
    });
    expect(result.data!.existingCombinations).toEqual([
      { channel: "Twitter", audience: "Gen Z" },
    ]);
  });

  it("caps combinations at 6", async () => {
    // 4 channels x 3 audiences = 12 combos, should cap at 6
    mockGetCampaign.mockResolvedValue({
      ...campaignDoc,
      channels: ["Twitter", "Email", "LinkedIn", "Instagram"],
      targetAudiences: ["Gen Z", "Millennials", "Boomers"],
    });

    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(true);
    expect(result.data!.combinations).toHaveLength(6);
  });

  it("returns error when all combinations already exist", async () => {
    mockGetContentForCampaign.mockResolvedValue([
      { channel: "Twitter", audience: "Gen Z" },
      { channel: "Twitter", audience: "Millennials" },
      { channel: "Email Newsletter", audience: "Gen Z" },
      { channel: "Email Newsletter", audience: "Millennials" },
    ]);

    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No new channel/audience combinations");
  });

  it("handles firestore errors gracefully", async () => {
    mockGetCampaign.mockRejectedValue(new Error("Firestore unavailable"));

    const result = await runPlanner("camp-1", "user-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Planner failed");
    expect(result.error).toContain("Firestore unavailable");
  });
});
