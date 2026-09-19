/**
 * LeadSpy Full End-to-End Discovery Pipeline Runner
 * File: server/projects/scripts/runSearchAndDirectDiscovery.js
 * 
 * Implements:
 * 1. Layer 1: Query Library & QueryRotatorService (Cycles, Priorities, Batching, DISCOVERY_MODE)
 * 2. Layer 2: Multi-Provider Search + Direct Sources (HN 30d, Reddit, GitHub) with RATE_LIMITED tracking
 * 3. Canonical Deduplication (Raw URL, Canonical URL, Source-ID, Content Fingerprint)
 * 4. Deep Content Extractor (Full page context, publish date, contacts)
 * 5. Project Classifier AI (Deterministic 9-Gate Qualification)
 * 6. Gate 8 Semantic Deduplication (Unchanged safety net)
 * 7. Deduplication Metrics Reporting (Task 7)
 * 8. Database Persistence (Supabase master_projects)
 */

import { QueryRotatorService, ROTATION_CYCLES } from '../services/queryRotatorService.js';
import { DISCOVERY_MODE } from '../config/projectQueryLibrary.js';
import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import { saveMasterProjects } from '../services/projectDbService.js';

export async function runFullDiscoveryPipeline(config = {}) {
  const {
    days = 30,
    batchSize = 20,
    cycle = 1,
    categories = null,
    siteFilter = null,
    location = null,
    mode = DISCOVERY_MODE.STANDARD,
    persistToDb = true
  } = config;

  console.log('================================================================');
  console.log(`🚀 RUNNING PROJECT DISCOVERY PIPELINE [MODE: ${mode.toUpperCase()}]`);
  console.log(`   Config: Cycle ${cycle} | Batch Size: ${batchSize} | Days: ${days}`);
  if (categories) console.log(`   Selected Categories: ${categories.join(', ')}`);
  if (siteFilter) console.log(`   Site Filter: ${siteFilter}`);
  if (location) console.log(`   Target Location: ${location}`);
  console.log('================================================================\n');

  const rotator = new QueryRotatorService({ days, batchSize, cycle, categories, siteFilter, location, mode });
  const searchQueries = rotator.getQueriesForCycle({ mode, batchSize });

  console.log(`📋 Selected ${searchQueries.length} prioritized queries [Mode: ${mode}]:`);
  searchQueries.forEach((q, i) => console.log(`   ${i + 1}. [${q.priority}] ${q.query}`));
  console.log('');

  const searchManager = new MultiSearchManager();
  const contentExtractor = new ContentExtractor();
  const canonicalDeduplicator = new CanonicalDeduplicator();
  const classifier = new ProjectClassifier();
  // Gemini 3.6 Flash enabled for high-precision LLM qualification with heuristic fallback

  const rawCandidatePool = [];
  const queryStatsMap = new Map();
  const providerStatus = {
    hackernews: 'ACTIVE',
    reddit: 'ACTIVE',
    github: 'ACTIVE',
    search_engines: 'ACTIVE'
  };

  function trackFound(queryStr, sourceName) {
    if (!queryStatsMap.has(queryStr)) {
      queryStatsMap.set(queryStr, { source: sourceName, rawResults: 0, uniqueResults: 0, qualified: 0, rejected: 0 });
    }
    const stat = queryStatsMap.get(queryStr);
    stat.rawResults++;
  }

  function ingestCandidate(rawItem) {
    trackFound(rawItem.search_query, rawItem.source);

    // Pre-Classification Canonical Deduplication (Tasks 2, 3, 4)
    const check = canonicalDeduplicator.checkUrlCandidate(rawItem);
    if (!check.isDuplicate) {
      const stat = queryStatsMap.get(rawItem.search_query);
      if (stat) stat.uniqueResults++;

      rawCandidatePool.push({
        ...rawItem,
        canonicalUrl: check.canonicalUrl || rawItem.url,
        canonicalId: check.canonicalId || null
      });
    }
  }

  // -------------------------------------------------------------
  // 1. DIRECT SOURCE: Hacker News (Strictly within last 30 days)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching Hacker News recent contract threads...');
  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (days * 86400);
    const hq = mode === DISCOVERY_MODE.HIGH_INTENT ? 'need someone to build' : 'SEEKING FREELANCER';
    const searchUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hq)}&tags=comment&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=25`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
    
    if (res.status === 429) {
      providerStatus.hackernews = 'RATE_LIMITED';
      console.warn('   ⚠️ Hacker News API returned HTTP 429 (RATE_LIMITED)');
    } else if (res.ok) {
      const data = await res.json();
      for (const h of (data.hits || [])) {
        const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
        const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        ingestCandidate({
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
  } catch (err) {
    console.warn('   [Notice] HN fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 2. DIRECT SOURCE: Reddit Live Hiring Feeds
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching live Reddit feeds with rate-limit detection...');
  const subreddits = ['forhire', 'freelance_forhire', 'jobbit'];
  for (const sub of subreddits) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/new/.rss`, {
        headers: { 'User-Agent': 'LeadSpyBot/1.0 (IT Project Engine; https://leadspy.app)' },
        signal: AbortSignal.timeout(6000)
      });

      if (res.status === 429) {
        providerStatus.reddit = 'RATE_LIMITED';
        console.warn(`   ⚠️ Reddit r/${sub} returned HTTP 429 (RATE_LIMITED) - respecting backoff`);
        break;
      } else if (res.ok) {
        const xml = await res.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        for (const e of entries) {
          const rawTitle = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/&amp;/g, '&') || '';
          const link = (e.match(/<link\s+href="([^"]+)"/) || [])[1] || '';
          const updated = (e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || null;
          const author = (e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || 'RedditUser';
          const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ') || rawTitle;

          if (/\[hiring\]/i.test(rawTitle) || /hiring/i.test(rawTitle)) {
            ingestCandidate({
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
    } catch (err) {}
    // Rate-aware pause
    await new Promise(r => setTimeout(r, 500));
  }

  // -------------------------------------------------------------
  // 3. DIRECT SOURCE: GitHub Public Issues (30d)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching GitHub open client requests...');
  try {
    const ghQuery = mode === DISCOVERY_MODE.HIGH_INTENT 
      ? '("need someone to build" OR "looking for development agency" OR "need an app built") is:issue is:open'
      : '("need developer" OR "looking for developer" OR "build website") is:issue is:open';

    const ghUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(ghQuery)}&sort=created&order=desc&per_page=15`;
    const ghRes = await fetch(ghUrl, {
      headers: { 'User-Agent': 'LeadSpyBot/1.0', 'Accept': 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(8000)
    });

    if (ghRes.status === 403 || ghRes.status === 429) {
      providerStatus.github = 'RATE_LIMITED';
      console.warn('   ⚠️ GitHub Search API returned HTTP 403/429 (RATE_LIMITED) - respecting rate window');
    } else if (ghRes.ok) {
      const ghData = await ghRes.json();
      for (const item of (ghData.items || [])) {
        ingestCandidate({
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
  } catch (err) {
    console.warn('   [Notice] GitHub fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 4. SEARCH PROVIDERS: Executing Rotator Queries with Backoff
  // -------------------------------------------------------------
  console.log(`📡 [Search Providers] Executing ${searchQueries.length} queries across web engines...`);

  for (const item of searchQueries) {
    const queryStr = item.query;
    try {
      const { provider, results } = await searchManager.searchWithFallback(queryStr, { timeRange: 'month', limit: 8 });
      for (const r of results) {
        if (contentExtractor.isValidTarget(r.url)) {
          ingestCandidate({
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
    // Respect rate limits with queue delay
    await new Promise(r => setTimeout(r, 400));
  }

  // -------------------------------------------------------------
  // 5. CONTENT EXTRACTION & FINGERPRINT DEDUPLICATION (Tasks 2 & 5)
  // -------------------------------------------------------------
  console.log(`\n🔍 Fetching & Extracting deep content for ${rawCandidatePool.length} pre-deduplicated candidates...`);
  const enrichedCandidates = [];

  for (const item of rawCandidatePool) {
    try {
      const extracted = await contentExtractor.extractDeepContent(item);
      if (extracted && extracted.rawContent) {
        // Step 2 Pre-Filter: Content Fingerprint Deduplication
        const fpCheck = canonicalDeduplicator.checkContentCandidate(extracted.title || item.title, extracted.rawContent);
        if (!fpCheck.isDuplicate) {
          extracted.search_query = item.search_query || 'unknown';
          extracted.search_source = item.search_source || item.source;
          extracted.search_result_url = item.search_result_url || item.url;
          extracted.discovered_at = item.discovered_at || new Date().toISOString();
          if (!extracted.postedAt && item.postedAt) extracted.postedAt = item.postedAt;

          enrichedCandidates.push(extracted);
        }
      }
    } catch (err) {}
  }

  console.log(`✨ Filtered into ${enrichedCandidates.length} clean candidates sent to 9-Gate Classifier.`);

  // -------------------------------------------------------------
  // 6. QUALIFICATION VIA 9-GATE ENGINE (Gate 8 Semantic Dedup Preserved)
  // -------------------------------------------------------------
  const qualifiedProjects = [];
  const rejectionReasons = {};
  let gate8Duplicates = 0;

  for (const candidate of enrichedCandidates) {
    const result = await classifier.qualifyAndExtract(candidate);
    const qStat = queryStatsMap.get(candidate.search_query);

    if (result.qualification_status === 'qualified' && result.has_actionable_contact) {
      result.freshnessStatus = candidate.freshnessStatus || 'fresh';
      result.status = candidate.freshnessStatus === 'archive' ? 'archive' : 'active';
      result.search_query = candidate.search_query;
      result.search_source = candidate.search_source;

      if (qStat) qStat.qualified++;
      qualifiedProjects.push(result);

      console.log(`🌟 [QUALIFIED] [${result.source.toUpperCase()}] ${result.title.substring(0, 70)}`);
      console.log(`   -> Contact: ${result.contact_type} (${result.contact_value || result.clientEmail})`);
      console.log(`   -> Link: ${result.sourceUrl}\n`);
    } else {
      const reason = result.rejection_reason || 'UNQUALIFIED';
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      if (reason === 'DUPLICATE') gate8Duplicates++;
      if (qStat) qStat.rejected++;
    }
  }

  const dedupMetrics = canonicalDeduplicator.getMetrics();
  const finalUniqueCandidates = enrichedCandidates.length - gate8Duplicates;

  // -------------------------------------------------------------
  // 7. STRUCTURED DEDUPLICATION & RUN REPORT (Task 7)
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log(`📊 DEDUPLICATION & CLASSIFICATION METRICS [MODE: ${mode.toUpperCase()}]:`);
  console.log(`   Raw Search Results               : ${dedupMetrics.rawResults}`);
  console.log(`   Exact URL Duplicates Removed     : ${dedupMetrics.urlDuplicatesRemoved}`);
  console.log(`   Canonical URL Duplicates Removed : ${dedupMetrics.canonicalUrlDuplicatesRemoved}`);
  console.log(`   Source-ID Duplicates Removed     : ${dedupMetrics.sourceIdDuplicatesRemoved}`);
  console.log(`   Content Duplicates Removed       : ${dedupMetrics.contentDuplicatesRemoved}`);
  console.log(`   Candidates Entering Classifier   : ${enrichedCandidates.length}`);
  console.log(`   Gate 8 Semantic Duplicates       : ${gate8Duplicates}`);
  console.log(`   Final Unique Candidates          : ${finalUniqueCandidates}`);
  console.log(`   Qualified Projects               : ${qualifiedProjects.length}`);
  console.log(`   Rejection Breakdown              :`, rejectionReasons);
  console.log(`   Provider Rate-Limit Status       :`, providerStatus);
  console.log('================================================================\n');

  // Query performance breakdown
  const queryBreakdown = [];
  for (const [qStr, stat] of queryStatsMap.entries()) {
    const qualRate = stat.rawResults > 0 ? (stat.qualified / stat.rawResults).toFixed(3) : 0;
    queryBreakdown.push({
      query: qStr,
      source: stat.source,
      rawResults: stat.rawResults,
      uniqueResults: stat.uniqueResults,
      qualified: stat.qualified,
      rejected: stat.rejected,
      qualificationRate: qualRate
    });
  }

  // -------------------------------------------------------------
  // 8. DATABASE PERSISTENCE
  // -------------------------------------------------------------
  if (persistToDb && qualifiedProjects.length > 0) {
    console.log(`💾 Persisting ${qualifiedProjects.length} qualified leads into Database...`);
    const dbRes = await saveMasterProjects(qualifiedProjects);
    console.log(`✅ Supabase Database updated! Total active projects: ${dbRes.total || qualifiedProjects.length}`);
  }

  return {
    mode,
    cycle,
    metrics: {
      rawResults: dedupMetrics.rawResults,
      urlDuplicatesRemoved: dedupMetrics.urlDuplicatesRemoved,
      canonicalUrlDuplicatesRemoved: dedupMetrics.canonicalUrlDuplicatesRemoved,
      sourceIdDuplicatesRemoved: dedupMetrics.sourceIdDuplicatesRemoved,
      contentDuplicatesRemoved: dedupMetrics.contentDuplicatesRemoved,
      candidatesEnteringClassifier: enrichedCandidates.length,
      gate8Duplicates,
      finalUniqueCandidates,
      qualifiedProjects: qualifiedProjects.length
    },
    rejectionReasons,
    providerStatus,
    queryBreakdown
  };
}

if (process.argv[1]?.endsWith('runSearchAndDirectDiscovery.js')) {
  runFullDiscoveryPipeline({ cycle: 1, batchSize: 15, days: 30 })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal Discovery Pipeline Error:', err);
      process.exit(1);
    });
}
