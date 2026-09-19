import React from 'react';
import { 
  Clock, 
  MapPin, 
  DollarSign, 
  Bookmark, 
  ExternalLink, 
  MessageSquare, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

export default function ProjectCard({ project, onSelect, onSave, isSaved = false }) {
  if (!project) return null;

  return (
    <div 
      onClick={() => onSelect(project)}
      className="group relative bg-[#171924] hover:bg-[#1c1e2b] border border-[#232635] hover:border-orange-500/30 rounded-2xl p-5 transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-orange-500/5 flex flex-col justify-between cursor-pointer"
    >
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              {project.category}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 ${
              project.freshnessBadge === 'Just Posted'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
            }`}>
              <Clock className="w-3 h-3" />
              {project.freshnessBadge} • {project.timeAgo}
            </span>
          </div>

          <span className="text-[11px] text-gray-400 capitalize px-2 py-0.5 rounded bg-white/5 font-mono">
            {project.source}
          </span>
        </div>

        {/* Project Title */}
        <h3 className="text-base font-semibold text-white group-hover:text-orange-400 transition-colors line-clamp-2 mb-2 leading-snug">
          {project.title}
        </h3>

        {/* AI Short Summary */}
        <p className="text-xs text-gray-400 line-clamp-2 mb-4 leading-relaxed">
          {project.summary}
        </p>

        {/* Skills Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.skills && project.skills.slice(0, 4).map((skill, idx) => (
            <span 
              key={idx} 
              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#212332] text-gray-300 border border-white/5"
            >
              {skill}
            </span>
          ))}
          {project.skills && project.skills.length > 4 && (
            <span className="text-[10px] text-gray-400 px-1 py-0.5 self-center">
              +{project.skills.length - 4} more
            </span>
          )}
        </div>

        {/* Actionable Contact Route Badge (Section 20 UI Requirement) */}
        <div className="flex items-center gap-1.5 mb-3">
          {project.contactType === 'email' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              ✓ Email available
            </span>
          ) : project.contactType === 'phone' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              ✓ Direct phone available
            </span>
          ) : project.contactType === 'public_business_contact' || project.contactType === 'public_company_website' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
              ✓ Public business contact
            </span>
          ) : project.contactType === 'public_profile_message' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              ✓ Direct profile outreach
            </span>
          ) : null}
        </div>
      </div>

      {/* Card Bottom: Budget, Client & Action */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-emerald-400 font-semibold">
            <DollarSign className="w-3.5 h-3.5" />
            <span>{project.budget || 'Negotiable'}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <MapPin className="w-3 h-3 text-blue-400" />
            <span>{project.clientLocation}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onSave && onSave(project.id)}
            title={isSaved ? "Saved" : "Save project"}
            className={`p-2 rounded-xl transition ${
              isSaved 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => onSelect(project)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold shadow-md shadow-orange-500/10 hover:opacity-95 transition"
          >
            <span>View</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
