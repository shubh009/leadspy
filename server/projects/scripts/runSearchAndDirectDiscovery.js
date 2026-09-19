/**
 * LeadSpy Full End-to-End Discovery Pipeline Runner
 * File: server/projects/scripts/runSearchAndDirectDiscovery.js
 * 
 * Implements:
 * 1. Layer 1: Query Library & QueryRotatorService (Cycles, Priorities, Batching)
 * 2. Layer 2: Multi-Provider Search (Bing, SearXNG, DuckDuckGo) + Direct Sources (HN 30d, Reddit RSS, GitHub 30d)
 * 3. URL Deduplication
 * 4. Deep Content Extractor (Full page context, publish date, contacts)
 * 5. Project Classifier AI (Deterministic 9-Gate Qualification)
 * 6. Smart Freshness Tagging (fresh < 30d, recent_discovery, archive > 30d)
 * 7. Query Performance Tracking (Section 12) & Admin Metadata (Section 16)
 * 8. Database Persistence (Supabase master_projects)
 */

import { QueryRotatorService, ROTATION_CYCLES } from '../services/queryRotatorService.js';
import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from '../services/projectDbService.js';
import { HackerNewsAdapter } from '../adapters/hackerNewsAdapter.js';
import { GitHubDiscussionsAdapter } from '../adapters/githubDiscussionsAdapter.js';
import { RedditAdapter } from '../adapters/redditAdapter.js';

