
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProductCatalog } from './components/ProductCatalog';
import { CampaignList } from './components/CampaignList';
import { ContentGenerator } from './components/ContentGenerator';
import { CampaignDetail } from './components/CampaignDetail';
import { ComplianceRules } from './components/ComplianceRules';
import { Product, Campaign, GeneratedContent, ComplianceRule } from './types';
import { Loader2 } from 'lucide-react';
import * as storage from './services/storageService';
import { uploadContentImages, isBase64DataUrl } from './services/fileStorage';
import { AuthScreen } from './components/AuthScreen';
import { onAuthChange, logOut } from './services/authService';
import type { User } from 'firebase/auth';

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
    primaryProductId: 'prod-1',
    secondaryProductIds: [],
    context: 'Focus on children returning to school and managing asthma during sports.',
    attachments: ['guidelines_2024.pdf'],
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
    primaryProductId: 'prod-3',
    secondaryProductIds: ['prod-2'], // Cross sell
    context: 'Exam season stress relief and focus enhancement.',
    attachments: [],
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
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contentStore, setContentStore] = useState<GeneratedContent[]>([]);
  const [complianceRules, setComplianceRules] = useState<ComplianceRule[]>([]);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Load Data from Firestore on Mount (only when authenticated)
  useEffect(() => {
    if (!currentUser) {
      setIsLoadingData(false);
      return;
    }
    const loadData = async () => {
      try {
        const [dbProducts, dbCampaigns, dbContent, dbComplianceRules] = await Promise.all([
          storage.getAll<Product>('products'),
          storage.getAll<Campaign>('campaigns'),
          storage.getAll<GeneratedContent>('content'),
          storage.getAll<ComplianceRule>('complianceRules')
        ]);

        if (dbProducts.length === 0) {
          // Seed DB with mock data if empty
          await Promise.all(MOCK_PRODUCTS.map(p => storage.put('products', p)));
          setProducts(MOCK_PRODUCTS);
        } else {
          setProducts(dbProducts);
        }

        if (dbCampaigns.length === 0) {
          await Promise.all(MOCK_CAMPAIGNS.map(c => storage.put('campaigns', c)));
          setCampaigns(MOCK_CAMPAIGNS);
        } else {
          setCampaigns(dbCampaigns);
        }

        setComplianceRules(dbComplianceRules);

        if (dbContent.length === 0) {
          await Promise.all(INITIAL_CONTENT.map(c => storage.put('content', c)));
          setContentStore(INITIAL_CONTENT);
        } else {
          setContentStore(dbContent.filter(c => c.status !== 'generating'));
        }
      } catch (e) {
        console.error("Failed to load data from storage", e);
        // Fallback to mocks in memory if DB fails
        setProducts(MOCK_PRODUCTS);
        setCampaigns(MOCK_CAMPAIGNS);
        setContentStore(INITIAL_CONTENT);
        setComplianceRules([]);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [currentUser]);

  const handleComplianceRuleCreate = (rule: ComplianceRule) => {
    setComplianceRules(prev => [rule, ...prev]);
    storage.put('complianceRules', rule);
  };

  const handleComplianceRuleUpdate = (rule: ComplianceRule) => {
    setComplianceRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    storage.put('complianceRules', rule);
  };

  const handleComplianceRuleDelete = (ruleId: string) => {
    setComplianceRules(prev => prev.filter(r => r.id !== ruleId));
    storage.deleteItem('complianceRules', ruleId);
    // Clear complianceRuleId from any campaigns referencing the deleted rule
    setCampaigns(prev => prev.map(c => {
      if (c.complianceRuleId === ruleId) {
        const updated = { ...c, complianceRuleId: undefined };
        storage.put('campaigns', updated);
        return updated;
      }
      return c;
    }));
  };

  const handleCampaignCreated = (newCampaign: Campaign) => {
    setCampaigns(prev => [newCampaign, ...prev]);
    storage.put('campaigns', newCampaign);
  };

  const handleCampaignUpdate = (updatedCampaign: Campaign) => {
    setCampaigns(prev => prev.map(c => c.id === updatedCampaign.id ? updatedCampaign : c));
    storage.put('campaigns', updatedCampaign);
  };

  const handleContentStoreUpdate = (newContentList: GeneratedContent[]) => {
    // Use functional update to merge new items without overwriting in-flight upload results
    setContentStore(prev => {
      // Build lookup of previous state for preserving in-flight image data
      const prevMap = new Map(prev.map(c => [c.id, c]));
      // newContentList is the authoritative list — items not in it (e.g. placeholders) are removed
      return newContentList.map(item => {
        const existing = prevMap.get(item.id);
        if (existing) {
          return {
            ...item,
            imageUrl: item.imageUrl || existing.imageUrl,
            storyboard: item.storyboard?.map((s, i) => ({
              ...s,
              imageUrl: s.imageUrl || existing.storyboard?.[i]?.imageUrl || '',
            })) || existing.storyboard,
          };
        }
        return item;
      });
    });

    // Upload images to Storage, then persist with download URLs
    newContentList.forEach(item => {
      const hasBase64 = (item.imageUrl && isBase64DataUrl(item.imageUrl)) ||
        item.storyboard?.some(s => s.imageUrl && isBase64DataUrl(s.imageUrl));

      if (hasBase64) {
        uploadContentImages(item)
          .then(processed => {
            storage.put('content', processed);
            setContentStore(prev => prev.map(c => c.id === processed.id ? processed : c));
          })
          .catch(() => storage.put('content', item));
      } else {
        storage.put('content', item);
      }
    });
  };

  // Safe handler for single item update to avoid race conditions with closures
  const handleUpdateItem = (updatedItem: GeneratedContent) => {
    // Immediate: update React state with base64 so user sees image instantly
    setContentStore(prev => {
      const existing = prev.find(c => c.id === updatedItem.id);
      if (existing) {
        // Merge: take image/storyboard from the update, preserve position and other fields
        return prev.map(c => c.id === updatedItem.id ? {
          ...existing,
          imageUrl: updatedItem.imageUrl || existing.imageUrl,
          storyboard: updatedItem.storyboard || existing.storyboard,
        } : c);
      }
      return [...prev, updatedItem];
    });

    // Background: upload base64 to Storage, then persist with download URLs
    const hasBase64 = (updatedItem.imageUrl && isBase64DataUrl(updatedItem.imageUrl)) ||
      updatedItem.storyboard?.some(s => s.imageUrl && isBase64DataUrl(s.imageUrl));

    if (hasBase64) {
      uploadContentImages(updatedItem)
        .then(processed => {
          storage.put('content', processed);
          setContentStore(prev => prev.map(c => c.id === processed.id ? {
            ...c,
            imageUrl: processed.imageUrl || c.imageUrl,
            storyboard: processed.storyboard || c.storyboard,
          } : c));
        })
        .catch(() => storage.put('content', updatedItem));
    } else {
      storage.put('content', updatedItem);
    }
  };

  if (authLoading || isLoadingData) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="animate-spin mb-2" size={32} />
        <span>Loading MarketGen AI...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return (
    <Router>
      <Layout onSignOut={logOut} userName={currentUser.displayName || currentUser.email || 'User'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<CampaignList campaigns={campaigns} />} />
          <Route 
            path="/campaigns/new" 
            element={
              <ContentGenerator
                products={products}
                complianceRules={complianceRules}
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
                complianceRules={complianceRules}
                contentStore={contentStore}
                onUpdateContent={handleContentStoreUpdate}
                onUpdateCampaign={handleCampaignUpdate}
                onUpdateItem={handleUpdateItem}
              />
            } 
          />
          <Route path="/products" element={<ProductCatalog products={products} />} />
          <Route
            path="/compliance-rules"
            element={
              <ComplianceRules
                rules={complianceRules}
                onCreate={handleComplianceRuleCreate}
                onUpdate={handleComplianceRuleUpdate}
                onDelete={handleComplianceRuleDelete}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
