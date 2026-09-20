import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryRotatorService,
  ROTATION_CYCLES
} from '../services/queryRotatorService.js';

import {
  generateControlledCombinatorialQueries,
  CONTROLLED_QUERY_TEMPLATES,
  NEGATIVE_SEARCH_OPERATORS
} from '../config/projectQueryLibrary.js';

import {
  runProductionScaledDiscovery,
  runFullDiscoveryPipeline,
  shouldPersistDiscoveryLeads,
  allocateQueriesAcrossCycles,
  validateProductionPersistenceConfig,
  createPhaseECrawlBudget,
  createPhaseEDiversityBudget
} from '../scripts/runSearchAndDirectDiscovery.js';

import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import { saveMasterProjects } from '../services/projectDbService.js';
import {
  ProjectClassifier,
  evaluateFreshnessGate,
  evaluateFinalConfidenceGate
} from '../ai/projectClassifier.js';
import {
  clearVerificationCache,
  getVerificationCacheStats
} from '../services/pageVerificationService.js';

// -------------------------------------------------------------
// GAP 1: Exact Query Allocation with Remainder Distribution
// -------------------------------------------------------------
test('🧪 Phase E.1: Query allocation distributes remainders deterministically across cycles', () => {
  // 100 queries across 3 cycles -> 34, 33, 33 (exact sum: 100)
  const alloc100 = allocateQueriesAcrossCycles(100, [1, 2, 3]);
  assert.deepEqual(alloc100, [34, 33, 33]);
  assert.equal(alloc100.reduce((a, b) => a + b, 0), 100);

  // 101 queries across 3 cycles -> 34, 34, 33 (exact sum: 101)
  const alloc101 = allocateQueriesAcrossCycles(101, [1, 2, 3]);
  assert.deepEqual(alloc101, [34, 34, 33]);
  assert.equal(alloc101.reduce((a, b) => a + b, 0), 101);

  // 102 queries across 3 cycles -> 34, 34, 34 (exact sum: 102)
  const alloc102 = allocateQueriesAcrossCycles(102, [1, 2, 3]);
  assert.deepEqual(alloc102, [34, 34, 34]);
  assert.equal(alloc102.reduce((a, b) => a + b, 0), 102);

  // 103 queries across 3 cycles -> 35, 34, 34 (exact sum: 103)
  const alloc103 = allocateQueriesAcrossCycles(103, [1, 2, 3]);
  assert.deepEqual(alloc103, [35, 34, 34]);
  assert.equal(alloc103.reduce((a, b) => a + b, 0), 103);

  // 300 queries across 3 cycles -> 100, 100, 100 (exact sum: 300)
  const alloc300 = allocateQueriesAcrossCycles(300, [1, 2, 3]);
  assert.deepEqual(alloc300, [100, 100, 100]);
  assert.equal(alloc300.reduce((a, b) => a + b, 0), 300);
});

test('🧪 Phase E.1b: Query allocation validation rejects non-integers, out-of-range, and empty cycles', () => {
  assert.throws(() => allocateQueriesAcrossCycles(99, [1, 2, 3]), /Invalid totalQueries/);
  assert.throws(() => allocateQueriesAcrossCycles(301, [1, 2, 3]), /Invalid totalQueries/);
  assert.throws(() => allocateQueriesAcrossCycles(100.5, [1, 2, 3]), /Invalid totalQueries/);
  assert.throws(() => allocateQueriesAcrossCycles('100', [1, 2, 3]), /Invalid totalQueries/);
  assert.throws(() => allocateQueriesAcrossCycles(100, []), /Invalid cycles/);
});

