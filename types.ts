
// User Roles
export type UserRole = 'admin' | 'marketer' | 'reviewer';

// Products
export interface Product {
  id: string;
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

// Compliance Rules
export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  ruleText: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

// Campaigns
export type CampaignStatus = 'draft' | 'generating' | 'review' | 'approved' | 'published' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  
  // New Product Structure
  primaryProductId?: string;
  secondaryProductIds: string[];
  
  // New Context fields
  context: string;
  attachments: string[]; // List of filenames

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

// Video Storyboard Types
export interface Scene {
  sceneNumber: number;
  imagePrompt: string;
  voiceover: string;
  imageUrl?: string;
}

// Content Generation
export interface GeneratedContent {
  id: string;
  campaignId: string;
  channel: string; // e.g., 'Twitter', 'LinkedIn', 'Email', 'Video Storyboard'
  audience: string;
  text: string;
  imageUrl?: string;
  complianceScore: number;
  status: 'draft' | 'approved' | 'rejected' | 'generating';
  riskLevel: 'low' | 'medium' | 'high';
  // Canvas specific properties
  x: number;
  y: number;
  width?: number;
  height?: number;
  connections?: string[]; // IDs of connected cards
  // Video specific properties
  storyboard?: Scene[];
  videoUrl?: string;
  videoStatus?: 'idle' | 'generating' | 'completed' | 'failed';
}

// Analytics
export interface DashboardMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  generatedAssets: number;
  avgComplianceScore: number;
}

export interface ChartData {
  name: string;
  value: number;
}
