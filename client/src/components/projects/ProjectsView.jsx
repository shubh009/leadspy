import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  RefreshCw, 
  Filter, 
  Bookmark, 
  Layers, 
  Clock, 
  Code2, 
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import ProjectCard from './ProjectCard';
import ProjectDetailModal from './ProjectDetailModal';
import { 
  fetchProjects, 
  searchProjectsNL, 
  saveProject, 
  fetchSavedProjects,
  triggerDiscoverySync 
} from '../../services/projectApi';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'Web Development', label: 'Web Development' },
  { id: 'Mobile App', label: 'Mobile App' },
  { id: 'UI/UX', label: 'UI/UX Design' },
  { id: 'SaaS', label: 'SaaS & MVPs' },
  { id: 'AI/ML', label: 'AI & Automation' },
];

const FRESHNESS_OPTIONS = [
  { id: '', label: 'Anytime' },
  { id: '1h', label: 'Just Posted (<2h)' },
  { id: '24h', label: 'Today (<24h)' },
  { id: '7d', label: 'This Week' },
];

const SUGGESTED_QUERIES = [
  'React & Next.js projects posted today',
  'Mobile app projects under $5,000',
  'UI/UX design for AI SaaS',
  'Python & AI automation gigs'
];

export default function ProjectsView() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'saved'
  const [projects, setProjects] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  // Search & Filters State
  const [nlQuery, setNlQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFreshness, setActiveFreshness] = useState('');
  const [activeTechFilter, setActiveTechFilter] = useState('');
  const [appliedChips, setAppliedChips] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Load projects from API
  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchProjects({
        category: activeCategory,
        tech: activeTechFilter,
        freshness: activeFreshness,
        limit: 24
      });
      if (res && res.data) {
        setProjects(res.data);
        setTotalCount(res.pagination?.total || res.data.length);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load user saved projects
  const loadSaved = async () => {
    try {
      const res = await fetchSavedProjects();
      if (res && res.data) {
        setSavedProjects(res.data);
      }
    } catch (err) {
      console.error('Failed to load saved projects:', err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadSaved();
  }, [activeCategory, activeFreshness, activeTechFilter]);

  // Handle Natural Language Search
  const handleNLSearch = async (e) => {
    if (e) e.preventDefault();
    if (!nlQuery.trim()) {
      loadProjects();
      setAppliedChips([]);
      return;
    }

    setLoading(true);
    try {
      const res = await searchProjectsNL(nlQuery);
      if (res && res.data) {
        setProjects(res.data);
        setTotalCount(res.pagination?.total || res.data.length);
        if (res.parsedQuery?.explanationChips) {
          setAppliedChips(res.parsedQuery.explanationChips);
        }
      }
    } catch (err) {
      console.error('NL Search failed:', err);
      showNotification('Search failed. Showing standard results.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Manual Crawl Sync
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerDiscoverySync();
      if (res && res.stats) {
        showNotification(`Discovered ${res.stats.saved} new project opportunities!`);
      } else {
        showNotification('Sync complete! Checking for fresh leads.');
      }
      await loadProjects();
    } catch (err) {
      showNotification('Sync completed with local cached leads.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Save
  const handleSaveToggle = async (projectId) => {
    try {
      await saveProject(projectId, 'saved');
      await loadSaved();
      showNotification('Project saved to your private pipeline!');
    } catch (err) {
      showNotification('Could not save project', 'error');
    }
  };

  const isProjectSaved = (projId) => {
    return savedProjects.some(s => s.project_id === projId || s.project?.id === projId);
  };

  const clearFilters = () => {
    setNlQuery('');
    setActiveCategory('all');
    setActiveFreshness('');
    setActiveTechFilter('');
    setAppliedChips([]);
    loadProjects();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0e0f15] overflow-hidden text-gray-200">
      
      {/* Top Header */}
      <div className="p-6 border-b border-[#1f2230] bg-[#12131c]/60 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Code2 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              IT Project Radar
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {totalCount} Opportunities
              </span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Real-time public client requirements across Reddit, Hacker News, LinkedIn & Tech Boards.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex rounded-xl bg-[#1a1c27] p-1 border border-white/5 text-xs font-medium">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'all' 
                  ? 'bg-orange-500 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Projects ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'saved' 
                  ? 'bg-orange-500 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved Pipeline ({savedProjects.length})
            </button>
          </div>

          {/* Sync Now Button */}
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1c1e2b] hover:bg-[#232635] text-gray-200 text-xs font-medium border border-white/5 transition cursor-pointer"
            title="Crawl internet sources for fresh opportunities"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Crawling...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        
        {/* Notification Toast */}
        {notification && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200 ${
            notification.type === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{notification.msg}</span>
          </div>
        )}

        {/* Natural Language AI Search Box */}
        {activeTab === 'all' && (
          <div className="space-y-3">
            <form onSubmit={handleNLSearch} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder="Ask anything... e.g. Find React projects from USA posted in last 24 hours"
                  className="w-full pl-11 pr-32 py-3 rounded-2xl bg-[#161823] border border-[#262838] focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 text-sm text-white placeholder-gray-500 outline-none transition shadow-inner"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-2 flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold shadow-md shadow-orange-500/20 hover:opacity-95 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Search</span>
                </button>
              </div>
            </form>

            {/* AI Suggested Queries */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-orange-400/80" />
                Quick Prompts:
              </span>
              {SUGGESTED_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setNlQuery(q);
                    searchProjectsNL(q).then(res => {
                      if (res && res.data) {
                        setProjects(res.data);
                        setTotalCount(res.pagination?.total || res.data.length);
                        if (res.parsedQuery?.explanationChips) {
                          setAppliedChips(res.parsedQuery.explanationChips);
                        }
                      }
                    });
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#191b26] hover:bg-[#202230] text-gray-400 hover:text-gray-200 border border-white/5 transition"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Filter Bar & Chips */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/5 flex-wrap">
              
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                      activeCategory === cat.id
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-[#181a25] text-gray-400 hover:text-gray-200 border border-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Freshness Filter */}
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {FRESHNESS_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveFreshness(opt.id)}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      activeFreshness === opt.id
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

            </div>

            {/* Active AI Applied Chips */}
            {appliedChips.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-orange-400 font-semibold">AI Applied:</span>
                {appliedChips.map((chip, idx) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-300 border border-orange-500/20 flex items-center gap-1"
                  >
                    {chip}
                  </span>
                ))}
                <button
                  onClick={clearFilters}
                  className="text-xs text-gray-400 hover:text-white underline ml-2 cursor-pointer"
                >
                  Reset all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Projects Grid / Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-[#161824] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : activeTab === 'saved' ? (
          // Saved Pipeline Screen
          <div>
            {savedProjects.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#141622] border border-white/5 space-y-3">
                <Bookmark className="w-8 h-8 text-gray-500 mx-auto" />
                <h3 className="text-base font-semibold text-white">No saved projects yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Browse the project feed and click the bookmark button on any opportunity to save it to your personal pipeline.
                </p>
                <button
                  onClick={() => setActiveTab('all')}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold shadow-md shadow-orange-500/20"
                >
                  Explore Feed
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedProjects.map((entry) => (
                  entry.project ? (
                    <ProjectCard
                      key={entry.id}
                      project={entry.project}
                      onSelect={(p) => setSelectedProject(p)}
                      onSave={handleSaveToggle}
                      isSaved={true}
                    />
                  ) : null
                ))}
              </div>
            )}
          </div>
        ) : (
          // All Projects Feed
          <div>
            {projects.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[#141622] border border-white/5 space-y-3">
                <Filter className="w-8 h-8 text-gray-500 mx-auto" />
                <h3 className="text-base font-semibold text-white">No matching projects found</h3>
                <p className="text-xs text-gray-400">
                  Try adjusting your keywords, tech stack, or freshness filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelect={(p) => setSelectedProject(p)}
                    onSave={handleSaveToggle}
                    isSaved={isProjectSaved(project.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSave={handleSaveToggle}
          isSaved={isProjectSaved(selectedProject.id)}
        />
      )}

    </div>
  );
}
