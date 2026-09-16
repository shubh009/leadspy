import { supabase } from '../config/supabase.js';
import { RemoteOkAdapter } from './adapters/remoteOkAdapter.js';
import { HackerNewsAdapter } from './adapters/hackerNewsAdapter.js';
import { ProjectClassifier } from './ai/projectClassifier.js';
import { saveMasterProjects } from './services/projectDbService.js';
import dotenv from 'dotenv';

dotenv.config();

async function populate() {
  console.log('🧹 Cleaning old mock records from Supabase...');
  try {
    await supabase.from('master_projects').delete().like('source_url', '%1fproject%');
    await supabase.from('master_projects').delete().like('source_url', '%alex-carter%');
    await supabase.from('master_projects').delete().like('source_url', '%sarah_builds%');
    console.log('✅ Mock records cleaned.');
  } catch (err) {
    console.warn('Cleanup note:', err.message);
  }

  console.log('📡 Fetching 100% verified live IT projects from RemoteOK & Hacker News...');
  const remoteOk = new RemoteOkAdapter();
  const hn = new HackerNewsAdapter();
  const classifier = new ProjectClassifier();

  const [remoteCandidates, hnCandidates] = await Promise.all([
    remoteOk.fetchCandidates(),
    hn.fetchCandidates()
  ]);

  console.log(`Fetched: ${remoteCandidates.length} RemoteOK candidates, ${hnCandidates.length} Hacker News candidates`);
  const allCandidates = [...remoteCandidates, ...hnCandidates];

  const qualifiedBatch = [];
  for (const c of allCandidates) {
    try {
      const p = await classifier.qualifyAndExtract(c);
      if (p) qualifiedBatch.push(p);
    } catch (e) {
      console.warn('Qualification skip:', e.message);
    }
  }

  console.log(`Qualified ${qualifiedBatch.length} live IT projects.`);
  const saveRes = await saveMasterProjects(qualifiedBatch);
  console.log('🎉 Save complete:', saveRes);

  // Verify in Supabase
  const { data: rows, error } = await supabase.from('master_projects').select('title,source,source_url').limit(10);
  if (!error && rows) {
    console.log('\n📋 Live Verified Projects in Supabase (first 10):');
    rows.forEach((r, i) => console.log(`${i+1}. [${r.source.toUpperCase()}] ${r.title}\n   🔗 URL: ${r.source_url}`));
  }

  process.exit(0);
}

populate().catch(err => {
  console.error('Population error:', err);
  process.exit(1);
});
