import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Mail, 
  MessageSquare, 
  Bookmark, 
  Check, 
  Clock, 
  MapPin, 
  DollarSign, 
  Sparkles, 
  Layers, 
  ShieldCheck,
  Copy,
  Send,
  FileText,
  Building,
  Target,
  Briefcase
} from 'lucide-react';

export default function ProjectDetailModal({ project, onClose, onSave, isSaved = false }) {
  const [activeTab, setActiveTab] = useState('breakdown'); // 'breakdown' | 'source' | 'pitch'
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!project) return null;

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyPitch = () => {
    const clientGreeting = project.clientName || 'there';
    const pitchText = `Hi ${clientGreeting},

I saw your recent post regarding "${project.title}" on ${project.source || 'the web'} and wanted to reach out directly.

Our team specializes in ${project.category || 'software development'} (${project.skills?.slice(0, 3).join(', ') || 'modern tech stack'}). We have delivered similar solutions with rapid turnarounds and high engineering standards.

Would you be open to a quick 10-minute chat or exchanging a few details over email to see how we can help you build this out efficiently?

Best regards,
LeadSpy Partner Team`;

    navigator.clipboard.writeText(pitchText);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      if (onSave) await onSave(project.id);
    } finally {
      setSaving(false);
    }
  };

  // Helper to structure formatted readable text
  const cleanDescription = (project.description || project.summary || '')
    .replace(/\\n/g, '\n')
    .trim();

  const formattedParagraphs = cleanDescription
    .split(/\n{2,}|\.\s+(?=[A-Z])/)
    .map(p => p.trim())
    .filter(p => p.length > 15);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#12141e] border border-[#26293b] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        
        {/* Top Bar / Header */}
        <div className="p-5 sm:px-8 border-b border-[#26293b] bg-[#161826]/70 flex items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30 tracking-wide">
                {project.category}
              </span>
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                project.freshnessBadge === 'Just Posted'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {project.freshnessBadge} • {project.timeAgo}
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[#1d2030] text-gray-300 border border-white/5 capitalize">
                Via {project.source}
              </span>
              {project.intent && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {project.intent}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug tracking-tight">
              {project.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={project.sourceUrl} 
              target="_blank" 
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 border border-white/10 transition"
              title="Open original live URL"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              Source Post
            </a>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 sm:px-8 border-b border-[#26293b] bg-[#141624]">
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'breakdown'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Interactive Brief
          </button>

          <button
            onClick={() => setActiveTab('source')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'source'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Formatted Original Post
          </button>

          <button
            onClick={() => setActiveTab('pitch')}
            className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'pitch'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Send className="w-4 h-4 text-amber-400" />
            Ready-to-Send Pitch
          </button>
        </div>

        {/* 2-Column Responsive Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Main Content Area (7 Cols) */}
          <div className="lg:col-span-8 p-6 sm:p-8 overflow-y-auto space-y-6 border-b lg:border-b-0 lg:border-r border-[#26293b] custom-scrollbar">
            
            {activeTab === 'breakdown' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Executive Summary Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs uppercase tracking-wider">
                    <Target className="w-4 h-4" />
                    Core Project Objective
                  </div>
                  <p className="text-gray-100 text-sm sm:text-base leading-relaxed font-normal">
                    {project.summary || cleanDescription.substring(0, 300)}
                  </p>
                </div>

                {/* Key Deliverables & Scope */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    Extracted Scope & Requirements
                  </h4>
                  <div className="space-y-2.5">
                    {formattedParagraphs.slice(0, 4).map((para, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-[#171926] border border-white/5 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                          {para}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tech Stack & Required Skills */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Technologies & Skills Detected
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {project.skills && project.skills.length > 0 ? (
                      project.skills.map((skill, idx) => (
                        <span 
                          key={idx} 
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#1d2030] text-orange-300 border border-orange-500/20 shadow-sm"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500 italic">No specific frameworks declared (Open to stack recommendations)</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'source' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Original Source Document
                  </span>
                  <button
                    onClick={() => handleCopyText(cleanDescription)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText ? 'Copied' : 'Copy Text'}
                  </button>
                </div>
                
                <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/5 space-y-3">
                  {cleanDescription.split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} className="h-2" />;
                    return (
                      <p key={idx} className="text-xs sm:text-sm text-gray-300 leading-relaxed font-sans">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'pitch' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                  <span>💡 1-Click Tailored Outreach Proposal for this client</span>
                  <button
                    onClick={handleCopyPitch}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition"
                  >
                    {copiedPitch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedPitch ? 'Copied Pitch!' : 'Copy Proposal Draft'}
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-[#0e1017] border border-white/10 text-gray-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-mono">
{`Hi ${project.clientName || 'there'},

I saw your recent post regarding "${project.title}" on ${project.source || 'the web'} and wanted to reach out directly.

Our team specializes in ${project.category || 'software development'} (${project.skills?.slice(0, 3).join(', ') || 'modern tech stack'}). We have delivered similar solutions with rapid turnarounds and high engineering standards.

Would you be open to a quick 10-minute chat or exchanging a few details over email to see how we can help you build this out efficiently?

Best regards,
LeadSpy Partner Team`}
                </div>
              </div>
            )}

          </div>

          {/* Right Sidebar (4 Cols) - Client Hub & Commercials */}
          <div className="lg:col-span-4 p-6 sm:p-8 bg-[#141624]/60 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* Commercials Card */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Commercial Summary
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#1b1e2c] border border-white/5 space-y-1">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    Budget
                  </span>
                  <p className="font-bold text-white text-sm">{project.budget || 'Negotiable'}</p>
                  <p className="text-[10px] text-gray-400">{project.projectType || 'Contract'}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#1b1e2c] border border-white/5 space-y-1">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    Lead Score
                  </span>
                  <p className="font-bold text-amber-400 text-sm">{project.relevanceScore || 85}/100</p>
                  <p className="text-[10px] text-gray-400">Verified Demand</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1b1e2c] border border-white/5 space-y-1">
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  Target Location
                </span>
                <p className="font-semibold text-white text-xs">{project.clientLocation || 'Remote / Global'}</p>
              </div>
            </div>

            {/* Direct Outreach Hub */}
            <div className="p-5 rounded-2xl bg-[#1a1d2d] border border-orange-500/20 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-orange-400" />
                    Client Identity
                  </span>
                  <p className="text-sm font-bold text-white">
                    {project.clientCompany || project.clientName || 'Direct Client'}
                  </p>
                </div>
                {project.clientCompanyUrl && (
                  <a
                    href={project.clientCompanyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>

              {/* Action Buttons based on contact type */}
              <div className="space-y-2.5 pt-1">
                {project.clientEmail && (
                  <a
                    href={`mailto:${project.clientEmail}?subject=Regarding%20your%20requirement%20for%20${encodeURIComponent(project.title)}&body=Hi%20${encodeURIComponent(project.clientName || 'there')},%0D%0A%0D%0AI%20saw%20your%20project%20post%20for%20"${encodeURIComponent(project.title)}"....`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold text-xs shadow-lg shadow-orange-500/25 hover:opacity-95 transition"
                  >
                    <Mail className="w-4 h-4" />
                    Send Direct Email
                  </a>
                )}

                {project.clientEmail && (
                  <button 
                    onClick={() => handleCopyEmail(project.clientEmail)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-gray-300 border border-white/5 transition"
                  >
                    {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                    {copiedEmail ? 'Copied to Clipboard!' : `Copy ${project.clientEmail}`}
                  </button>
                )}

                {project.contactType === 'public_profile_message' && (
                  <a
                    href={project.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#ff4500] hover:bg-[#e03d00] text-white font-semibold text-xs shadow-lg shadow-[#ff4500]/25 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Direct DM to {project.clientName || 'Client'}
                  </a>
                )}

                {project.sourceUrl && (
                  <a
                    href={project.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-gray-300 border border-white/10 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    Open Live Original Post
                  </a>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 px-6 sm:px-8 border-t border-[#26293b] bg-[#12141e] flex items-center justify-between">
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              isSaved 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-emerald-400 text-emerald-400' : ''}`} />
            {isSaved ? 'Saved in Pipeline' : 'Save to Pipeline'}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
