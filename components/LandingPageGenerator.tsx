import React, { useState } from 'react';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import { ChatMessage, LandingPageProject, InterviewQuestion } from '../types';
import { ChatPanel } from './ChatPanel';
import { InterviewPanel } from './InterviewPanel';
import { LandingPagePreview } from './LandingPagePreview';
import { generateLandingPage } from '../services/landingPageService';

interface LandingPageGeneratorProps {
  landingPages: LandingPageProject[];
  onSave: (project: LandingPageProject) => void;
  onDelete: (id: string) => void;
  onRefreshUsage?: () => void;
}

type Phase = 'initial' | 'loading-interview' | 'interview' | 'chat';

const createNewProject = (): LandingPageProject => ({
  id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: 'New Page',
  conversationHistory: [],
  currentHtml: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const LandingPageGenerator: React.FC<LandingPageGeneratorProps> = ({ landingPages, onSave, onDelete, onRefreshUsage }) => {
  const [activeProject, setActiveProject] = useState<LandingPageProject>(() => {
    return landingPages[0] || createNewProject();
  });
  const [messages, setMessages] = useState<ChatMessage[]>(activeProject.conversationHistory);
  const [currentHtml, setCurrentHtml] = useState<string | null>(activeProject.currentHtml);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Interview state
  const [phase, setPhase] = useState<Phase>(() =>
    activeProject.conversationHistory.length > 0 ? 'chat' : 'initial'
  );
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [initialDescription, setInitialDescription] = useState('');

  const switchProject = (project: LandingPageProject) => {
    setActiveProject(project);
    setMessages(project.conversationHistory);
    setCurrentHtml(project.currentHtml);
    setPhase(project.conversationHistory.length > 0 ? 'chat' : 'initial');
    setInterviewQuestions([]);
    setInitialDescription('');
    setDropdownOpen(false);
  };

  const handleNewProject = () => {
    const project = createNewProject();
    setActiveProject(project);
    setMessages([]);
    setCurrentHtml(null);
    setPhase('initial');
    setInterviewQuestions([]);
    setInitialDescription('');
    setDropdownOpen(false);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    if (activeProject.id === id) {
      const remaining = landingPages.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        switchProject(remaining[0]);
      } else {
        handleNewProject();
      }
    }
    setDropdownOpen(false);
  };

  // First message: triggers interview questions from AI
  const handleInitialMessage = async (text: string) => {
    setInitialDescription(text);
    setPhase('loading-interview');
    setIsLoading(true);

    try {
      const response = await generateLandingPage([{ role: 'user', content: text }]);

      if (response.interview && response.interview.length > 0) {
        setInterviewQuestions(response.interview);
        setPhase('interview');
      } else {
        // AI didn't return interview questions — go straight to chat
        const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
        const assistantMsg: ChatMessage = { id: `msg-${Date.now()}-a`, role: 'assistant', content: response.message, timestamp: Date.now() };
        const allMessages = [userMsg, assistantMsg];
        setMessages(allMessages);
        if (response.html) setCurrentHtml(response.html);
        setPhase('chat');
        saveProject(allMessages, response.html, text);
      }
    } catch (error: any) {
      console.error('Interview fetch error:', error);
      const isQuotaError = error?.code === 'functions/resource-exhausted';
      const content = isQuotaError
        ? 'Daily generation limit reached. Upgrade to Pro for more generations.'
        : 'Sorry, something went wrong starting the interview. Please try again.';
      const errorMsg: ChatMessage = { id: `msg-${Date.now()}-err`, role: 'assistant', content, timestamp: Date.now() };
      setMessages([errorMsg]);
      setPhase('chat');
    } finally {
      setIsLoading(false);
      onRefreshUsage?.();
    }
  };

  // Interview complete: compile answers, switch to chat, generate in preview
  const handleInterviewComplete = async (answers: { label: string; answer: string }[]) => {
    const preferencesText = answers.map((a) => `- ${a.label}: ${a.answer}`).join('\n');
    const compiledMessage = `${initialDescription}\n\nMy preferences:\n${preferencesText}`;

    // Switch to chat immediately — loader shows in the preview area
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: compiledMessage, timestamp: Date.now() };
    setMessages([userMsg]);
    setPhase('chat');
    setIsLoading(true);

    const conversationHistory = [
      { role: 'user', content: initialDescription },
      { role: 'assistant', content: 'I have a few questions to tailor the page to your needs.' },
      { role: 'user', content: `Here are my preferences:\n${preferencesText}\n\nPlease generate the landing page.` },
    ];

    try {
      const response = await generateLandingPage(conversationHistory);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: response.message || "Here's your landing page!",
        timestamp: Date.now(),
      };
      const allMessages = [userMsg, assistantMsg];
      setMessages(allMessages);

      if (response.html) setCurrentHtml(response.html);
      saveProject(allMessages, response.html, initialDescription);
    } catch (error: any) {
      console.error('Generation error:', error);
      const isQuotaError = error?.code === 'functions/resource-exhausted';
      const content = isQuotaError
        ? 'Daily generation limit reached. Upgrade to Pro for more generations.'
        : 'Sorry, something went wrong. Please try again.';
      const errorMsg: ChatMessage = { id: `msg-${Date.now()}-err`, role: 'assistant', content, timestamp: Date.now() };
      setMessages([userMsg, errorMsg]);
    } finally {
      setIsLoading(false);
      onRefreshUsage?.();
    }
  };

  // Chat refinement messages (after initial generation) — supports image attachments
  const handleSendMessage = async (text: string, images?: string[]) => {
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: 'user', content: text, images, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Build history: only include images on the last user message to keep payload small
      const history = updatedMessages.map((m, i) => ({
        role: m.role,
        content: m.content,
        ...(i === updatedMessages.length - 1 && m.images?.length ? { images: m.images } : {}),
      }));
      const response = await generateLandingPage(history, currentHtml || undefined);

      const assistantMsg: ChatMessage = { id: `msg-${Date.now()}-a`, role: 'assistant', content: response.message, timestamp: Date.now() };
      const allMessages = [...updatedMessages, assistantMsg];
      setMessages(allMessages);

      const newHtml = response.html ?? currentHtml;
      if (response.html) setCurrentHtml(response.html);

      saveProject(allMessages, newHtml, undefined);
    } catch (error: any) {
      console.error('Refinement error:', error);
      const isQuotaError = error?.code === 'functions/resource-exhausted';
      const content = isQuotaError
        ? 'Daily generation limit reached. Upgrade to Pro for more generations.'
        : 'Sorry, something went wrong. Please try again.';
      const errorMsg: ChatMessage = { id: `msg-${Date.now()}-err`, role: 'assistant', content, timestamp: Date.now() };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      onRefreshUsage?.();
    }
  };

  const saveProject = (msgs: ChatMessage[], html: string | null, firstDescription?: string) => {
    const title = firstDescription
      ? firstDescription.slice(0, 50)
      : activeProject.title !== 'New Page'
      ? activeProject.title
      : msgs[0]?.content.slice(0, 50) || 'Untitled Page';

    // Strip images from persisted messages (too large for Firestore)
    const persistableMessages = msgs.map(({ images, ...rest }) => rest);

    const savedProject: LandingPageProject = {
      ...activeProject,
      title: activeProject.conversationHistory.length === 0 ? title : activeProject.title,
      conversationHistory: persistableMessages,
      currentHtml: html,
      updatedAt: Date.now(),
    };
    setActiveProject(savedProject);
    onSave(savedProject);
  };

  // Determine which left panel to show
  const renderLeftPanel = () => {
    switch (phase) {
      case 'initial':
        return <ChatPanel messages={[]} onSendMessage={handleInitialMessage} isLoading={false} />;
      case 'loading-interview':
        return <ChatPanel messages={[]} onSendMessage={() => {}} isLoading={true} />;
      case 'interview':
        return (
          <InterviewPanel
            questions={interviewQuestions}
            onComplete={handleInterviewComplete}
            isGenerating={isLoading}
            description={initialDescription}
          />
        );
      case 'chat':
        return <ChatPanel messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left side: interview or chat */}
      <div className="w-[420px] flex flex-col shrink-0">
        {/* Project selector */}
        <div className="relative border-b border-slate-200 bg-white z-10">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="truncate">{activeProject.title}</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 shadow-lg rounded-b-lg z-20 max-h-64 overflow-y-auto">
              <button
                onClick={handleNewProject}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus size={16} />
                New Page
              </button>
              {landingPages.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                    p.id === activeProject.id ? 'bg-slate-50' : ''
                  }`}
                >
                  <button
                    onClick={() => switchProject(p)}
                    className="flex-1 text-left text-sm text-slate-700 truncate"
                  >
                    {p.title}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderLeftPanel()}
      </div>

      {/* Right side: preview — isLoading drives the generating state */}
      <div className="flex-1 min-w-0">
        <LandingPagePreview html={currentHtml} isGenerating={isLoading} />
      </div>
    </div>
  );
};
