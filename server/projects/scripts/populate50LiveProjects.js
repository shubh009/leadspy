/**
 * LeadSpy 50 High-Volume Qualified Projects Discovery Engine
 * Systematically crawls and discovers 50+ live, verified, top-quality client projects
 * across P1, P2, P3 sources with strict 9-Gate Qualification and Freshness validation.
 */

import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from '../services/projectDbService.js';
import { supabase } from '../../config/supabase.js';

export async function populate50Projects() {
  console.log('================================================================');
  console.log('🎯 POPULATING 50+ QUALIFIED LIVE CLIENT PROJECTS INTO SUPABASE');
  console.log('   Multi-Source Sweep: Hacker News (45d), Reddit RSS (10 subs), GitHub, Search Dorks');
  console.log('   Strict 9-Gate Engine: Zero jobs, zero freelancer pitches, zero dead links');
  console.log('================================================================\n');

  const contentExtractor = new ContentExtractor();
  const classifier = new ProjectClassifier();
  classifier.apiKey = null; // Deterministic strict qualification

  const candidatePool = [];
  const seenUrls = new Set();

  function addCandidate(cand) {
    if (cand.url && !seenUrls.has(cand.url) && contentExtractor.isValidTarget(cand.url)) {
      seenUrls.add(cand.url);
      candidatePool.push(cand);
    }
  }

  // -------------------------------------------------------------
  // 1. HACKER NEWS: High-Yield Broad Queries (Past 45 days)
  // -------------------------------------------------------------
  console.log('📡 [Source 1/4: Hacker News] Ingesting client contract threads (past 45 days)...');
  const fortyFiveDaysAgo = Math.floor(Date.now() / 1000) - (45 * 86400);
  const hnQueries = [
    'seeking freelancer',
    'looking for developer',
    'need developer',
    'need website',
    'build app',
    'build MVP',
    'contract developer',
    'looking for agency',
    'need someone to build',
    'web development',
    'mobile app developer'
  ];

  for (const q of hnQueries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=comment&numericFilters=created_at_i>${fortyFiveDaysAgo}&hitsPerPage=30`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        for (const h of (data.hits || [])) {
          const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          addCandidate({
            source: 'hackernews',
            url: `https://news.ycombinator.com/item?id=${h.objectID}`,
            title: lines[0]?.substring(0, 110) || `Hacker News Client Requirement`,
            snippet: text,
            author: h.author || 'HN Client',
            postedAt: h.created_at,
            priorityTier: 'P2'
          });
        }
      }
    } catch (e) {}
  }
  console.log(`   -> Total candidates with Hacker News: ${candidatePool.length}`);

  // -------------------------------------------------------------
  // 2. REDDIT: Active Subreddits via Live RSS
  // -------------------------------------------------------------
  console.log('📡 [Source 2/4: Reddit] Fetching active hiring feeds across 10 subreddits...');
  const subreddits = [
    'forhire',
    'freelance_forhire',
    'jobbit',
    'devsforhire',
    'hireaprogrammer',
    'SideProject',
    'AppDevelopers',
    'Startups',
    'SaaS',
    'webdev'
  ];

  for (const sub of subreddits) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/new/.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const xml = await res.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        for (const e of entries) {
          const rawTitle = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/&amp;/g, '&') || '';
          const link = (e.match(/<link\s+href="([^"]+)"/) || [])[1] || '';
          const updated = (e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || new Date().toISOString();
          const author = (e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || 'Reddit Client';
          const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ') || rawTitle;

          // Check for hiring or demand intent
          const lowerTitle = rawTitle.toLowerCase();
          const isHiring = lowerTitle.includes('hiring') || lowerTitle.includes('need') || lowerTitle.includes('looking for');
          const isSupply = lowerTitle.includes('[for hire]') || lowerTitle.startsWith('for hire');

          if (isHiring && !isSupply) {
            addCandidate({
              source: 'reddit',
              url: link,
              title: rawTitle.replace(/^\[hiring\]\s*/i, ''),
              snippet: content.substring(0, 800),
              author,
              postedAt: updated,
              priorityTier: 'P1'
            });
          }
        }
      }
    } catch (e) {}
  }
  console.log(`   -> Total pool with Reddit: ${candidatePool.length}`);

  // -------------------------------------------------------------
  // 3. GITHUB: Public Project Issues & RFPs
  // -------------------------------------------------------------
  console.log('📡 [Source 3/4: GitHub] Fetching public client issues & RFP requests...');
  const ghSearches = [
    '("need developer" OR "looking for developer") is:issue is:open',
    '("build website" OR "need a website") is:issue is:open',
    '("mobile app" OR "flutter" OR "react native") "looking for developer" is:issue is:open',
    '("build an mvp" OR "build saas") is:issue is:open',
    '("contract project" OR "freelance project") is:issue is:open',
    '("development agency" OR "need an agency") is:issue is:open',
    '("looking for someone to build" OR "need someone to build") is:issue is:open'
  ];

  for (const ghQuery of ghSearches) {
    try {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(ghQuery)}&sort=created&order=desc&per_page=15`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LeadSpyBot/1.0', 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          addCandidate({
            source: 'github',
            url: item.html_url,
            title: item.title,
            snippet: `${item.title} | ${item.body?.substring(0, 700) || item.title}`,
            author: item.user?.login || 'GitHub User',
            postedAt: item.created_at,
            priorityTier: 'P1'
          });
        }
      }
    } catch (e) {}
  }
  console.log(`   -> Total pool with GitHub: ${candidatePool.length}`);

  // -------------------------------------------------------------
  // 4. SEARCH DORK ENGINE: Dynamic Web & Platform Discovery
  // -------------------------------------------------------------
  console.log('📡 [Source 4/4: Search Engines] Running multi-provider search queries...');
  const searchManager = new MultiSearchManager();
  const dorkQueries = [
    'site:reddit.com/r/forhire "hiring" "website"',
    'site:reddit.com/r/forhire "hiring" "app"',
    'site:reddit.com/r/forhire "hiring" "developer"',
    'site:indiehackers.com "looking for developer"',
    'site:indiehackers.com "need someone to build"',
    'site:github.com "looking for web development agency"',
    '"need someone to build a website"',
    '"looking for a web development agency"',
    '"need someone to build an MVP"',
    '"looking for mobile app development agency"',
    '"need someone to build a SaaS"'
  ];

  for (const dork of dorkQueries) {
    try {
      const { results } = await searchManager.searchWithFallback(dork, { timeRange: 'month', limit: 8 });
      for (const r of results) {
        addCandidate({
          source: r.engine || 'web_search',
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          priorityTier: 'P1'
        });
      }
    } catch (e) {}
  }

  console.log(`\n================================================================`);
  console.log(`📥 Total Unique Discovered Candidates: ${candidatePool.length}`);
  console.log('🔍 Executing Deep Content Extraction & Context Enrichment...\n');

  // -------------------------------------------------------------
  // 5. ENRICHMENT VIA DEEP CONTENT EXTRACTOR
  // -------------------------------------------------------------
  const enrichedList = [];
  let processedCount = 0;

  for (const item of candidatePool) {
    try {
      processedCount++;
      const extracted = await contentExtractor.extractDeepContent(item);
      if (extracted && extracted.rawContent) {
        enrichedList.push(extracted);
      }
      if (processedCount % 30 === 0) {
        console.log(`   [Progress] Processed ${processedCount}/${candidatePool.length} pages...`);
      }
    } catch (e) {}
  }

  console.log(`\n✨ Deep Context Extracted for ${enrichedList.length} pages.`);
  console.log('⚙️ Evaluating against 9-Gate Qualification Engine...\n');

  // -------------------------------------------------------------
  // 6. QUALIFY VIA 9-GATE ENGINE
  // -------------------------------------------------------------
  const qualifiedProjects = [];
  const rejectedReasons = {};

  for (const cand of enrichedList) {
    const result = await classifier.qualifyAndExtract(cand);

    if (result.qualification_status === 'qualified' && result.has_actionable_contact) {
      result.freshnessStatus = cand.freshnessStatus || 'fresh';
      result.status = cand.freshnessStatus === 'archive' ? 'archive' : 'active';
      qualifiedProjects.push(result);

      console.log(`🌟 [QUALIFIED #${qualifiedProjects.length}] [${result.source.toUpperCase()}] ${result.title.substring(0, 70)}`);
      console.log(`   -> Contact: ${result.contact_type} (${result.contact_value || result.clientEmail})`);
      console.log(`   -> Link: ${result.sourceUrl}\n`);
    } else {
      const reason = result.rejection_reason || 'UNQUALIFIED';
      rejectedReasons[reason] = (rejectedReasons[reason] || 0) + 1;
    }
  }

  console.log('================================================================');
  console.log(`📊 POPULATION RUN COMPLETE:`);
  console.log(`   Candidates Ingested : ${candidatePool.length}`);
  console.log(`   Enriched with HTML  : ${enrichedList.length}`);
  console.log(`   Total Qualified     : ${qualifiedProjects.length}`);
  console.log('   Rejection Breakdown :', rejectedReasons);
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 7. PERSISTENCE TO SUPABASE
  // -------------------------------------------------------------
  if (qualifiedProjects.length > 0) {
    console.log(`💾 Persisting ${qualifiedProjects.length} verified projects to Supabase master_projects...`);
    const saveRes = await saveMasterProjects(qualifiedProjects);
    console.log(`✅ Supabase update completed! Total active projects in database: ${saveRes.total || qualifiedProjects.length}`);
  }

  // Report final count in Supabase
  try {
    const { count } = await supabase.from('master_projects').select('*', { count: 'exact', head: true });
    console.log(`\n🎉 FINAL SUPABASE ROW COUNT: ${count} projects ready for user review!`);
  } catch (e) {}

  return {
    totalIngested: candidatePool.length,
    totalQualified: qualifiedProjects.length
  };
}

if (process.argv[1]?.endsWith('populate50LiveProjects.js')) {
  populate50Projects()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal Error:', err);
      process.exit(1);
    });
}
