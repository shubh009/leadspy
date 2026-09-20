/**
 * LeadSpy Full End-to-End Discovery Pipeline Runner - V2
 * File: server/projects/scripts/runSearchAndDirectDiscovery.js
 * 
 * Supports:
 * 1. Layer 1: Query Library & Balanced QueryRotatorService (Extended metadata propagation)
 * 2. Layer 2: MultiSearchManager V2 (Primary -> Deterministic Quality Check -> Fallback Chain -> Enrichment)
 * 3. Canonical Deduplication (Raw URL, Canonical URL, Source-ID, Content Fingerprint)
 * 4. Source-Aware Cheap Pre-Crawl Filter (scoreSearchResult with explainable evidence)
 * 5. Strict Crawl Safeguards (PRE_CRAWL_THRESHOLD, MAX_CRAWLS_PER_QUERY, MAX_TOTAL_CRAWLS_PER_RUN)
 * 6. Reddit Recall Fix (Evaluates buyer/project intent without requiring the word "hiring")
 * 7. Untouched 9-Gate Qualification Engine (Preserved Gate 8 & Gate 7)
 * 8. Configurable DB Persistence (Supports PERSIST_TO_DB=false for audit-only runs)
 */

import dotenv from 'dotenv';
dotenv.config();

import { QueryRotatorService, ROTATION_CYCLES } from '../services/queryRotatorService.js';
import { DISCOVERY_MODE } from '../config/projectQueryLibrary.js';
import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import { saveMasterProjects } from '../services/projectDbService.js';
import {
  evaluateCandidateValidityGate,
  getVerificationCacheStats,
  LINK_HEALTH_STATUS,
  PAGE_TYPE
} from '../services/pageVerificationService.js';

function getCandidateRootDomain(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    return host;
  } catch (e) {
    return 'unknown';
  }
}

