
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Download,
  Send,
  Filter,
  History,
  RefreshCw,
  Loader2,
  Sparkles,
  FileText,
  Package,
  Info,
  ShieldCheck,
  Users,
  GraduationCap,
  Heart,
  Globe,
  Baby,
  Pill,
  Building2,
  Stethoscope,
  UserCircle,
  Mail,
  Linkedin,
  Twitter,
  Instagram,
  Globe2,
  Video,
  Facebook,
  Youtube,
  Image,
  Tv,
  Pencil,
  X,
  Check,
  Paperclip,
  Lightbulb,
  MousePointerClick,
  ChevronRight
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { Campaign, Product, GeneratedContent, ComplianceRule, CHANNEL_FORMATS, getParentChannel } from '../types';
import { CanvasBoard, INITIAL_CANVAS_SCALE } from './CanvasBoard';
import { startGeneration, subscribeToJob, subscribeToContent, JobStatus } from '../services/orchestrationService';
import { VideoStoryboardModal } from './VideoStoryboardModal';
import { ContentDetailModal } from './ContentDetailModal';
import { ContentCreationModal } from './ContentCreationModal';
import { FilterPanel, ContentFilters, INITIAL_FILTERS } from './FilterPanel';

interface CampaignDetailProps {
  campaigns: Campaign[];
  products: Product[];
  complianceRules: ComplianceRule[];
  contentStore: GeneratedContent[];
  onUpdateContent: (content: GeneratedContent[]) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onUpdateItem: (content: GeneratedContent) => void;
}

interface ChipOption {
  label: string;
  icon: React.ElementType;
  selectedClasses: string;
  selectedIconClass: string;
}

