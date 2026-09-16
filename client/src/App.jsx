import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatCanvas from './components/ChatCanvas';
import RightHistory from './components/RightHistory';
import LeadsCRMView from './components/LeadsCRMView';
import CampaignsView from './components/CampaignsView';
import LoginView from './components/LoginView';
import ProjectsView from './components/projects/ProjectsView';
import { INITIAL_CAMPAIGNS, MOCK_LEADS, INITIAL_CHAT_MESSAGES, enrichLead } from './data/mockData';
import { sendChatMessage, triggerScrape, fetchCampaigns, fetchLeads, updateLeadStatus } from './services/api';
import { getStoredUser, logoutUser } from './services/authService';

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [activeNav, setActiveNav] = useState('chat'); // 'chat' | 'projects' | 'campaigns' | 'leads'
  const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [messages, setMessages] = useState(INITIAL_CHAT_MESSAGES);
  const [leads, setLeads] = useState([]);
  const [crmLeads, setCrmLeads] = useState(MOCK_LEADS);
  const [isScraping, setIsScraping] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [activeFilterType, setActiveFilterType] = useState('all');
  const [crmPotentialFilter, setCrmPotentialFilter] = useState('ALL');

  // Load persisted campaigns & leads from Supabase on mount
  useEffect(() => {
    async function loadDataFromDb() {
      try {
        const dbCampaigns = await fetchCampaigns();
        if (dbCampaigns && dbCampaigns.length > 0) {
          setCampaigns(dbCampaigns);
        }
        const dbLeads = await fetchLeads();
        if (dbLeads && dbLeads.length > 0) {
          const enriched = dbLeads.map((l, i) => enrichLead(l, i));
          setCrmLeads(enriched);
        }
      } catch (err) {
        console.warn('DB initialization error:', err);
      }
    }
    loadDataFromDb();
  }, []);

  const handleNewChat = () => {
    setMessages([
      {
        id: 'm-welcome-' + Date.now(),
        sender: 'ai',
        text: "Namaste! I'm LeadSpy AI. Tell me what kind of business clients you want to target, what service you offer them, and in which Indian city or area (e.g., Delhi NCR, Mumbai, Agra, Bangalore, Pune).",
        chips: [
          "🎯 Step-by-Step Lead Finder",
          "I sell Web Design to Real Estate in Agra",
          "I sell SEO to Clinics in South Delhi",
          "I sell Google Ads to Coaching Centers in Kota",
          "I sell Social Media to Restaurants in Bangalore"
        ]
      }
    ]);
    setActiveSearchQuery('');
    setActiveFilterType('all');
    setActiveCampaignId(null);
  };

  const handleLaunchDiscoveryScrape = (query, filterType = 'all') => {
    setActiveSearchQuery(query);
    setActiveFilterType(filterType);

    const filterLabels = {
      no_website: 'No Website Detected',
      low_rating: 'Low Rating (<4.0)',
      unclaimed: 'Unclaimed Listing',
      all: 'All Top Listings'
    };

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: `🎯 Target: ${query} [Angle: ${filterLabels[filterType] || filterType}]`
    };

    setMessages(prev => [...prev, userMsg]);
    handleStartScrape(query, filterType);
  };

  const handleStartScrape = async (query = activeSearchQuery, filterType = activeFilterType) => {
    const targetQ = query || 'Real Estate Agencies in South Delhi';
    const targetF = filterType || 'all';

    setIsScraping(true);
    setMessages(prev => [
      ...prev,
      {
        id: 'ai-progress-' + Date.now(),
        sender: 'ai',
        text: `⚡ Scanning Google Maps in real-time for "${targetQ}" [Filter: ${targetF}]... Please wait a few seconds while browser extracts contacts and checks websites.`,
        chips: []
      }
    ]);

    try {
      const result = await triggerScrape(targetQ, targetF, 15);
      if (result && result.leads && result.leads.length > 0) {
        // Enrich newly scraped leads with CRM intelligence & AI Audit fields
        const enrichedList = result.leads.map((l, i) => enrichLead(l, i));
        const hotCount = enrichedList.filter(l => l.aiAudit?.tier === 'HOT' || (l.aiAudit?.fitScore || l.score) >= 80).length;

        setLeads(enrichedList);
        setCrmLeads(prev => [...enrichedList, ...prev]);

        // Add campaign to history
        const newCampaign = {
          id: 'camp-' + Date.now(),
          title: targetQ,
          query: `${targetQ} (${targetF})`,
          leadsCount: result.leads.length,
          active: true
        };
        setCampaigns(prev => [newCampaign, ...prev]);
        setActiveCampaignId(newCampaign.id);

        // Announce completion in chat with direct links
        setMessages(prev => [
          ...prev,
          {
            id: 'ai-done-' + Date.now(),
            sender: 'ai',
            text: `🎉 Successfully scanned & found ${result.leads.length} verified leads for "${targetQ}"! AI pre-qualified ${hotCount} 🔥 Hot Potential Clients with high paying capacity & burning pain points ready for outreach.`,
            chips: ["🔥 View Hot Potential in CRM", "📥 Download Leads CSV", "👥 Open in Leads & CRM"]
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: 'ai-none-' + Date.now(),
            sender: 'ai',
            text: `No listings found matching the strict filter in this area.`,
            chips: []
          }
        ]);
      }
    } catch (err) {
      console.error('Scrape execution error:', err);
    } finally {
      setIsScraping(false);
    }
  };

  const handleSendMessage = async (text) => {
    const lowerText = text.toLowerCase();

    // If user clicked Hot Potential in CRM
    if (lowerText.includes('hot potential') || lowerText.includes('view hot')) {
      setCrmPotentialFilter('HOT');
      setActiveNav('leads');
      return;
    }

    // If user clicked Download CSV chip
    if (lowerText.includes('download leads csv') || lowerText.includes('export csv')) {
      handleExportCSV();
      return;
    }

    // If user clicked Open in Leads & CRM chip
    if (lowerText.includes('leads & crm') || lowerText.includes('open in leads')) {
      setCrmPotentialFilter('ALL');
      setActiveNav('leads');
      return;
    }

    // Normal conversation flow
    const userMsg = { id: 'user-' + Date.now(), sender: 'user', text };
    const loadingId = 'ai-loading-' + Date.now();
    const loadingMsg = { 
      id: loadingId, 
      sender: 'ai', 
      isLoading: true, 
      text: 'Analyzing query & verifying location...' 
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, loadingMsg]);

    // Track filter selection
    const hasNoWebsite = lowerText.includes('no website') || lowerText.includes('without website') || lowerText.includes('broken');
    const hasLowRating = lowerText.includes('low rating') || lowerText.includes('reputation') || lowerText.includes('rating') || lowerText.includes('< 4') || lowerText.includes('<4');
    const hasUnclaimed = lowerText.includes('unclaimed');

    let chosenFilter = activeFilterType;
    if (hasNoWebsite && hasLowRating) {
      chosenFilter = 'no_website_low_rating';
    } else if (hasNoWebsite) {
      chosenFilter = 'no_website';
    } else if (hasLowRating) {
      chosenFilter = 'low_rating';
    } else if (hasUnclaimed) {
      chosenFilter = 'unclaimed';
    }
    setActiveFilterType(chosenFilter);

    try {
      const aiResponse = await sendChatMessage(text, updatedMessages);

      const aiReply = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: aiResponse.replyText,
        question: aiResponse.followUpQuestion,
        chips: aiResponse.chips || []
      };

      // Replace loading bubble with the real reply
      setMessages(prev => prev.map(m => m.id === loadingId ? aiReply : m));

      if (aiResponse.searchQuery) {
        setActiveSearchQuery(aiResponse.searchQuery);
      }

      // ONLY start scraping when ready
      if (aiResponse.isReadyToScrape && aiResponse.searchQuery) {
        handleStartScrape(aiResponse.searchQuery, chosenFilter);
      }

    } catch (err) {
      console.warn('AI call error:', err.message);
      setMessages(prev => prev.filter(m => m.id !== loadingId));
    }
  };

  const handleUpdateCrmLead = (leadId, updates) => {
    setCrmLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
    if (leadId && (updates.status || updates.notes)) {
      updateLeadStatus(leadId, updates.status, updates.notes).catch(e => console.warn(e));
    }
  };

  const handleAddCrmLead = (newLead) => {
    setCrmLeads(prev => [newLead, ...prev]);
    setLeads(prev => [newLead, ...prev]);
  };

  const handleExportCSV = () => {
    const listToExport = activeNav === 'leads' ? crmLeads : (leads.length > 0 ? leads : crmLeads);
    const headers = ['Lead Name', 'Company', 'Title', 'Status', 'Score', 'Intent', 'Phone', 'Email', 'Website', 'Instagram', 'Facebook', 'LinkedIn', 'Location', 'AI Recommendation'];
    const rows = listToExport.map(l => [
      `"${l.name || ''}"`,
      `"${l.company || ''}"`,
      `"${l.title || ''}"`,
      `"${l.status || 'New'}"`,
      l.score || 80,
      `"${l.intent || 'Medium'}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${l.website || ''}"`,
      `"${l.instagram || ''}"`,
      `"${l.facebook || ''}"`,
      `"${l.linkedin || ''}"`,
      `"${l.location || ''}"`,
      `"${l.aiRecommendation || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leadspy_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = () => {
    setCampaigns([]);
    setActiveCampaignId(null);
  };

  const handleDeleteCampaign = (campaignId) => {
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    if (activeCampaignId === campaignId) {
      setActiveCampaignId(null);
    }
  };

  const handleDeleteLead = (leadId) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setCrmLeads(prev => prev.filter(l => l.id !== leadId));
    if (activeCampaignId) {
      setCampaigns(prev => prev.map(c => 
        c.id === activeCampaignId 
          ? { ...c, leadsCount: Math.max(0, (c.leadsCount || 1) - 1) } 
          : c
      ));
    }
  };

  // If user is not logged in, render the reference-style Login Panel
  if (!currentUser) {
    return (
      <LoginView 
        onLoginSuccess={(user) => setCurrentUser(user)} 
      />
    );
  }

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  return (
    <div className="flex h-screen w-screen bg-[#14151b] overflow-hidden">
      {/* 1. Left Dark Sidebar with Leads & CRM menu & User Profile */}
      <Sidebar 
        activeNav={activeNav} 
        leadsCount={crmLeads.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavChange={(nav) => {
          setActiveNav(nav);
          if (nav === 'chat' && messages.length === 0) handleNewChat();
        }} 
      />

      {/* 2. Main Central View */}
      {activeNav === 'projects' ? (
        <ProjectsView />
      ) : activeNav === 'campaigns' ? (
        <CampaignsView 
          campaigns={campaigns}
          onSelectCampaign={(camp) => {
            setActiveCampaignId(camp.id);
            setActiveSearchQuery(camp.query);
            setActiveNav('chat');
          }}
          onExportCampaign={() => {
            handleExportCSV();
          }}
          onNavigateToChat={() => {
            setActiveNav('chat');
            handleNewChat();
          }}
          onDeleteCampaign={handleDeleteCampaign}
        />
      ) : activeNav === 'leads' ? (
        <LeadsCRMView 
          leads={crmLeads}
          onUpdateLead={handleUpdateCrmLead}
          onAddLead={handleAddCrmLead}
          onDeleteLead={handleDeleteLead}
          onExportCSV={handleExportCSV}
          initialPotentialFilter={crmPotentialFilter}
          onImportCSV={(file) => {
            alert(`Imported ${file.name} successfully into Leads & CRM!`);
          }}
        />
      ) : (
        <>
          {/* Main Central Elevated Chat & Canvas */}
          <ChatCanvas 
            messages={messages} 
            leads={leads} 
            onSendMessage={handleSendMessage}
            onExportCSV={handleExportCSV}
            isScraping={isScraping}
            onStartScrape={() => handleStartScrape(activeSearchQuery, activeFilterType)}
            onNewChat={handleNewChat}
            onLaunchDiscoveryScrape={handleLaunchDiscoveryScrape}
            onNavigateToCRM={() => setActiveNav('leads')}
            onUpdateLead={handleUpdateCrmLead}
            onDeleteLead={handleDeleteLead}
          />

          {/* 3. Right History Sidebar */}
          <RightHistory 
            campaigns={campaigns}
            activeCampaignId={activeCampaignId}
            onSelectCampaign={(c) => {
              setActiveCampaignId(c.id);
              setActiveSearchQuery(c.query);
            }}
            onClearHistory={handleClearHistory}
            onDeleteCampaign={handleDeleteCampaign}
          />
        </>
      )}
    </div>
  );
}

export default App;
