import express from 'express';
import {
  listProjects,
  naturalLanguageSearch,
  getProjectDetail,
  saveProjectToCrm,
  listSavedProjects,
  triggerCrawlSync
} from '../controllers/projectController.js';

const router = express.Router();

// Search & Filtered Feed
router.get('/', listProjects);
router.post('/nl-search', naturalLanguageSearch);
router.get('/saved', listSavedProjects);
router.post('/save', saveProjectToCrm);
router.post('/sync-now', triggerCrawlSync);
router.get('/:id', getProjectDetail);

export default router;
