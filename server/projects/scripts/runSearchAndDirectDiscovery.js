/**
 * LeadSpy Full End-to-End Discovery Pipeline Runner
 * Implements:
 * 1. Layer 1: Dynamic Dork & Query Generation
 * 2. Layer 2: Multi-Provider Search (Bing, SearXNG, DuckDuckGo) + Direct Sources (HN 30d, Reddit RSS, GitHub 30d)
 * 3. URL Deduplication
 * 4. Deep Content Extractor (Full page context, publish date, contacts)
 * 5. Project Classifier AI (Deterministic 9-Gate Qualification)
 * 6. Smart Freshness Tagging (fresh < 30d, recent_discovery, archive > 30d)
 * 7. Database Persistence (Supabase master_projects)
 */

import { generateSearchQueries, CORE_INTENT_QUERIES } from '../sources/queryGenerator.js';
import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from '../services/projectDbService.js';
import { HackerNewsAdapter } from '../adapters/hackerNewsAdapter.js';
import { GitHubDiscussionsAdapter } from '../adapters/githubDiscussionsAdapter.js';
import { RedditAdapter } from '../adapters/redditAdapter.js';

export async function runFullDiscoveryPipeline() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPLETE PROJECT DISCOVERY PIPELINE');
  console.log('   Layer 1: Dynamic Dork & Target Query Generation');
  console.log('   Layer 2: Multi-Provider Search Engine Abstraction');
  console.log('   Direct Sources: Hacker News (30d), Reddit RSS, GitHub');
  console.log('   Deep Content Extraction + AI Qualification Engine');
  console.log('================================================================\n');

  const searchManager = new MultiSearchManager();
  const contentExtractor = new ContentExtractor();
  const classifier = new ProjectClassifier();
  classifier.apiKey = null; // Deterministic strict qualification

  const rawCandidatePool = [];
  const seenUrls = new Set();

  // -------------------------------------------------------------
  // 1. DIRECT SOURCE: Hacker News (Strictly within last 30 days)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching Hacker News recent threads (Strict 30-day window)...');
  try {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
    const hnQueries = ['"SEEKING FREELANCER"', '"looking for developer"', '"need a developer"', '"contract developer"'];
    
    for (const hq of hnQueries) {
      const searchUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hq)}&tags=comment&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=15`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        for (const h of (data.hits || [])) {
          const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
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
              postedAt: h.created_at || new Date().toISOString(),
              priorityTier: 'P2'
            });
          }
        }
      }
    }
    console.log(`   -> Hacker News recent items collected: ${rawCandidatePool.filter(c => c.source === 'hackernews').length}`);
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
          const updated = (e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || new Date().toISOString();
          const author = (e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || 'RedditUser';
          const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ') || rawTitle;

          // Only take hiring posts, ignore [for hire]
          if (/\[hiring\]/i.test(rawTitle) || /hiring/i.test(rawTitle)) {
            if (link && !seenUrls.has(link)) {
              seenUrls.add(link);
              rawCandidatePool.push({
                source: 'reddit',
                url: link,
                title: rawTitle.replace(/^\[hiring\]\s*/i, ''),
                snippet: content.substring(0, 700),
                author,
                postedAt: updated,
                priorityTier: 'P1'
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
    const ghQuery = encodeURIComponent('("need developer" OR "looking for developer" OR "build website") is:issue is:open');
    const ghUrl = `https://api.github.com/search/issues?q=${ghQuery}&sort=created&order=desc&per_page=15`;
    const ghRes = await fetch(ghUrl, {
      headers: { 'User-Agent': 'LeadSpyBot/1.0', 'Accept': 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000)
    });
    if (ghRes.ok) {
      const ghData = await ghRes.json();
      for (const item of (ghData.items || [])) {
        if (item.html_url && !seenUrls.has(item.html_url)) {
          seenUrls.add(item.html_url);
          rawCandidatePool.push({
            source: 'github',
            url: item.html_url,
            title: item.title,
            snippet: `${item.title} | ${item.body?.substring(0, 600) || item.title}`,
            author: item.user?.login || 'GitHub User',
            postedAt: item.created_at || new Date().toISOString(),
            priorityTier: 'P1'
          });
        }
      }
    }
    console.log(`   -> GitHub candidates collected: ${rawCandidatePool.filter(c => c.source === 'github').length}`);
  } catch (err) {
    console.warn('   [Notice] GitHub fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 4. SEARCH PROVIDERS: Dynamic Dork & Web Discovery (Layer 1 + 2)
  // -------------------------------------------------------------
  console.log('📡 [Search Providers] Generating dynamic dorks & querying search engines...');
  const searchQueries = [
    'site:reddit.com/r/forhire "hiring" "website"',
    'site:reddit.com/r/forhire "hiring" "developer"',
    'site:indiehackers.com "looking for developer"',
    'site:github.com "looking for web development agency"',
    ...CORE_INTENT_QUERIES.slice(0, 5)
  ];

  for (const query of searchQueries) {
    try {
      const { provider, results } = await searchManager.searchWithFallback(query, { timeRange: 'month', limit: 8 });
      for (const r of results) {
        if (contentExtractor.isValidTarget(r.url) && !seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          rawCandidatePool.push({
            source: r.engine || 'web_search',
            url: r.url,
            title: r.title,
            snippet: r.snippet,
            priorityTier: 'P1',
            query
          });
        }
      }
    } catch (err) {
      console.warn(`   [Search Engine notice for "${query}"]:`, err.message);
    }
  }

  console.log(`\n📥 Total Discovered URL Pool: ${rawCandidatePool.length}`);
  console.log('🔍 Executing Deep Content Extraction on candidates...\n');

  // -------------------------------------------------------------
  // 5. DEEP CONTENT EXTRACTION & CONTEXT ANALYSIS
  // -------------------------------------------------------------
  const enrichedCandidates = [];
  for (const item of rawCandidatePool) {
    try {
      const extracted = await contentExtractor.extractDeepContent(item);
      if (extracted && extracted.rawContent) {
        enrichedCandidates.push(extracted);
      }
    } catch (err) {
      // Keep going
    }
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

    if (result.qualification_status === 'qualified' && result.has_actionable_contact) {
      const freshness = candidate.freshnessStatus || 'fresh';
      result.freshnessStatus = freshness;
      result.status = freshness === 'archive' ? 'archive' : 'active';

      if (freshness === 'fresh') stats.fresh++;
      else if (freshness === 'archive') stats.archive++;
      else stats.recent_discovery++;

      qualifiedProjects.push(result);
      console.log(`🌟 [QUALIFIED] [${freshness.toUpperCase()}] ${result.title.substring(0, 70)}`);
      console.log(`   -> Source: ${result.source} | Contact: ${result.contact_type} (${result.contact_value || result.clientEmail})`);
      console.log(`   -> Link: ${result.sourceUrl}\n`);
    } else {
      stats.rejected++;
    }
  }

  console.log('================================================================');
  console.log(`📊 DISCOVERY SUMMARY:`);
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
  } else {
    console.log('ℹ️ No new qualified leads met strict quality thresholds in this pass.');
  }

  return {
    ingested: rawCandidatePool.length,
    qualified: qualifiedProjects.length,
    stats
  };
}

// If run directly via CLI
if (process.argv[1]?.endsWith('runSearchAndDirectDiscovery.js')) {
  runFullDiscoveryPipeline()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal Discovery Pipeline Error:', err);
      process.exit(1);
    });
}
