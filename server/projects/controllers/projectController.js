import {
  getProjects,
  getProjectById,
  saveUserProject,
  getUserSavedProjects
} from '../services/projectDbService.js';
import { parseNaturalLanguageQuery } from '../ai/queryParser.js';
import { discoveryService } from '../services/discoveryService.js';

/**
 * Project Controller
 */

export async function listProjects(req, res) {
  try {
    const {
      category = 'all',
      tech,
      location,
      budgetMin,
      budgetMax,
      freshness,
      search,
      page = 1,
      limit = 12,
      sort = 'fresh'
    } = req.query;

    const result = await getProjects({
      category,
      tech,
      location,
      budgetMin,
      budgetMax,
      freshness,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort
    });

    return res.json({
      success: true,
      data: result.projects,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit) || 1
      }
    });
  } catch (error) {
    console.error('[ProjectController - listProjects Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function naturalLanguageSearch(req, res) {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Query string is required' });
    }

    // 1. Parse natural language into structured filters
    const parsed = parseNaturalLanguageQuery(query);

    // 2. Query project database with structured filters
    const result = await getProjects({
      category: parsed.filters.category || 'all',
      tech: parsed.filters.tech || null,
      location: parsed.filters.location || null,
      budgetMin: parsed.filters.budgetMin || null,
      budgetMax: parsed.filters.budgetMax || null,
      freshness: parsed.filters.freshness || null,
      search: parsed.filters.tech ? null : query,
      page: 1,
      limit: 20
    });

    return res.json({
      success: true,
      parsedQuery: parsed,
      data: result.projects,
      pagination: {
        total: result.total,
        page: 1,
        limit: 20
      }
    });
  } catch (error) {
    console.error('[ProjectController - nlSearch Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function getProjectDetail(req, res) {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    return res.json({ success: true, data: project });
  } catch (error) {
    console.error('[ProjectController - getDetail Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function saveProjectToCrm(req, res) {
  try {
    const { projectId, status = 'saved', notes = '', pitchDraft = '' } = req.body;
    const userId = req.headers['x-user-id'] || 'user-1';

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId is required' });
    }

    const result = await saveUserProject(userId, projectId, status, notes, pitchDraft);
    return res.json({ success: true, data: result.saved });
  } catch (error) {
    console.error('[ProjectController - saveProject Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function listSavedProjects(req, res) {
  try {
    const userId = req.headers['x-user-id'] || 'user-1';
    const saved = await getUserSavedProjects(userId);
    return res.json({ success: true, data: saved });
  } catch (error) {
    console.error('[ProjectController - listSaved Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function triggerCrawlSync(req, res) {
  try {
    const { source } = req.body || {};
    // Run in background or wait for quick finish
    const syncResult = await discoveryService.runDiscovery({ specificSource: source });
    return res.json({ success: true, ...syncResult });
  } catch (error) {
    console.error('[ProjectController - triggerSync Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