const AVAILABLE_AUDIENCES: ChipOption[] = [
  { label: 'Healthcare Professionals', icon: Stethoscope, selectedClasses: 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200', selectedIconClass: 'text-blue-500' },
  { label: 'Patients', icon: Heart, selectedClasses: 'bg-rose-50 border-rose-300 text-rose-700 ring-1 ring-rose-200', selectedIconClass: 'text-rose-500' },
  { label: 'Caregivers', icon: Users, selectedClasses: 'bg-amber-50 border-amber-300 text-amber-700 ring-1 ring-amber-200', selectedIconClass: 'text-amber-500' },
  { label: 'General Public', icon: Globe, selectedClasses: 'bg-slate-100 border-slate-400 text-slate-700 ring-1 ring-slate-300', selectedIconClass: 'text-slate-600' },
  { label: 'Students', icon: GraduationCap, selectedClasses: 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-200', selectedIconClass: 'text-indigo-500' },
  { label: 'Seniors', icon: UserCircle, selectedClasses: 'bg-teal-50 border-teal-300 text-teal-700 ring-1 ring-teal-200', selectedIconClass: 'text-teal-500' },
  { label: 'Parents', icon: Baby, selectedClasses: 'bg-pink-50 border-pink-300 text-pink-700 ring-1 ring-pink-200', selectedIconClass: 'text-pink-500' },
  { label: 'Pharmacists', icon: Pill, selectedClasses: 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-1 ring-emerald-200', selectedIconClass: 'text-emerald-500' },
  { label: 'Hospital Administrators', icon: Building2, selectedClasses: 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200', selectedIconClass: 'text-violet-500' },
];

const AVAILABLE_CHANNELS: ChipOption[] = [
  { label: 'Email', icon: Mail, selectedClasses: 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200', selectedIconClass: 'text-blue-500' },
  { label: 'LinkedIn', icon: Linkedin, selectedClasses: 'bg-sky-50 border-sky-300 text-sky-700 ring-1 ring-sky-200', selectedIconClass: 'text-sky-500' },
  { label: 'Twitter', icon: Twitter, selectedClasses: 'bg-cyan-50 border-cyan-300 text-cyan-700 ring-1 ring-cyan-200', selectedIconClass: 'text-cyan-500' },
  { label: 'Instagram', icon: Instagram, selectedClasses: 'bg-pink-50 border-pink-300 text-pink-700 ring-1 ring-pink-200', selectedIconClass: 'text-pink-500' },
  { label: 'Web', icon: Globe2, selectedClasses: 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-1 ring-emerald-200', selectedIconClass: 'text-emerald-500' },
  { label: 'TikTok', icon: Tv, selectedClasses: 'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-700 ring-1 ring-fuchsia-200', selectedIconClass: 'text-fuchsia-500' },
  { label: 'Facebook', icon: Facebook, selectedClasses: 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-200', selectedIconClass: 'text-indigo-500' },
  { label: 'YouTube', icon: Youtube, selectedClasses: 'bg-red-50 border-red-300 text-red-700 ring-1 ring-red-200', selectedIconClass: 'text-red-500' },
  { label: 'Pinterest', icon: Image, selectedClasses: 'bg-rose-50 border-rose-300 text-rose-700 ring-1 ring-rose-200', selectedIconClass: 'text-rose-500' },
  { label: 'Video Storyboard', icon: Video, selectedClasses: 'bg-violet-50 border-violet-300 text-violet-700 ring-1 ring-violet-200', selectedIconClass: 'text-violet-500' },
];

export const CampaignDetail: React.FC<CampaignDetailProps> = ({
  campaigns,
  products,
  complianceRules,
  contentStore,
  onUpdateContent,
  onUpdateCampaign,
  onUpdateItem
}) => {
  const { id } = useParams<{ id: string }>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [detailContentId, setDetailContentId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [canvasFocusTarget, setCanvasFocusTarget] = useState<{ x: number; y: number; timestamp: number } | null>(null);
  const [creationModal, setCreationModal] = useState<{
    position: { x: number; y: number };
    initialText?: string;
    initialImageDataUrl?: string;
  } | null>(null);
  const [filters, setFilters] = useState<ContentFilters>(INITIAL_FILTERS);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in Firestore subscription callbacks
  const contentStoreRef = useRef(contentStore);
  contentStoreRef.current = contentStore;
  const onUpdateContentRef = useRef(onUpdateContent);
  onUpdateContentRef.current = onUpdateContent;

  const campaign = campaigns.find(c => c.id === id);

  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const onUpdateCampaignRef = useRef(onUpdateCampaign);
  onUpdateCampaignRef.current = onUpdateCampaign;
  const primaryProduct = products.find(p => p.id === campaign?.primaryProductId);
  const secondaryProducts = products.filter(p => campaign?.secondaryProductIds.includes(p.id));
  const brandName = primaryProduct?.brand || campaign?.name || 'Your Brand';
  const complianceRule = complianceRules.find(r => r.id === campaign?.complianceRuleId);

  // Local state for inputs
  const [keyMessageInput, setKeyMessageInput] = useState('');
  const [contextInput, setContextInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isEditingProducts, setIsEditingProducts] = useState(false);
  const [isBrandMode, setIsBrandMode] = useState(false);

  // Sync state when campaign loads (only on campaign ID change to avoid resetting during edits)
  useEffect(() => {
    if (campaign) {
      setKeyMessageInput(campaign.keyMessage);
      setContextInput(campaign.context || '');
      setNameInput(campaign.name);
      setIsBrandMode(!campaign.primaryProductId);
    }
  }, [campaign?.id]);

  // Migrate old parent channel names to sub-format names
  useEffect(() => {
    if (!campaign) return;
    const migrated: string[] = [];
    let needsMigration = false;
    for (const ch of campaign.channels) {
      const formats = CHANNEL_FORMATS[ch];
      if (formats && formats[0] !== ch) {
        // Parent name (e.g. 'Instagram') → expand to sub-formats
        migrated.push(...formats);
        needsMigration = true;
      } else {
        migrated.push(ch);
      }
    }
    if (needsMigration) {
      onUpdateCampaign({ ...campaign, channels: [...new Set(migrated)] });
    }
  }, [campaign?.id, onUpdateCampaign]);

  // Clear status message after 3 seconds
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Filter content for this campaign
  const campaignContent = contentStore.filter(c => c.campaignId === id);
  const activeEditingContent = contentStore.find(c => c.id === editingContentId);
  const activeDetailContent = contentStore.find(c => c.id === detailContentId);

  // Filtered content for the canvas
  const filteredContent = useMemo(() => {
    return campaignContent.filter(item => {
      // Always show generating cards regardless of filters
      if (item.status === 'generating') return true;

      if (filters.channels.size > 0) {
        const parent = getParentChannel(item.channel);
        if (!filters.channels.has(parent)) return false;
      }
      if (filters.audiences.size > 0 && !filters.audiences.has(item.audience)) return false;
      if (filters.statuses.size > 0 && !filters.statuses.has(item.status)) return false;
      if (filters.complianceMin > 0 && item.complianceScore < filters.complianceMin) return false;
      return true;
    });
  }, [campaignContent, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.channels.size > 0) count++;
    if (filters.audiences.size > 0) count++;
    if (filters.statuses.size > 0) count++;
    if (filters.complianceMin > 0) count++;
    return count;
  }, [filters]);

  // Close filter panel on click outside or Escape
  useEffect(() => {
    if (!isFilterPanelOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node) &&
        filterButtonRef.current && !filterButtonRef.current.contains(e.target as Node)
      ) {
        setIsFilterPanelOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterPanelOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterPanelOpen]);

  // ── Job subscription: track pipeline progress in real time ───────────────
  useEffect(() => {
    if (!activeJobId) return;

    const unsub = subscribeToJob(activeJobId, (job) => {
      setJobStatus(job);

      if (job.status === 'completed') {
        setIsGenerating(false);
        setStatusMessage(null);
        setActiveJobId(null);
        setJobStatus(null);
        // Remove any remaining placeholder cards
        const currentStore = contentStoreRef.current;
        if (currentStore.some(c => c.id.startsWith('placeholder-'))) {
          onUpdateContentRef.current(currentStore.filter(c => !c.id.startsWith('placeholder-')));
        }
        // Update campaign status after successful generation
        const currentCampaign = campaignRef.current;
        if (currentCampaign && currentCampaign.status === 'draft') {
          onUpdateCampaignRef.current({ ...currentCampaign, status: 'review', progress: 50 });
        }
      } else if (job.status === 'failed') {
        setIsGenerating(false);
        setStatusMessage(job.error || 'Generation failed. Please try again.');
        setActiveJobId(null);
        setJobStatus(null);
        // Remove placeholder cards on failure
        const currentStore = contentStoreRef.current;
        if (currentStore.some(c => c.id.startsWith('placeholder-'))) {
          onUpdateContentRef.current(currentStore.filter(c => !c.id.startsWith('placeholder-')));
        }
      }
    });

    return unsub;
  }, [activeJobId]);

  // ── Content subscription: stream generated content from Firestore ────────
  useEffect(() => {
    if (!activeJobId || !campaign) return;

    const unsub = subscribeToContent(campaign.id, (firestoreContent) => {
      // Merge Firestore-generated content into the content store.
      // Only include items from the active generation job.
      const jobContent = firestoreContent.filter(
        (c) => c.generationJobId === activeJobId
      );

      if (jobContent.length === 0) return;

      // Use refs to get latest values, avoiding stale closures
      const currentContentStore = contentStoreRef.current;
      const currentCampaign = campaignRef.current;

      // Assign canvas positions to new items that don't have them yet.
      // Exclude current job items from startX calculation to prevent drift on re-snapshots.
      const currentJobIds = new Set(jobContent.map(c => c.id));
      const existingContent = currentContentStore.filter(c => c.campaignId === currentCampaign?.id && !currentJobIds.has(c.id));
      let startX = 50;
      if (existingContent.length > 0) {
        const maxX = Math.max(...existingContent.map(c => c.x));
        startX = maxX + 400;
      }

      const positioned = jobContent.map((item, idx) => {
        // Check if this item already has a position in the local content store
        const existing = currentContentStore.find(c => c.id === item.id);
        // If this item already exists in local store, preserve its position
        // (even if at 0,0 — that could be a deliberate user placement)
        const hasLocalPosition = !!existing;
        return {
          ...item,
          x: hasLocalPosition ? existing.x : startX + (Math.floor(idx / 2) * 340),
          y: hasLocalPosition ? existing.y : 100 + ((idx % 2) * 450),
          width: existing?.width || item.width || 320,
        };
      });

      // Merge: keep non-job content, replace job content with latest from Firestore.
      // Also remove placeholder cards since real content has arrived.
      const jobIds = new Set(positioned.map(c => c.id));
      const otherContent = currentContentStore.filter(
        c => !jobIds.has(c.id) && !c.id.startsWith('placeholder-')
      );
      onUpdateContentRef.current([...otherContent, ...positioned]);
    });

    return unsub;
  }, [activeJobId, campaign?.id]);

  // Generate button validation
  const canGenerate = campaign ? campaign.targetAudiences.length > 0 && campaign.channels.length > 0 : false;

  const handleCanvasUpdate = (updatedItems: GeneratedContent[]) => {
    const otherContent = contentStore.filter(c => c.campaignId !== id);
    const updatedIds = new Set(updatedItems.map(i => i.id));
    const hiddenItems = campaignContent.filter(c => !updatedIds.has(c.id));
    onUpdateContent([...otherContent, ...hiddenItems, ...updatedItems]);
  };

  const handleCanvasDoubleClick = (canvasPos: { x: number; y: number }) => {
    setCreationModal({ position: canvasPos });
  };

  const handlePasteOnCanvas = (canvasPos: { x: number; y: number }, text?: string, imageDataUrl?: string) => {
    setCreationModal({ position: canvasPos, initialText: text, initialImageDataUrl: imageDataUrl });
  };

  const handleDeleteContent = (id: string) => {
    onUpdateContent(contentStore.filter(c => c.id !== id));
  };

  const handleManualContentCreate = (newContent: GeneratedContent) => {
    onUpdateContent([...contentStore, newContent]);
  };

  const handleGenerateMore = async () => {
    if (!campaign || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(null);
    setJobStatus(null);

    // Create placeholder cards so the user sees immediate visual feedback
    const existingContent = contentStore.filter(c => c.campaignId === campaign.id);
    let startX = 50;
    if (existingContent.length > 0) {
      const maxX = Math.max(...existingContent.map(c => c.x));
      startX = maxX + 400;
    }

    const placeholders: GeneratedContent[] = [];
    let idx = 0;
    for (const aud of campaign.targetAudiences) {
      for (const ch of campaign.channels) {
        placeholders.push({
          id: `placeholder-${Date.now()}-${idx}`,
          campaignId: campaign.id,
          channel: ch,
          audience: aud,
          text: '',
          imageUrl: '',
          complianceScore: 0,
          status: 'generating',
          riskLevel: 'low',
          x: startX + (Math.floor(idx / 2) * 340),
          y: 100 + ((idx % 2) * 450),
          width: 320,
        });
        idx++;
      }
    }
    if (placeholders.length > 0) {
      onUpdateContent([...contentStore, ...placeholders]);
    }

    try {
      const jobId = await startGeneration(campaign.id);
      setActiveJobId(jobId);
      setStatusMessage('Pipeline started. Waiting for updates...');
    } catch (error) {
      console.error('Failed to start generation:', error);
      setIsGenerating(false);
      setStatusMessage('Generation failed. Please try again.');
      // Remove placeholders on failure
      onUpdateContent(contentStore.filter(c => !c.id.startsWith('placeholder-')));
    }
  };

  const handleNameBlur = () => {
    if (campaign && nameInput.trim() !== '' && nameInput !== campaign.name) {
      onUpdateCampaign({ ...campaign, name: nameInput });
    }
  };

  const handleKeyMessageBlur = () => {
    if (campaign && keyMessageInput !== campaign.keyMessage) {
      onUpdateCampaign({ ...campaign, keyMessage: keyMessageInput });
    }
  };

  const handleContextBlur = () => {
    if (campaign && contextInput !== campaign.context) {
      onUpdateCampaign({ ...campaign, context: contextInput });
    }
  };

  const handleToggleAudience = (aud: string) => {
    if (!campaign) return;
    const current = campaign.targetAudiences;
    const next = current.includes(aud)
      ? current.filter(a => a !== aud)
      : [...current, aud];
    onUpdateCampaign({ ...campaign, targetAudiences: next });
  };

  const handleToggleParentChannel = (parentName: string) => {
    if (!campaign) return;
    const subFormats = CHANNEL_FORMATS[parentName] || [parentName];
    const anySelected = subFormats.some(sf => campaign.channels.includes(sf));
    // Always strip the parent name itself (stale from old data format)
    const cleaned = campaign.channels.filter(ch => ch !== parentName);
    let next: string[];
    if (anySelected) {
      // Deselect all sub-formats of this parent
      next = cleaned.filter(ch => !subFormats.includes(ch));
    } else {
      // Select all sub-formats of this parent
      next = [...cleaned, ...subFormats.filter(sf => !cleaned.includes(sf))];
    }
    onUpdateCampaign({ ...campaign, channels: next });
  };

  const handleToggleSubFormat = (subFormat: string) => {
    if (!campaign) return;
    // Strip any stale parent name for this sub-format
    const parentName = getParentChannel(subFormat);
    const current = campaign.channels.filter(ch => ch !== parentName || parentName === subFormat);
    const next = current.includes(subFormat)
      ? current.filter(ch => ch !== subFormat)
      : [...current, subFormat];
    onUpdateCampaign({ ...campaign, channels: next });
  };

  const handleSetPrimary = (productId: string) => {
    if (!campaign) return;
    setIsBrandMode(false);
    const newSecondary = campaign.secondaryProductIds.filter(id => id !== productId);
    onUpdateCampaign({ ...campaign, primaryProductId: productId, secondaryProductIds: newSecondary });
  };

  const handleToggleSecondary = (productId: string) => {
    if (!campaign) return;
    if (campaign.primaryProductId === productId) return;
    const current = campaign.secondaryProductIds;
    const next = current.includes(productId)
      ? current.filter(id => id !== productId)
      : [...current, productId];
    onUpdateCampaign({ ...campaign, secondaryProductIds: next });
  };

  const handleBrandCampaignToggle = () => {
    if (!campaign) return;
    if (!isBrandMode) {
      // Switch to brand campaign
      setIsBrandMode(true);
      onUpdateCampaign({ ...campaign, primaryProductId: undefined, secondaryProductIds: [] });
    } else {
      // Exit brand mode — user can now select a product from the list below
      setIsBrandMode(false);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    if (!campaign) return;
    const next = campaign.attachments.filter((_, i) => i !== idx);
    onUpdateCampaign({ ...campaign, attachments: next });
  };

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!campaign || !e.target.files || e.target.files.length === 0) return;
    const newNames = Array.from(e.target.files).map(f => f.name);
    onUpdateCampaign({ ...campaign, attachments: [...campaign.attachments, ...newNames] });
    e.target.value = '';
  };

  if (!campaign) {
    return <div className="p-8 text-center">Campaign not found</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Campaign Header */}
      <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link to="/campaigns" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
             <div className="flex items-center space-x-2 text-sm text-slate-500 mb-0.5">
               <span>Campaigns</span>
               <span>/</span>
               <span className="font-medium text-slate-900">{campaign.name}</span>
             </div>
             <h1 className="text-lg font-bold text-slate-900 leading-none">Canvas Workspace</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <button
              ref={filterButtonRef}
              onClick={() => setIsFilterPanelOpen(prev => !prev)}
              className={`flex items-center space-x-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeFilterCount > 0
                  ? 'text-blue-700 bg-blue-50 border border-blue-300 hover:bg-blue-100'
                  : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter size={16} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-blue-600 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {isFilterPanelOpen && (
              <FilterPanel
                ref={filterPanelRef}
                filters={filters}
                onFiltersChange={setFilters}
                onClearAll={() => setFilters(INITIAL_FILTERS)}
                onClose={() => setIsFilterPanelOpen(false)}
                campaignContent={campaignContent}
              />
            )}
          </div>
          <button className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            <History size={16} />
            <span>History</span>
          </button>
          <div className="h-6 w-[1px] bg-slate-200 mx-2"></div>
          <button className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
            <Send size={16} />
            <span>Publish</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Controls */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 overflow-y-auto">

           {/* Section: Campaign Name */}
           <div className="p-4 border-b border-slate-100">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Campaign Name</label>
              <input
                type="text"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameBlur}
              />
           </div>

           {/* Section: Context */}
           <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="font-semibold text-slate-900">Context</h3>
                 <button className="text-slate-400 hover:text-slate-600"><RefreshCw size={14}/></button>
              </div>
              <textarea
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-3"
                 rows={3}
                 value={contextInput}
                 onChange={(e) => setContextInput(e.target.value)}
                 onBlur={handleContextBlur}
                 placeholder="Campaign context..."
               />

               {/* Attachments with add/remove */}
               <div className="space-y-1">
                 <div className="flex items-center justify-between">
                   <span className="text-xs font-semibold text-slate-500 uppercase">Attachments</span>
                   <label className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer font-medium flex items-center">
                     <Paperclip size={11} className="mr-0.5" />
                     Add
                     <input
                       type="file"
                       multiple
                       className="hidden"
                       onChange={handleAddAttachment}
                     />
                   </label>
                 </div>
                 {campaign.attachments.length > 0 ? (
                   campaign.attachments.map((file, i) => (
                     <div key={i} className="flex items-center justify-between text-xs text-blue-600 bg-blue-50 p-1.5 rounded group">
                       <div className="flex items-center min-w-0">
                         <FileText size={12} className="mr-1.5 shrink-0" />
                         <span className="truncate">{file}</span>
                       </div>
                       <button
                         onClick={() => handleRemoveAttachment(i)}
                         className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                       >
                         <X size={12} />
                       </button>
                     </div>
                   ))
                 ) : (
                   <div className="text-xs text-slate-400 py-1">No attachments</div>
                 )}
               </div>
           </div>

           {/* Section: Products */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
               <h3 className="font-semibold text-slate-900">Products</h3>
               <button
                 onClick={() => setIsEditingProducts(!isEditingProducts)}
                 className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"
               >
                 {isEditingProducts ? (
                   <><Check size={12} className="mr-0.5" /> Done</>
                 ) : (
                   <><Pencil size={12} className="mr-0.5" /> Edit</>
                 )}
               </button>
             </div>

             {isEditingProducts ? (
               <div className="space-y-2">
                 {/* Brand Campaign Toggle */}
                 <button
                   onClick={handleBrandCampaignToggle}
                   className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                     isBrandMode
                       ? 'border-purple-300 bg-purple-50 text-purple-700'
                       : 'border-slate-200 bg-white text-slate-600 hover:border-purple-200'
                   }`}
                 >
                   <Lightbulb size={13} className={isBrandMode ? 'text-purple-500' : 'text-slate-400'} />
                   <span className="font-medium">Brand / Idea Campaign</span>
                 </button>

                 {/* Product List */}
                 {products.map(p => {
                   const isPrimary = campaign.primaryProductId === p.id;
                   const isSecondary = campaign.secondaryProductIds.includes(p.id);
                   return (
                     <div key={p.id} className={`p-2 rounded-lg border transition-all ${
                       isPrimary ? 'border-blue-200 bg-blue-50' :
                       isSecondary ? 'border-indigo-200 bg-indigo-50' :
                       'border-slate-100 bg-white'
                     }`}>
                       <div className="flex items-center space-x-2 mb-2">
                         <img src={p.imageUrl} alt={p.name} className="w-6 h-6 rounded object-cover" />
                         <span className="text-xs font-semibold text-slate-800 truncate">{p.name}</span>
                       </div>
                       <div className="flex gap-1.5">
                         <button
                           onClick={() => handleSetPrimary(p.id)}
                           className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                             isPrimary
                               ? 'bg-blue-600 text-white'
                               : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600'
                           }`}
                         >
                           Primary
                         </button>
                         <button
                           onClick={() => handleToggleSecondary(p.id)}
                           disabled={isPrimary}
                           className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                             isSecondary
                               ? 'bg-indigo-600 text-white'
                               : isPrimary
                                 ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                 : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                           }`}
                         >
                           Secondary
                         </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <>
                 {primaryProduct ? (
                   <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm mb-3 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-bl font-bold">PRIMARY</div>
                     <div className="flex items-center space-x-2">
                       <div className="w-8 h-8 bg-slate-100 rounded object-cover flex-shrink-0">
                          <img src={primaryProduct.imageUrl} alt={primaryProduct.name} className="w-full h-full rounded object-cover" />
                       </div>
                       <div className="min-w-0">
                         <div className="font-semibold text-sm text-slate-800 truncate">{primaryProduct.name}</div>
                         <div className="text-[10px] text-slate-500">{primaryProduct.brand}</div>
                       </div>
                     </div>
                   </div>
                 ) : isBrandMode ? (
                    <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg text-xs text-purple-700 flex items-center mb-3">
                       <Package size={14} className="mr-2" />
                       <span>Brand / Idea Campaign</span>
                    </div>
                 ) : (
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs text-slate-500 flex items-center mb-3">
                       <Package size={14} className="mr-2" />
                       <span>No product selected</span>
                    </div>
                 )}

                 {secondaryProducts.length > 0 && (
                   <div className="space-y-2">
                     <div className="text-[10px] font-bold text-slate-400 uppercase">Secondary</div>
                     {secondaryProducts.map(p => (
                       <div key={p.id} className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="w-5 h-5 bg-slate-200 rounded flex-shrink-0">
                             <img src={p.imageUrl} alt={p.name} className="w-full h-full rounded object-cover" />
                          </div>
                          <span className="text-xs text-slate-700 truncate">{p.name}</span>
                       </div>
                     ))}
                   </div>
                 )}
               </>
             )}
           </div>

           {/* Section: Key Message */}
           <div className="p-4 border-b border-slate-100">
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Key Message</label>
               <textarea
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                 rows={3}
                 value={keyMessageInput}
                 onChange={(e) => setKeyMessageInput(e.target.value)}
                 onBlur={handleKeyMessageBlur}
               />
           </div>

           {/* Section: Compliance Rule */}
           <div className="p-4 border-b border-slate-100">
             <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Compliance Rule</label>
             {complianceRule ? (
               <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2.5">
                 <div className="flex items-center space-x-2 min-w-0">
                   <ShieldCheck size={14} className="text-green-600 shrink-0" />
                   <div className="min-w-0">
                     <div className="text-sm font-medium text-green-800 truncate">{complianceRule.name}</div>
                     {complianceRule.description && (
                       <div className="text-[10px] text-green-600 truncate">{complianceRule.description}</div>
                     )}
                   </div>
                 </div>
                 <button
                   onClick={() => campaign && onUpdateCampaign({ ...campaign, complianceRuleId: undefined })}
                   className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0 ml-2"
                 >
                   Remove
                 </button>
               </div>
             ) : (
               <select
                 className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                 value=""
                 onChange={(e) => {
                   if (campaign && e.target.value) {
                     onUpdateCampaign({ ...campaign, complianceRuleId: e.target.value });
                   }
                 }}
               >
                 <option value="">No compliance rule</option>
                 {complianceRules.map(r => (
                   <option key={r.id} value={r.id}>{r.name}</option>
                 ))}
               </select>
             )}
           </div>

           {/* Section: Target Audiences */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
               <h3 className="font-semibold text-slate-900">Target Audiences</h3>
               <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                 {campaign.targetAudiences.length} selected
               </span>
             </div>

             <div className="flex flex-wrap gap-2">
               {AVAILABLE_AUDIENCES.map(({ label: aud, icon: Icon, selectedClasses, selectedIconClass }) => {
                 const isSelected = campaign.targetAudiences.includes(aud);
                 return (
                   <button
                     key={aud}
                     onClick={() => handleToggleAudience(aud)}
                     className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer ${
                       isSelected
                         ? `${selectedClasses} shadow-sm`
                         : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                     }`}
                   >
                     <Icon size={13} className={isSelected ? selectedIconClass : 'text-slate-400'} />
                     <span>{aud}</span>
                   </button>
                 );
               })}
             </div>
           </div>

           {/* Section: Channels */}
           <div className="p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Channels</h3>
                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {campaign.channels.length} format{campaign.channels.length !== 1 ? 's' : ''}
                </span>
             </div>
             <div className="flex flex-wrap gap-2">
                {AVAILABLE_CHANNELS.map(({ label: parentName, icon: Icon, selectedClasses, selectedIconClass }) => {
                  const subFormats = CHANNEL_FORMATS[parentName] || [parentName];
                  const selectedCount = subFormats.filter(sf => campaign.channels.includes(sf)).length;
                  const isSelected = selectedCount > 0;
                  const isMultiFormat = subFormats.length > 1;
                  return (
                    <button
                      key={parentName}
                      onClick={() => handleToggleParentChannel(parentName)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer ${
                        isSelected
                          ? `${selectedClasses} shadow-sm`
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={13} className={isSelected ? selectedIconClass : 'text-slate-400'} />
                      <span>{parentName}</span>
                      {isSelected && isMultiFormat && (
                        <span className="text-[10px] opacity-70 ml-0.5">{selectedCount}/{subFormats.length}</span>
                      )}
                    </button>
                  );
                })}
             </div>

             {/* Sub-format expansion rows */}
             {AVAILABLE_CHANNELS.map(({ label: parentName, selectedClasses }) => {
               const subFormats = CHANNEL_FORMATS[parentName] || [parentName];
               if (subFormats.length <= 1) return null;
               const selectedCount = subFormats.filter(sf => campaign.channels.includes(sf)).length;
               if (selectedCount === 0) return null;

               return (
                 <div key={`sub-${parentName}`} className="mt-3 ml-1">
                   <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase mb-1.5">
                     <ChevronRight size={10} />
                     <span>{parentName} Formats</span>
                   </div>
                   <div className="flex flex-wrap gap-1.5 ml-3">
                     {subFormats.map(sf => {
                       const isSelected = campaign.channels.includes(sf);
                       // Strip parent prefix for display: "Instagram Post" → "Post"
                       const shortName = sf.startsWith(parentName) ? sf.slice(parentName.length).trim() : sf;
                       return (
                         <button
                           key={sf}
                           onClick={() => handleToggleSubFormat(sf)}
                           className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all duration-150 border cursor-pointer ${
                             isSelected
                               ? `${selectedClasses} shadow-sm`
                               : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                           }`}
                         >
                           {isSelected && <Check size={10} />}
                           <span>{shortName}</span>
                         </button>
                       );
                     })}
                   </div>
                 </div>
               );
             })}
           </div>

           <div className="p-4 mt-auto">
             {/* Pipeline progress */}
             {jobStatus && isGenerating && (
               <div className="mb-3 space-y-1.5">
                 <div className="flex items-center justify-between text-xs">
                   <span className="text-slate-600 font-medium">{jobStatus.phase}</span>
                   <span className="text-slate-400">{jobStatus.progress}%</span>
                 </div>
                 <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                   <div
                     className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                     style={{ width: `${jobStatus.progress}%` }}
                   />
                 </div>
                 {jobStatus.itemsTotal > 0 && (
                   <div className="text-[10px] text-slate-400">
                     {jobStatus.itemsCompleted}/{jobStatus.itemsTotal} items
                     {jobStatus.retryCount > 0 && ` | ${jobStatus.retryCount} compliance retries`}
                   </div>
                 )}
               </div>
             )}
             {statusMessage && !jobStatus && (
               <div className="mb-2 p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100 flex items-start animate-fadeIn">
                 <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                 <span>{statusMessage}</span>
               </div>
             )}
             {!canGenerate && !isGenerating && (
               <div className="mb-2 p-2 bg-amber-50 text-amber-700 text-xs rounded border border-amber-100 flex items-start">
                 <Info size={14} className="mr-1.5 mt-0.5 shrink-0" />
                 <span>Select at least 1 audience and 1 channel to generate</span>
               </div>
             )}
             <button
               onClick={handleGenerateMore}
               disabled={isGenerating || !canGenerate}
               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
             >
               {isGenerating ? (
                 <>
                   <Loader2 size={18} className="animate-spin" />
                   <span>Generating...</span>
                 </>
               ) : (
                 <>
                   <Sparkles size={18} />
                   <span>Generate New Variants</span>
                 </>
               )}
             </button>
           </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
           {campaignContent.length === 0 && !isGenerating ? (
             <div
               className="absolute inset-0 flex items-center justify-center cursor-pointer"
               onDoubleClick={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 handleCanvasDoubleClick({
                   x: (e.clientX - rect.left) / INITIAL_CANVAS_SCALE,
                   y: (e.clientY - rect.top) / INITIAL_CANVAS_SCALE,
                 });
               }}
             >
               <div className="text-center max-w-md px-8">
                 <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                   <MousePointerClick size={28} className="text-slate-400" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-700 mb-2">Ready to create content</h2>
                 <p className="text-sm text-slate-500 mb-6">
                   <span className="font-semibold text-blue-600">Double-click</span> anywhere or <span className="font-semibold text-blue-600">paste</span> text/images to add content manually.
                   Or select audiences and channels, then click "Generate New Variants" for AI generation.
                 </p>
                 <div className="flex items-center justify-center gap-3 text-xs">
                   <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                     campaign.targetAudiences.length > 0
                       ? 'bg-green-50 border-green-200 text-green-700'
                       : 'bg-slate-50 border-slate-200 text-slate-400'
                   }`}>
                     <Users size={12} />
                     <span>{campaign.targetAudiences.length} audience{campaign.targetAudiences.length !== 1 ? 's' : ''}</span>
                     {campaign.targetAudiences.length > 0 && <Check size={12} />}
                   </div>
                   <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                     campaign.channels.length > 0
                       ? 'bg-green-50 border-green-200 text-green-700'
                       : 'bg-slate-50 border-slate-200 text-slate-400'
                   }`}>
                     <Send size={12} />
                     <span>{campaign.channels.length} format{campaign.channels.length !== 1 ? 's' : ''}</span>
                     {campaign.channels.length > 0 && <Check size={12} />}
                   </div>
                 </div>
               </div>
             </div>
           ) : filteredContent.length === 0 && campaignContent.length > 0 ? (
             <div className="absolute inset-0 flex items-center justify-center">
               <div className="text-center max-w-sm px-8">
                 <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                   <Filter size={28} className="text-slate-400" />
                 </div>
                 <h2 className="text-lg font-bold text-slate-700 mb-2">No matching content</h2>
                 <p className="text-sm text-slate-500 mb-4">
                   {campaignContent.length} card{campaignContent.length !== 1 ? 's are' : ' is'} hidden by your current filters.
                 </p>
                 <button
                   onClick={() => setFilters(INITIAL_FILTERS)}
                   className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                 >
                   Clear all filters
                 </button>
               </div>
             </div>
           ) : (
             <CanvasBoard
                items={filteredContent}
                onItemsChange={handleCanvasUpdate}
                onEdit={(id) => setEditingContentId(id)}
                onDelete={handleDeleteContent}
                onDoubleClick={(id) => setDetailContentId(id)}
                onCanvasDoubleClick={handleCanvasDoubleClick}
                onPasteOnCanvas={handlePasteOnCanvas}
                pasteEnabled={!creationModal}
                brandName={brandName}
                focusTarget={canvasFocusTarget}
             />
           )}
        </div>
      </div>

      {activeEditingContent && (
        <VideoStoryboardModal
          content={activeEditingContent}
          onClose={() => setEditingContentId(null)}
          onUpdate={onUpdateItem}
        />
      )}

      {activeDetailContent && (
        <ContentDetailModal
          content={activeDetailContent}
          onClose={() => setDetailContentId(null)}
          onSave={(updated) => {
            onUpdateItem(updated);
            setDetailContentId(null);
          }}
        />
      )}

      {creationModal && campaign && (
        <ContentCreationModal
          campaignId={campaign.id}
          onClose={() => setCreationModal(null)}
          onCreate={handleManualContentCreate}
          initialText={creationModal.initialText}
          initialImageDataUrl={creationModal.initialImageDataUrl}
          canvasPosition={creationModal.position}
          existingChannels={campaign.channels}
          existingAudiences={campaign.targetAudiences}
        />
      )}
    </div>
  );
};
