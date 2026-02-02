import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProductCatalog } from './components/ProductCatalog';
import { CampaignList } from './components/CampaignList';
import { ContentGenerator } from './components/ContentGenerator';
import { CampaignDetail } from './components/CampaignDetail';
import { Product, Campaign, GeneratedContent } from './types';
import { Sparkles, KeyRound, ExternalLink } from 'lucide-react';

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
  const [hasApiKey, setHasApiKey] = useState(false);
  const [checkingKey, setCheckingKey] = useState(true);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
          setHasApiKey(true);
        }
      } catch (e) {
        console.error("Error checking API key:", e);
      } finally {
        setCheckingKey(false);
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    if ((window as any).aistudio) {
      try {
        await (window as any).aistudio.openSelectKey();
        // Assuming success if the dialog closes without throwing, 
        // mitigating race condition by setting true immediately as per instructions
        setHasApiKey(true);
      } catch (e) {
        console.error("Key selection failed", e);
        // If "Requested entity was not found", reset state
        if (e instanceof Error && e.message.includes("Requested entity was not found")) {
          setHasApiKey(false);
          alert("Key selection failed. Please try again.");
        }
      }
    } else {
      alert("AI Studio environment not detected.");
    }
  };

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

  if (checkingKey) {
    return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  }

  // Key Selection Screen
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 text-blue-600">
            <Sparkles size={32} />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to MarketGen AI</h1>
          <p className="text-slate-500 mb-8">
            To generate high-quality marketing assets and images using the latest Gemini Pro models, please connect your Google AI Studio account.
          </p>

          <button 
            onClick={handleConnectKey}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center space-x-2 transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-500/20 mb-6"
          >
            <KeyRound size={20} />
            <span>Connect API Key</span>
          </button>

          <div className="pt-6 border-t border-slate-100">
             <a 
               href="https://ai.google.dev/gemini-api/docs/billing" 
               target="_blank" 
               rel="noreferrer"
               className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 transition-colors"
             >
               <span>View Billing Documentation</span>
               <ExternalLink size={14} className="ml-1" />
             </a>
             <p className="text-xs text-slate-400 mt-2">
               A paid project is required for the full enterprise experience.
             </p>
          </div>
        </div>
      </div>
    );
  }

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