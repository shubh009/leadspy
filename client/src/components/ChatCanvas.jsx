import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  MicOff,
  ExternalLink,
  Phone,
  Star,
  Globe,
  PlusCircle,
  Sparkles,
  Download,
  Table as TableIcon,
  LayoutGrid,
  Code2,
  Copy,
  Sliders,
  MapPin,
  Briefcase,
  CheckCircle2,
  X,
  Radio,
  Volume2,
  Loader2,
  Mail,
  Users,
  Trash2
} from 'lucide-react';
import LeadOverviewDrawer from './LeadOverviewDrawer';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function ChatCanvas({ 
  messages = [], 
  leads = [], 
  onSendMessage, 
  onExportCSV, 
  isScraping = false, 
  onStartScrape, 
  onNewChat,
  onLaunchDiscoveryScrape,
  onNavigateToCRM,
  onUpdateLead,
  onDeleteLead
}) {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState('CARDS'); // 'CARDS' | 'TABLE' | 'RAW'
  const [copiedId, setCopiedId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);

  // --- Voice Search (Speech-to-Text) State ---
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState(null);
  const recognitionRef = useRef(null);

  // --- Interactive Lead Discovery Form State ---
  const [showDiscoveryForm, setShowDiscoveryForm] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState('Real Estate Agencies');
  const [customNiche, setCustomNiche] = useState('');
  const [selectedCity, setSelectedCity] = useState('South Delhi');
  const [customCity, setCustomCity] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('no_website');

  const popularNiches = [
    { label: 'Real Estate', query: 'Real Estate Agencies', icon: '🏢' },
    { label: 'Clinics & Doctors', query: 'Dental & Health Clinics', icon: '🦷' },
    { label: 'Gyms & Fitness', query: 'Fitness Gyms', icon: '🏋️' },
    { label: 'Restaurants & Cafes', query: 'Restaurants & Cafes', icon: '☕' },
    { label: 'Law Firms', query: 'Law Firms & Advocates', icon: '⚖️' },
    { label: 'Salons & Spas', query: 'Beauty Salons & Spas', icon: '💇' },
    { label: 'Coaching Centers', query: 'Coaching Institutes', icon: '📚' }
  ];

  const popularCities = [
    'South Delhi',
    'Bandra, Mumbai',
    'Indiranagar, Bangalore',
    'Pune',
    'Hyderabad',
    'Agra',
    'Jaipur'
  ];

  const filterOptions = [
    { 
      id: 'no_website', 
      title: 'No Website Detected', 
      desc: 'Pitch custom web design & high-converting landing pages', 
      badge: 'High Conversion 🔥',
      color: 'border-orange-200 hover:border-orange-400 bg-orange-50/50'
    },
    { 
      id: 'low_rating', 
      title: 'Low Rating (< 4.0 ⭐)', 
      desc: 'Pitch review management & reputation recovery', 
      badge: 'Urgent Pain Point ⚠️',
      color: 'border-amber-200 hover:border-amber-400 bg-amber-50/50'
    },
    { 
      id: 'unclaimed', 
      title: 'Unclaimed Listing', 
      desc: 'Pitch Google Business Profile claiming & optimization', 
      badge: 'Quick Win 📍',
      color: 'border-blue-200 hover:border-blue-400 bg-blue-50/50'
    },
    { 
      id: 'all', 
      title: 'All Top Ranked', 
      desc: 'Pitch SEO ranking, Meta & Google Ads services', 
      badge: 'Broad Scale 🚀',
      color: 'border-gray-200 hover:border-gray-400 bg-gray-50/50'
    }
  ];

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleChipClick = (chipText) => {
    if (chipText.toLowerCase().includes('new search')) {
      onNewChat();
    } else if (chipText.toLowerCase().includes('step-by-step') || chipText.toLowerCase().includes('interactive')) {
      setShowDiscoveryForm(true);
    } else {
      onSendMessage(chipText);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Voice Search Handler ---
  const toggleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceFeedback('Voice search is not supported in this browser. Please try Chrome, Edge, or Safari.');
      setTimeout(() => setVoiceFeedback(null), 4000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setVoiceFeedback(null);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceFeedback('Listening... Speak your prompt clearly (e.g., "Find gyms in Pune with no website")');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceFeedback('Microphone permission blocked. Please enable mic access in your browser.');
        } else {
          setVoiceFeedback(`Voice input: ${event.error}`);
        }
        setTimeout(() => setVoiceFeedback(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
        setVoiceFeedback(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech initialization error:', err);
      setIsListening(false);
    }
  };

  // --- Launch Discovery Form Scrape ---
  const handleLaunchFromWizard = () => {
    const targetNiche = customNiche.trim() || selectedNiche;
    const targetCity = customCity.trim() || selectedCity;
    const query = `${targetNiche} in ${targetCity}`;

    if (onLaunchDiscoveryScrape) {
      onLaunchDiscoveryScrape(query, selectedFilter);
    } else {
      onSendMessage(`Find ${query} with filter ${selectedFilter}`);
    }
    setShowDiscoveryForm(false);
  };

  return (
    <main className="flex-1 bg-[#f4f6fa] flex flex-col h-full overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 bg-white border-b border-gray-200/80 px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-gray-800 text-base flex items-center gap-2">
            <span>AI Lead Intelligence</span>
          </h1>

          <button
            onClick={() => setShowDiscoveryForm(!showDiscoveryForm)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition ml-2 cursor-pointer ${
              showDiscoveryForm 
                ? 'bg-orange-500 text-white border-orange-500 shadow-orange-500/20' 
                : 'border-orange-200 text-orange-600 bg-orange-50/70 hover:bg-orange-100/80'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showDiscoveryForm ? 'Hide Wizard' : '🎯 Lead Discovery Wizard'}</span>
          </button>

          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-orange-300 bg-white hover:bg-orange-50 text-xs font-medium text-gray-600 hover:text-orange-600 shadow-2xs transition ml-1 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {leads.length > 0 && (
            <button 
              onClick={onExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-medium rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Conversation & Lead Stream Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Messages Stream */}
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} max-w-4xl mx-auto`}
          >
            {/* User Message */}
            {msg.sender === 'user' && (
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-3 rounded-2xl rounded-tr-xs text-sm shadow-md shadow-orange-500/10 max-w-xl">
                {msg.text}
              </div>
            )}

            {/* AI Response Bubble */}
            {msg.sender === 'ai' && (
              <div className="w-full space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 mt-0.5 border border-orange-200">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    {msg.isLoading ? (
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-xs text-gray-500 font-medium">{msg.text || 'Thinking & verifying parameters...'}</span>
                        <div className="flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                          {msg.text}
                        </p>
                        {msg.question && (
                          <p className="text-xs text-gray-500 mt-1 font-normal">
                            {msg.question}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Interactive Question Chips */}
                {!msg.isLoading && msg.chips && msg.chips.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-10 pt-1">
                    {msg.chips.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChipClick(chip)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-orange-50 hover:border-orange-300 text-gray-700 hover:text-orange-600 border border-gray-200/90 shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Interactive Lead Discovery Wizard Form */}
        {showDiscoveryForm && (
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border-2 border-orange-300/90 shadow-xl shadow-orange-500/10 overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md">
                  <Sliders className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <span>Interactive Lead Discovery Wizard</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Step-by-Step</span>
                  </h3>
                  <p className="text-xs text-orange-100">
                    Pick your target industry, location & cold pitch qualification angle.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDiscoveryForm(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
                title="Close Wizard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Industry / Niche */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-bold">1</span>
                    <span>Target Industry / Business Niche</span>
                  </label>
                  <span className="text-[11px] text-gray-500">Selected: <b className="text-orange-600">{customNiche || selectedNiche}</b></span>
                </div>

                {/* Popular Pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {popularNiches.map((niche) => {
                    const isSelected = (!customNiche && selectedNiche === niche.query) || customNiche === niche.query;
                    return (
                      <button
                        key={niche.query}
                        type="button"
                        onClick={() => {
                          setSelectedNiche(niche.query);
                          setCustomNiche('');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20'
                            : 'bg-gray-50 hover:bg-orange-50/60 text-gray-700 hover:text-orange-600 border-gray-200'
                        }`}
                      >
                        <span>{niche.icon}</span>
                        <span>{niche.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Niche Input */}
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Or type custom niche (e.g. Interior Designers, Dental Clinics, Yoga Studios)..."
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Step 2: Target City / Area */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-bold">2</span>
                    <span>Target City / Locality</span>
                  </label>
                  <span className="text-[11px] text-gray-500">Selected: <b className="text-orange-600">{customCity || selectedCity}</b></span>
                </div>

                {/* Popular Cities */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {popularCities.map((city) => {
                    const isSelected = (!customCity && selectedCity === city) || customCity === city;
                    return (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          setSelectedCity(city);
                          setCustomCity('');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/20'
                            : 'bg-gray-50 hover:bg-orange-50/60 text-gray-700 hover:text-orange-600 border-gray-200'
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{city}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom City Input */}
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Or type specific locality / city (e.g. Koramangala Bangalore, Sector 62 Noida, Agra)..."
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:bg-white focus:border-orange-400 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Step 3: Qualification Angle & Filter */}
              <div>
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-bold">3</span>
                  <span>Qualification Angle / Filter</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filterOptions.map((opt) => {
                    const isSelected = selectedFilter === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedFilter(opt.id)}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/60 shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                              {opt.title}
                            </span>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            {opt.desc}
                          </p>
                        </div>
                        <div className="flex items-center justify-end mt-2 pt-1">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Launch Action Summary Bar */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                  <span className="text-gray-400 block text-[11px]">Ready to extract:</span>
                  <span className="font-semibold text-gray-900">
                    "{customNiche.trim() || selectedNiche} in {customCity.trim() || selectedCity}"
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowDiscoveryForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchFromWizard}
                    disabled={isScraping}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-semibold shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isScraping ? 'Scanning Maps...' : '⚡ Launch Live Lead Scan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Scraping & Filtering Loading Card */}
        {isScraping && (
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-orange-200/90 shadow-lg shadow-orange-500/5 p-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header with Radar & Spinner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 shadow-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <span>Searching Google Maps & Filtering Leads...</span>
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Live Extraction</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Puppeteer headless browser is crawling live listings, extracting contact numbers, and verifying qualification angles.
                  </p>
                </div>
              </div>

              {/* Progress Pulse Indicator */}
              <div className="flex items-center gap-2 text-[11px] font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 shrink-0">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Browser Engine...</span>
              </div>
            </div>

            {/* Live Visual Skeleton Cards (Shimmering Lead Previews) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div 
                  key={i} 
                  className="p-4 rounded-2xl border border-gray-100 bg-[#fafbfe] space-y-3 relative overflow-hidden animate-pulse"
                >
                  {/* Category & Rating skeleton */}
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 bg-orange-100/70 rounded-md"></div>
                    <div className="h-4 w-16 bg-amber-100/70 rounded-md"></div>
                  </div>

                  {/* Business Name skeleton */}
                  <div className="h-5 w-3/4 bg-gray-200 rounded-md"></div>

                  {/* Phone skeleton */}
                  <div className="h-3.5 w-1/2 bg-gray-200/80 rounded-md"></div>

                  {/* AI Outreach pitch box skeleton */}
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100/80 space-y-1.5">
                    <div className="h-3 w-1/3 bg-amber-200/60 rounded"></div>
                    <div className="h-3 w-full bg-amber-100 rounded"></div>
                    <div className="h-3 w-4/5 bg-amber-100 rounded"></div>
                  </div>

                  {/* Footer buttons skeleton */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="h-4 w-20 bg-gray-200 rounded"></div>
                    <div className="h-7 w-24 bg-orange-200/60 rounded-lg"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Status Tip */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>AI is evaluating opportunities and drafting outreach hooks in real-time...</span>
              </span>
              <span className="font-mono text-[11px] text-orange-600 font-medium">Please wait a few seconds</span>
            </div>
          </div>
        )}

        {/* Lead Canvas */}
        {!isScraping && leads.length > 0 && (
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden">
            {/* Tab Header Bar */}
            <div className="bg-[#fafbfe] border-b border-gray-200/80 px-6 py-3 flex items-center justify-between">
              <div className="inline-flex p-1 bg-gray-200/70 rounded-xl text-xs font-medium">
                <button 
                  onClick={() => setActiveTab('CARDS')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'CARDS' 
                      ? 'bg-white text-gray-900 shadow-xs font-semibold' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards View</span>
                </button>
                <button 
                  onClick={() => setActiveTab('TABLE')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'TABLE' 
                      ? 'bg-white text-gray-900 shadow-xs font-semibold' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Data Table</span>
                </button>
                <button 
                  onClick={() => setActiveTab('RAW')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'RAW' 
                      ? 'bg-white text-gray-900 shadow-xs font-semibold' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>JSON Export</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {onNavigateToCRM && (
                  <button 
                    onClick={onNavigateToCRM}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Open Leads & CRM →</span>
                  </button>
                )}
                <span className="text-xs text-gray-500 font-mono">
                  {leads.length} qualified leads
                </span>
                <button 
                  onClick={() => copyToClipboard(JSON.stringify(leads, null, 2), 'all-leads')}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedId === 'all-leads' ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>

            {/* Lead Content Display */}
            <div className="p-6">
              {activeTab === 'CARDS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {leads.map((lead) => (
                    <div 
                      key={lead.id}
                      className="p-4 rounded-2xl border border-gray-100 bg-[#fbfbfe] hover:bg-white hover:border-orange-200/80 hover:shadow-md hover:shadow-orange-500/5 transition group flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200/60">
                            {lead.category}
                          </span>
                          <div className="flex items-center gap-1 text-xs font-semibold text-gray-800">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{lead.rating}</span>
                            <span className="text-[10px] text-gray-400 font-normal">({lead.reviewsCount})</span>
                          </div>
                        </div>

                        {/* Business Name */}
                        <h3 className="font-semibold text-gray-900 text-sm mb-1.5 group-hover:text-orange-600 transition">
                          {lead.name}
                        </h3>

                        {/* Info details - Address removed from view as requested, preserved in JSON */}
                        <div className="space-y-1.5 text-xs text-gray-500">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="font-mono text-gray-700">{lead.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {lead.email ? (
                              <a 
                                href={`mailto:${lead.email}`}
                                title="Send Email"
                                className="font-mono text-orange-600 hover:text-orange-700 hover:underline truncate max-w-[240px]"
                              >
                                {lead.email}
                              </a>
                            ) : (
                              <span className="text-gray-400 text-[11px] italic">No public email found</span>
                            )}
                          </div>
                        </div>

                        {/* AI Cold Pitch Angle */}
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900 leading-snug">
                          <span className="font-semibold block text-amber-950 mb-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" /> 
                            AI Outreach Hook:
                          </span>
                          {lead.aiPitch}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                        {lead.website ? (
                          <a 
                            href={lead.website} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Visit Website</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            ⚠️ No Website Detected
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLeadToDelete(lead);
                            }}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remove Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <a 
                            href={`https://wa.me/?text=${encodeURIComponent('Hi ' + lead.name + ', ' + lead.aiPitch)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition shadow-2xs"
                          >
                            Contact
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'TABLE' && (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left text-xs text-gray-600">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-800 font-semibold">
                      <tr>
                        <th className="p-3">Business</th>
                        <th className="p-3">Rating</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Opportunity</th>
                        <th className="p-3">Website</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {leads.map((l) => (
                        <tr 
                          key={l.id} 
                          onClick={() => {
                            setSelectedLead(l);
                            setIsDrawerOpen(true);
                          }}
                          className="hover:bg-orange-50/40 cursor-pointer transition select-none"
                          title="Click to view Lead Overview"
                        >
                          <td className="p-3 font-semibold text-gray-900 flex items-center gap-2">
                            <span>{l.name}</span>
                            <span className="text-[10px] text-gray-400 font-normal">({l.company || l.category})</span>
                          </td>
                          <td className="p-3">⭐ {l.rating} ({l.reviewsCount})</td>
                          <td className="p-3 font-mono">{l.phone}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[10px] font-semibold border border-orange-200">
                              {l.opportunityTag}
                            </span>
                          </td>
                          <td className="p-3">
                            {l.website ? (
                              <a 
                                href={l.website} 
                                target="_blank" 
                                rel="noreferrer" 
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline"
                              >
                                Link
                              </a>
                            ) : (
                              <span className="text-rose-500 font-bold">None</span>
                            )}
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setLeadToDelete(l)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer inline-flex items-center"
                              title="Remove Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'RAW' && (
                <pre className="bg-[#181920] text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96">
                  {JSON.stringify(leads, null, 2)}
                </pre>
              )}
            </div>

            {/* Quick Notice Banner */}
            <div className="px-6 py-3 bg-[#fafbfe] border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                💡 Puppeteer Google Maps lead extraction with verified opportunity pitch.
              </span>
              <button 
                onClick={onStartScrape}
                disabled={isScraping}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isScraping ? 'Scraping Live...' : 'Scrape 15 More'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Prompt Bar */}
      <footer className="p-4 pb-6 bg-transparent shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Voice Listening Banner / Feedback */}
          {(isListening || voiceFeedback) && (
            <div className="mb-2.5 px-4 py-2 bg-orange-50 border border-orange-200/90 rounded-2xl flex items-center justify-between text-xs text-orange-800 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 font-medium">
                {isListening ? (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                    </span>
                    <span className="font-semibold text-orange-900">Listening live...</span>
                    <span className="text-orange-700 text-[11px]">Speak your prompt (niche & city)</span>
                  </div>
                ) : (
                  <span>{voiceFeedback}</span>
                )}
              </div>
              {isListening && (
                <button
                  onClick={toggleVoiceSearch}
                  className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold rounded-lg shadow-2xs transition"
                >
                  Done Speaking
                </button>
              )}
            </div>
          )}

          <form 
            onSubmit={handleSend}
            className="bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/50 p-2 flex items-center gap-2 focus-within:border-orange-400 transition"
          >
            <button 
              type="button" 
              onClick={() => setShowDiscoveryForm(!showDiscoveryForm)}
              className="p-2 text-orange-600 hover:text-orange-700 rounded-xl hover:bg-orange-50 transition"
              title="Open Step-by-Step Lead Finder Wizard"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Voice Input Button */}
            <button 
              type="button" 
              onClick={toggleVoiceSearch}
              className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
                isListening 
                  ? 'bg-orange-500 text-white animate-pulse ring-2 ring-orange-400' 
                  : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
              }`}
              title={isListening ? "Listening... Click to stop" : "Voice Search (Click and speak your query)"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening... speak now" : "Ask LeadSpy to find any leads (or use mic / wizard)..."}
              className="flex-1 bg-transparent border-none text-sm text-gray-800 placeholder-gray-400 focus:outline-none px-2"
            />

            <button 
              type="submit"
              className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 transition active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-[10px] text-gray-400 mt-2 flex items-center justify-center gap-2">
            <span>LeadSpy AI Assistant</span>
            <span>·</span>
            <span>Google Maps live data extraction</span>
            <span>·</span>
            <span className="text-orange-500 font-medium">Voice & Interactive Finder Enabled</span>
          </p>
        </div>
      </footer>

      {/* Slide-over Drawer for Lead Overview (Screenshot 2) */}
      <LeadOverviewDrawer
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdateStatus={onUpdateLead}
        onDeleteLead={(leadId) => {
          setIsDrawerOpen(false);
          if (onDeleteLead) onDeleteLead(leadId);
        }}
        onOpenFullPage={() => {
          setIsDrawerOpen(false);
          if (onNavigateToCRM) onNavigateToCRM();
        }}
      />

      {/* Delete Lead Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={!!leadToDelete}
        title="Remove Lead"
        message={`Are you sure you want to remove "${leadToDelete?.name || leadToDelete?.company || 'this lead'}"? This action cannot be undone.`}
        confirmText="Remove Lead"
        onConfirm={() => {
          if (leadToDelete && onDeleteLead) {
            onDeleteLead(leadToDelete.id);
          }
          setLeadToDelete(null);
        }}
        onClose={() => setLeadToDelete(null)}
      />
    </main>
  );
}
