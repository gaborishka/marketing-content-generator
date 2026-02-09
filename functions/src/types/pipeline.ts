// Pipeline types for the backend agent orchestration system.

// ── User & Billing ────────────────────────────────────────────────────────

export type UserTier = "free" | "pro";

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  tier: UserTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface DailyUsageDoc {
  uid: string;
  date: string; // YYYY-MM-DD
  generationCount: number;
  updatedAt: FirebaseFirestore.Timestamp;
}

export const TIER_LIMITS: Record<UserTier, number> = {
  free: 10,
  pro: 100,
};

// ── Job Status ─────────────────────────────────────────────────────────────

export type JobPhase =
  | "pending"
  | "planning"
  | "generating"
  | "compliance_check"
  | "retrying"
  | "generating_images"
  | "completed"
  | "failed";

export interface JobStatus {
  userId: string;
  campaignId: string;
  status: JobPhase;
  progress: number; // 0-100
  phase: string; // Human-readable: "Gathering context...", "Generating copy...", etc.
  contentIds: string[];
  itemsCompleted: number;
  itemsTotal: number;
  retryCount: number;
  error?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
}

// ── Planner Context ────────────────────────────────────────────────────────

export interface PlannerContext {
  campaign: {
    name: string;
    description: string;
    keyMessage: string;
    context: string;
  };
  primaryProduct?: {
    name: string;
    brand: string;
    description: string;
    features: string[];
    marketingTags: string[];
  };
  secondaryProducts: { name: string; brand: string }[];
  complianceRule?: { name: string; ruleText: string };
  combinations: { channel: string; audience: string }[];
  existingCombinations: { channel: string; audience: string }[];
}

// ── Compliance ─────────────────────────────────────────────────────────────

export interface ComplianceResult {
  contentId: string;
  score: number; // 0-100
  pass: boolean; // score >= 80
  feedback: string;
  violations: string[];
  suggestedFix?: string;
}

export interface ComplianceFeedback {
  contentId: string;
  score: number;
  violations: string[];
  suggestedFix?: string;
}

// ── Agent Result ───────────────────────────────────────────────────────────

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Content Doc (Firestore shape with pipeline extensions) ─────────────────

export interface ContentDoc {
  id: string;
  campaignId: string;
  userId: string;
  channel: string;
  audience: string;
  text: string;
  imageUrl: string;
  complianceScore: number;
  status: "draft" | "approved" | "rejected" | "generating";
  riskLevel: "low" | "medium" | "high";
  x: number;
  y: number;
  width?: number;
  height?: number;
  connections?: string[];
  storyboard?: SceneDoc[];
  videoUrl?: string;
  videoStatus?: "idle" | "generating" | "completed" | "failed";
  generationJobId?: string;
  complianceDetails?: {
    score: number;
    violations: string[];
    suggestions: string[];
    suggestedFix?: string;
    retryAttempt: number;
  };
}

export interface SceneDoc {
  sceneNumber: number;
  imagePrompt: string;
  voiceover: string;
  imageUrl?: string;
}

// ── Firestore document shapes for reads ────────────────────────────────────

export interface CampaignDoc {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: string;
  primaryProductId?: string;
  secondaryProductIds: string[];
  context: string;
  attachments: string[];
  targetAudiences: string[];
  channels: string[];
  languages: string[];
  keyMessage: string;
  startDate: string;
  budget: number;
  progress: number;
  complianceScore?: number;
  complianceRuleId?: string;
}

export type ProductSource = "internal" | "shopify";

export interface ProductDoc {
  id: string;
  userId: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  features: string[];
  imageUrl: string;
  complianceFiles: string[];
  marketingTags: string[];
  source: ProductSource;
  shopifyProductId?: string;
  shopifyHandle?: string;
  lastSyncedAt?: string;
}

export interface ShopifyConnectionDoc {
  userId: string;
  shopDomain: string;
  accessToken: string;
  scope: string;
  installedAt: string;
  shopName?: string;
}

export interface ComplianceRuleDoc {
  id: string;
  userId: string;
  name: string;
  description: string;
  ruleText: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Image Aspect Ratios ──────────────────────────────────────────────────────

export type ImageAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

const CHANNEL_ASPECT_RATIOS: Record<string, ImageAspectRatio> = {
  "Instagram Post": "1:1",
  "Instagram Story": "9:16",
  "Instagram Reel": "9:16",
  "Instagram Carousel": "1:1",
  "Tweet": "16:9",
  "Twitter Thread": "16:9",
  "LinkedIn Post": "4:3",
  "LinkedIn Article": "16:9",
  "Email Newsletter": "16:9",
  "Web Banner": "16:9",
  "Blog Post": "16:9",
  "Facebook Post": "4:3",
  "Facebook Ad": "1:1",
  "Pinterest Pin": "3:4",
  "TikTok Video": "9:16",
  "YouTube Video": "16:9",
  "YouTube Short": "9:16",
  "Video Storyboard": "16:9",
};

export function getAspectRatioForChannel(channel: string): ImageAspectRatio {
  return CHANNEL_ASPECT_RATIOS[channel] ?? "16:9";
}
