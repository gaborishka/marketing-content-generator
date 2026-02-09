import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Loader2,
  Sparkles,
  Copy,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Check,
  RotateCcw
} from 'lucide-react';
import { GeneratedContent, Campaign } from '../types';
import { chatWithAIForContent } from '../services/contentAIService';
import { generateImage } from '../services/geminiClient';
import { getAspectRatioForChannel } from '../services/imageHelpers';
import { saveContentChange } from '../services/contentHistoryService';
import { RevealImage } from './RevealImage';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ContentAIAssistantProps {
  content: GeneratedContent;
  campaign?: Campaign;
  onClose: () => void;
  onUpdate: (updated: GeneratedContent) => void;
}

export const ContentAIAssistant: React.FC<ContentAIAssistantProps> = ({
  content,
  campaign,
  onClose,
  onUpdate
}) => {
  // Store original content to allow reset
  const [originalContent] = useState<GeneratedContent>(content);
  // Store pending changes (not applied yet)
  const [pendingChanges, setPendingChanges] = useState<Partial<GeneratedContent> | null>(null);
  // Track which specific fields were changed (for highlighting)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    seo: false,
    refinement: false
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get the current display content (original + pending changes)
  const displayContent: GeneratedContent = pendingChanges 
    ? { ...content, ...pendingChanges }
    : content;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const campaignContext = campaign ? {
        name: campaign.name,
        keyMessage: campaign.keyMessage,
        audience: content.audience
      } : undefined;

      // Use displayContent (which includes pending changes) so modifications build on previous changes
      const response = await chatWithAIForContent(displayContent, [...messages, userMessage], campaignContext);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If AI wants to update the content, merge with existing pending changes (don't apply yet)
      if (response.shouldUpdate) {
        const newChanges: Partial<GeneratedContent> = {};
        const newChangedFields = new Set<string>();
        
        // Only include text updates if provided
        if (response.updatedContent?.text) {
          newChanges.text = response.updatedContent.text;
          // Track which specific text fields were changed
          if (response.updateFields?.includes('headline')) {
            newChangedFields.add('headline');
          }
          if (response.updateFields?.includes('body')) {
            newChangedFields.add('body');
          }
          if (response.updateFields?.includes('text')) {
            newChangedFields.add('headline');
            newChangedFields.add('body');
          }
        }
        
        // Handle image generation if requested
        if (response.updateFields?.includes('image') && response.imagePrompt) {
          setIsLoading(true);
          try {
            const aspectRatio = getAspectRatioForChannel(displayContent.channel);
            const generatedImage = await generateImage(response.imagePrompt, aspectRatio);
            newChanges.imageUrl = generatedImage;
            newChangedFields.add('image');
          } catch (imageError: any) {
            const imageErrorMessage: ChatMessage = {
              role: 'assistant',
              content: `I tried to generate a new image, but encountered an error: ${imageError.message || 'Unknown error'}. The text changes are still available to apply.`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, imageErrorMessage]);
          } finally {
            setIsLoading(false);
          }
        }
        
        // Merge with existing pending changes
        if (Object.keys(newChanges).length > 0) {
          setPendingChanges(prev => prev ? { ...prev, ...newChanges } : newChanges);
          setChangedFields(prev => {
            const combined = new Set(prev);
            newChangedFields.forEach(field => combined.add(field));
            return combined;
          });
        }
      }

      // If there are follow-up questions, add them as assistant messages
      if (response.questions && response.questions.length > 0) {
        const questionsMessage: ChatMessage = {
          role: 'assistant',
          content: `I have a few questions to better understand your needs:\n\n${response.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, questionsMessage]);
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSection = (section: 'seo' | 'refinement') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleApply = async () => {
    if (pendingChanges) {
      // Preserve all original content fields, only update the changed ones
      const updated: GeneratedContent = {
        ...content,
        ...pendingChanges
      };
      
      // Track history before updating
      try {
        const lastMessage = messages[messages.length - 1];
        const aiPrompt = lastMessage?.role === 'user' ? lastMessage.content : undefined;
        
        await saveContentChange({
          contentId: content.id,
          campaignId: content.campaignId,
          changeType: 'ai_modified',
          previousVersion: content,
          newVersion: updated,
          description: `Modified via AI: ${changedFields.has('headline') ? 'headline' : ''} ${changedFields.has('body') ? 'body' : ''} ${changedFields.has('image') ? 'image' : ''}`.trim(),
          metadata: {
            aiPrompt
          }
        });
      } catch (error) {
        console.error('Failed to save history:', error);
      }
      
      // Ensure userId and other required fields are preserved
      onUpdate(updated);
      setPendingChanges(null);
      setChangedFields(new Set());
    }
  };

  const handleReset = () => {
    setChangedFields(new Set());
    setPendingChanges(null);
  };

  // Extract headline and body from text if they exist
  const textParts = displayContent.text.split('\n\n');
  const headline = textParts[0] || '';
  const body = textParts.slice(1).join('\n\n') || displayContent.text;
  
  const hasChanges = pendingChanges !== null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-slate-50">
      {/* Left Panel - Content Details */}
      <div className="w-1/2 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Selected Content</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Apply/Reset Buttons - Show when there are pending changes */}
        {hasChanges && (
          <div className="px-6 py-3 border-b border-blue-200 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Changes pending</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
              <button
                onClick={handleApply}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Check size={14} />
                <span>Apply</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Details */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata */}
          <div className="flex items-center space-x-4 text-sm text-slate-500">
            <span>{content.audience}</span>
            <span className="text-slate-300">·</span>
            <span>English</span>
            <span className="text-slate-300">·</span>
            <span>{new Date().toLocaleDateString('en-GB')}</span>
            <button className="ml-auto text-blue-600 hover:text-blue-700">
              <Copy size={14} />
            </button>
          </div>

          {/* Image Preview */}
          {displayContent.imageUrl && (
            <div className={`rounded-lg overflow-hidden border bg-slate-50 ${
              hasChanges && changedFields.has('image') ? 'border-blue-300 ring-2 ring-blue-200' : 'border-slate-200'
            }`}>
              <RevealImage src={displayContent.imageUrl} alt="Content" className="w-full object-cover" />
            </div>
          )}

          {/* Content Text */}
          <div className="space-y-3">
            {headline && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-1">Headline</h3>
                <p className={`text-base font-semibold ${
                  hasChanges && changedFields.has('headline') ? 'text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200' : 'text-slate-900'
                }`}>
                  {headline}
                </p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-1">Body</h3>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                hasChanges && changedFields.has('body') ? 'text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200' : 'text-slate-700'
              }`}>
                {body}
              </p>
            </div>
          </div>

          {/* Compliance Section */}
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${
              displayContent.complianceScore >= 90 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              <ShieldCheck size={12} />
              <span>{displayContent.complianceScore}% passed</span>
            </div>
            <div className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
              Unknown Risk
            </div>
          </div>

          {/* SEO Keywords Section */}
          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={() => toggleSection('seo')}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-2"
            >
              <span>SEO Keywords</span>
              {expandedSections.seo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.seo && (
              <div className="flex flex-wrap gap-2">
                {['Neurocalm', 'PS5 gaming', 'family stress relief', 'nerve discomfort', 'calm parenting'].map((keyword, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Refinement Suggestion Section */}
          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={() => toggleSection('refinement')}
              className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-2"
            >
              <span>Refinement Suggestion</span>
              {expandedSections.refinement ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.refinement && (
              <p className="text-sm text-slate-600">
                Consider emphasizing the unique benefits of Neurocalm in managing nerve discomfort.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - AI Assistant */}
      <div className="w-1/2 bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <Sparkles size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Sparkles size={32} className="text-blue-600" />
              </div>
              <p className="text-slate-600 text-sm">
                Start typing below to begin modifying this content with AI assistance.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-lg px-4 py-3">
                <Loader2 size={16} className="animate-spin text-slate-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your modification request to get started..."
              className="flex-1 resize-none border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