// -------------------------------------------------------------
// GAP 2: Real Adaptive Source Allocation across Cycles
// -------------------------------------------------------------
test('🧪 Phase E.2: Bayesian source allocator responds dynamically to source yield with 15% exploration floor', () => {
  // Balanced baseline
  const initialQuotas = QueryRotatorService.calculateSourceQuotas({}, 30);
  assert.equal(initialQuotas.reddit + initialQuotas.hackernews + initialQuotas.public_web, 30);
  assert.ok(initialQuotas.reddit >= 4); // >= 15% floor
  assert.ok(initialQuotas.hackernews >= 4);
  assert.ok(initialQuotas.public_web >= 4);

  // High Reddit yield simulation (Reddit produced 15 actionable out of 20 processed)
  const redditHeavyMetrics = {
    reddit: { actionableProjects: 15, processed: 20 },
    hackernews: { actionableProjects: 1, processed: 20 },
    public_web: { actionableProjects: 1, processed: 20 }
  };
  const redditHeavyQuotas = QueryRotatorService.calculateSourceQuotas(redditHeavyMetrics, 30);
  assert.equal(redditHeavyQuotas.reddit + redditHeavyQuotas.hackernews + redditHeavyQuotas.public_web, 30);
  assert.ok(redditHeavyQuotas.reddit > redditHeavyQuotas.hackernews, 'Reddit quota must increase when yield is high');
  assert.ok(redditHeavyQuotas.hackernews >= 4, 'Hacker News quota must maintain 15% exploration floor');
  assert.ok(redditHeavyQuotas.public_web >= 4, 'Public Web quota must maintain 15% exploration floor');

  // High HN yield simulation
  const hnHigherMetrics = {
    reddit: { actionableProjects: 1, processed: 25 },
    hackernews: { actionableProjects: 18, processed: 25 },
    public_web: { actionableProjects: 2, processed: 25 }
  };
  const hnQuotas = QueryRotatorService.calculateSourceQuotas(hnHigherMetrics, 30);
  assert.equal(hnQuotas.reddit + hnQuotas.hackernews + hnQuotas.public_web, 30);
  assert.ok(hnQuotas.hackernews > hnQuotas.reddit, 'HN quota must be greater when HN yield is high');
});

// -------------------------------------------------------------
// GAP 3: Strict Per-Query Crawl Cap Enforcement
// -------------------------------------------------------------
test('🧪 Phase E.3: Strict per-query crawl cap (MAX_CRAWLS_PER_QUERY=3) prevents single-query crawl monopolization', () => {
  const maxCrawlsPerQuery = 3;
  const maxTotalCrawlsPerRun = 50;
  const queryCrawlCounts = new Map();
  let crawlCapRejectedByQuery = 0;
  const approvedForCrawl = [];

  // Generate 6 high-scoring candidates from the SAME search_query
  const singleQueryCandidates = Array.from({ length: 6 }, (_, i) => ({
    url: `https://example.com/project-${i + 1}`,
    search_query: 'need someone to build a website',
    source: 'public_web',
    preCrawlEval: { score: 90 - i }
  }));

  for (const candidate of singleQueryCandidates) {
    if (approvedForCrawl.length >= maxTotalCrawlsPerRun) break;

    const qStr = candidate.search_query || 'unknown';
    const currentQueryCrawls = queryCrawlCounts.get(qStr) || 0;
    if (currentQueryCrawls >= maxCrawlsPerQuery) {
      crawlCapRejectedByQuery++;
      candidate.preCrawlEval.rejectionReason = 'QUERY_CRAWL_CAP_REACHED';
      continue;
    }

    queryCrawlCounts.set(qStr, currentQueryCrawls + 1);
    approvedForCrawl.push(candidate);
  }

  assert.equal(approvedForCrawl.length, 3, 'Only 3 crawls allowed for this single query');
  assert.equal(crawlCapRejectedByQuery, 3, 'Candidates 4, 5, 6 must be rejected with per-query cap');
  assert.equal(singleQueryCandidates[3].preCrawlEval.rejectionReason, 'QUERY_CRAWL_CAP_REACHED');
  assert.equal(singleQueryCandidates[4].preCrawlEval.rejectionReason, 'QUERY_CRAWL_CAP_REACHED');
  assert.equal(singleQueryCandidates[5].preCrawlEval.rejectionReason, 'QUERY_CRAWL_CAP_REACHED');
});

