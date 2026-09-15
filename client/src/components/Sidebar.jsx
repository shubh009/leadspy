import React from 'react';
import { 
  Bot, 
  Users,
  Layers, 
  FolderKanban, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  LogOut, 
  Sparkles, 
  Compass,
  Zap
} from 'lucide-react';

export default function Sidebar({ activeNav = 'chat', onNavChange, leadsCount = 0 }) {
  const navItems = [
    { id: 'chat', label: 'AI Lead Finder', icon: Bot, isPro: false },
    { id: 'campaigns', label: 'Lead Campaigns', icon: FolderKanban, isPro: false },
    { id: 'leads', label: 'Leads & CRM', icon: Users, isPro: false, badge: leadsCount > 0 ? leadsCount : null },
    { id: 'statistics', label: 'Analytics', icon: BarChart3, isPro: true },
    { id: 'settings', label: 'Settings', icon: Settings, isPro: false },
    { id: 'faq', label: 'Updates & FAQ', icon: HelpCircle, isPro: false },
  ];

  return (
    <aside className="w-64 bg-[#14151b] text-gray-300 flex flex-col justify-between h-full p-4 select-none shrink-0 border-r border-[#20222b]">
      {/* Brand Top */}
      <div>
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold text-lg">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <span className="font-semibold text-white text-base tracking-tight flex items-center gap-1.5">
                LeadSpy
                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-mono font-bold">AI</span>
              </span>
              <p className="text-[11px] text-gray-400">Maps Lead Intelligence</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition">
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavChange && onNavChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#222430] text-white shadow-sm ring-1 ring-white/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1b24]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && !item.isPro && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {item.isPro && (
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-950/60 text-orange-400 border border-orange-800/40">
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pro Card & Logout */}
      <div className="space-y-4 pt-4">
        {/* Glowing Orange Card from Reference UI */}
        <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-orange-500 via-rose-500 to-amber-600 text-white shadow-xl shadow-orange-500/15">
          {/* Subtle light bubble overlay */}
          <div className="absolute top-2 right-2 w-16 h-16 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/15 rounded-full blur-lg pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-amber-200" />
              <h4 className="font-semibold text-sm">Turbo Scraping</h4>
            </div>
            <p className="text-[11px] text-white/85 leading-relaxed mb-3.5">
              Extract 500+ verified Google Maps leads per day with auto email enrichment!
            </p>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-white/70 block">Starting at</span>
                <span className="font-bold text-sm">$19<span className="text-xs font-normal">/mo</span></span>
              </div>
              <button className="px-3.5 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-semibold hover:bg-gray-100 transition shadow-sm">
                Get Pro
              </button>
            </div>
          </div>
        </div>

        {/* Log Out */}
        <button className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition">
          <span className="flex items-center gap-2">
            <span>Log out</span>
          </span>
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