export async function runFullDiscoveryPipeline(config = {}) {
  const {
    days = 30,
    batchSize = 20,
    cycle = 1,
    categories = null,
    siteFilter = null,
    location = null
  } = config;

  console.log('================================================================');
  console.log('🚀 RUNNING COMPLETE PROJECT DISCOVERY PIPELINE');
  console.log(`   Config: Cycle ${cycle} | Batch Size: ${batchSize} | Days: ${days}`);
  if (categories) console.log(`   Selected Categories: ${categories.join(', ')}`);
  if (siteFilter) console.log(`   Site Filter: ${siteFilter}`);
  if (location) console.log(`   Target Location: ${location}`);
  console.log('================================================================\n');

  const rotator = new QueryRotatorService({ days, batchSize, cycle, categories, siteFilter, location });
  const searchQueries = rotator.getQueriesForCycle();

  console.log(`📋 Selected ${searchQueries.length} prioritized queries for Cycle ${cycle}:`);
  searchQueries.forEach((q, i) => console.log(`   ${i + 1}. [${q.priority}] ${q.query}`));
  console.log('');

  const searchManager = new MultiSearchManager();
  const contentExtractor = new ContentExtractor();
  const classifier = new ProjectClassifier();
  classifier.apiKey = null; // Deterministic strict qualification

  const rawCandidatePool = [];
  const seenUrls = new Set();

  // Helper for tracking query performance
  const queryStatsMap = new Map();

  function trackFound(queryStr, sourceName, url) {
    if (!queryStatsMap.has(queryStr)) {
      queryStatsMap.set(queryStr, { source: sourceName, found: 0, unique: 0, qualified: 0, rejected: 0, contactable: 0 });
    }
    const stat = queryStatsMap.get(queryStr);
    stat.found++;
    if (!seenUrls.has(url)) {
      stat.unique++;
    }
  }

  // -------------------------------------------------------------
  // 1. DIRECT SOURCE: Hacker News (Strictly within last 30-45 days)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching Hacker News recent threads (Strict 30-day window)...');
  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (days * 86400);
    const hq = 'SEEKING FREELANCER';
    const searchUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hq)}&tags=comment&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=20`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      for (const h of (data.hits || [])) {
        const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
        trackFound(hq, 'hackernews', itemUrl);
        if (!seenUrls.has(itemUrl)) {
          seenUrls.add(itemUrl);
          const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          rawCandidatePool.push({
            source: 'hackernews',
            url: itemUrl,
            title: lines[0]?.substring(0, 100) || 'Hacker News Project Opportunity',
            snippet: text,
            author: h.author || 'HN Client',
            postedAt: h.created_at || null,
            priorityTier: 'P2',
            search_query: hq,
            search_source: 'hackernews',
            search_result_url: itemUrl,
            discovered_at: new Date().toISOString()
          });
        }
      }
    }
    console.log(`   -> Hacker News items collected: ${rawCandidatePool.filter(c => c.source === 'hackernews').length}`);
  } catch (err) {
    console.warn('   [Notice] HN fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 2. DIRECT SOURCE: Reddit Live Hiring Feeds (RSS)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching live Reddit hiring feeds...');
  const subreddits = ['forhire', 'freelance_forhire', 'jobbit', 'devsforhire', 'hireaprogrammer'];
  for (const sub of subreddits) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/new/.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const xml = await res.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        for (const e of entries) {
          const rawTitle = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/&amp;/g, '&') || '';
          const link = (e.match(/<link\s+href="([^"]+)"/) || [])[1] || '';
          const updated = (e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || null;
          const author = (e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || 'RedditUser';
          const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ') || rawTitle;

          // Only take hiring posts, ignore [for hire]
          if (/\[hiring\]/i.test(rawTitle) || /hiring/i.test(rawTitle)) {
            trackFound(`r/${sub}/hiring`, 'reddit', link);
            if (link && !seenUrls.has(link)) {
              seenUrls.add(link);
              rawCandidatePool.push({
                source: 'reddit',
                url: link,
                title: rawTitle.replace(/^\[hiring\]\s*/i, ''),
                snippet: content.substring(0, 700),
                author,
                postedAt: updated,
                priorityTier: 'P1',
                search_query: `r/${sub}/new.rss`,
                search_source: 'reddit',
                search_result_url: link,
                discovered_at: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (err) {}
  }
  console.log(`   -> Reddit live items collected: ${rawCandidatePool.filter(c => c.source === 'reddit').length}`);

  // -------------------------------------------------------------
  // 3. DIRECT SOURCE: GitHub Public Issues & Discussions (30d)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching GitHub open client requests (30d)...');
  try {
    const ghQuery = '("need developer" OR "looking for developer" OR "build website") is:issue is:open';
    const ghUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(ghQuery)}&sort=created&order=desc&per_page=15`;
    const ghRes = await fetch(ghUrl, {
      headers: { 'User-Agent': 'LeadSpyBot/1.0', 'Accept': 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000)
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      for (const item of (ghData.items || [])) {
        trackFound(ghQuery, 'github', item.html_url);
        if (item.html_url && !seenUrls.has(item.html_url)) {
          seenUrls.add(item.html_url);
          rawCandidatePool.push({
            source: 'github',
            url: item.html_url,
            title: item.title,
            snippet: `${item.title} | ${item.body?.substring(0, 600) || item.title}`,
            author: item.user?.login || 'GitHub User',
            postedAt: item.created_at || null,
            priorityTier: 'P1',
            search_query: ghQuery,
            search_source: 'github',
            search_result_url: item.html_url,
            discovered_at: new Date().toISOString()
          });
        }
      }
    }
    console.log(`   -> GitHub candidates collected: ${rawCandidatePool.filter(c => c.source === 'github').length}`);
  } catch (err) {
    console.warn('   [Notice] GitHub fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 4. SEARCH PROVIDERS: Executing Rotator Cycle Queries
  // -------------------------------------------------------------
  console.log(`📡 [Search Providers] Executing ${searchQueries.length} prioritized queries across search engines...`);

  for (const item of searchQueries) {
    const queryStr = item.query;
    try {
      const { provider, results } = await searchManager.searchWithFallback(queryStr, { timeRange: 'month', limit: 8 });
      for (const r of results) {
        trackFound(queryStr, provider, r.url);
        if (contentExtractor.isValidTarget(r.url) && !seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          rawCandidatePool.push({
            source: r.engine || provider || 'web_search',
            url: r.url,
            title: r.title,
            snippet: r.snippet,
            priorityTier: item.priority === 'HIGH' ? 'P1' : 'P2',
            search_query: queryStr,
            search_source: r.engine || provider || 'search_engine',
            search_result_url: r.url,
            discovered_at: new Date().toISOString(),
            postedAt: null
          });
        }
      }
    } catch (err) {
      console.warn(`   [Search Engine notice for "${queryStr}"]:`, err.message);
    }
  }

  console.log(`\n📥 Total Unique Discovered Candidates: ${rawCandidatePool.length}`);
  console.log('🔍 Executing Deep Content Extraction on candidates...\n');

  // -------------------------------------------------------------
  // 5. DEEP CONTENT EXTRACTION & CONTEXT ANALYSIS
  // -------------------------------------------------------------
  const enrichedCandidates = [];
  for (const item of rawCandidatePool) {
    try {
      const extracted = await contentExtractor.extractDeepContent(item);
      if (extracted && extracted.rawContent) {
        // Carry forward admin/debug metadata (Section 16)
        extracted.search_query = item.search_query || 'unknown';
        extracted.search_source = item.search_source || item.source;
        extracted.search_result_url = item.search_result_url || item.url;
        extracted.discovered_at = item.discovered_at || new Date().toISOString();
        if (!extracted.postedAt && item.postedAt) extracted.postedAt = item.postedAt;

        enrichedCandidates.push(extracted);
      }
    } catch (err) {}
  }

  console.log(`✨ Successfully extracted deep context for ${enrichedCandidates.length} pages.`);
  console.log('⚙️ Passing full context through 9-Gate Project Classifier AI...\n');

  // -------------------------------------------------------------
  // 6. QUALIFICATION VIA 9-GATE ENGINE
  // -------------------------------------------------------------
  const qualifiedProjects = [];
  const stats = { fresh: 0, recent_discovery: 0, archive: 0, rejected: 0 };

  for (const candidate of enrichedCandidates) {
    const result = await classifier.qualifyAndExtract(candidate);
    const qStat = queryStatsMap.get(candidate.search_query);

    if (result.qualification_status === 'qualified' && result.has_actionable_contact) {
      const freshness = candidate.freshnessStatus || 'fresh';
      result.freshnessStatus = freshness;
      result.status = freshness === 'archive' ? 'archive' : 'active';
      result.search_query = candidate.search_query;
      result.search_source = candidate.search_source;

      if (freshness === 'fresh') stats.fresh++;
      else if (freshness === 'archive') stats.archive++;
      else stats.recent_discovery++;

      if (qStat) {
        qStat.qualified++;
        if (result.has_actionable_contact) qStat.contactable++;
      }

      qualifiedProjects.push(result);
      console.log(`🌟 [QUALIFIED] [${freshness.toUpperCase()}] ${result.title.substring(0, 70)}`);
      console.log(`   -> Source: ${result.source} | Query: "${candidate.search_query}"`);
      console.log(`   -> Contact: ${result.contact_type} (${result.contact_value || result.clientEmail})`);
      console.log(`   -> Link: ${result.sourceUrl}\n`);
    } else {
      stats.rejected++;
      if (qStat) qStat.rejected++;
    }
  }

  // Record Telemetry in QueryRotatorService (Section 12)
  for (const [qStr, s] of queryStatsMap.entries()) {
    QueryRotatorService.recordQueryPerformance({
      query: qStr,
      source: s.source,
      resultsFound: s.found,
      uniqueResults: s.unique,
      qualifiedProjects: s.qualified,
      rejectedResults: s.rejected,
      contactableProjects: s.contactable
    });
  }

  console.log('================================================================');
  console.log(`📊 DISCOVERY SUMMARY FOR CYCLE ${cycle}:`);
  console.log(`   Total URLs Ingested    : ${rawCandidatePool.length}`);
  console.log(`   Enriched with Context  : ${enrichedCandidates.length}`);
  console.log(`   Total Qualified Leads  : ${qualifiedProjects.length}`);
  console.log(`     - Fresh (< 30 days)  : ${stats.fresh}`);
  console.log(`     - Recent Discovery   : ${stats.recent_discovery}`);
  console.log(`     - Archive (> 30 days): ${stats.archive}`);
  console.log(`   Rejected (Noise/Jobs)  : ${stats.rejected}`);
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 7. PERSISTENCE TO DATABASE (Supabase master_projects)
  // -------------------------------------------------------------
  if (qualifiedProjects.length > 0) {
    console.log(`💾 Persisting ${qualifiedProjects.length} qualified leads into Database...`);
    const dbRes = await saveMasterProjects(qualifiedProjects);
    console.log(`✅ Supabase Database updated! Total active projects: ${dbRes.total || qualifiedProjects.length}`);
  }

  return {
    cycle,
    ingested: rawCandidatePool.length,
    qualified: qualifiedProjects.length,
    stats,
    performanceSummary: QueryRotatorService.getPerformanceSummary()
  };
}

// If run directly via CLI
if (process.argv[1]?.endsWith('runSearchAndDirectDiscovery.js')) {
  runFullDiscoveryPipeline({ cycle: 1, batchSize: 20, days: 30 })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal Discovery Pipeline Error:', err);
      process.exit(1);
    });
}
