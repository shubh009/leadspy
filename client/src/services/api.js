const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050/api';

export async function sendChatMessage(message, history = [], criteria = {}, sessionId = 'leadspy-session') {
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, criteria, sessionId })
    });
    if (!res.ok) throw new Error('Chat API returned error');
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error('Chat API Error:', err);
    throw err;
  }
}

export async function triggerScrape(query = 'Real Estate in Agra', filterType = 'all', limit = 15, campaignId = null) {
  try {
    const res = await fetch(`${API_BASE_URL}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filterType, limit, campaignId })
    });
    if (!res.ok) throw new Error('Scrape API returned error');
    return await res.json();
  } catch (err) {
    console.error('Scrape API Error:', err);
    throw err;
  }
}

// ==========================================
// CAMPAIGNS API
// ==========================================

export async function fetchCampaigns() {
  try {
    const res = await fetch(`${API_BASE_URL}/campaigns`);
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    const data = await res.json();
    return data.campaigns || [];
  } catch (err) {
    console.warn('Could not fetch campaigns from server, falling back:', err.message);
    return [];
  }
}

export async function saveCampaign(campaign) {
  try {
    const res = await fetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign)
    });
    if (!res.ok) throw new Error('Failed to save campaign');
    return await res.json();
  } catch (err) {
    console.error('Save Campaign Error:', err);
    throw err;
  }
}

export async function updateCampaign(id, updates) {
  try {
    const res = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update campaign');
    return await res.json();
  } catch (err) {
    console.error('Update Campaign Error:', err);
    throw err;
  }
}

export async function deleteCampaign(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/campaigns/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete campaign');
    return await res.json();
  } catch (err) {
    console.error('Delete Campaign Error:', err);
    throw err;
  }
}

// ==========================================
// LEADS API
// ==========================================

export async function fetchLeads(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE_URL}/leads?${query}`);
    if (!res.ok) throw new Error('Failed to fetch leads');
    const data = await res.json();
    return data.leads || [];
  } catch (err) {
    console.warn('Could not fetch leads from server, falling back:', err.message);
    return [];
  }
}

export async function updateLeadStatus(id, status, notes = '') {
  try {
    const res = await fetch(`${API_BASE_URL}/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    if (!res.ok) throw new Error('Failed to update lead');
    return await res.json();
  } catch (err) {
    console.error('Update Lead Error:', err);
    throw err;
  }
}

export async function deleteLead(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/leads/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete lead');
    return await res.json();
  } catch (err) {
    console.error('Delete Lead Error:', err);
    throw err;
  }
}
