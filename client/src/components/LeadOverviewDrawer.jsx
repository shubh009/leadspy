import React, { useState } from 'react';
import { 
  X, 
  Maximize2, 
  ExternalLink, 
  Copy, 
  Check, 
  Mail, 
  Phone, 
  Edit3, 
  Sparkles, 
  TrendingUp, 
  MapPin, 
  Clock,
  Zap,
  Flame,
  MessageSquare,
  AlertTriangle,
  Target,
  ArrowRight,
  ShieldCheck,
  Globe,
  FileText,
  Trash2
} from 'lucide-react';
import ClientAuditReportModal from './ClientAuditReportModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function LeadOverviewDrawer({ 
  lead, 
  isOpen, 
  onClose, 
  onUpdateStatus, 
  onOpenFullPage,
  onDeleteLead
}) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead?.status || 'New');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Drawer Main Tabs: 'diagnostic' | 'outreach' | 'intelligence' | 'activity'
  const [activeTab, setActiveTab] = useState('diagnostic');

  // Outreach sub-tone tab: 'hinglish' | 'english' | 'call'
  const [pitchTone, setPitchTone] = useState('hinglish');
  const [outreachToast, setOutreachToast] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  if (!isOpen || !lead) return null;

  const handleCopyPhone = () => {
    if (lead.phone) {
      navigator.clipboard.writeText(lead.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleCopyEmail = () => {
    if (lead.email) {
      navigator.clipboard.writeText(lead.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone;

  // Outreach pitches
  const pitches = lead.aiAudit?.pitches || {};
  const currentPitchText = pitchTone === 'hinglish' 
    ? (pitches.whatsappHinglish || `Namaste ${lead.name || lead.company}! Google Maps par aapka business dekha...`)
    : pitchTone === 'english'
      ? (pitches.whatsappEnglish || `Hi ${lead.name || lead.company}, noticed your business on Google Maps...`)
      : '';

  const handleCopyPitch = () => {
    if (currentPitchText) {
      navigator.clipboard.writeText(currentPitchText);
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  const handleLaunchWhatsApp = () => {
    if (!cleanPhone || cleanPhone.length < 10) {
      alert('Valid phone number not found for this lead.');
      return;
    }

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(currentPitchText)}`;
    window.open(waUrl, '_blank');

    if (onUpdateStatus) {
      onUpdateStatus(lead.id, 'Contacted');
      setCurrentStatus('Contacted');
    }

    setOutreachToast('🚀 WhatsApp opened! Lead marked as "Contacted" in CRM.');
    setTimeout(() => setOutreachToast(null), 4000);
  };

  const handleStartCall = () => {
    if (!lead.phone) {
      alert('Phone number missing for this lead.');
      return;
    }

    if (onUpdateStatus) {
      onUpdateStatus(lead.id, 'Contacted');
      setCurrentStatus('Contacted');
    }

    setOutreachToast('📞 Dialing lead! Status marked as "Contacted".');
    setTimeout(() => setOutreachToast(null), 4000);
    window.location.href = `tel:${lead.phone}`;
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

  const allStatuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Demo Scheduled', 'Negotiation'];

  const fitScore = lead.aiAudit?.fitScore || lead.score || 75;
  const tier = lead.aiAudit?.tier || (fitScore >= 80 ? 'HOT' : fitScore >= 55 ? 'WARM' : 'COLD');
  const payingCapacity = lead.aiAudit?.payingCapacity || (lead.score > 80 ? 'High' : 'Medium');
  const estimatedBudget = lead.aiAudit?.estimatedBudget || (lead.opportunity ? `₹${lead.opportunity.toLocaleString()}` : '₹25,000 - ₹50,000/mo');
  const leaksCount = lead.aiAudit?.digitalLeaks?.length || 2;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in">
      {/* Click outside to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Slide-over Drawer Panel - Wider for comfortable tabbed layout */}
      <aside className="w-full max-w-3xl lg:max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
        
        {/* Top Sticky Header */}
        <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">
              Lead Overview
            </h2>
            {tier === 'HOT' && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
                HOT PROSPECT
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAuditModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 hover:border-orange-300 text-orange-700 hover:bg-orange-100 text-xs font-bold transition cursor-pointer shadow-2xs"
              title="View & Export Client Audit PDF Report"
            >
              <FileText className="w-3.5 h-3.5 text-orange-600" />
              <span>Audit Report (PDF)</span>
            </button>

            <button
              onClick={() => onOpenFullPage ? onOpenFullPage(lead) : alert(`Full page view for: ${lead.name}`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-xs font-medium text-gray-600 hover:text-gray-900 transition hover:bg-gray-50 cursor-pointer"
            >
              <span>Full View</span>
              <Maximize2 className="w-3 h-3" />
            </button>

            {onDeleteLead && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-7 h-7 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                title="Delete Lead"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Outreach Toast Feedback */}
        {outreachToast && (
          <div className="bg-emerald-600 text-white text-xs font-semibold px-6 py-2 flex items-center justify-between animate-in slide-in-from-top duration-200">
            <span>{outreachToast}</span>
            <button onClick={() => setOutreachToast(null)} className="text-white/80 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Compact Lead Identity Strip */}
        <div className="px-6 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">
                {lead.name}
              </h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                {lead.title || 'Decision Maker'} @ <span className="text-gray-800 font-semibold">{lead.company || lead.name}</span>
              </p>
            </div>

            {/* Status Pill with Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsEditingStatus(!isEditingStatus)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 shadow-2xs cursor-pointer ${getStatusBadgeClass(currentStatus)}`}
                title="Click to update status"
              >
                <span>{currentStatus}</span>
                <Edit3 className="w-3 h-3 opacity-60" />
              </button>

              {isEditingStatus && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95">
                  <p className="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Change Status</p>
                  {allStatuses.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setCurrentStatus(s);
                        setIsEditingStatus(false);
                        if (onUpdateStatus) onUpdateStatus(lead.id, s);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 flex items-center justify-between ${
                        currentStatus === s ? 'text-orange-600 bg-orange-50/50 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      <span>{s}</span>
                      {currentStatus === s && <Check className="w-3 h-3 text-orange-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Contact Chips Row */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {/* Phone */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 min-w-0">
              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="font-mono text-gray-800 text-[11px] truncate font-medium">{lead.phone || 'No phone'}</span>
              {lead.phone && (
                <button onClick={handleCopyPhone} className="ml-auto text-gray-400 hover:text-gray-600 shrink-0">
                  {copiedPhone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 min-w-0">
              <MapPin className="w-3 h-3 text-orange-600 shrink-0" />
              <span className="text-gray-800 text-[11px] truncate font-medium" title={lead.location}>
                {lead.location || 'India'}
              </span>
            </div>

            {/* Google Rating */}
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 min-w-0">
              <Globe className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="text-gray-800 text-[11px] truncate font-medium">
                {lead.rating ? `${lead.rating}★ (${lead.reviewsCount || 0})` : 'Google Listing'}
              </span>
            </div>
          </div>

          {/* Contact Details & Social Links Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {lead.email && (
              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                <Mail className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="font-mono text-gray-800 text-[11px] font-medium">{lead.email}</span>
                <button onClick={handleCopyEmail} className="text-gray-400 hover:text-gray-600 ml-1 cursor-pointer">
                  {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            {lead.website && lead.website !== 'None' && (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-blue-50/60 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 text-[11px] font-medium transition cursor-pointer"
              >
                <Globe className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate max-w-[120px]">Website</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            )}

            {/* Social Media Badges */}
            {lead.instagram && (
              <a
                href={lead.instagram}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-pink-700 px-2.5 py-1.5 rounded-lg border border-pink-200 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                title="Open Instagram Profile"
              >
                <span>📸</span>
                <span>Instagram</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            )}

            {lead.facebook && (
              <a
                href={lead.facebook}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 px-2.5 py-1.5 rounded-lg border border-blue-200 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                title="Open Facebook Page"
              >
                <span>📘</span>
                <span>Facebook</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            )}

            {lead.linkedin && (
              <a
                href={lead.linkedin}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 px-2.5 py-1.5 rounded-lg border border-sky-200 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                title="Open LinkedIn Page"
              >
                <span>💼</span>
                <span>LinkedIn</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📑 CLEAN TAB NAVIGATION BAR (NO HORIZONTAL SCROLL) */}
        {/* ========================================================================= */}
        <div className="px-6 bg-white border-b border-gray-200 flex items-center justify-between gap-1 shrink-0 overflow-hidden select-none">
          {/* Tab 1: AI Diagnostic */}
          <button
            onClick={() => setActiveTab('diagnostic')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'diagnostic'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>AI Diagnostic</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
              tier === 'HOT' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {fitScore}%
            </span>
          </button>

          {/* Tab 2: 1-Click Outreach */}
          <button
            onClick={() => setActiveTab('outreach')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'outreach'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>1-Click Outreach</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              WhatsApp
            </span>
          </button>

          {/* Tab 3: CRM Signals */}
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'intelligence'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span>CRM Signals</span>
          </button>

          {/* Tab 4: Timeline */}
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-gray-800 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Activity Log</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 📦 TAB CONTENT CONTAINER */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: AI DIAGNOSTIC & AUDIT */}
          {activeTab === 'diagnostic' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Score & Tier Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50 border border-orange-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
                    <Zap className="w-5 h-5 fill-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">AI Propensity & Conversion Audit</h4>
                    <p className="text-[11px] text-gray-500">Evaluated against Indian local market benchmarks</p>
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-bold shadow-2xs border flex items-center gap-1.5 ${
                  tier === 'HOT'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20'
                    : 'bg-amber-500 text-white border-amber-600'
                }`}>
                  {tier === 'HOT' && <Flame className="w-3.5 h-3.5 fill-white" />}
                  <span>{fitScore}% · {tier === 'HOT' ? 'HOT CLIENT' : 'WARM FIT'}</span>
                </div>
              </div>

              {/* 1-Click Client Audit Report Callout */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Client Closing Asset</span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Generate an audit report for {lead.name} to send via WhatsApp or email.
                  </p>
                </div>
                <button
                  onClick={() => setShowAuditModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer shrink-0 ml-3 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Audit PDF</span>
                </button>
              </div>

              {/* 3 Metrics: Capacity, Est Budget, Burning Hook */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Paying Capacity</span>
                  <span className={`text-sm font-bold block mt-0.5 ${
                    payingCapacity === 'High' ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {payingCapacity} Capacity
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1 leading-tight line-clamp-2">
                    {lead.aiAudit?.capacityReason || 'Prime commercial locality with verified footfall.'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Est. Budget</span>
                  <span className="text-sm font-bold text-gray-900 block mt-0.5">
                    {estimatedBudget}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                    Healthy budget for monthly local digital services.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Primary Pain</span>
                  <span className="text-xs font-bold text-rose-700 block mt-0.5 truncate" title={lead.aiAudit?.primaryPain}>
                    {lead.aiAudit?.primaryPain || 'Missing Website'}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                    Immediate revenue leak.
                  </p>
                </div>
              </div>

              {/* Detected Digital Leaks Checklist */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Detected Digital Leaks (Why they will buy):</span>
                  </span>
                  <span className="text-[11px] text-gray-400">{leaksCount} issues flagged</span>
                </div>

                <div className="space-y-2">
                  {(lead.aiAudit?.digitalLeaks || [
                    { id: '1', title: 'No Official Website on Google Maps', desc: 'Losing 30-40 direct inquiries per month to rivals offering instant booking.', impact: 'Revenue Leak' },
                    { id: '2', title: 'Missing WhatsApp Consultation CTA', desc: 'Indian mobile visitors bounce without a direct WhatsApp button.', impact: 'Conversion Leak' }
                  ]).map((leak, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 bg-white p-3 rounded-xl border border-rose-100 shadow-2xs text-xs">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-gray-900 block">{leak.title}</span>
                        <p className="text-gray-600 text-[11px] leading-relaxed">{leak.desc}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold shrink-0">
                        {leak.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Local Competitor Gap (FOMO Hook) */}
              {lead.aiAudit?.competitorGap && (
                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                    <Target className="w-3.5 h-3.5 text-amber-600" />
                    <span>Local Competitor Gap (FOMO Hook)</span>
                  </div>
                  <p className="text-gray-800 text-xs leading-relaxed">
                    <span className="font-semibold">{lead.aiAudit.competitorGap.topRival}</span> is winning top spots with {lead.aiAudit.competitorGap.advantage}.
                  </p>
                  <p className="text-[11px] font-semibold text-rose-600 pt-0.5">
                    ⚠️ Estimated Loss: {lead.aiAudit.competitorGap.estimatedLoss}
                  </p>
                </div>
              )}

              {/* Quick Outreach Banner CTA */}
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('outreach')}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Switch to 1-Click Outreach Pitch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: 1-CLICK OUTREACH PITCH GENERATOR */}
          {activeTab === 'outreach' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Tone Selection Pills */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">Select Outreach Angle:</span>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setPitchTone('hinglish')}
                    className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      pitchTone === 'hinglish' 
                        ? 'bg-white text-emerald-700 shadow-2xs' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    💬 Hinglish (WhatsApp)
                  </button>
                  <button
                    onClick={() => setPitchTone('english')}
                    className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      pitchTone === 'english' 
                        ? 'bg-white text-emerald-700 shadow-2xs' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ✉️ Formal English
                  </button>
                  <button
                    onClick={() => setPitchTone('call')}
                    className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      pitchTone === 'call' 
                        ? 'bg-white text-emerald-700 shadow-2xs' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📞 30-Sec Call Script
                  </button>
                </div>
              </div>

              {/* Pitch Display Container */}
              {pitchTone === 'call' ? (
                /* 30-Sec Calling Battlecard */
                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3 text-xs shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Step 1: Icebreaker (5 sec)</span>
                    <p className="text-gray-800 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 font-medium leading-relaxed">
                      "{pitches.callScript?.icebreaker || `Namaste Sir, main local business growth team se bol raha hoon. Maine Google Maps par aapka ${lead.name} dekha...`}"
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Step 2: Burning Hook (15 sec)</span>
                    <p className="text-gray-800 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 font-medium leading-relaxed">
                      "{pitches.callScript?.hook || `Aapke customer reviews acche hain par verified website na hone se daily direct patient calls drop ho rahe hain.`}"
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Step 3: Offer & WhatsApp Preview (10 sec)</span>
                    <p className="text-gray-800 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 font-medium leading-relaxed">
                      "{pitches.callScript?.cta || `Main aapke is number par ek 1-minute ka sample mobile preview bhej raha hoon. Aap dekh kar batayein.`}"
                    </p>
                  </div>

                  <button
                    onClick={handleStartCall}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-blue-600/20"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Dial Now with Battlecard</span>
                  </button>
                </div>
              ) : (
                /* WhatsApp Text Box & 1-Click Send */
                <div className="space-y-3">
                  <div className="relative">
                    <textarea
                      readOnly
                      value={currentPitchText}
                      rows={6}
                      className="w-full text-xs text-gray-800 bg-white p-3.5 pr-10 rounded-xl border border-gray-200 focus:outline-hidden font-normal leading-relaxed shadow-2xs resize-none"
                    />
                    <button
                      onClick={handleCopyPitch}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition cursor-pointer"
                      title="Copy pitch text"
                    >
                      {copiedPitch ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* 1-Click WhatsApp Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLaunchWhatsApp}
                      className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-600/25"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Open in WhatsApp (1-Click Safe Send)</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                    </button>
                    <button
                      onClick={handleCopyPitch}
                      className="py-3 px-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition cursor-pointer shadow-2xs"
                    >
                      {copiedPitch ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Safety Guarantee Callout */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-[11px] leading-relaxed flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Ban Risk: Pre-fills message on your official WhatsApp Web/App so you have 100% human control.</span>
              </div>

            </div>
          )}

          {/* TAB 3: CRM SIGNALS & INTELLIGENCE */}
          {activeTab === 'intelligence' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* 6 Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
                  <span className="text-[10px] text-gray-400 block font-medium uppercase">Lead Fit Score</span>
                  <span className="text-base font-bold text-gray-900 mt-0.5 block">{fitScore} / 100</span>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
                  <span className="text-[10px] text-gray-400 block font-medium uppercase">Conversion Probability</span>
                  <span className="text-base font-bold text-emerald-600 mt-0.5 block">{lead.intelligence?.conversionProb || `${fitScore - 4}%`}</span>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
                  <span className="text-[10px] text-gray-400 block font-medium uppercase">Engagement Level</span>
                  <span className="text-sm font-bold text-gray-900 mt-1 block">{tier === 'HOT' ? 'High Intent' : 'Moderate'}</span>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
                  <span className="text-[10px] text-gray-400 block font-medium uppercase">Opportunity Size</span>
                  <span className="text-xs font-semibold text-gray-900 mt-1 block">{estimatedBudget}</span>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
                  <span className="text-[10px] text-gray-400 block font-medium uppercase">Buying Stage</span>
                  <span className="text-xs font-semibold text-gray-900 mt-1 block">{lead.intelligence?.buyingStage || 'Initial Outreach'}</span>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
                  <span className="text-[10px] text-gray-400 block font-medium uppercase">Listing Claimed</span>
                  <span className="text-xs font-semibold text-gray-900 mt-1 block">{lead.claimed ? 'Verified Listing' : 'Unclaimed'}</span>
                </div>
              </div>

              {/* AI Key Signals */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-gray-900 block">Key Signals Detected:</span>
                <ul className="space-y-1.5 text-xs text-gray-700">
                  {(lead.keySignals || [
                    'High review count indicating recurring footfall',
                    'Missing verified website on Google Maps profile',
                    'Active phone number with responsive business hours'
                  ]).map((sig, idx) => (
                    <li key={idx} className="flex items-start gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-orange-500 font-bold">•</span>
                      <span>{sig}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Recommendation */}
              <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200 text-xs text-gray-800 space-y-1">
                <span className="font-bold text-orange-900 block text-[11px] uppercase tracking-wider">AI Recommended Action</span>
                <p className="leading-relaxed">{lead.recommendedAction || 'Pitch 1-page mobile preview highlighting instant WhatsApp appointment booking.'}</p>
              </div>

            </div>
          )}

          {/* TAB 4: ACTIVITY LOG & TIMELINE */}
          {activeTab === 'activity' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-gray-900 block">Outreach & Activity History:</span>

              <div className="relative pl-5 space-y-4 border-l-2 border-gray-100 my-2">
                {(lead.activities || [
                  { id: '1', time: 'Today · Just now', text: `AI analyzed lead: ${fitScore}% fit score determined.` },
                  { id: '2', time: 'Today · Extracted', text: `Profile captured from Google Maps (${lead.category || 'Local Business'}).` }
                ]).map((act, i) => (
                  <div key={act.id || i} className="relative group">
                    <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-white border-2 border-orange-500 shadow-2xs group-hover:scale-125 transition" />
                    <div>
                      <span className="text-[11px] font-semibold text-gray-500 block">{act.time}</span>
                      <p className="text-xs text-gray-800 mt-0.5 leading-relaxed font-normal">{act.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="p-3.5 border-t border-gray-200 bg-white flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('outreach');
              handleLaunchWhatsApp();
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-600/20"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Pitch</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('outreach');
              setPitchTone('call');
            }}
            className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition hover:bg-gray-50 cursor-pointer shadow-2xs"
          >
            <Phone className="w-3.5 h-3.5 text-gray-500" />
            <span>Call Script</span>
          </button>

          <a
            href={lead.email ? `mailto:${lead.email}?subject=Digital%20Growth%20Audit%20for%20${encodeURIComponent(lead.company)}` : '#'}
            onClick={(e) => {
              if (!lead.email) {
                e.preventDefault();
                alert('No email available for this lead.');
              }
            }}
            className="py-2.5 px-3 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition hover:bg-gray-50 cursor-pointer shadow-2xs"
          >
            <Mail className="w-3.5 h-3.5 text-gray-500" />
            <span>Email</span>
          </a>

          <button
            onClick={() => setIsEditingStatus(true)}
            className="py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-orange-500/20"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>

      </aside>

      {/* Client Audit Report Modal */}
      {showAuditModal && (
        <ClientAuditReportModal
          lead={lead}
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
        />
      )}

      {/* Delete Lead Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={showDeleteModal}
        title="Remove Lead"
        message={`Are you sure you want to remove "${lead.name || lead.company}"? This action cannot be undone.`}
        confirmText="Remove Lead"
        onConfirm={() => {
          if (onDeleteLead) {
            onDeleteLead(lead.id);
          }
          setShowDeleteModal(false);
        }}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
