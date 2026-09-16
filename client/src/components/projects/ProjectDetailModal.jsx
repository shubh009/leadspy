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
  Copy
} from 'lucide-react';

export default function ProjectDetailModal({ project, onClose, onSave, isSaved = false }) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181a24] border border-[#272a38] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        
        {/* Header */}
        <div className="p-6 border-b border-[#272a38] flex items-start justify-between gap-4 bg-[#14151e]/50">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                {project.category}
              </span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
                project.freshnessBadge === 'Just Posted'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {project.freshnessBadge} • {project.timeAgo}
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 capitalize">
                Via {project.source}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white leading-snug">
              {project.title}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm custom-scrollbar">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#1f2230] border border-white/5 space-y-1">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Budget
              </span>
              <p className="font-semibold text-white text-sm">{project.budget || 'Negotiable'}</p>
              <p className="text-[10px] text-gray-400">{project.projectType}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#1f2230] border border-white/5 space-y-1">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                Client Location
              </span>
              <p className="font-semibold text-white text-sm">{project.clientLocation}</p>
              <p className="text-[10px] text-gray-400">Target Area</p>
            </div>
            <div className="p-3 rounded-xl bg-[#1f2230] border border-white/5 space-y-1">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                AI Lead Score
              </span>
              <p className="font-semibold text-amber-400 text-sm">{project.relevanceScore}/100</p>
              <p className="text-[10px] text-gray-400">{project.intent}</p>
            </div>
          </div>

          {/* AI Executive Summary */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 space-y-2">
            <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              AI Requirement Breakdown
            </div>
            <p className="text-gray-200 text-sm leading-relaxed">
              {project.summary}
            </p>
          </div>

          {/* Skills & Technologies */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Required Skills & Technologies
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {project.skills && project.skills.map((skill, idx) => (
                <span 
                  key={idx} 
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#222536] text-orange-300 border border-orange-500/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Original Client Requirement */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Original Requirement Text
            </h4>
            <div className="p-4 rounded-xl bg-[#13141c] border border-white/5 text-gray-300 text-xs leading-relaxed whitespace-pre-line font-mono max-h-48 overflow-y-auto">
              {project.description}
            </div>
          </div>

          {/* Client & Outreach Action Box */}
          <div className="p-4 rounded-xl bg-[#1e212f] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Posted by</p>
                <p className="text-sm font-semibold text-white">{project.clientName}</p>
              </div>
              {project.clientEmail && (
                <button 
                  onClick={() => handleCopyEmail(project.clientEmail)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-200 transition"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                  {copiedEmail ? 'Copied Email' : project.clientEmail}
                </button>
              )}
            </div>

            {/* Direct Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {project.clientEmail ? (
                <a
                  href={`mailto:${project.clientEmail}?subject=Regarding%20your%20${encodeURIComponent(project.title)}&body=Hi%20${encodeURIComponent(project.clientName)},%0D%0A%0D%0AI%20saw%20your%20requirement%20for%20${encodeURIComponent(project.title)}...`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-xs shadow-lg shadow-orange-500/20 hover:opacity-95 transition"
                >
                  <Mail className="w-4 h-4" />
                  Send Direct Email
                </a>
              ) : project.source === 'reddit' ? (
                <a
                  href={`https://reddit.com/message/compose/?to=${project.clientUsername}&subject=Regarding%20your%20project:%20${encodeURIComponent(project.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff4500] text-white font-medium text-xs shadow-lg shadow-[#ff4500]/20 hover:opacity-95 transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Reddit DM
                </a>
              ) : (
                <a
                  href={project.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-xs shadow-lg shadow-blue-600/20 hover:opacity-95 transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  Reach Out on {project.source}
                </a>
              )}

              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 font-medium text-xs border border-white/5 transition"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
                Open Original Post
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-[#272a38] bg-[#14151e] flex items-center justify-between">
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
              isSaved 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-emerald-400 text-emerald-400' : ''}`} />
            {isSaved ? 'Saved in Pipeline' : 'Save to Pipeline'}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
