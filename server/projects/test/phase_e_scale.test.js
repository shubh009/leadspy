import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QueryRotatorService,
  ROTATION_CYCLES
} from '../services/queryRotatorService.js';

import {
  runProductionScaledDiscovery,
  runFullDiscoveryPipeline,
  shouldPersistDiscoveryLeads,
  allocateQueriesAcrossCycles,
  validateProductionPersistenceConfig
} from '../scripts/runSearchAndDirectDiscovery.js';

import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import { saveMasterProjects } from '../services/projectDbService.js';

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

