import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProductCatalog } from './components/ProductCatalog';
import { CampaignList } from './components/CampaignList';
import { ContentGenerator } from './components/ContentGenerator';
import { CampaignDetail } from './components/CampaignDetail';
import { Product, Campaign, GeneratedContent } from './types';

// Seed Data
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Respirol',
    sku: 'MC-2004',
    brand: 'MediCure',
    category: 'Pharmaceuticals',
    description: 'An inhaler for the long-term management of asthma and COPD.',
    price: 29.99,
    features: ['12-hour relief', 'Non-drowsy', 'Easy-swallow coating'],
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400',
    complianceFiles: ['fda-approval.pdf'],
    marketingTags: ['pain relief', 'seniors', 'active lifestyle']
  },
  {
    id: 'prod-2',
    name: 'VitaGlow Daily Serum',
    sku: 'VG-101',
    brand: 'GlowLabs',
    category: 'Cosmetics',
    description: 'Vitamin C enriched serum for brighter, smoother skin tone in 2 weeks.',
    price: 54.50,
    features: ['Vitamin C + E', 'Cruelty-free', 'Dermatologist tested'],
    imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=400',
    complianceFiles: [],
    marketingTags: ['beauty', 'skincare', 'organic']
  },
  {
    id: 'prod-3',
    name: 'NeuroFocus Pro',
    sku: 'NF-990',
    brand: 'BrainGen',
    category: 'Supplements',
    description: 'Nootropic supplement designed to enhance cognitive function and memory retention.',
    price: 45.00,
    features: ['Caffeine-free', 'Natural ingredients', 'Clinically studied'],
    imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&q=80&w=400',
    complianceFiles: ['supplement-facts.pdf'],
    marketingTags: ['focus', 'students', 'professionals']
  }
];

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c-1',
    name: 'Back to School Respirol Campaign',
    description: 'Launch campaign for Respirol',
    status: 'published',
    productId: 'prod-1',
    targetAudiences: ['Healthcare Professionals', 'Parents'],
    channels: ['LinkedIn', 'Instagram', 'Twitter'],
    languages: ['en'],
    keyMessage: 'An inhaler for the long-term management of asthma and COPD.',
    startDate: '2024-07-01',
    budget: 5000,
    progress: 65
  },
  {
    id: 'c-2',
    name: 'NeuroFocus Student Push',
    description: 'Student targeting for NeuroFocus',
    status: 'draft',
    productId: 'prod-3',
    targetAudiences: ['Students'],
    channels: ['TikTok', 'Twitter'],
    languages: ['en'],
    keyMessage: 'Study smarter, not harder.',
    startDate: '2024-08-15',
    budget: 2000,
    progress: 10
  }
];

// Mock Content for the existing campaigns
const INITIAL_CONTENT: GeneratedContent[] = [
  {
    id: 'g-1',
    campaignId: 'c-1',
    channel: 'LinkedIn',
    audience: 'Healthcare Professionals',
    text: 'Respirol offers a dual-action approach for long-term asthma and COPD management, combining an ICS and LABA to reduce inflammation and open airways.',
    complianceScore: 100,
    riskLevel: 'low',
    status: 'approved',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800',
    x: 100,
    y: 100,
    width: 320,
    connections: ['g-2']
  },
  {
    id: 'g-2',
    campaignId: 'c-1',
    channel: 'Twitter',
    audience: 'Parents',
    text: 'Help your child breathe easier this school year. Respirol helps manage asthma symptoms so they can focus on learning, not wheezing. #AsthmaAwareness',
    complianceScore: 92,
    riskLevel: 'low',
    status: 'draft',
    imageUrl: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=800',
    x: 500,
    y: 100,
    width: 320
  },
  {
    id: 'g-3',
    campaignId: 'c-1',
    channel: 'Instagram',
    audience: 'Healthcare Professionals',
    text: 'Deep dive into the MoA of Respirol. Dual-action ICS/LABA for long-term respiratory management. Link in bio for clinical data.',
    complianceScore: 98,
    riskLevel: 'low',
    status: 'draft',
    imageUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&q=80&w=800',
    x: 100,
    y: 500,
    width: 320,
    connections: ['g-1']
  }
];

function App() {
  const [products] = useState<Product[]>(MOCK_PRODUCTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [contentStore, setContentStore] = useState<GeneratedContent[]>(INITIAL_CONTENT);

  const handleCampaignCreated = (newCampaign: Campaign, generatedContent: GeneratedContent[]) => {
    setCampaigns([newCampaign, ...campaigns]);
    
    // Assign initial positions to generated content for the canvas
    const positionedContent = generatedContent.map((c, i) => ({
      ...c,
      x: 50 + (i % 3) * 350, // Simple grid layout logic
      y: 50 + Math.floor(i / 3) * 400,
      width: 320
    }));

    setContentStore([...positionedContent, ...contentStore]);
  };

  const handleCampaignUpdate = (updatedCampaign: Campaign) => {
    setCampaigns(prev => prev.map(c => c.id === updatedCampaign.id ? updatedCampaign : c));
  };

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<CampaignList campaigns={campaigns} />} />
          <Route 
            path="/campaigns/new" 
            element={
              <ContentGenerator 
                products={products} 
                onComplete={handleCampaignCreated} 
              />
            } 
          />
          <Route 
            path="/campaigns/:id" 
            element={
              <CampaignDetail 
                campaigns={campaigns}
                products={products}
                contentStore={contentStore}
                onUpdateContent={setContentStore}
                onUpdateCampaign={handleCampaignUpdate}
              />
            } 
          />
          <Route path="/products" element={<ProductCatalog products={products} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