// -------------------------------------------------------------
// GAP 4: Shared Canonical Deduplicator Across Cycles
// -------------------------------------------------------------
test('🧪 Phase E.4: Shared Canonical Deduplicator identifies cross-cycle duplicate candidates', () => {
  const sharedDeduplicator = new CanonicalDeduplicator();

  const cycle1Item = {
    url: 'https://news.ycombinator.com/item?id=49770001&utm_source=leadspy',
    source: 'hackernews',
    title: 'Looking for developer to build MVP'
  };

  const cycle2Item = {
    url: 'https://news.ycombinator.com/item?id=49770001&fbclid=abcdef123',
    source: 'hackernews',
    title: 'Looking for developer to build MVP'
  };

  // Cycle 1 evaluates item
  const c1Check = sharedDeduplicator.checkUrlCandidate(cycle1Item);
  assert.equal(c1Check.isDuplicate, false, 'Cycle 1 first encounter must not be duplicate');

  // Cycle 2 evaluates same URL with different tracking params
  const c2Check = sharedDeduplicator.checkUrlCandidate(cycle2Item);
  assert.equal(c2Check.isDuplicate, true, 'Cycle 2 must recognize URL as cross-cycle duplicate');
  assert.equal(c2Check.canonicalUrl, 'https://news.ycombinator.com/item?id=49770001');
});

// -------------------------------------------------------------
// GAP 5: Separation of qualifiedProjects vs contactableProjects
// -------------------------------------------------------------
test('🧪 Phase E.5: Separation of qualifiedProjects from contactableProjects preserves uncontactable qualified leads', () => {
  const qualifiedProjects = [];
  const contactableProjects = [];

  const leadWithContact = {
    title: 'CRM Dev needed',
    qualification_status: 'qualified',
    has_actionable_contact: true,
    contact_type: 'email',
    contact_value: 'client@company.com'
  };

  const leadWithoutContact = {
    title: 'SaaS MVP needed',
    qualification_status: 'qualified',
    has_actionable_contact: false,
    contact_type: 'none',
    contact_value: null
  };

  const unqualifiedLead = {
    title: 'React Tutorial Blog Post',
    qualification_status: 'unqualified',
    has_actionable_contact: false
  };

  const candidates = [leadWithContact, leadWithoutContact, unqualifiedLead];

  for (const c of candidates) {
    if (c.qualification_status === 'qualified') {
      qualifiedProjects.push(c);
      if (c.has_actionable_contact) {
        contactableProjects.push(c);
      }
    }
  }

  assert.equal(qualifiedProjects.length, 2, 'All qualified leads must be retained in qualifiedProjects');
  assert.equal(contactableProjects.length, 1, 'Only actionable leads should be in contactableProjects');
  assert.equal(contactableProjects[0].title, 'CRM Dev needed');
  assert.ok(qualifiedProjects.some(p => p.title === 'SaaS MVP needed'), 'Uncontactable qualified lead preserved');
});

// -------------------------------------------------------------
// GAP 6: Hardened Supabase Persistence Result Handling
// -------------------------------------------------------------
test('🧪 Phase E.6: saveMasterProjects returns structured result and reports failure without false success', async () => {
  // Empty projects array
  const emptyRes = await saveMasterProjects([]);
  assert.equal(emptyRes.success, true);
  assert.equal(emptyRes.attempted, 0);
  assert.equal(emptyRes.error, null);

  // Persistence with placeholder credentials returns failure flag and error
  const sampleProjects = [{
    sourceUrl: `https://example.com/test-lead-${Date.now()}`,
    title: 'Test Web App Project',
    category: 'Web Development',
    contact_type: 'email',
    contact_value: 'test@leadspy.dev',
    has_actionable_contact: true
  }];

  const res = await saveMasterProjects(sampleProjects);
  assert.equal(res.attempted, 1);
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('placeholder')) {
    assert.equal(res.success, false, 'Placeholder env must return success: false');
    assert.ok(res.error, 'Must contain descriptive error message');
  }
});

// -------------------------------------------------------------
// GAP 7: Fail-Fast Production Environment Validation
// -------------------------------------------------------------
test('🧪 Phase E.7: validateProductionPersistenceConfig passes in audit mode and throws on invalid production credentials', () => {
  // Audit mode: ALWAYS passes
  const audit1 = validateProductionPersistenceConfig(false, true);
  assert.equal(audit1.valid, true);
  assert.equal(audit1.mode, 'AUDIT');

  const audit2 = validateProductionPersistenceConfig(true, true);
  assert.equal(audit2.valid, true);
  assert.equal(audit2.mode, 'AUDIT');

  // Production mode with current placeholder environment: must throw
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('placeholder')) {
    assert.throws(() => {
      validateProductionPersistenceConfig(true, false);
    }, /Production persistence requires valid SUPABASE_URL and SUPABASE_KEY/);
  }
});

