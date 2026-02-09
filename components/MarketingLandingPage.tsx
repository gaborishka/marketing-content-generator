import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Megaphone,
  ShieldCheck,
  LayoutDashboard,
  Package,
  Palette,
  ArrowRight,
  Check,
  ChevronRight,
} from 'lucide-react';
import { TIER_LIMITS } from '../types';

const FEATURES = [
  { icon: Megaphone, title: 'Multi-Channel Campaigns', description: 'Create content for social, email, display, and more — all from a single brief.' },
  { icon: Sparkles, title: 'AI Generation', description: 'Powered by Google Gemini to generate copy, images, and video storyboards instantly.' },
  { icon: ShieldCheck, title: 'Compliance Built-In', description: 'Automated compliance checks ensure every piece of content meets your brand guidelines.' },
  { icon: LayoutDashboard, title: 'Canvas Workspace', description: 'Drag, arrange, and connect content on an infinite canvas for visual campaign planning.' },
  { icon: Package, title: 'Product Catalog', description: 'Link products directly to campaigns for accurate, on-brand marketing copy.' },
  { icon: Palette, title: 'Brand Management', description: 'Maintain consistent voice, tone, and visual identity across every channel.' },
];

const STEPS = [
  { number: '1', title: 'Create Your Brief', description: 'Define your campaign goals, target audience, and select channels.' },
  { number: '2', title: 'AI Generates Content', description: 'Our agent pipeline creates copy, checks compliance, and generates images.' },
  { number: '3', title: 'Review & Publish', description: 'Refine content on the canvas, approve, and export to your channels.' },
];

const FREE_FEATURES = [
  `${TIER_LIMITS.free} generations per day`,
  'All channels supported',
  'Basic compliance checking',
  'Canvas workspace',
];

const PRO_FEATURES = [
  `${TIER_LIMITS.pro} generations per day`,
  'All channels supported',
  'Advanced compliance with retries',
  'Canvas workspace',
  'Priority support',
  'Image & video generation',
];

const TESTIMONIALS = [
  { quote: 'MarketGen AI cut our campaign production time by 80%. What used to take a week now takes an afternoon.', name: 'Sarah Chen', role: 'Marketing Director, TechStart' },
  { quote: 'The compliance checking alone is worth it. No more back-and-forth with legal on every piece of content.', name: 'James Okafor', role: 'Brand Manager, HealthPlus' },
  { quote: 'Finally, a tool that understands multi-channel. We generate consistent messaging across all platforms in one go.', name: 'Maria Gonzalez', role: 'CMO, RetailWave' },
];

export const MarketingLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const howItWorksRef = useRef<HTMLDivElement>(null);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">MarketGen AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">AI-Powered</span>{' '}
            Marketing Content Generation
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10">
            Generate compliant, multi-channel marketing campaigns in minutes.
            From copy to images to video storyboards — all powered by Google Gemini.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
            >
              Get Started Free <ArrowRight size={16} />
            </button>
            <button
              onClick={scrollToHowItWorks}
              className="px-8 py-3.5 text-sm font-semibold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              See How It Works
            </button>
          </div>
        </div>
        {/* Decorative mockup */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-64 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <LayoutDashboard size={48} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">Campaign Canvas Workspace</p>
                <p className="text-xs mt-1">Drag, connect, and refine your content visually</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything you need for marketing at scale</h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              A complete AI-powered toolkit for creating, reviewing, and managing marketing content across every channel.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section ref={howItWorksRef} className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How it works</h2>
            <p className="text-sm text-slate-500">Three simple steps from brief to published content.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(s => (
              <div key={s.number} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-5 text-white font-bold text-lg">
                  {s.number}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-sm text-slate-500">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="bg-white rounded-xl border-2 border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Free</h3>
              <p className="text-3xl font-bold text-slate-900 mb-4">$0<span className="text-sm font-normal text-slate-500">/month</span></p>
              <ul className="space-y-2 mb-6">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-center text-sm text-slate-600">
                    <Check size={16} className="mr-2 text-slate-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/auth')}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Get Started
              </button>
            </div>
            {/* Pro */}
            <div className="bg-white rounded-xl border-2 border-blue-400 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl">
                RECOMMENDED
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Pro</h3>
              <p className="text-3xl font-bold text-slate-900 mb-4">$29<span className="text-sm font-normal text-slate-500">/month</span></p>
              <ul className="space-y-2 mb-6">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-center text-sm text-slate-600">
                    <Check size={16} className="mr-2 text-blue-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/auth')}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-colors shadow-lg shadow-blue-500/20"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Loved by marketing teams</h2>
            <p className="text-sm text-slate-500">See what our users have to say.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <p className="text-sm text-slate-600 leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to transform your marketing?</h2>
          <p className="text-blue-100 mb-8">Start generating compliant, multi-channel campaigns in minutes.</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-8 py-3.5 text-sm font-semibold bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-colors shadow-lg flex items-center gap-2 mx-auto"
          >
            Get Started Free <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">MarketGen AI</span>
          </div>
          <p className="text-xs text-slate-500">&copy; {new Date().getFullYear()} MarketGen AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
