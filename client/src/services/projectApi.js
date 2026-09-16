/**
 * LeadSpy IT Project Discovery Engine API Client
 */

const API_BASE = '/api/projects';

export async function fetchProjects(params = {}) {
  const query = new URLSearchParams();
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.tech) query.set('tech', params.tech);
  if (params.location) query.set('location', params.location);
  if (params.budgetMin) query.set('budgetMin', params.budgetMin);
  if (params.budgetMax) query.set('budgetMax', params.budgetMax);
  if (params.freshness) query.set('freshness', params.freshness);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.sort) query.set('sort', params.sort);

  const res = await fetch(`${API_BASE}?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchProjectsNL(queryText) {
  const res = await fetch(`${API_BASE}/nl-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchProjectById(id) {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveProject(projectId, status = 'saved', notes = '') {
  const res = await fetch(`${API_BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, status, notes })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSavedProjects() {
  const res = await fetch(`${API_BASE}/saved`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function triggerDiscoverySync(source = null) {
  const res = await fetch(`${API_BASE}/sync-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
