import { supabase } from '../config/supabase.js';

/**
 * LeadSpy Supabase Database Service
 * Handles persistence for Campaigns, Leads, and Chat History.
 */

// ==========================================
// 1. CAMPAIGNS OPERATIONS
// ==========================================

export async function upsertCampaign(campaignData) {
  try {
    const payload = {
      id: campaignData.id || `camp-${Date.now()}`,
      title: campaignData.title || 'Untitled Campaign',
      query: campaignData.query || '',
      filter_type: campaignData.filterType || campaignData.filter_type || 'all',
      location: campaignData.location || null,
      category: campaignData.category || null,
      leads_count: Number(campaignData.leadsCount || campaignData.leads_count || 0),
      no_website_count: Number(campaignData.noWebsiteCount || campaignData.no_website_count || 0),
      status: campaignData.status || 'Active',
      color: campaignData.color || 'orange',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('campaigns')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[DB Error - upsertCampaign]:', err.message);
    throw err;
  }
}

export async function getAllCampaigns() {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[DB Error - getAllCampaigns]:', err.message);
    return [];
  }
}

export async function getCampaignById(id) {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[DB Error - getCampaignById ${id}]:`, err.message);
    return null;
  }
}

export async function updateCampaign(id, updates) {
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('campaigns')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[DB Error - updateCampaign ${id}]:`, err.message);
    throw err;
  }
}

export async function deleteCampaign(id) {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[DB Error - deleteCampaign ${id}]:`, err.message);
    throw err;
  }
}

// ==========================================
// 2. LEADS OPERATIONS
// ==========================================

function formatLeadPayload(lead, campaignId = null, searchQuery = null) {
  return {
    id: lead.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    campaign_id: campaignId || lead.campaign_id || null,
    search_query: searchQuery || lead.search_query || lead.query || null,
    name: lead.name || 'Unknown Business',
    category: lead.category || null,
    address: lead.address || lead.location || null,
    phone: lead.phone || null,
    email: lead.email || null,
    website: lead.website || null,
    instagram: lead.instagram || null,
    facebook: lead.facebook || null,
    linkedin: lead.linkedin || null,
    rating: lead.rating ? parseFloat(lead.rating) : null,
    reviews_count: lead.reviewsCount !== undefined ? parseInt(lead.reviewsCount, 10) : (lead.reviews_count || 0),
    claimed: Boolean(lead.claimed),
    opportunity_score: lead.opportunityScore || lead.opportunity_score || null,
    opportunity_tag: lead.opportunityTag || lead.opportunity_tag || null,
    ai_pitch: lead.aiPitch || lead.ai_pitch || null,
    status: lead.status || 'new',
    notes: lead.notes || null,
    updated_at: new Date().toISOString()
  };
}

export async function saveOrUpdateLead(lead, campaignId = null, searchQuery = null) {
  let payload = formatLeadPayload(lead, campaignId, searchQuery);
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const { data, error } = await supabase
      .from('leads')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (!error) return data;

    // Self-healing: if Supabase schema cache doesn't have a column yet, strip it & retry
    const colMatch = error.message && error.message.match(/Could not find the '([^']+)' column/i);
    if (colMatch && colMatch[1] && payload[colMatch[1]] !== undefined) {
      delete payload[colMatch[1]];
      continue;
    }

    console.error('[DB Error - saveOrUpdateLead]:', error.message);
    throw error;
  }
}

export async function saveBatchLeads(leads, campaignId = null, searchQuery = null) {
  if (!leads || leads.length === 0) return [];
  let formatted = leads.map(l => formatLeadPayload(l, campaignId, searchQuery));
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const { data, error } = await supabase
      .from('leads')
      .upsert(formatted, { onConflict: 'id' })
      .select();

    if (!error) return data || [];

    // Self-healing: if Supabase schema cache doesn't have a column yet, strip it & retry
    const colMatch = error.message && error.message.match(/Could not find the '([^']+)' column/i);
    if (colMatch && colMatch[1]) {
      const missingCol = colMatch[1];
      formatted = formatted.map(f => {
        const copy = { ...f };
        delete copy[missingCol];
        return copy;
      });
      continue;
    }

    console.error('[DB Error - saveBatchLeads]:', error.message);
    return [];
  }
  return [];
}

export async function getAllLeads({ campaignId = null, status = null, search = null, limit = 100, offset = 0 } = {}) {
  try {
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { leads: data || [], total: count || 0 };
  } catch (err) {
    console.error('[DB Error - getAllLeads]:', err.message);
    return { leads: [], total: 0 };
  }
}

export async function updateLead(id, updates) {
  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[DB Error - updateLead ${id}]:`, err.message);
    throw err;
  }
}

export async function deleteLead(id) {
  try {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[DB Error - deleteLead ${id}]:`, err.message);
    throw err;
  }
}

// ==========================================
// 3. CHAT HISTORY OPERATIONS
// ==========================================

export async function saveChatMessage(sessionId, role, content) {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .insert({
        session_id: sessionId || 'default-session',
        role,
        content: typeof content === 'object' ? JSON.stringify(content) : String(content)
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[DB Error - saveChatMessage]:', err.message);
    return null;
  }
}

export async function getChatHistory(sessionId = 'default-session') {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`[DB Error - getChatHistory ${sessionId}]:`, err.message);
    return [];
  }
}
