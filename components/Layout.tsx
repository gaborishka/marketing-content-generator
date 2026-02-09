import React, { useState } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Palette,
  ShieldCheck,
  Globe,
  Settings,
  Menu,
  Bell,
  User,
  LogOut,
  Sparkles
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { UsageInfo } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  userName?: string;
  usageInfo?: UsageInfo | null;
}

const SidebarItem = ({ icon: Icon, label, path, active }: { icon: any, label: string, path: string, active: boolean }) => (
  <Link 
    to={path} 
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout: React.FC<LayoutProps> = ({ children, onSignOut, userName, usageInfo }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCanvasRoute = (/^\/campaigns\/[^/]+$/.test(location.pathname) && location.pathname !== '/campaigns/new') || location.pathname.startsWith('/landing');

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center space-x-2 border-b border-slate-800">
          <div className="bg-gradient-to-tr from-blue-500 to-purple-500 p-2 rounded-lg">
            <Sparkles size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">MarketGen AI</span>
        </div>

        <nav className="p-4 mt-4">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            path="/" 
            active={location.pathname === '/'} 
          />
          <SidebarItem 
            icon={Megaphone} 
            label="Campaigns" 
            path="/campaigns" 
            active={location.pathname.startsWith('/campaigns')} 
          />
          <SidebarItem
            icon={Package}
            label="Products"
            path="/products"
            active={location.pathname.startsWith('/products')}
          />
          <SidebarItem
            icon={Palette}
            label="Brands"
            path="/brands"
            active={location.pathname.startsWith('/brands')}
          />
          <SidebarItem
            icon={ShieldCheck}
            label="Compliance Rules"
            path="/compliance-rules"
            active={location.pathname.startsWith('/compliance-rules')}
          />
          <SidebarItem
            icon={Globe}
            label="Landing Pages"
            path="/landing"
            active={location.pathname.startsWith('/landing')}
          />
          <SidebarItem
            icon={Settings}
            label="Settings"
            path="/settings"
            active={location.pathname === '/settings'}
          />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800">
          {usageInfo && (
            <div className="mb-3 px-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Usage Today</span>
                <span className="text-[10px] text-slate-500">{usageInfo.generationCount}/{usageInfo.limit}</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    usageInfo.generationCount >= usageInfo.limit
                      ? 'bg-red-500'
                      : usageInfo.generationCount >= usageInfo.limit * 0.8
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${usageInfo.limit > 0 ? Math.min(100, (usageInfo.generationCount / usageInfo.limit) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 flex items-center justify-center text-xs font-bold text-slate-900">
              {(userName || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{userName || 'User'}</p>
              <p className="text-xs text-slate-400">
                {usageInfo ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    usageInfo.tier === 'pro'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {usageInfo.tier}
                  </span>
                ) : 'Marketer Admin'}
              </p>
            </div>
            <button onClick={onSignOut} title="Sign out">
              <LogOut size={16} className="text-slate-400 hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-40">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center space-x-4 ml-auto">
             <div className="relative">
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <Bell size={20} className="text-slate-500 hover:text-slate-700 cursor-pointer" />
             </div>
             <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
             <button className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
               Help & Support
             </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className={`flex-1 bg-slate-50/50 ${isCanvasRoute ? 'overflow-hidden' : 'overflow-auto p-4 md:p-8'}`}>
          <div className={`animate-fadeIn ${isCanvasRoute ? 'h-full' : 'max-w-7xl mx-auto'}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};
