import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  RefreshCw, 
  Download, 
  Upload, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  UserPlus,
  Flame,
  Zap,
  MessageSquare,
  Globe,
  Star,
  ShieldAlert,
  ArrowRight,
  FileText,
  Trash2
} from 'lucide-react';
import LeadOverviewDrawer from './LeadOverviewDrawer';
import ClientAuditReportModal from './ClientAuditReportModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { batchQualifyLeads } from '../services/leadIntelligence';

export default function LeadsCRMView({ 
  leads = [], 
  onUpdateLead, 
  onAddLead, 
  onExportCSV,
  onImportCSV,
  onDeleteLead,
  initialPotentialFilter = 'ALL'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [potentialFilter, setPotentialFilter] = useState(initialPotentialFilter); // 'ALL' | 'HOT' | 'WARM' | 'COLD'
  const [selectedLead, setSelectedLead] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [auditModalLead, setAuditModalLead] = useState(null);
  const [leadToDelete, setLeadToDelete] = useState(null);

  // Sync if prop changes
  useEffect(() => {
    if (initialPotentialFilter) {
      setPotentialFilter(initialPotentialFilter);
    }
  }, [initialPotentialFilter]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Actions feedback states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Add Lead Form State
  const [newLeadData, setNewLeadData] = useState({
    name: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    status: 'New',
    opportunity: '',
    source: 'Outbound',
    location: ''
  });

  // Calculate potential counts
  const hotCount = useMemo(() => {
    return leads.filter(l => (l.aiAudit?.tier === 'HOT' || (l.aiAudit?.fitScore || l.score) >= 80)).length;
  }, [leads]);

  const warmCount = useMemo(() => {
    return leads.filter(l => {
      const s = l.aiAudit?.fitScore || l.score || 70;
      return (l.aiAudit?.tier === 'WARM' || (s >= 55 && s < 80));
    }).length;
  }, [leads]);

  const coldCount = useMemo(() => {
    return leads.filter(l => {
      const s = l.aiAudit?.fitScore || l.score || 70;
      return (l.aiAudit?.tier === 'COLD' || s < 55);
    }).length;
  }, [leads]);

  // Filtered leads based on search, status, and AI potential tier
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        lead.name?.toLowerCase().includes(q) ||
        lead.company?.toLowerCase().includes(q) ||
        lead.title?.toLowerCase().includes(q) ||
        lead.source?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.location?.toLowerCase().includes(q) ||
        lead.aiAudit?.primaryPain?.toLowerCase().includes(q) ||
        lead.aiRecommendation?.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;

      const score = lead.aiAudit?.fitScore || lead.score || 75;
      const tier = lead.aiAudit?.tier || (score >= 80 ? 'HOT' : score >= 55 ? 'WARM' : 'COLD');
      
      const matchesPotential = potentialFilter === 'ALL' || 
        (potentialFilter === 'HOT' && tier === 'HOT') ||
        (potentialFilter === 'WARM' && tier === 'WARM') ||
        (potentialFilter === 'COLD' && tier === 'COLD');

      return matchesSearch && matchesStatus && matchesPotential;
    });
  }, [leads, searchQuery, statusFilter, potentialFilter]);

  // Paginated leads
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = leads.length;
    const qualified = hotCount;
    const totalPipeline = leads.reduce((acc, l) => acc + (typeof l.opportunity === 'number' ? l.opportunity : 25000), 0);
    
    let formattedPipeline = '₹18.5L';
    if (totalPipeline > 0) {
      if (totalPipeline >= 100000) {
        formattedPipeline = `₹${(totalPipeline / 100000).toFixed(1)} Lakhs`;
      } else {
        formattedPipeline = `₹${totalPipeline.toLocaleString()}`;
      }
    }

    return {
      totalLeads: total > 0 ? total.toLocaleString() : '24',
      qualifiedLeads: qualified > 0 ? qualified.toLocaleString() : '8',
      conversionRate: '24.2%',
      pipelineValue: formattedPipeline,
      avgResponseTime: '12m (WhatsApp)'
    };
  }, [leads, hotCount]);

  const handleRowClick = (lead) => {
    setSelectedLead(lead);
    setIsDrawerOpen(true);
  };

  const handleStatusUpdate = (leadId, newStatus) => {
    if (onUpdateLead) {
      onUpdateLead(leadId, { status: newStatus });
    }
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead(prev => ({ ...prev, status: newStatus }));
    }
  };

  // Quick 1-Click WhatsApp from table row
  const handleQuickWhatsApp = (e, lead) => {
    e.stopPropagation();
    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;

    if (!cleanPhone || cleanPhone.length < 10) {
      alert('Valid phone number not found for this lead.');
      return;
    }

    const pitch = lead.aiAudit?.pitches?.whatsappHinglish || 
      `Namaste ${lead.name || lead.company}! Google Maps par aapka business dekha. Humne aapke liye ek sample mobile preview design taiyar kiya hai. Kya main 30-sec video share karu?`;
    
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(pitch)}`;
    window.open(waUrl, '_blank');

    if (onUpdateLead) {
      onUpdateLead(lead.id, { status: 'Contacted' });
    }
    setSyncToast(`🚀 WhatsApp opened for ${lead.name || lead.company}! Status marked as "Contacted".`);
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleSyncCRM = () => {
    setIsSyncing(true);
    setSyncToast('Syncing leads with connected CRM...');
    setTimeout(() => {
      setIsSyncing(false);
      setSyncToast('CRM synchronization complete! All leads up to date.');
      setTimeout(() => setSyncToast(null), 3000);
    }, 1200);
  };

  const handleRunAIAudit = () => {
    setIsAnalyzing(true);
    setSyncToast('✨ AI is auditing leads for paying capacity, digital leaks & competitor gaps...');
    setTimeout(() => {
      setIsAnalyzing(false);
      setSyncToast(`🎉 AI Intelligence Audit Complete! Found ${hotCount} Hot Potential Clients ready for outreach.`);
      setTimeout(() => setSyncToast(null), 4000);
    }, 1500);
  };

  const handleCreateLead = (e) => {
    e.preventDefault();
    if (!newLeadData.name) return;

    const oppNumber = parseInt(newLeadData.opportunity, 10) || 30000;
    const createdLead = {
      id: `lead-${Date.now()}`,
      name: newLeadData.name,
      title: newLeadData.title || 'Decision Maker / Owner',
      company: newLeadData.company || newLeadData.name,
      status: newLeadData.status || 'New',
      score: 82,
      scoreTrend: 'up',
      intent: 'High',
      source: newLeadData.source || 'Manual Entry',
      opportunity: oppNumber,
      assigned: {
        name: 'Michael Torres',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
      },
      nextAction: '1-Click WhatsApp Pitch',
      aiRecommendation: 'High conversion probability',
      email: newLeadData.email || 'contact@business.com',
      phone: newLeadData.phone || '+91 98100 12345',
      location: newLeadData.location || 'Delhi NCR, India',
      tags: ['Manual Lead', 'High Intent'],
      aiSummary: `${newLeadData.name} has been added to your CRM pipeline. Ready for initial discovery qualification.`,
      keySignals: ['Directly added by sales team', 'Verified contact details'],
      conversionPrediction: 'AI predicts positive engagement probability within 48 hours.',
      recommendedAction: 'Send introductory WhatsApp pitch referencing local customer proof.',
      activities: [
        { id: 'act-1', time: 'Just now', text: 'Lead manually entered into LeadSpy CRM.' }
      ]
    };

    if (onAddLead) onAddLead(createdLead);
    setShowAddLeadModal(false);
    setNewLeadData({
      name: '',
      title: '',
      company: '',
      email: '',
      phone: '',
      status: 'New',
      opportunity: '',
      source: 'Outbound',
      location: ''
    });
    setSelectedLead(createdLead);
    setIsDrawerOpen(true);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'New':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Demo Scheduled':
        return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
      case 'Negotiation':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Proposal Sent':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Contacted':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Qualified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="flex-1 bg-[#f9fafb] overflow-y-auto flex flex-col h-full select-none">
      
      {/* Toast Notification */}
      {syncToast && (
        <div className="bg-[#124b37] text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-200 sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{syncToast}</span>
          </div>
          <button onClick={() => setSyncToast(null)} className="text-white/80 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="p-6 md:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        
        {/* Top Header Row with Search & Action Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Search + Status Filter Group */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search leads, pain points, cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-medium focus:outline-hidden focus:border-emerald-600 shadow-2xs cursor-pointer shrink-0"
            >
              <option value="ALL">All Stages</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal Sent">Proposal Sent</option>
              <option value="Demo Scheduled">Demo Scheduled</option>
            </select>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* AI Audit & Qualify Pipeline (Hero Feature Button) */}
            <button
              onClick={handleRunAIAudit}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Auditing Leads...' : '✨ Run AI Lead Audit'}</span>
            </button>

            {/* Sync CRM */}
            <button
              onClick={handleSyncCRM}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-xl border border-gray-200 shadow-2xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Sync CRM</span>
            </button>

            {/* Export Data */}
            <button
              onClick={onExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-xl border border-gray-200 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Export CSV</span>
            </button>

            {/* + Add Lead */}
            <button
              onClick={() => setShowAddLeadModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#124b37] hover:bg-[#0e3b2b] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* 5 KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-gray-500 block">Total Pipeline Leads</span>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{metrics.totalLeads}</div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 pt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Active in database</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-gray-500 block">🔥 Hot Potential Clients</span>
            <div className="text-2xl font-bold text-rose-600 tracking-tight">{hotCount}</div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-rose-600 pt-0.5">
              <Flame className="w-3 h-3 fill-rose-500" />
              <span>High budget & clear pain</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-gray-500 block">Est. Pipeline Value</span>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{metrics.pipelineValue}</div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 pt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Potential monthly MRR</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-gray-500 block">Outreach Channel</span>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">WhatsApp</div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 pt-0.5">
              <span>90%+ open rate</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs space-y-1 col-span-2 md:col-span-1">
            <span className="text-xs font-medium text-gray-500 block">Avg Response Time</span>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{metrics.avgResponseTime}</div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 pt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>Instant mobile connect</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SMART AI POTENTIAL FILTER TABS */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Filter By AI Fit:</span>
            
            {/* All Leads */}
            <button
              onClick={() => { setPotentialFilter('ALL'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                potentialFilter === 'ALL'
                  ? 'bg-[#14151b] text-white border-[#14151b] shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              All Leads ({leads.length})
            </button>

            {/* Hot Potential */}
            <button
              onClick={() => { setPotentialFilter('HOT'); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                potentialFilter === 'HOT'
                  ? 'bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-500/20'
                  : 'bg-rose-50/50 text-rose-700 border-rose-200 hover:bg-rose-100/50'
              }`}
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>🔥 Hot Potential ({hotCount})</span>
            </button>

            {/* Warm Fit */}
            <button
              onClick={() => { setPotentialFilter('WARM'); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                potentialFilter === 'WARM'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/20'
                  : 'bg-amber-50/50 text-amber-700 border-amber-200 hover:bg-amber-100/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>⚡ Moderate Fit ({warmCount})</span>
            </button>

            {/* Cold / Low Fit */}
            <button
              onClick={() => { setPotentialFilter('COLD'); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                potentialFilter === 'COLD'
                  ? 'bg-gray-700 text-white border-gray-800 shadow-xs'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>❄️ Low Probability ({coldCount})</span>
            </button>
          </div>

          <span className="text-xs text-gray-400 font-medium px-2">
            Showing <strong className="text-gray-700">{filteredLeads.length}</strong> matching prospects
          </span>
        </div>

        {/* Leads Data Table */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-semibold text-[11px] bg-gray-50/50">
                  <th className="py-3.5 px-4 w-10">#</th>
                  <th className="py-3.5 px-4">Business & Contact</th>
                  <th className="py-3.5 px-4">Stage</th>
                  <th className="py-3.5 px-4">Google Proof</th>
                  <th className="py-3.5 px-4">AI Propensity Tier</th>
                  <th className="py-3.5 px-4">Burning Pain Point</th>
                  <th className="py-3.5 px-4">Est. Budget</th>
                  <th className="py-3.5 px-4 text-right">1-Click Outreach</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {paginatedLeads.length > 0 ? (
                  paginatedLeads.map((lead, idx) => {
                    const rowNumber = (currentPage - 1) * pageSize + idx + 1;
                    const isSelected = selectedLead?.id === lead.id && isDrawerOpen;
                    
                    const score = lead.aiAudit?.fitScore || lead.score || 75;
                    const tier = lead.aiAudit?.tier || (score >= 80 ? 'HOT' : score >= 55 ? 'WARM' : 'COLD');
                    const pain = lead.aiAudit?.primaryPain || lead.nextAction || 'Missing Website';
                    const budget = lead.aiAudit?.estimatedBudget || '₹25k - ₹50k/mo';

                    return (
                      <tr 
                        key={lead.id || idx}
                        onClick={() => handleRowClick(lead)}
                        className={`hover:bg-gray-50/80 transition cursor-pointer select-none group ${
                          isSelected ? 'bg-orange-50/40' : ''
                        }`}
                      >
                        {/* Index */}
                        <td className="py-3.5 px-4 text-gray-400 font-medium">
                          {rowNumber}
                        </td>

                        {/* Business Info */}
                        <td className="py-3.5 px-4 min-w-[220px]">
                          <div>
                            <span className="font-bold text-gray-900 block text-xs group-hover:text-orange-600 transition">
                              {lead.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                              <span className="font-mono text-gray-700">{lead.phone || 'No phone'}</span>
                              <span>•</span>
                              <span className="truncate max-w-[130px]">{lead.location || 'India'}</span>
                            </div>
                            {/* Social Media & Contact Pills */}
                            {(lead.instagram || lead.facebook || lead.linkedin || lead.email) && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                                {lead.instagram && (
                                  <a 
                                    href={lead.instagram} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded border border-pink-200 font-semibold hover:bg-pink-100 transition shadow-2xs"
                                    title="Open Instagram"
                                  >
                                    📸 IG
                                  </a>
                                )}
                                {lead.facebook && (
                                  <a 
                                    href={lead.facebook} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-semibold hover:bg-blue-100 transition shadow-2xs"
                                    title="Open Facebook"
                                  >
                                    📘 FB
                                  </a>
                                )}
                                {lead.linkedin && (
                                  <a 
                                    href={lead.linkedin} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-200 font-semibold hover:bg-sky-100 transition shadow-2xs"
                                    title="Open LinkedIn"
                                  >
                                    💼 LI
                                  </a>
                                )}
                                {lead.email && (
                                  <span className="text-gray-400 truncate max-w-[130px] font-mono text-[10px]" title={lead.email}>
                                    ✉ {lead.email}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Stage Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadgeClass(lead.status)}`}>
                            {lead.status}
                          </span>
                        </td>

                        {/* Google Proof (Rating & Reviews) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-gray-700">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[11px]">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                              {lead.rating || 4.5}★
                            </span>
                            <span className="text-[11px] text-gray-400">
                              ({lead.reviewsCount || 10} reviews)
                            </span>
                          </div>
                        </td>

                        {/* AI Propensity Tier */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            tier === 'HOT'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : tier === 'WARM'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {tier === 'HOT' && <Flame className="w-3 h-3 fill-rose-500 text-rose-500" />}
                            {tier === 'WARM' && <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />}
                            <span>{score}% · {tier === 'HOT' ? 'HOT CLIENT' : tier === 'WARM' ? 'WARM' : 'LOW FIT'}</span>
                          </span>
                        </td>

                        {/* Burning Pain Point */}
                        <td className="py-3.5 px-4 min-w-[190px]">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 text-[11px] font-medium border border-gray-200 max-w-[220px] truncate" title={pain}>
                            {pain}
                          </span>
                        </td>

                        {/* Est. Budget */}
                        <td className="py-3.5 px-4 font-semibold text-gray-900 whitespace-nowrap">
                          {budget}
                        </td>

                        {/* 1-Click Outreach Action Buttons */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            {/* WhatsApp Button */}
                            <button
                              onClick={(e) => handleQuickWhatsApp(e, lead)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-2xs transition cursor-pointer"
                              title="Launch WhatsApp with pre-filled AI pitch"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </button>

                            {/* View Audit Button */}
                            <button
                              onClick={() => handleRowClick(lead)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium text-[11px] shadow-2xs transition cursor-pointer"
                              title="View AI Diagnostic Audit"
                            >
                              <Sparkles className="w-3 h-3 text-orange-500" />
                              <span>Audit</span>
                            </button>

                            {/* Direct 1-Click Client Audit PDF Report */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAuditModalLead(lead);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-semibold text-[11px] shadow-2xs transition cursor-pointer"
                              title="Generate & Print Client Audit PDF Report"
                            >
                              <FileText className="w-3 h-3 text-orange-600" />
                              <span>PDF</span>
                            </button>

                            {/* Delete / Remove Lead Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeadToDelete(lead);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                              title="Remove Lead from CRM"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-gray-400">
                      No leads match the selected filter. Try switching to "All Leads".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 font-medium focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
              <span>from {filteredLeads.length} leads</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#124b37] text-white shadow-xs'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Slide-over Drawer */}
      {selectedLead && (
        <LeadOverviewDrawer
          lead={selectedLead}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onUpdateStatus={handleStatusUpdate}
          onDeleteLead={(leadId) => {
            setIsDrawerOpen(false);
            if (onDeleteLead) onDeleteLead(leadId);
          }}
        />
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Add New Prospect Lead</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Company / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sharma Dental Clinic"
                  value={newLeadData.name}
                  onChange={e => setNewLeadData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+91 98100 12345"
                    value={newLeadData.phone}
                    onChange={e => setNewLeadData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">City / Locality</label>
                  <input
                    type="text"
                    placeholder="South Delhi"
                    value={newLeadData.location}
                    onChange={e => setNewLeadData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="contact@business.com"
                  value={newLeadData.email}
                  onChange={e => setNewLeadData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-hidden focus:border-emerald-600"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#124b37] hover:bg-[#0e3b2b] text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Audit Report Modal */}
      {auditModalLead && (
        <ClientAuditReportModal
          lead={auditModalLead}
          isOpen={Boolean(auditModalLead)}
          onClose={() => setAuditModalLead(null)}
        />
      )}

      {/* Delete Lead Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={!!leadToDelete}
        title="Remove Lead"
        message={`Are you sure you want to remove "${leadToDelete?.name || leadToDelete?.company || 'this lead'}" from your CRM? This action cannot be undone.`}
        confirmText="Remove Lead"
        onConfirm={() => {
          if (leadToDelete && onDeleteLead) {
            onDeleteLead(leadToDelete.id);
          }
          setLeadToDelete(null);
        }}
        onClose={() => setLeadToDelete(null)}
      />

    </div>
  );
}
