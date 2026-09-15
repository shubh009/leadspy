import React, { useState } from 'react';
import { 
  FolderKanban, 
  Search, 
  Plus, 
  Download, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Globe, 
  ArrowUpRight, 
  ChevronRight,
  Filter,
  BarChart2,
  Users,
  Building2,
  Trash2,
  Layers,
  Sparkles
} from 'lucide-react';

import DeleteConfirmModal from './DeleteConfirmModal';

export default function CampaignsView({ 
  campaigns = [], 
  onSelectCampaign, 
  onExportCampaign, 
  onNewCampaign,
  onNavigateToChat,
  onDeleteCampaign
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [campaignToDelete, setCampaignToDelete] = useState(null);

  // Map enriched campaigns from campaigns state
  const displayCampaigns = campaigns.map((c, i) => ({
    id: c.id || `camp-${i}`,
    title: c.title || 'Target Campaign',
    query: c.query || 'Google Maps Leads',
    leadsCount: typeof c.leadsCount === 'number' ? c.leadsCount : 15,
    status: c.active !== undefined ? (c.active ? 'Active' : 'Completed') : (i === 0 ? 'Active' : 'Completed'),
    date: c.date || 'Sep 2026',
    location: c.location || (c.title?.includes('Agra') ? 'Agra, UP' : c.title?.includes('Delhi') ? 'South Delhi' : 'Delhi NCR'),
    verifiedPhonePercent: c.verifiedPhonePercent || '93%',
    noWebsiteCount: c.noWebsiteCount ?? Math.round((c.leadsCount || 15) * 0.4),
    category: c.category || (c.title?.includes('Real Estate') ? 'Real Estate' : c.title?.includes('Doctor') || c.title?.includes('Dermatologist') ? 'Healthcare' : 'Local Business'),
    color: i % 3 === 0 ? 'orange' : i % 3 === 1 ? 'emerald' : 'blue'
  }));

  const filteredCampaigns = displayCampaigns.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'ALL' || c.category === selectedTag;
    return matchesSearch && matchesTag;
  });

  const totalLeads = displayCampaigns.reduce((acc, c) => acc + (c.leadsCount || 0), 0);
  const totalNoWebsite = displayCampaigns.reduce((acc, c) => acc + (c.noWebsiteCount || 0), 0);

  return (
    <div className="flex-1 bg-[#f4f6fa] flex flex-col h-full overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-800 text-base">Lead Campaigns</h1>
            <p className="text-[11px] text-gray-500">Organize and manage your targeted outreach pipelines</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onNavigateToChat}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl shadow-sm shadow-orange-500/20 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Search Campaign</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Total Campaigns</span>
              <FolderKanban className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{displayCampaigns.length}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <span>● {displayCampaigns.filter(c => c.status === 'Active').length} Active Pipelines</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Scraped Leads</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalLeads}</div>
            <div className="text-[11px] text-gray-500 mt-1">Google Maps verified businesses</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">No Website (Hot Intent)</span>
              <Globe className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600">{totalNoWebsite}</div>
            <div className="text-[11px] text-gray-500 mt-1">Prime candidates for web pitch</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Average Match Rate</span>
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">94.2%</div>
            <div className="text-[11px] text-gray-500 mt-1">Direct phone & locality verified</div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search campaigns by city, query, or niche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['ALL', 'Real Estate', 'Healthcare', 'Education'].map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer border ${
                  selectedTag === tag 
                    ? 'bg-gray-900 text-white border-gray-900 shadow-xs' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Cards Grid */}
        {filteredCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((camp) => (
              <div 
                key={camp.id}
                className="bg-white rounded-2xl border border-gray-200/80 hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition flex flex-col justify-between p-5 group"
              >
                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      camp.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {camp.status}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{camp.date}</span>
                    </span>
                  </div>

                  {/* Campaign Title & Query */}
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-orange-600 transition">
                    {camp.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{camp.location}</span>
                  </div>

                  {/* Stats Pill Box */}
                  <div className="bg-[#fafbfe] border border-gray-100 rounded-xl p-3 grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Leads Found</span>
                      <span className="text-sm font-bold text-gray-800">{camp.leadsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">No Website</span>
                      <span className="text-sm font-bold text-amber-600">{camp.noWebsiteCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Phone Verified</span>
                      <span className="text-sm font-bold text-emerald-600">{camp.verifiedPhonePercent}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Category</span>
                      <span className="text-xs font-semibold text-gray-700 truncate block">{camp.category}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button 
                    onClick={() => onSelectCampaign && onSelectCampaign(camp)}
                    className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition cursor-pointer"
                  >
                    <span>Open Pipeline</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => onExportCampaign && onExportCampaign(camp)}
                      className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                      title="Export Campaign Leads CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCampaignToDelete(camp);
                      }}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center max-w-md mx-auto my-12 space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No Campaigns Found</h3>
            <p className="text-xs text-gray-500">
              {searchQuery ? `No campaigns match "${searchQuery}".` : 'You have not created any search campaigns yet or they have been deleted.'}
            </p>
            <button
              onClick={onNavigateToChat}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl shadow-sm shadow-orange-500/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Search Campaign</span>
            </button>
          </div>
        )}
      </div>

      {/* Campaign Delete Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={!!campaignToDelete}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${campaignToDelete?.title}"? This action cannot be undone.`}
        itemCount={campaignToDelete?.leadsCount || 0}
        itemCountLabel="leads"
        confirmText="Delete Campaign"
        onConfirm={() => {
          if (campaignToDelete && onDeleteCampaign) {
            onDeleteCampaign(campaignToDelete.id);
          }
          setCampaignToDelete(null);
        }}
        onClose={() => setCampaignToDelete(null)}
      />
    </div>
  );
}
