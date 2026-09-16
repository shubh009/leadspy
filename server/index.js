import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './projects/routes/projectRoutes.js';
import { discoveryService } from './projects/services/discoveryService.js';

// LeadSpy Server with Automated Free Email Extractor
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LeadSpy Backend Engine', timestamp: new Date().toISOString() });
});

// Auth & API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', apiRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 LeadSpy Server running on http://localhost:${PORT}`);
  console.log(`   - AI Chat: POST http://localhost:${PORT}/api/chat`);
  console.log(`   - IT Projects: GET http://localhost:${PORT}/api/projects`);
  console.log(`   - Scraper: POST http://localhost:${PORT}/api/scrape`);
  console.log(`   - Live SSE: GET http://localhost:${PORT}/api/scrape/stream`);

  // Pre-seed and initial discovery crawl in background
  discoveryService.runDiscovery().catch(err => {
    console.warn('Initial project discovery sync notice:', err.message);
  });
});