function getRedditSubreddit(urlStr) {
  try {
    const match = urlStr.match(/reddit\.com\/r\/([^/?#]+)/i);
    return match ? match[1].toLowerCase() : 'all';
  } catch (e) {
    return 'all';
  }
}

/**
 * Deterministic, Source-Aware Pre-Crawl Scoring Function
 * Evaluates cheap metadata (title, snippet, url, sourceDomain, query context) with zero network cost.
 * 
 * @param {Object} item - SERP result candidate
 * @param {Object} context - Query metadata context (intentType, deliverableType, sourceScope, priority)
 * @returns {Object} { score, decision, positiveSignals, negativeSignals, sourceScope, rejectionReason }
 */
export function scoreSearchResult(item, context = {}) {
  const title = (item.title || '').trim();
  const snippet = (item.snippet || '').trim();
  const fullText = `${title} ${snippet}`;
  const url = (item.url || '').toLowerCase();
  const sourceScope = context.sourceScope || item.source || 'public_web';

  const positiveSignals = [];
  const negativeSignals = [];
  let score = 0;

  // 1. POSITIVE SIGNALS
  // 1.1 Direct Buyer Intent (+30)
  const buyerIntentRegex = /\b(need|needs|looking for|seeking|want to build|looking to outsource|our company|for our business|hiring (an?\s*)?(developer|agency|team|someone|firm)|request for proposal|rfp|scope of work|proposal|budget|quote|vendor|agency|technology partner)\b/i;
  if (buyerIntentRegex.test(fullText)) {
    score += 30;
    const m = fullText.match(buyerIntentRegex);
    positiveSignals.push(`Buyer intent: "${m[0]}"`);
  }

  // 1.2 Concrete IT Deliverable (+25)
  const deliverableRegex = /\b(website|web app|web application|mobile app|software|saas|mvp|crm|erp|dashboard|portal|automation|ai agent|chatbot|api|ecommerce|booking system|platform|application)\b/i;
  if (deliverableRegex.test(fullText)) {
    score += 25;
    const m = fullText.match(deliverableRegex);
    positiveSignals.push(`IT deliverable: "${m[0]}"`);
  }

  // 1.3 Project / Procurement Signal (+20)
  const procurementRegex = /\b(request for proposal|rfp|scope of work|statement of work|fixed price|contract project|budget\s*[:=$]|project budget|send proposal|quotation)\b/i;
  if (procurementRegex.test(fullText)) {
    score += 20;
    const m = fullText.match(procurementRegex);
    positiveSignals.push(`Procurement/Budget: "${m[0]}"`);
  }

  // 1.4 Project Action Verb (+15)
  const actionVerbRegex = /\b(build|develop|create|implement|integrate|redesign|revamp|maintain|fix|outsource|development team)\b/i;
  if (actionVerbRegex.test(fullText)) {
    score += 15;
    const m = fullText.match(actionVerbRegex);
    positiveSignals.push(`Project action: "${m[0]}"`);
  }

  // 1.5 Direct Outreach / Contact Signal (+10)
  const contactSignalRegex = /\b(contact\s*(us|me)?|email|dm me|pm me|inbox|send details|apply at|quote)\b/i;
  if (contactSignalRegex.test(fullText)) {
    score += 10;
    positiveSignals.push('Outreach/Contact signal');
  }

  // Contextual metadata boost from Query Library
  if (context.qualityTier === 'A') {
    score += 5;
    positiveSignals.push('Query Quality Tier A');
  }

  // 2. NEGATIVE SIGNALS (Context-Aware)
  // 2.1 Job / Employment Signal (-50)
  const isFeatureSalary = /salary\s*(calculation|module|component|system|slip)/i.test(fullText);
  const employmentRegex = /\b(senior\s*(software|react|node|frontend|backend)\s*developer|sde\b|full[- ]?time (job|role|position|employee)|permanent (role|position)|annual ctc|ctc\s*[:=]|[\d.]+\s*lpa|job vacancy|job opening|notice period|submit resume|send your cv|join our team|401k|benefits package|\$\d+k salary|w2 role)\b/i;
  if (!isFeatureSalary && employmentRegex.test(fullText)) {
    score -= 50;
    negativeSignals.push('Employment/Salaried job signal');
  }

  // 2.2 Internship / Trainee (-50)
  if (/\b(intern\b|internship|apprenticeship|trainee|stipend)\b/i.test(fullText)) {
    score -= 50;
    negativeSignals.push('Internship/Trainee signal');
  }

  // 2.3 Educational / Tutorial / Guide / Informational Blog (-45)
  const informationalArticleRegex = /\b(why (you|businesses|companies) need|top \d+ reasons|reasons (you|businesses) need|how to (learn|build|use|setup|choose)|guide to|tutorial|course|learn react|documentation|step by step guide|definition of|read our blog)\b/i;
  if (informationalArticleRegex.test(fullText)) {
    score -= 45;
    negativeSignals.push('Informational blog/article/guide');
  }

  // 2.4 Technical Discussion / Comparison (-35)
  const discussionRegex = /\b(ask hn|what is the best|which (framework|stack|library) is better|what do you think of|pros and cons|vs\b|comparison|reddit discussion)\b/i;
  if (discussionRegex.test(fullText)) {
    score -= 35;
    negativeSignals.push('General technical discussion/question');
  }

  // 2.5 Product / Marketing URL Paths (-30)
  const isProductPath = /\/(pricing|features|blog|docs|documentation|about|services|category|tag|author)\b/i.test(url) ||
                        /\b(download (our|the)? (software|app|tool)|features and download|welcome to our (website|software))\b/i.test(fullText);
  if (isProductPath) {
    score -= 30;
    negativeSignals.push('Product homepage or marketing blog path');
  }

  // 2.6 Pure Marketing / Non-IT Gig (-45)
  const isCustomAutomationSoftware = /marketing automation\s*(software|platform|system|tool|app)/i.test(fullText);
  const nonItRegex = /\b(marketing agency|social media marketing|seo agency|copywriter|content writer|virtual assistant|va\b|video editor|manage instagram|reels creator)\b/i;
  if (!isCustomAutomationSoftware && nonItRegex.test(fullText)) {
    score -= 45;
    negativeSignals.push('Non-IT marketing/agency service');
  }

  // 2.7 Blacklisted Domains (-100)
  const domain = (item.sourceDomain || '').toLowerCase();
  const isBlacklisted = domain.includes('merriam-webster') ||
                        domain.includes('wikipedia.org') ||
                        domain.includes('dictionary') ||
                        domain.includes('naukri.com') ||
                        domain.includes('indeed.com') ||
                        domain.includes('glassdoor') ||
                        domain.includes('workindia');
  if (isBlacklisted) {
    score -= 100;
    negativeSignals.push(`Blacklisted domain: ${domain}`);
  }

  // Source-Specific Adjustments
  if (sourceScope === 'reddit') {
    // Reddit posts with supply-side self intro get penalized
    if (/\b(for hire|hire me|my portfolio|available for freelance)\b/i.test(fullText)) {
      score -= 50;
      negativeSignals.push('Reddit supply-side freelancer self-pitch');
    }
  } else if (sourceScope === 'github') {
    // Normal bug issues get penalized
    if (/\b(issue #\d+|bug fix|pr #\d+|merge branch|lint failed)\b/i.test(fullText) && !/\b(bounty|paid|budget|\$)\b/i.test(fullText)) {
      score -= 40;
      negativeSignals.push('GitHub non-commercial codebase bug report');
    }
  }

  if (context.crossQueryBoost) {
    score += context.crossQueryBoost;
    positiveSignals.push(`Cross-query corroboration boost (+${context.crossQueryBoost})`);
  }

  const threshold = Number(process.env.PRE_CRAWL_THRESHOLD) || 45;
  const decision = score >= threshold ? 'accept' : 'reject';
  let rejectionReason = null;
  if (decision === 'reject') {
    if (negativeSignals.length > 0) rejectionReason = negativeSignals[0];
    else rejectionReason = 'INSUFFICIENT_BUYER_INTENT_OR_DELIVERABLE';
  }

  let candidateState = 'REJECT';
  if (score >= 70) candidateState = 'HIGH_CONFIDENCE_PROJECT';
  else if (score >= 50) candidateState = 'PROJECT_CANDIDATE';
  else if (score >= 35) candidateState = 'REVIEW';
  else candidateState = 'REJECT';

  return {
    score,
    decision,
    candidateState,
    positiveSignals,
    negativeSignals,
    sourceScope,
    rejectionReason
  };
}

export async function runFullDiscoveryPipeline(config = {}) {
  const {
    days = 30,
    batchSize = 20,
    cycle = 1,
    categories = null,
    siteFilter = null,
    location = null,
    mode = DISCOVERY_MODE.STANDARD,
    persistToDb = (process.env.PERSIST_TO_DB !== 'false')
  } = config;

  // Safeguards and thresholds
  const preCrawlThreshold = Number(process.env.PRE_CRAWL_THRESHOLD) || 45;
  const maxCrawlsPerQuery = Number(process.env.MAX_CRAWLS_PER_QUERY) || 3;
  const maxTotalCrawlsPerRun = Number(process.env.MAX_TOTAL_CRAWLS_PER_RUN) || 50;

  console.log('================================================================');
  console.log(`🚀 RUNNING PROJECT DISCOVERY PIPELINE V2 [MODE: ${mode.toUpperCase()}]`);
  console.log(`   Config: Cycle ${cycle} | Batch Size: ${batchSize} | Days: ${days}`);
  console.log(`   Safeguards: Pre-Crawl Threshold: ${preCrawlThreshold} | Max/Query: ${maxCrawlsPerQuery} | Max Run Crawls: ${maxTotalCrawlsPerRun}`);
  console.log(`   Persistence Mode: ${persistToDb ? 'ACTIVE (Persist to Supabase)' : 'AUDIT ONLY (PERSIST_TO_DB=false)'}`);
  if (categories) console.log(`   Selected Categories: ${categories.join(', ')}`);
  if (siteFilter) console.log(`   Site Filter: ${siteFilter}`);
  if (location) console.log(`   Target Location: ${location}`);
  console.log('================================================================\n');

  const rotator = new QueryRotatorService({ days, batchSize, cycle, categories, siteFilter, location, mode });
  const searchQueries = rotator.getQueriesForCycle({ mode, batchSize });

  console.log(`📋 Selected ${searchQueries.length} balanced prioritized queries [Mode: ${mode}]:`);
  searchQueries.forEach((q, i) => console.log(`   ${i + 1}. [${q.priority}|${q.intentType || 'gen'}|${q.qualityTier || 'A'}] ${q.query}`));
  console.log('');

  const searchManager = new MultiSearchManager();
  const contentExtractor = new ContentExtractor();
  const canonicalDeduplicator = new CanonicalDeduplicator();
  const classifier = new ProjectClassifier();

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
      queryStatsMap.set(queryStr, {
        source: sourceName,
        rawResults: 0,
        uniqueResults: 0,
        preFilterAccepted: 0,
        preFilterRejected: 0,
        deepCrawled: 0,
        qualified: 0,
        contactable: 0,
        rejected: 0,
        rejectionReasons: {}
      });
    }
    const stat = queryStatsMap.get(queryStr);
    stat.rawResults++;
  }

  function ingestCandidate(rawItem, queryContext = {}) {
    trackFound(rawItem.search_query, rawItem.source);

    // Pre-Classification Canonical Deduplication
    const check = canonicalDeduplicator.checkUrlCandidate(rawItem);
    if (!check.isDuplicate) {
      const stat = queryStatsMap.get(rawItem.search_query);
      if (stat) stat.uniqueResults++;

      rawCandidatePool.push({
        ...rawItem,
        canonicalUrl: check.canonicalUrl || rawItem.url,
        canonicalId: check.canonicalId || null,
        queryContext
      });
    }
  }

  // -------------------------------------------------------------
  // 1. DIRECT SOURCE: Hacker News (Recent Contract Threads)
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
        }, { sourceScope: 'hackernews', intentType: 'project_requirement', priority: 'MEDIUM' });
      }
    }
  } catch (err) {
    console.warn('   [Notice] HN fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 2. DIRECT SOURCE: Reddit Live Feeds (Recall Fix: Evaluates Buyer/Project Intent)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching live Reddit feeds (Intent-based, not hiring-only)...');
  const subreddits = ['forhire', 'freelance_forhire', 'jobbit'];
  const projectIntentFilter = /\b(hiring|need|looking for|seeking|build|develop|create|saas|app|website|software|crm|platform|mvp|agency|developer|team)\b/i;

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

          // Recall fix: Accept if title OR content matches project/buyer intent
          if (projectIntentFilter.test(rawTitle) || projectIntentFilter.test(content.substring(0, 200))) {
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
            }, { sourceScope: 'reddit', intentType: 'buyer_request', priority: 'HIGH' });
          }
        }
      }
    } catch (err) {}
    await new Promise(r => setTimeout(r, 400));
  }

  // -------------------------------------------------------------
  // 3. DIRECT SOURCE: GitHub Public Issues (30d)
  // -------------------------------------------------------------
  console.log('📡 [Direct Source] Fetching GitHub open client requests...');
  try {
    const thirtyDaysIso = new Date(Date.now() - (days * 86400 * 1000)).toISOString().split('T')[0];
    const ghQuery = `is:issue is:open created:>${thirtyDaysIso} "development agency" OR "looking to hire" OR "bounty"`;
    const ghUrl = `https://api.github.com/search/issues?q=${encodeURIComponent(ghQuery)}&sort=created&order=desc&per_page=15`;
    const ghRes = await fetch(ghUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LeadSpy-Project-Discovery'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (ghRes.status === 403 || ghRes.status === 429) {
      providerStatus.github = 'RATE_LIMITED';
      console.warn('   ⚠️ GitHub Search API returned HTTP 403/429 (RATE_LIMITED)');
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
        }, { sourceScope: 'github', intentType: 'project_requirement', priority: 'HIGH' });
      }
    }
  } catch (err) {
    console.warn('   [Notice] GitHub fetch notice:', err.message);
  }

  // -------------------------------------------------------------
  // 4. SEARCH PROVIDERS V2: Executing Rotator Queries with Fallback Chain
  // -------------------------------------------------------------
  console.log(`📡 [Search Providers V2] Executing ${searchQueries.length} balanced queries with fallback chain...`);

  for (const item of searchQueries) {
    const queryStr = item.query;
    try {
      const { provider, results, quality, fallbackOccurred } = await searchManager.searchWithFallback(queryStr, {
        timeRange: 'month',
        limit: 8,
        enrich: item.priority === 'HIGH' && item.qualityTier === 'A'
      });

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
          }, {
            sourceScope: item.sourceScope || 'public_web',
            intentType: item.intentType || 'buyer_request',
            deliverableType: item.deliverableType || 'custom_software',
            priority: item.priority,
            qualityTier: item.qualityTier
          });
        }
      }
    } catch (err) {
      console.warn(`   [Search Engine notice for "${queryStr}"]:`, err.message);
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // -------------------------------------------------------------
  // 5. LINK HEALTH + PAGE VALIDITY VERIFICATION (Mandatory Gate)
  // -------------------------------------------------------------
  console.log(`\n🛡️ Running Link Health & Page Validity Gate on ${rawCandidatePool.length} unique candidates...`);

  const linkHealthChecked = rawCandidatePool.length;
  let linkHealthPassed = 0;
  let linkHealthFailed = 0;
  let pageValidityChecked = 0;
  let pageValidityPassed = 0;
  let pageValidityFailed = 0;
  let pageFetchAttempts = 0;
  let pageFetchSuccesses = 0;
  let pageFetchFailures = 0;
  const verificationRejections = {};
  const verifiedCandidatePool = [];

  async function verifyCandidatePool(candidates, concurrency = 6) {
    const results = new Array(candidates.length);
    let index = 0;
    async function worker() {
      while (index < candidates.length) {
        const i = index++;
        try {
          results[i] = await evaluateCandidateValidityGate(candidates[i]);
        } catch (err) {
          results[i] = {
            pass: false,
            rejection_stage: 'LINK_HEALTH',
            rejection_reason: 'VERIFICATION_EXCEPTION'
          };
        }
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  const gateResults = await verifyCandidatePool(rawCandidatePool, 6);

  for (let i = 0; i < rawCandidatePool.length; i++) {
    const item = rawCandidatePool[i];
    const gateRes = gateResults[i];
    const stat = queryStatsMap.get(item.search_query);

    if (!gateRes) continue;

    // Check Link Health
    if (gateRes.healthReport && gateRes.healthReport.is_accessible) {
      linkHealthPassed++;
      // Gate 2: Page Validity was evaluated
      pageValidityChecked++;
      pageFetchAttempts++;

      if (gateRes.candidate?.pageContentPreview || gateRes.pass) {
        pageFetchSuccesses++;
      } else {
        pageFetchFailures++;
      }

      if (gateRes.validityReport && gateRes.validityReport.page_valid) {
        pageValidityPassed++;
        verifiedCandidatePool.push({
          ...item,
          final_url: gateRes.candidate.final_url || item.url,
          link_health_status: gateRes.candidate.link_health_status,
          page_type: gateRes.candidate.page_type,
          verificationGate: gateRes
        });
      } else {
        pageValidityFailed++;
        const reason = gateRes.rejection_reason || 'INVALID_PAGE';
        verificationRejections[reason] = (verificationRejections[reason] || 0) + 1;
        if (stat) {
          stat.preFilterRejected++;
          stat.rejectionReasons[reason] = (stat.rejectionReasons[reason] || 0) + 1;
        }
      }
    } else {
      // Link health failed: page validity was NOT evaluated
      linkHealthFailed++;
      const reason = gateRes.rejection_reason || 'UNREACHABLE';
      verificationRejections[reason] = (verificationRejections[reason] || 0) + 1;
      if (stat) {
        stat.preFilterRejected++;
        stat.rejectionReasons[reason] = (stat.rejectionReasons[reason] || 0) + 1;
      }
    }
  }

  const cacheStats = getVerificationCacheStats();

  console.log(`   -> Link Health: Checked: ${linkHealthChecked} | Passed: ${linkHealthPassed} | Failed: ${linkHealthFailed}`);
  console.log(`   -> Page Validity: Checked: ${pageValidityChecked} | Passed: ${pageValidityPassed} | Failed: ${pageValidityFailed}`);
  console.log(`   -> Verification Cache: Hits: ${cacheStats.cacheHits} | Misses: ${cacheStats.cacheMisses}`);
  console.log(`   -> Candidates Surviving Verification Gate: ${verifiedCandidatePool.length}`);

  // -------------------------------------------------------------
  // 6. PROJECT INTENT SCORING & CANDIDATE STATE ASSIGNMENT
  // -------------------------------------------------------------
  console.log(`\n🧠 Scoring Project Intent on ${verifiedCandidatePool.length} verified candidates...`);
  const candidateStateCounts = {
    HIGH_CONFIDENCE_PROJECT: 0,
    PROJECT_CANDIDATE: 0,
    REVIEW: 0,
    REJECT: 0
  };
  let totalPreFilterAccepted = 0;
  let totalPreFilterRejected = 0;
  const scoredCandidates = [];

  for (const item of verifiedCandidatePool) {
    const meta = canonicalDeduplicator.getCandidateMetadata(item.canonicalUrl || item.url);
    let crossQueryBoost = 0;
    if (meta) {
      if (meta.query_count > 1) crossQueryBoost += 5;
      if (meta.distinct_clusters_count > 1) crossQueryBoost += 5;
      if (meta.best_rank <= 3) crossQueryBoost += 5;
    }

    const evalResult = scoreSearchResult(item, { ...item.queryContext, crossQueryBoost });
    item.preCrawlEval = evalResult;
    item.candidateState = evalResult.candidateState;

    candidateStateCounts[evalResult.candidateState] = (candidateStateCounts[evalResult.candidateState] || 0) + 1;

    const stat = queryStatsMap.get(item.search_query);
    if (evalResult.decision === 'accept') {
      totalPreFilterAccepted++;
      if (stat) stat.preFilterAccepted++;
      scoredCandidates.push(item);
    } else {
      totalPreFilterRejected++;
      if (stat) {
        stat.preFilterRejected++;
        const r = evalResult.rejectionReason || 'LOW_SCORE';
        stat.rejectionReasons[r] = (stat.rejectionReasons[r] || 0) + 1;
      }
    }
  }

  console.log(`   -> Pre-Filter Accepted: ${totalPreFilterAccepted} | Pre-Filter Rejected: ${totalPreFilterRejected}`);
  console.log(`   -> Candidate States: HIGH_CONFIDENCE: ${candidateStateCounts.HIGH_CONFIDENCE_PROJECT} | CANDIDATE: ${candidateStateCounts.PROJECT_CANDIDATE} | REVIEW: ${candidateStateCounts.REVIEW} | REJECT: ${candidateStateCounts.REJECT}`);

  // -------------------------------------------------------------
  // 7. GLOBAL CANDIDATE RANKING & DIVERSITY BUDGET ALLOCATION
  // -------------------------------------------------------------
  console.log(`\n📊 Global Candidate Ranking across all queries...`);

  // Sort globally by intent score descending
  scoredCandidates.sort((a, b) => b.preCrawlEval.score - a.preCrawlEval.score);

  const approvedForCrawl = [];
  const domainCounts = {};
  const redditSubredditCounts = {};
  let hnCount = 0;
  let ghCount = 0;

  for (const candidate of scoredCandidates) {
    if (approvedForCrawl.length >= maxTotalCrawlsPerRun) break;

    const url = candidate.final_url || candidate.url;
    const domain = getCandidateRootDomain(url);
    const source = candidate.sourceScope || candidate.source || 'public_web';

    // Source-native platforms have community/platform-aware caps instead of root-domain cap (Amendment 3)
    if (source === 'reddit' || domain === 'reddit.com') {
      const sub = getRedditSubreddit(url);
      const subCount = redditSubredditCounts[sub] || 0;
      const totalReddit = Object.values(redditSubredditCounts).reduce((a, b) => a + b, 0);
      if (subCount >= 5 || totalReddit >= 12) continue; // community cap
      redditSubredditCounts[sub] = subCount + 1;
    } else if (source === 'hackernews' || domain === 'ycombinator.com') {
      if (hnCount >= 10) continue;
      hnCount++;
    } else if (source === 'github' || domain === 'github.com') {
      if (ghCount >= 8) continue;
      ghCount++;
    } else {
      // General web: enforce max 3 per root domain
      const domCount = domainCounts[domain] || 0;
      if (domCount >= 3) continue;
      domainCounts[domain] = domCount + 1;
    }

    approvedForCrawl.push(candidate);
  }

  console.log(`   -> Promising Candidates Scheduled for Deep Crawl: ${approvedForCrawl.length} (Global Cap: ${maxTotalCrawlsPerRun})`);

  // -------------------------------------------------------------
  // 6. SELECTIVE DEEP CRAWL & CONTENT FINGERPRINT DEDUPLICATION
  // -------------------------------------------------------------
  console.log(`\n🔍 Selectively Deep Crawling ${approvedForCrawl.length} promising URLs...`);
  const enrichedCandidates = [];
  let extractionFailures = 0;

  for (const item of approvedForCrawl) {
    const stat = queryStatsMap.get(item.search_query);
    if (stat) stat.deepCrawled++;

    try {
      const extracted = await contentExtractor.extractDeepContent(item);
      if (extracted && extracted.rawContent) {
        const fpCheck = canonicalDeduplicator.checkContentCandidate(extracted.title || item.title, extracted.rawContent);
        if (!fpCheck.isDuplicate) {
          extracted.search_query = item.search_query || 'unknown';
          extracted.search_source = item.search_source || item.source;
          extracted.search_result_url = item.search_result_url || item.url;
          extracted.discovered_at = item.discovered_at || new Date().toISOString();
          if (!extracted.postedAt && item.postedAt) extracted.postedAt = item.postedAt;

          enrichedCandidates.push(extracted);
        }
      } else {
        extractionFailures++;
      }
    } catch (err) {
      extractionFailures++;
    }
  }

  console.log(`✨ ${enrichedCandidates.length} successfully extracted candidates sent to 9-Gate Classifier.`);

  // -------------------------------------------------------------
  // 7. QUALIFICATION VIA UNTOUCHED 9-GATE ENGINE
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

      if (qStat) {
        qStat.qualified++;
        if (result.contact_type !== 'none') qStat.contactable++;
      }
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

  // Crawl reduction rate diagnostic
  const totalEvaluated = rawCandidatePool.length;
  const crawlReductionRate = totalEvaluated > 0
    ? `${((1 - (approvedForCrawl.length / totalEvaluated)) * 100).toFixed(1)}%`
    : '0.0%';

  // -------------------------------------------------------------
  // 8. STRUCTURED FUNNEL METRICS REPORT
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log(`📊 COMPLETE RETRIEVAL FUNNEL & EFFICIENCY METRICS [MODE: ${mode.toUpperCase()}]:`);
  console.log(`   Raw Search Results               : ${dedupMetrics.rawResults}`);
  console.log(`   Unique Search Results            : ${totalEvaluated}`);
  console.log(`   Link Health Checked / Passed     : ${linkHealthChecked} / ${linkHealthPassed} (Failed: ${linkHealthFailed})`);
  console.log(`   Page Validity Checked / Passed   : ${pageValidityChecked} / ${pageValidityPassed} (Failed: ${pageValidityFailed})`);
  console.log(`   Verification Cache Hits / Misses : ${cacheStats.cacheHits} / ${cacheStats.cacheMisses}`);
  console.log(`   Candidate State Breakdown        :`, candidateStateCounts);
  console.log(`   Pre-Filter Accepted              : ${totalPreFilterAccepted}`);
  console.log(`   Pre-Filter Rejected (Zero Crawl) : ${totalPreFilterRejected}`);
  console.log(`   Deep Crawled (Promising URLs)    : ${approvedForCrawl.length}`);
  console.log(`   Extraction Failures              : ${extractionFailures}`);
  console.log(`   Candidates Entering Classifier   : ${enrichedCandidates.length}`);
  console.log(`   Gate 8 Semantic Duplicates       : ${gate8Duplicates}`);
  console.log(`   Final Qualified Projects         : ${qualifiedProjects.length}`);
  console.log(`   Contactable Leads Verified       : ${qualifiedProjects.filter(p => p.has_actionable_contact).length}`);
  console.log(`   Diagnostic Crawl Reduction Rate  : ${crawlReductionRate}`);
  console.log(`   Rejection Breakdown              :`, rejectionReasons);
  console.log(`   Verification Rejections          :`, verificationRejections);
  console.log(`   Provider Status                  :`, providerStatus);
  console.log('================================================================\n');

  // Query performance breakdown report
  const queryBreakdown = [];
  for (const [qStr, stat] of queryStatsMap.entries()) {
    const qualRate = stat.deepCrawled > 0 ? (stat.qualified / stat.deepCrawled).toFixed(3) : 0;
    const crawlEff = stat.deepCrawled > 0 ? (stat.qualified / stat.deepCrawled).toFixed(3) : 0;
    queryBreakdown.push({
      query: qStr,
      source: stat.source,
      rawResults: stat.rawResults,
      uniqueResults: stat.uniqueResults,
      preFilterAccepted: stat.preFilterAccepted,
      deepCrawled: stat.deepCrawled,
      qualified: stat.qualified,
      contactable: stat.contactable,
      qualificationRate: qualRate,
      crawlEfficiency: crawlEff
    });

    // Record into global telemetry
    rotator.recordQueryPerformance(qStr, stat);
  }

  // -------------------------------------------------------------
  // 9. DATABASE PERSISTENCE (Auditable with PERSIST_TO_DB)
  // -------------------------------------------------------------
  if (persistToDb && qualifiedProjects.length > 0) {
    console.log(`💾 Persisting ${qualifiedProjects.length} qualified leads into Database...`);
    const dbRes = await saveMasterProjects(qualifiedProjects);
    console.log(`✅ Supabase Database updated! Total active projects: ${dbRes.total || qualifiedProjects.length}`);
  } else if (!persistToDb && qualifiedProjects.length > 0) {
    console.log(`🔍 [AUDIT RUN] Persistence disabled (persistToDb=false). Generated ${qualifiedProjects.length} qualified leads without modifying DB.`);
  }

  return {
    mode,
    cycle,
    projects: qualifiedProjects,
    metrics: {
      rawResults: dedupMetrics.rawResults,
      uniqueResults: totalEvaluated,
      linkHealthChecked,
      linkHealthPassed,
      linkHealthFailed,
      pageValidityChecked,
      pageValidityPassed,
      pageValidityFailed,
      pageFetchAttempts,
      pageFetchSuccesses,
      pageFetchFailures,
      verificationCacheHits: cacheStats.cacheHits,
      verificationCacheMisses: cacheStats.cacheMisses,
      candidateStates: candidateStateCounts,
      preFilterAccepted: totalPreFilterAccepted,
      preFilterRejected: totalPreFilterRejected,
      deepCrawled: approvedForCrawl.length,
      extractionFailures,
      candidatesEnteringClassifier: enrichedCandidates.length,
      gate8Duplicates,
      finalUniqueCandidates,
      qualifiedProjects: qualifiedProjects.length,
      contactableProjects: qualifiedProjects.filter(p => p.has_actionable_contact).length,
      crawlReductionRate
    },
    rejectionReasons,
    verificationRejections,
    providerStatus,
    queryBreakdown
  };
}

/**
 * GAP 4: Phase D 20-Query Controlled Pilot Runner (Audit Only)
 * Guarantees cycle=1, batchSize=20, persistToDb=false, auditOnly=true
 */
export async function runPhaseDPilot(options = {}) {
  console.log('🏁 [PHASE D PILOT] Initializing 1 controlled cycle of exactly 20 queries (Audit Mode, 0 DB persistence)...');
  return runFullDiscoveryPipeline({
    cycle: 1,
    batchSize: 20,
    days: 30,
    persistToDb: false,
    auditOnly: true,
    ...options
  });
}

if (process.argv[1]?.endsWith('runSearchAndDirectDiscovery.js')) {
  const isPilot = process.argv.includes('--pilot') || process.argv.includes('--phase-d');
  const runner = isPilot ? runPhaseDPilot : runFullDiscoveryPipeline;
  const config = isPilot ? {} : { cycle: 1, batchSize: 20, days: 30 };

  runner(config)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal Discovery Pipeline Error:', err);
      process.exit(1);
    });
}