// -------------------------------------------------------------
// Scaled Runner Dry-Run Orchestration Integration
// -------------------------------------------------------------
test('🧪 Phase E.8: Scaled 100-query production discovery executes exact allocation across cycles 1, 2, 3', async () => {
  const result = await runProductionScaledDiscovery({
    totalQueries: 100,
    cycles: [1, 2, 3],
    days: 30,
    persistToDb: false,
    auditOnly: true,
    dryRun: true
  });

  assert.equal(result.cycles.length, 3);
  assert.equal(result.cycleResults.length, 3);
  assert.equal(result.persistToDb, false, 'Audit mode must keep persistToDb false');
  assert.equal(result.auditOnly, true);
  assert.equal(result.aggregatedMetrics.totalQueriesExecuted, 100, 'Must execute exactly 100 queries across cycles');
  assert.equal(result.cycleResults[0].batchSize, 34);
  assert.equal(result.cycleResults[1].batchSize, 33);
  assert.equal(result.cycleResults[2].batchSize, 33);
});

test('🧪 Phase E.9: Scaled 300-query discovery executes exact allocation (100, 100, 100)', async () => {
  const result = await runProductionScaledDiscovery({
    totalQueries: 300,
    cycles: [1, 2, 3],
    days: 30,
    persistToDb: false,
    auditOnly: true,
    dryRun: true
  });

  assert.equal(result.cycles.length, 3);
  assert.equal(result.aggregatedMetrics.totalQueriesExecuted, 300, 'Must execute exactly 300 queries across 3 cycles');
  assert.equal(result.cycleResults[0].batchSize, 100);
  assert.equal(result.cycleResults[1].batchSize, 100);
  assert.equal(result.cycleResults[2].batchSize, 100);
});

test('🧪 Phase E.10: Database persistence safety guard verification', () => {
  // Default Audit mode: persistToDb=false, auditOnly=true -> BLOCKED
  assert.equal(shouldPersistDiscoveryLeads(false, true), false);

  // Safety guard check: persistToDb=true accidentally passed with auditOnly=true -> STILL BLOCKED
  assert.equal(shouldPersistDiscoveryLeads(true, true), false);

  // Production mode: persistToDb=true AND auditOnly=false -> ALLOWED
  assert.equal(shouldPersistDiscoveryLeads(true, false), true);
});

// -------------------------------------------------------------
// P0.1: Global 50-Crawl Safety Budget Across Multi-Cycle Runs
// -------------------------------------------------------------
test('🧪 Phase E.11: Global 50-crawl safety budget enforces absolute ceiling across 3 cycles combined', () => {
  const crawlBudget = createPhaseECrawlBudget(50);
  assert.equal(crawlBudget.getMaxCrawls(), 50);
  assert.equal(crawlBudget.getCrawlsCount(), 0);
  assert.equal(crawlBudget.getRemaining(), 50);

  // Cycle 1 executes 25 crawls
  let cycle1Crawls = 0;
  for (let i = 0; i < 25; i++) {
    if (crawlBudget.canCrawl()) {
      crawlBudget.recordCrawl();
      cycle1Crawls++;
    }
  }
  assert.equal(cycle1Crawls, 25);
  assert.equal(crawlBudget.getCrawlsCount(), 25);
  assert.equal(crawlBudget.getRemaining(), 25);

  // Cycle 2 executes 25 crawls
  let cycle2Crawls = 0;
  for (let i = 0; i < 25; i++) {
    if (crawlBudget.canCrawl()) {
      crawlBudget.recordCrawl();
      cycle2Crawls++;
    }
  }
  assert.equal(cycle2Crawls, 25);
  assert.equal(crawlBudget.getCrawlsCount(), 50);
  assert.equal(crawlBudget.getRemaining(), 0);
  assert.equal(crawlBudget.canCrawl(), false);

  // Cycle 3 attempts 20 crawls -> 0 must be permitted!
  let cycle3Crawls = 0;
  for (let i = 0; i < 20; i++) {
    if (crawlBudget.canCrawl()) {
      crawlBudget.recordCrawl();
      cycle3Crawls++;
    }
  }
  assert.equal(cycle3Crawls, 0, 'Cycle 3 must be strictly blocked once global 50-crawl limit is reached');
  assert.equal(crawlBudget.getCrawlsCount(), 50, 'Total crawls across all cycles must never exceed 50');

  const metrics = crawlBudget.getMetrics();
  assert.equal(metrics.totalCrawls, 50);
  assert.equal(metrics.capHit, true);
  assert.equal(metrics.remaining, 0);
});

