import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';

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

// API Routes
app.use('/api', apiRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 LeadSpy Server running on http://localhost:${PORT}`);
  console.log(`   - AI Chat: POST http://localhost:${PORT}/api/chat`);
  console.log(`   - Scraper: POST http://localhost:${PORT}/api/scrape`);
  console.log(`   - Live SSE: GET http://localhost:${PORT}/api/scrape/stream`);
});
