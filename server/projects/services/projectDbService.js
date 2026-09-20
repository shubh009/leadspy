import { supabase } from '../../config/supabase.js';
import crypto from 'crypto';

/**
 * LeadSpy Project Database Service
 * Manages Supabase master_projects and user_saved_projects with robust resilient fallback.
 */

// In-memory fallback repository to ensure zero-downtime and local demo availability
let IN_MEMORY_PROJECTS = [];
let IN_MEMORY_SAVED = [];

export function validateProductionPersistenceConfig(persistToDb = false, auditOnly = true) {
  const shouldPersist = Boolean(persistToDb) && !auditOnly;
  if (!shouldPersist) {
    return { valid: true, mode: 'AUDIT' };
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_KEY?.trim();

  const isMissing = !url || !key;
  const isPlaceholderUrl = !url || url.includes('placeholder.supabase.co');
  const isPlaceholderKey = !key || key === 'placeholder-anon-key';

  if (isMissing || isPlaceholderUrl || isPlaceholderKey) {
    throw new Error(
      'Production persistence requires valid SUPABASE_URL and SUPABASE_KEY in environment. Found placeholder or missing credentials.'
    );
  }

  return { valid: true, mode: 'PRODUCTION' };
}

export async function saveMasterProjects(projects = []) {
  if (!projects || projects.length === 0) {
    return {
      success: true,
      attempted: 0,
      inserted: 0,
      updated: 0,
      total: IN_MEMORY_PROJECTS.length,
      error: null
    };
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const p of projects) {
    // Generate unique, deterministic canonical ID using MD5 hash of source_url
    const canonicalId = p.canonicalId || `proj-${crypto.createHash('md5').update(p.sourceUrl || p.title || String(Math.random())).digest('hex')}`;
    const record = {
      canonical_id: canonicalId,
      source: p.source || 'web',
      source_url: p.sourceUrl,
      source_post_id: p.sourcePostId || null,
      title: p.title,
      short_summary: p.shortSummary || '',
      original_description: p.originalDescription || p.shortSummary || '',
      category: p.category || 'Web Development',
      subcategory: p.subcategory || null,
      skills: p.skills || [],
      features: p.features || [],
      client_name: p.clientName || null,
      client_company: p.clientCompany || null,
      client_company_url: p.clientCompanyUrl || null,
      client_username: p.clientUsername || null,
      client_email: p.clientEmail || null,
      client_phone: p.clientPhone || null,
      client_profile_url: p.clientProfileUrl || null,
      client_contact_method: p.contact_type || p.clientContactMethod || 'none',
      has_actionable_contact: p.has_actionable_contact ?? true,
      contact_type: p.contact_type || 'none',
      contact_value: p.contact_value || null,
      client_location: p.clientLocation || null,
      budget: p.budget || null,
      budget_min: p.budgetMin || null,
      budget_max: p.budgetMax || null,
      currency: p.currency || null,
      project_type: p.projectType || null,
      intent: p.projectIntent || p.intent || 'Looking for Developer',
      relevance_score: p.relevanceScore || 85,
      contactability_score: p.contactabilityScore || 80,
      posted_at: p.postedAt || new Date().toISOString(),
      discovered_at: p.discoveredAt || new Date().toISOString(),
      status: 'active'
    };

    const existingIdx = IN_MEMORY_PROJECTS.findIndex(item => item.source_url === record.source_url);
    if (existingIdx >= 0) {
      IN_MEMORY_PROJECTS[existingIdx] = { ...IN_MEMORY_PROJECTS[existingIdx], ...record, id: IN_MEMORY_PROJECTS[existingIdx].id };
      updatedCount++;
    } else {
      record.id = record.id || `proj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      IN_MEMORY_PROJECTS.unshift(record);
      insertedCount++;
    }
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_KEY?.trim();
  const isPlaceholderUrl = !url || url.includes('placeholder.supabase.co');
  const isPlaceholderKey = !key || key === 'placeholder-anon-key';

  if (isPlaceholderUrl || isPlaceholderKey) {
    return {
      success: false,
      attempted: projects.length,
      inserted: insertedCount,
      updated: updatedCount,
      total: IN_MEMORY_PROJECTS.length,
      error: 'Supabase credentials missing or set to placeholder values'
    };
  }

  // Batch Upsert to Supabase in ONE single fast query
  try {
    const seen = new Set();
    const recordsToUpsert = [];

    for (const p of IN_MEMORY_PROJECTS) {
      const cid = p.canonical_id || `proj-${crypto.createHash('md5').update(p.source_url || p.title || String(Math.random())).digest('hex')}`;
      if (!seen.has(cid)) {
        seen.add(cid);
        recordsToUpsert.push({
          canonical_id: cid,
          source: p.source || 'web',
          source_url: p.source_url,
          source_post_id: p.source_post_id || null,
          title: p.title,
          short_summary: p.short_summary,
          original_description: p.original_description,
          category: p.category || 'Web Development',
          subcategory: p.subcategory || null,
          skills: p.skills || [],
          features: p.features || [],
          client_name: p.client_name || p.client_company || 'Direct Client',
          client_username: p.client_username || null,
          client_email: p.client_email || (p.contact_value && p.contact_value.includes('@') ? p.contact_value : null),
          client_profile_url: p.client_profile_url || (p.contact_value && /^https?:\/\//i.test(p.contact_value) ? p.contact_value : null) || p.client_company_url || null,
          client_contact_method: p.contact_type || p.client_contact_method || (p.client_email || (p.contact_value && p.contact_value.includes('@')) ? 'email' : (p.client_profile_url || (p.contact_value && /^https?:\/\//i.test(p.contact_value)) ? 'public_profile_message' : 'none')),
          client_location: p.client_location || null,
          budget: p.budget || null,
          budget_min: p.budget_min || null,
          budget_max: p.budget_max || null,
          currency: p.currency || 'USD',
          project_type: p.project_type || 'Contract',
          intent: p.intent || 'Looking for Developer',
          relevance_score: p.relevance_score || 85,
          posted_at: p.posted_at || new Date().toISOString(),
          discovered_at: p.discovered_at || new Date().toISOString(),
          last_seen_at: p.last_seen_at || new Date().toISOString(),
          status: 'active'
        });
      }
    }

    const { error } = await supabase
      .from('master_projects')
      .upsert(recordsToUpsert, { onConflict: 'source_url' });

    if (error) {
      console.warn('Supabase batch upsert warning:', error.message);
      return {
        success: false,
        attempted: projects.length,
        inserted: 0,
        updated: 0,
        total: IN_MEMORY_PROJECTS.length,
        error: error.message
      };
    }

    console.log(`✅ Upserted ${recordsToUpsert.length} unique live projects to Supabase.`);
    return {
      success: true,
      attempted: projects.length,
      inserted: insertedCount,
      updated: updatedCount,
      total: IN_MEMORY_PROJECTS.length,
      error: null
    };
  } catch (err) {
    console.warn('Supabase sync notice:', err.message);
    return {
      success: false,
      attempted: projects.length,
      inserted: 0,
      updated: 0,
      total: IN_MEMORY_PROJECTS.length,
      error: err.message
    };
  }
}

export async function getProjects({
  category = 'all',
  tech = null,
  location = null,
  budgetMin = null,
  budgetMax = null,
  freshness = null,
  search = null,
  page = 1,
  limit = 12,
  sort = 'fresh'
} = {}) {
  // 1. Try Supabase first
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      let query = supabase.from('master_projects').select('*', { count: 'exact' });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      if (location) {
        query = query.ilike('client_location', `%${location}%`);
      }
      if (budgetMin) {
        query = query.gte('budget_min', Number(budgetMin));
      }
      if (budgetMax) {
        query = query.lte('budget_max', Number(budgetMax));
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,short_summary.ilike.%${search}%,original_description.ilike.%${search}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.order('posted_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (!error && data && data.length > 0) {
        return {
          projects: data.map(formatProjectForClient),
          total: count || data.length,
          page,
          limit
        };
      }
    }
  } catch (err) {
    // Fall through to memory store
  }

  // 2. Query in-memory store
  let filtered = [...IN_MEMORY_PROJECTS];

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.category?.toLowerCase() === category.toLowerCase());
  }

  if (tech) {
    filtered = filtered.filter(p => 
      (p.skills || []).some(s => s.toLowerCase().includes(tech.toLowerCase())) ||
      p.title.toLowerCase().includes(tech.toLowerCase()) ||
      p.short_summary.toLowerCase().includes(tech.toLowerCase())
    );
  }

  if (location) {
    const loc = location.toLowerCase();
    filtered = filtered.filter(p => {
      const pLoc = (p.client_location || '').toLowerCase();
      return pLoc.includes(loc) || pLoc.includes('remote') || pLoc.includes('global');
    });
  }

  if (budgetMin) {
    filtered = filtered.filter(p => p.budget_min && p.budget_min >= Number(budgetMin));
  }

  if (budgetMax) {
    filtered = filtered.filter(p => p.budget_max && p.budget_max <= Number(budgetMax));
  }

  if (freshness) {
    const now = Date.now();
    filtered = filtered.filter(p => {
      const diffHrs = (now - new Date(p.posted_at).getTime()) / (1000 * 60 * 60);
      if (freshness === '1h') return diffHrs <= 2;
      if (freshness === '24h') return diffHrs <= 24;
      if (freshness === '7d') return diffHrs <= 168;
      return true;
    });
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(s) ||
      p.short_summary.toLowerCase().includes(s) ||
      p.original_description.toLowerCase().includes(s) ||
      (p.skills || []).some(skill => skill.toLowerCase().includes(s))
    );
  }

  // Sorting
  filtered.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  return {
    projects: paginated.map(formatProjectForClient),
    total,
    page,
    limit
  };
}

export async function getProjectById(id) {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const { data, error } = await supabase
        .from('master_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) return formatProjectForClient(data);
    }
  } catch (err) {
    // Fallback
  }

  const found = IN_MEMORY_PROJECTS.find(p => p.id === id);
  return found ? formatProjectForClient(found) : null;
}

export async function saveUserProject(userId = 'default-user', projectId, status = 'saved', notes = '', pitchDraft = '') {
  const entry = {
    id: `saved-${Date.now()}`,
    user_id: userId,
    project_id: projectId,
    status,
    notes,
    pitch_draft: pitchDraft,
    created_at: new Date().toISOString()
  };

  const existingIdx = IN_MEMORY_SAVED.findIndex(s => s.user_id === userId && s.project_id === projectId);
  if (existingIdx >= 0) {
    IN_MEMORY_SAVED[existingIdx] = { ...IN_MEMORY_SAVED[existingIdx], status, notes, pitch_draft: pitchDraft };
  } else {
    IN_MEMORY_SAVED.unshift(entry);
  }

  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await supabase
        .from('user_saved_projects')
        .upsert(entry, { onConflict: 'user_id,project_id' });
    }
  } catch (err) {}

  return { success: true, saved: entry };
}

export async function getUserSavedProjects(userId = 'default-user') {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const { data, error } = await supabase
        .from('user_saved_projects')
        .select(`
          id,
          user_id,
          project_id,
          status,
          notes,
          pitch_draft,
          created_at,
          master_projects (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(row => ({
          id: row.id,
          user_id: row.user_id,
          project_id: row.project_id,
          status: row.status,
          notes: row.notes,
          pitch_draft: row.pitch_draft,
          created_at: row.created_at,
          project: row.master_projects ? formatProjectForClient(row.master_projects) : null
        }));
      }
    }
  } catch (err) {
    // Fall back to memory store
  }

  const savedList = IN_MEMORY_SAVED.filter(s => s.user_id === userId);
  return savedList.map(s => {
    const project = IN_MEMORY_PROJECTS.find(p => p.id === s.project_id);
    return {
      ...s,
      project: project ? formatProjectForClient(project) : null
    };
  });
}

function formatProjectForClient(row) {
  const postedDate = new Date(row.posted_at || Date.now());
  const diffMinutes = Math.floor((Date.now() - postedDate.getTime()) / (1000 * 60));
  
  let freshnessBadge = 'Older';
  let freshnessColor = 'gray';
  let timeAgo = `${diffMinutes}m ago`;

  if (diffMinutes < 60) {
    freshnessBadge = 'Just Posted';
    freshnessColor = 'emerald';
    timeAgo = `${diffMinutes}m ago`;
  } else if (diffMinutes < 1440) {
    freshnessBadge = 'Fresh';
    freshnessColor = 'cyan';
    const hrs = Math.floor(diffMinutes / 60);
    timeAgo = `${hrs}h ago`;
  } else if (diffMinutes < 10080) {
    freshnessBadge = 'Recent';
    freshnessColor = 'blue';
    const days = Math.floor(diffMinutes / 1440);
    timeAgo = `${days}d ago`;
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.short_summary,
    description: row.original_description,
    source: row.source,
    sourceUrl: row.source_url,
    category: row.category,
    skills: row.skills || [],
    features: row.features || [],
    clientName: row.client_name || row.client_company || 'Direct Client',
    clientCompany: row.client_company || null,
    clientCompanyUrl: row.client_company_url || null,
    clientUsername: row.client_username || null,
    clientEmail: row.client_email || null,
    clientPhone: row.client_phone || null,
    clientProfileUrl: row.client_profile_url || null,
    clientContactMethod: row.client_contact_method || row.contact_type || (row.client_email ? 'email' : 'none'),
    hasActionableContact: row.has_actionable_contact ?? (Boolean(row.client_email) || row.client_contact_method === 'email' || Boolean(row.client_profile_url)),
    contactType: row.contact_type || row.client_contact_method || (row.client_email ? 'email' : 'none'),
    contactValue: row.contact_value || row.client_email || row.client_profile_url || row.client_company_url || null,
    clientLocation: row.client_location || 'Not Specified',
    budget: row.budget || null,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    currency: row.currency || 'USD',
    projectType: row.project_type || 'Project Contract',
    intent: row.intent || 'Looking for Developer',
    relevanceScore: row.relevance_score || 85,
    contactabilityScore: row.contactability_score || 80,
    postedAt: row.posted_at,
    timeAgo,
    freshnessBadge,
    freshnessColor
  };
}