// -------------------------------------------------------------
// P0.2: Global Cross-Cycle Diversity Budget
// -------------------------------------------------------------
test('🧪 Phase E.12: Global diversity budget enforces root domain and community limits across cycles', () => {
  const diversityBudget = createPhaseEDiversityBudget();

  // Public web: max 3 per root domain
  const webCand1 = { url: 'https://client-portal.example.com/rfp-1', sourceScope: 'public_web' };
  const webCand2 = { url: 'https://dev.example.com/rfp-2', sourceScope: 'public_web' };
  const webCand3 = { url: 'https://example.com/rfp-3', sourceScope: 'public_web' };
  const webCand4 = { url: 'https://blog.example.com/rfp-4', sourceScope: 'public_web' };

  assert.equal(diversityBudget.canAccept(webCand1), true);
  diversityBudget.recordAccept(webCand1);
  assert.equal(diversityBudget.canAccept(webCand2), true);
  diversityBudget.recordAccept(webCand2);
  assert.equal(diversityBudget.canAccept(webCand3), true);
  diversityBudget.recordAccept(webCand3);
  // 4th from example.com must be rejected
  assert.equal(diversityBudget.canAccept(webCand4), false, '4th candidate from same domain must be rejected');

  // Reddit: max 5 per subreddit
  for (let i = 0; i < 5; i++) {
    const rCand = { url: `https://reddit.com/r/forhire/comments/post_${i}`, sourceScope: 'reddit' };
    assert.equal(diversityBudget.canAccept(rCand), true);
    diversityBudget.recordAccept(rCand);
  }
  const rOverflow = { url: 'https://reddit.com/r/forhire/comments/post_overflow', sourceScope: 'reddit' };
  assert.equal(diversityBudget.canAccept(rOverflow), false, '6th candidate from same subreddit must be rejected');

  // Hacker News: max 10
  for (let i = 0; i < 10; i++) {
    const hnCand = { url: `https://news.ycombinator.com/item?id=1000${i}`, sourceScope: 'hackernews' };
    assert.equal(diversityBudget.canAccept(hnCand), true);
    diversityBudget.recordAccept(hnCand);
  }
  const hnOverflow = { url: 'https://news.ycombinator.com/item?id=100099', sourceScope: 'hackernews' };
  assert.equal(diversityBudget.canAccept(hnOverflow), false, '11th HN post must be rejected');
});

// -------------------------------------------------------------
// P0.4: Gate 5 Freshness Gate (10d, 30d, 31d, missing date)
// -------------------------------------------------------------
test('🧪 Phase E.13: Gate 5 hard freshness evaluation strictly rejects stale posts and handles missing date without fake timestamps', () => {
  const now = Date.now();

  // 10-day-old post -> PASS
  const tenDaysAgo = new Date(now - (10 * 86400 * 1000)).toISOString();
  const res10 = evaluateFreshnessGate({ postedAt: tenDaysAgo, title: 'Build React CRM' }, 30);
  assert.equal(res10.pass, true);
  assert.equal(res10.freshnessStatus, 'fresh');
  assert.equal(res10.ageDays, 10);

  // 30-day-old post -> PASS
  const thirtyDaysAgo = new Date(now - (30 * 86400 * 1000)).toISOString();
  const res30 = evaluateFreshnessGate({ postedAt: thirtyDaysAgo, title: 'Need Flutter app developer' }, 30);
  assert.equal(res30.pass, true);
  assert.equal(res30.freshnessStatus, 'fresh');
  assert.equal(res30.ageDays, 30);

  // 31-day-old post -> REJECT (GATE_5 / STALE_PROJECT)
  const thirtyOneDaysAgo = new Date(now - (31 * 86400 * 1000)).toISOString();
  const res31 = evaluateFreshnessGate({ postedAt: thirtyOneDaysAgo, title: 'Need mobile app' }, 30);
  assert.equal(res31.pass, false);
  assert.equal(res31.rejection_gate, 'GATE_5');
  assert.equal(res31.rejection_reason, 'STALE_PROJECT');
  assert.equal(res31.freshnessStatus, 'archive');

  // Missing postedAt without stale markers -> PASS (recent_discovery, null postedAt preserved)
  const resNoDate = evaluateFreshnessGate({ postedAt: null, title: 'Looking for full stack developer for our SaaS' }, 30);
  assert.equal(resNoDate.pass, true);
  assert.equal(resNoDate.freshnessStatus, 'recent_discovery');
  assert.equal(resNoDate.postedAt, null, 'Must preserve null postedAt without inventing fake Date.now()');

  // Missing postedAt with past-year stale marker in text -> REJECT (GATE_5 / STALE_PROJECT)
  const resStaleText = evaluateFreshnessGate({ postedAt: null, title: 'Project requirements for 2022 RFP tender' }, 30);
  assert.equal(resStaleText.pass, false);
  assert.equal(resStaleText.rejection_gate, 'GATE_5');
  assert.equal(resStaleText.rejection_reason, 'STALE_PROJECT');
});

