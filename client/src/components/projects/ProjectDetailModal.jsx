import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Mail, 
  Bookmark, 
  Check, 
  Clock, 
  MapPin, 
  DollarSign, 
  Sparkles, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Calendar, 
  FileText, 
  UserPlus, 
  CheckCircle2, 
  Flame, 
  Lightbulb, 
  Compass, 
  Code2, 
  Tag, 
  Layers 
} from 'lucide-react';

export default function ProjectDetailModal({ 
  project, 
  onClose, 
  onSave, 
  isSaved = false,
  onPrev,
  onNext
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  if (!project) return null;

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      if (onSave) await onSave(project.id);
    } finally {
      setSaving(false);
    }
  };

  // Helper to extract clean requirements list
  const fullDescription = (project.description || project.originalDescription || project.summary || '').trim();
  const rawBullets = fullDescription
    .split(/\n+|\.\s+(?=[A-Z])/)
    .map(s => s.replace(/^[-•*–—\d.)\s]+/, '').trim())
    .filter(s => s.length > 20 && !s.toLowerCase().includes('contact') && !s.toLowerCase().includes('http'));

  const requirementBullets = rawBullets.length > 0 ? rawBullets.slice(0, 5) : [
    `Implement core ${project.category || 'software'} functionality according to client specification`,
    `Ensure responsive, high-performance, and reliable execution`,
    `Maintain modern architecture and clean coding standards`,
    `Seamless integration with client workflow and APIs`,
    `Provide documentation and delivery support`
  ];

  // Client initial for avatar
  const clientDisplayName = project.clientName || project.author || 'Client';
  const clientInitial = clientDisplayName.charAt(0).toUpperCase() || 'C';

  // Issue or Post ID snippet
  const postIdNumber = (project.sourcePostId || '').replace(/\D/g, '').slice(-4) || '195';

  // Primary contact action URL & Label
  let contactUrl = project.sourceUrl;
  let contactLabel = `Contact ${clientDisplayName}`;
  let contactSubtext = `Open ${project.source || 'source'} discussion`;

  if (project.contactType === 'email' && project.clientEmail) {
    contactUrl = `mailto:${project.clientEmail}?subject=Regarding%20your%20${encodeURIComponent(project.title)}&body=Hi%20${encodeURIComponent(clientDisplayName)},%0D%0A%0D%0AI%20saw%20your%20requirement%20for%20${encodeURIComponent(project.title)}...`;
    contactLabel = `Email ${clientDisplayName}`;
    contactSubtext = project.clientEmail;
  } else if (project.contactType === 'public_profile_message') {
    contactUrl = project.clientProfileUrl || project.sourceUrl;
    contactLabel = `Message ${clientDisplayName}`;
    contactSubtext = `Direct profile outreach on ${project.source}`;
  } else if (project.clientCompanyUrl || project.contactValue) {
    contactUrl = project.clientCompanyUrl || project.contactValue;
    contactLabel = `Visit ${project.clientCompany || 'Company'} Page`;
    contactSubtext = `Verified business portal`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#f8faff] text-gray-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden border border-white/60 my-auto flex flex-col font-sans">
        
        {/* ======================================================== */}
        {/* TOP BAR / HEADER */}
        {/* ======================================================== */}
        <div className="p-4 sm:px-8 bg-white border-b border-gray-200/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Source Brand Icon */}
            <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              {project.source === 'reddit' ? (
                <span className="font-bold text-lg text-orange-500">r/</span>
              ) : project.source === 'hackernews' ? (
                <span className="font-bold text-lg text-orange-400">Y</span>
              ) : (
                <Code2 className="w-5 h-5 text-white" />
              )}
            </div>

            {/* Breadcrumb info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 flex-wrap">
                <span className="capitalize">{project.source || 'GitHub'} Issue</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-600 truncate">{project.author || 'vogler75/monster-mq'}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500 font-normal">#{postIdNumber}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Discovered {project.timeAgo || 'recently'} • Posted {project.freshnessBadge || 'Fresh'}
              </p>
            </div>
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Prev / Next navigation */}
            <div className="flex items-center bg-gray-100/80 rounded-xl p-1 border border-gray-200/60">
              <button 
                onClick={onPrev}
                disabled={!onPrev}
                className="p-1.5 rounded-lg hover:bg-white text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Previous Project"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={onNext}
                disabled={!onNext}
                className="p-1.5 rounded-lg hover:bg-white text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Next Project"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View Original button */}
            <a
              href={project.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300/80 shadow-sm transition"
            >
              <span>View Original</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            </a>

            {/* Close modal */}
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2-COLUMN MODAL BODY */}
        {/* ======================================================== */}
        <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto max-h-[82vh] bg-[#f8faff]">
          
          {/* ------------------------------------------------------ */}
          {/* LEFT MAIN CONTENT (approx 65% / 8 Cols) */}
          {/* ------------------------------------------------------ */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Tags / Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#fff4eb] text-[#e65100] border border-[#ffe0cc]">
                🏷️ {project.category || 'Web Development'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9]">
                💻 {project.subcategory || 'Open Source'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f3e5f5] text-[#7b1fa2] border border-[#e1bee7]">
                {project.intent || 'Looking for Agency / Developer'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e3f2fd] text-[#1565c0] border border-[#bbdefb] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {project.freshnessBadge || 'Fresh'} ({project.timeAgo || '3 days ago'})
              </span>
            </div>

            {/* Main Project Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight leading-snug">
              {project.title}
            </h1>

            {/* Overview / Introduction Paragraph */}
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed font-normal">
              {project.summary || fullDescription.substring(0, 260)}
            </p>

            {/* Quick Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/50 to-blue-50/30 border border-purple-100/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Quick Summary</span>
                </div>
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed max-w-xl">
                  {fullDescription.length > 250 
                    ? fullDescription.substring(0, 220) + '...'
                    : fullDescription || 'Well-defined client scope requiring experienced development team.'}
                </p>
              </div>

              {/* Good Fit Pill Card */}
              <div className="bg-white/90 border border-purple-100 shadow-sm rounded-xl px-3.5 py-2 flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 leading-tight">Good Fit</p>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">
                    For {project.skills?.slice(0, 2).join(' / ') || 'Development'} Experts
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Requirements Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#eff6ff]/70 border border-blue-100 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Detailed Requirements</span>
              </div>
              <ul className="space-y-2.5">
                {requirementBullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700 leading-relaxed font-normal">
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom 2 Grid Cards: Tech Stack & Ideal For */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Tech Stack / Skills */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Tech Stack / Skills</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.skills && project.skills.length > 0 ? (
                    project.skills.map((skill, idx) => (
                      <span 
                        key={idx}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200/70 shadow-2xs"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    ['Full-Stack', 'APIs', 'Architecture', 'Clean Code'].map((skill, idx) => (
                      <span 
                        key={idx}
                        className="px-3 py-1 rounded-xl text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200/70"
                      >
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Ideal For */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span>Ideal For</span>
                </div>
                <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Developers with {project.skills?.[0] || 'domain'} experience</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Experience in {project.category || 'software'} systems</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Proven agency / contractor track record</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Familiar with {project.skills?.slice(0, 2).join(', ') || 'modern'} architecture</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* ------------------------------------------------------ */}
          {/* RIGHT SIDEBAR (approx 35% / 4 Cols) */}
          {/* ------------------------------------------------------ */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* 1. Lead Score Card */}
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {/* Circle Ring Score Badge */}
                  <div className="w-14 h-14 rounded-full border-4 border-emerald-400 bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <ShieldCheck className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold block">
                      Lead Score
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-emerald-600">
                        {project.relevanceScore || 88}
                      </span>
                      <span className="text-xs text-gray-400 font-semibold">/100</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold shrink-0">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span>High Potential</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-100">
                Well-defined requirement with active client intent and actionable reachability.
              </p>
            </div>

            {/* 2. Commercials & Metadata Grid (2x2) */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-sm grid grid-cols-2 gap-4">
              
              {/* Budget */}
              <div className="space-y-1">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">
                    $
                  </div>
                  Budget
                </span>
                <p className="font-bold text-gray-900 text-sm">{project.budget || 'Negotiable'}</p>
                <p className="text-[11px] text-gray-400">{project.projectType || 'Contract'}</p>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    <MapPin className="w-3 h-3" />
                  </div>
                  Location
                </span>
                <p className="font-bold text-gray-900 text-sm">{project.clientLocation || 'Remote'}</p>
                <p className="text-[11px] text-gray-400">Global / Worldwide</p>
              </div>

              {/* Timeline */}
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <div className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-xs">
                    <Calendar className="w-3 h-3" />
                  </div>
                  Timeline
                </span>
                <p className="font-bold text-gray-900 text-sm">Not specified</p>
                <p className="text-[11px] text-gray-400">Flexible</p>
              </div>

              {/* Project Type */}
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                    <FileText className="w-3 h-3" />
                  </div>
                  Project Type
                </span>
                <p className="font-bold text-gray-900 text-sm truncate">{project.category || 'Feature Development'}</p>
                <p className="text-[11px] text-gray-400 capitalize">{project.source || 'Direct'}</p>
              </div>

            </div>

            {/* 3. Author / Client Card */}
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                <span>Author / Client</span>
              </div>

              {/* Client Info Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 font-extrabold text-xl flex items-center justify-center shrink-0">
                    {clientInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm truncate">{clientDisplayName}</p>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                        Author
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 capitalize">{project.source} User</p>
                    <a 
                      href={project.clientProfileUrl || project.sourceUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium mt-0.5"
                    >
                      View Profile ↗
                    </a>
                  </div>
                </div>

                <button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${
                    isFollowing 
                      ? 'bg-blue-50 text-blue-700 border-blue-300' 
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isFollowing ? 'Following' : '+ Follow'}</span>
                </button>
              </div>

              {/* Primary Call to Action Button */}
              <div className="flex items-center gap-2 pt-2">
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/25 transition cursor-pointer"
                >
                  <Send className="w-4 h-4 text-white" />
                  <div className="text-left leading-tight">
                    <span className="text-xs sm:text-sm font-bold block">{contactLabel}</span>
                    <span className="text-[10px] opacity-80 block truncate max-w-[180px]">{contactSubtext}</span>
                  </div>
                </a>

                {/* Bookmark button */}
                <button
                  onClick={handleSaveClick}
                  disabled={saving}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    isSaved 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-300' 
                      : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                  title={isSaved ? 'Saved in Pipeline' : 'Save to Pipeline'}
                >
                  <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-emerald-500 text-emerald-500' : ''}`} />
                </button>
              </div>

              {/* Pro Tip */}
              <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-1.5 pt-1">
                <span className="text-amber-500 font-bold">⚡ Pro Tip:</span>
                <span>Mention relevant tech experience and project scope when reaching out for a higher response rate.</span>
              </p>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
