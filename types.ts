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

// Campaigns
export type CampaignStatus = 'draft' | 'generating' | 'review' | 'approved' | 'published' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  productId: string;
  targetAudiences: string[];
  channels: string[];
  languages: string[];
  keyMessage: string;
  startDate: string;
  budget: number;
  progress: number;
  complianceScore?: number;
}

// Content Generation
export interface GeneratedContent {
  id: string;
  campaignId: string;
  channel: string; // e.g., 'Twitter', 'LinkedIn', 'Email'
  audience: string;
  text: string;
  imageUrl?: string;
  complianceScore: number;
  status: 'draft' | 'approved' | 'rejected';
  riskLevel: 'low' | 'medium' | 'high';
  // Canvas specific properties
  x: number;
  y: number;
  width?: number;
  height?: number;
  connections?: string[]; // IDs of connected cards
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