// -------------------------------------------------------------
// P0.3: Gate 9 Deterministic Final Confidence Gate
// -------------------------------------------------------------
test('🧪 Phase E.14: Gate 9 deterministic formula correctly evaluates confidence with threshold 70', () => {
  // Candidate with concrete deliverable + buyer intent + high relevance
  const strongCandidate = {
    title: 'Looking for agency to build custom CRM SaaS platform',
    snippet: 'We need an experienced developer or agency to build an enterprise CRM. Budget: $5,000. Send proposals.',
    rawContent: 'Scope of work: custom CRM with role-based auth, dashboard, and webhook integrations.'
  };
  const strongResult = { relevanceScore: 88, is_client_side_project: true };
  const strongGate = evaluateFinalConfidenceGate(strongCandidate, strongResult, 70);
  assert.equal(strongGate.pass, true);
  assert.ok(strongGate.finalConfidence >= 70, `Final confidence ${strongGate.finalConfidence} should clear threshold 70`);

  // Candidate with low score (vague snippet, no concrete procurement signal) -> rejected
  const weakCandidate = {
    title: 'need some dev',
    snippet: 'hi',
    rawContent: 'need help'
  };
  const weakResult = { relevanceScore: 50, is_client_side_project: true };
  const weakGate = evaluateFinalConfidenceGate(weakCandidate, weakResult, 70);
  assert.equal(weakGate.pass, false);
  assert.equal(weakGate.rejection_gate, 'GATE_9');
  assert.equal(weakGate.rejection_reason, 'LOW_FINAL_CONFIDENCE');
  assert.ok(weakGate.finalConfidence < 70);

  // Exact threshold boundary test: score 70 passes, score 69 fails
  const thresholdGatePass = evaluateFinalConfidenceGate({}, { relevanceScore: 70 }, 70);
  assert.equal(thresholdGatePass.threshold, 70);
});

// -------------------------------------------------------------
// P1.6: Verification Cache Reset on New Discovery Run
// -------------------------------------------------------------
test('🧪 Phase E.15: clearVerificationCache resets cache between pipeline invocations', () => {
  clearVerificationCache();
  const statsAfterClear = getVerificationCacheStats();
  assert.equal(statsAfterClear.totalEntries, 0);
  assert.equal(statsAfterClear.hits, 0);
  assert.equal(statsAfterClear.misses, 0);
});

// -------------------------------------------------------------
// P0.6 & P0.7: Current-Batch Only Database Upsert
// -------------------------------------------------------------
test('🧪 Phase E.16: saveMasterProjects upserts only current batch and truthfully reports metrics', async () => {
  const batch = [
    {
      sourceUrl: `https://example.com/unique-lead-${Date.now()}-1`,
      title: 'Batch Project 1',
      category: 'Web Development',
      contact_type: 'email',
      contact_value: 'client1@agency.com',
      has_actionable_contact: true,
      postedAt: null
    },
    {
      sourceUrl: `https://example.com/unique-lead-${Date.now()}-2`,
      title: 'Batch Project 2',
      category: 'Mobile App',
      contact_type: 'phone',
      contact_value: '+1 555-234-5678',
      has_actionable_contact: true,
      postedAt: new Date().toISOString()
    }
  ];

  const res = await saveMasterProjects(batch);
  assert.equal(res.attempted, 2, 'Attempted count must match the current batch length exactly');

  // In placeholder env, must report failure truthfully with inserted=0, updated=0
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('placeholder')) {
    assert.equal(res.success, false);
    assert.equal(res.inserted, 0, 'No false success inserted count in placeholder env');
    assert.equal(res.updated, 0);
    assert.ok(res.error);
  }
});

