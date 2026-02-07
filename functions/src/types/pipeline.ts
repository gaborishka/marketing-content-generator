// Pipeline types for the backend agent orchestration system.

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
