import express from 'express';
import { processUserPrompt } from '../services/aiService.js';
import { scrapeGoogleMaps } from '../services/scraperService.js';
import {
  getAllCampaigns,
  getCampaignById,
  upsertCampaign,
  updateCampaign,
  deleteCampaign,
  getAllLeads,
  saveOrUpdateLead,
  updateLead,
  deleteLead,
  saveChatMessage,
  getChatHistory
} from '../services/leadDbService.js';

const router = express.Router();

// ==========================================
// 1. AI CHAT ENDPOINTS
// ==========================================

router.post('/chat', async (req, res) => {
  try {
    const { message, history, criteria, sessionId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Persist user prompt if sessionId provided
    if (sessionId) {
      saveChatMessage(sessionId, 'user', message).catch(e => console.error(e));
    }

    const aiResult = await processUserPrompt({
      message,
      history: history || [],
      currentCriteria: criteria || {}
    });

    if (sessionId && aiResult) {
      saveChatMessage(sessionId, 'assistant', aiResult).catch(e => console.error(e));
    }

    return res.json({
      success: true,
      data: aiResult
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/chat/history', async (req, res) => {
  try {
    const { sessionId = 'default-session' } = req.query;
    const history = await getChatHistory(sessionId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. GOOGLE MAPS SCRAPING ENDPOINTS
// ==========================================

router.post('/scrape', async (req, res) => {
  try {
    const { query, filterType = 'all', limit = 15, campaignId } = req.body;
    const targetCampId = campaignId || `camp-${Date.now()}`;

    const leads = await scrapeGoogleMaps(
      query || 'Real Estate Agencies in Agra',
      filterType,
      limit,
      null,
      targetCampId
    );

    return res.json({
      success: true,
      campaignId: targetCampId,
      query,
      filterType,
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scrape/stream', async (req, res) => {
  const query = req.query.q || 'Real Estate Agencies in Agra';
  const filterType = req.query.filter || 'all';
  const limit = parseInt(req.query.limit, 10) || 15;
  const campaignId = req.query.campaignId || `camp-${Date.now()}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'STATUS', message: `Connecting to Google Maps for "${query}" with filter: ${filterType}...` })}\n\n`);

  try {
    const leads = await scrapeGoogleMaps(
      query,
      filterType,
      limit,
      (lead) => {
        res.write(`data: ${JSON.stringify({ type: 'LEAD', lead })}\n\n`);
      },
      campaignId
    );

    res.write(`data: ${JSON.stringify({ type: 'DONE', campaignId, count: leads.length })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'ERROR', message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

// ==========================================
// 3. CAMPAIGNS CRUD ENDPOINTS
// ==========================================

router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await getAllCampaigns();
    res.json({ success: true, count: campaigns.length, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const campaign = await upsertCampaign(req.body);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/campaigns/:id', async (req, res) => {
  try {
    const campaign = await updateCampaign(req.params.id, req.body);
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/campaigns/:id', async (req, res) => {
  try {
    await deleteCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. LEADS CRUD ENDPOINTS
// ==========================================

router.get('/leads', async (req, res) => {
  try {
    const { campaignId, status, search, limit = 100, offset = 0 } = req.query;
    const result = await getAllLeads({
      campaignId,
      status,
      search,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    res.json({ success: true, total: result.total, leads: result.leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/leads', async (req, res) => {
  try {
    const { lead, campaignId } = req.body;
    const saved = await saveOrUpdateLead(lead, campaignId);
    res.json({ success: true, lead: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/leads/:id', async (req, res) => {
  try {
    const updated = await updateLead(req.params.id, req.body);
    res.json({ success: true, lead: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/leads/:id', async (req, res) => {
  try {
    await deleteLead(req.params.id);
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