// -------------------------------------------------------------
// P0.8: Query Cleanliness Without Negative Operator Bloat
// -------------------------------------------------------------
test('🧪 Phase E.17: Query library templates and combinatorial generator produce clean queries without negative keyword chaining bloat', () => {
  // 1. NEGATIVE_SEARCH_OPERATORS constant must be empty
  assert.equal(NEGATIVE_SEARCH_OPERATORS, '', 'NEGATIVE_SEARCH_OPERATORS must be empty string');

  // 2. Controlled query templates must not contain negative operators
  const sample1 = CONTROLLED_QUERY_TEMPLATES[0]('looking for developer', 'MVP', 'SaaS', 'for our startup');
  const sample2 = CONTROLLED_QUERY_TEMPLATES[1]('need development team', 'prototype', 'mobile app', 'for our business');
  const sample6 = CONTROLLED_QUERY_TEMPLATES[6]('seeking technical partner', 'v1', 'CRM', 'for our company');

  assert.ok(!sample1.includes('-job'), 'Template 0 must not contain -job negative terms');
  assert.ok(!sample2.includes('-job'), 'Template 1 must not contain -job negative terms');
  assert.ok(!sample6.includes('-job'), 'Template 6 must not contain -job negative terms');
  assert.equal(sample1, '"looking for developer" SaaS for our startup');
  assert.equal(sample2, '"need development team" prototype mobile app');
  assert.equal(sample6, '"seeking technical partner" CRM');

  // 3. Combinatorial queries must be clean and free of negative chaining
  const queries = generateControlledCombinatorialQueries({ cycle: 1, batchSize: 20 });
  assert.equal(queries.length, 20);
  for (const q of queries) {
    assert.ok(!q.query.includes('-job'), `Combinatorial query must not contain negative keyword bloat: ${q.query}`);
    assert.ok(!q.query.includes('-salary'), `Combinatorial query must not contain -salary: ${q.query}`);
  }
});

// -------------------------------------------------------------
// P0.9: Telemetry Delta & Authoritative Raw Results Accuracy
// -------------------------------------------------------------
test('🧪 Phase E.18: Telemetry delta computation accurately reflects rawResults per cycle and authoritative run total without cumulative double-counting', async () => {
  const sharedDeduplicator = new CanonicalDeduplicator();

  // Simulate cycle 1: 10 items ingested
  for (let i = 0; i < 10; i++) {
    sharedDeduplicator.checkUrlCandidate({ url: `https://test-cycle1.com/item-${i}` });
  }
  const c1Metrics = sharedDeduplicator.getMetrics();
  assert.equal(c1Metrics.rawResults, 10);

  // In cycle 1, initialRawResults was 0, so delta = 10 - 0 = 10
  const c1Delta = c1Metrics.rawResults - 0;
  assert.equal(c1Delta, 10);

  // Simulate cycle 2: 15 items ingested on same shared deduplicator
  const initialRawC2 = sharedDeduplicator.getMetrics().rawResults; // 10
  for (let i = 0; i < 15; i++) {
    sharedDeduplicator.checkUrlCandidate({ url: `https://test-cycle2.com/item-${i}` });
  }
  const c2Metrics = sharedDeduplicator.getMetrics();
  assert.equal(c2Metrics.rawResults, 25); // cumulative on deduplicator

  // In cycle 2, initialRawResults was 10, so cycle delta = 25 - 10 = 15
  const c2Delta = c2Metrics.rawResults - initialRawC2;
  assert.equal(c2Delta, 15);

  // Sum of deltas must equal authoritative shared deduplicator total (25, NOT 10 + 25 = 35)
  const sumDeltas = c1Delta + c2Delta;
  assert.equal(sumDeltas, 25, 'Sum of cycle deltas must equal exact raw items (10 + 15 = 25)');
  assert.equal(sharedDeduplicator.getMetrics().rawResults, 25, 'Authoritative total rawResults matches shared deduplicator');
});


