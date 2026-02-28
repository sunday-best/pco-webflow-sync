import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutGrid, Plus, Settings, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Layout({ children, currentPageName }) {
  const navItems = [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutGrid },
    { name: 'New Connection', page: 'NewConnection', icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight">PCO → Webflow Sync</h1>
                <p className="text-xs text-slate-500">by Sunday Best</p>
              </div>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive 
                        ? "bg-slate-100 text-slate-900" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}