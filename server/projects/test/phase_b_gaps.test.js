/**
 * Phase B Gaps Hermetic Unit Test Suite
 * File: server/projects/test/phase_b_gaps.test.js
 * 
 * Hermetically tests:
 * 1. GAP 1: Real Page Content Verification (Mocked HTTP responses)
 * 2. GAP 2: Verification Cache (Hits, Misses, Canonical Sharing, Reset)
 * 3. GAP 3: Adaptive Source Allocation Integration (Deterministic 20-Query Quotas)
 * 4. GAP 4: Phase D 20-Query Pilot Configuration (cycle=1, batchSize=20, audit-only)
 */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateCandidateValidityGate,
  fetchLightweightPageContent,
  clearVerificationCache,
  getVerificationCacheStats,
  normalizeVerificationUrl,
  LINK_HEALTH_STATUS,
  PAGE_TYPE
} from '../services/pageVerificationService.js';

import {
  QueryRotatorService
} from '../services/queryRotatorService.js';

import {
  generateControlledCombinatorialQueries
} from '../config/projectQueryLibrary.js';

beforeEach(() => {
  clearVerificationCache();
});

// =============================================================
// GAP 1: REAL PAGE-CONTENT VERIFICATION
// =============================================================

test('🧪 Gap 1.1: Valid project page with actual HTML body passes verification', async () => {
  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head><title>Project RFP - Custom SaaS Development</title></head>
      <body>
        <h1>Looking for software development agency to build SaaS MVP</h1>
        <p>We are a logistics company seeking an external engineering team to build a real-time tracking portal using React, Node.js, and PostgreSQL. Budget: $15,000. Submit proposals to rfp@logitech.com</p>
      </body>
    </html>
  `;

  const mockFetch = async (url, opts) => ({
    status: 200,
    url,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => htmlBody
  });

  const candidate = {
    url: 'https://logitech.com/rfp-2026',
    snippet: 'Vague snippet from search engine'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, true, 'Valid real HTML content must pass');
  assert.equal(res.validityReport.page_valid, true);
  assert.equal(res.validityReport.page_type, PAGE_TYPE.PROJECT_PAGE);
  assert.ok(res.candidate.pageContentPreview.includes('logistics company'));
});

test('🧪 Gap 1.2: Actual live login page returns HTTP 200 but rejected at PAGE_VALIDITY', async () => {
  const loginHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <h2>Sign In to Portal</h2>
        <form action="/auth" method="POST">
          <label>Email: <input type="text" name="email"></label>
          <label>Password: <input type="password" name="password"></label>
          <button type="submit">Log in to continue</button>
        </form>
      </body>
    </html>
  `;

  const mockFetch = async (url) => ({
    status: 200,
    url,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => loginHtml
  });

  const candidate = {
    url: 'https://app.privatecorp.com/dashboard',
    snippet: 'We need software developers for project' // Old/misleading snippet
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false, 'Live login page must be rejected despite snippet');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.LOGIN_PAGE);
});

test('🧪 Gap 1.3: Actual live soft-404 returns HTTP 200 but rejected at PAGE_VALIDITY', async () => {
  const soft404Html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>404 Not Found</h1>
        <p>The requested URL was not found on this server. This page does not exist anymore.</p>
      </body>
    </html>
  `;

  const mockFetch = async (url) => ({
    status: 200,
    url,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => soft404Html
  });

  const candidate = {
    url: 'https://client-site.com/rfp-archived',
    snippet: 'Need agency to build custom software'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false, 'Live soft-404 page must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.ERROR_PAGE);
});

test('🧪 Gap 1.4: Actual deleted Reddit post returns HTTP 200 but rejected at PAGE_VALIDITY', async () => {
  const redditDeletedHtml = `
    <div>
      <h1>[Hiring] Mobile App Developer</h1>
      <div class="post-body">[deleted] Sorry, this post was removed by moderators.</div>
    </div>
  `;

  const mockFetch = async (url) => ({
    status: 200,
    url: 'https://www.reddit.com/r/forhire/comments/del1',
    headers: new Map([['content-type', 'text/html']]),
    text: async () => redditDeletedHtml
  });

  const candidate = {
    url: 'https://www.reddit.com/r/forhire/comments/del1',
    snippet: 'We are looking for an app developer'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false, 'Deleted Reddit post must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.ERROR_PAGE);
});

test('🧪 Gap 1.5: Generic root homepage returns HTTP 200 but rejected at PAGE_VALIDITY', async () => {
  const homeHtml = `
    <html><body>Welcome to Our Agency. We provide web services worldwide.</body></html>
  `;

  const mockFetch = async (url) => ({
    status: 200,
    url: 'https://genericagency.com/',
    headers: new Map([['content-type', 'text/html']]),
    text: async () => homeHtml
  });

  const candidate = {
    url: 'https://genericagency.com/',
    snippet: 'Need someone to build a website'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false, 'Generic root homepage must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.STATIC_PAGE);
});

test('🧪 Gap 1.6: HTTP 301 redirects to valid project page -> final URL captured and passed', async () => {
  const projectHtml = `
    <html><body><h1>Request For Proposal</h1><p>Our organization is seeking vendors to build an ERP system. Contact: procurement@health.gov</p></body></html>
  `;

  const mockFetch = async (url, opts) => {
    return {
      status: 200,
      url: 'https://health.gov/procurement/rfp-2026-final',
      headers: new Map([['content-type', 'text/html']]),
      text: async () => projectHtml
    };
  };

  const candidate = {
    url: 'https://health.gov/rfp-old-link',
    snippet: 'RFP announcement'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, true);
  assert.equal(res.candidate.final_url, 'https://health.gov/procurement/rfp-2026-final');
});

test('🧪 Gap 1.7: HTTP 403 Forbidden marked BLOCKED at LINK_HEALTH without permanent domain penalty', async () => {
  const mockFetch = async () => ({
    status: 403,
    url: 'https://firewalled-vendor.com/rfp',
    headers: new Map()
  });

  const candidate = {
    url: 'https://firewalled-vendor.com/rfp',
    snippet: 'Need developer for CRM'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false);
  assert.equal(res.rejection_stage, 'LINK_HEALTH');
  assert.equal(res.rejection_reason, LINK_HEALTH_STATUS.BLOCKED);
  assert.equal(res.validityReport.evaluated, false, 'Page validity must NOT be evaluated when link is blocked');
});

test('🧪 Gap 1.8: Network failure or timeout marked UNREACHABLE at LINK_HEALTH', async () => {
  const mockFetch = async () => {
    const err = new Error('Connection refused');
    err.name = 'AbortError';
    throw err;
  };

  const candidate = {
    url: 'https://offline-server.net/rfp',
    snippet: 'Need developer'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false);
  assert.equal(res.rejection_stage, 'LINK_HEALTH');
  assert.equal(res.rejection_reason, LINK_HEALTH_STATUS.UNREACHABLE);
  assert.equal(res.validityReport.evaluated, false, 'Page validity must NOT be evaluated on network failure');
});

test('🧪 Gap 1.9: Client-side JS shell / SPA under 4KB marked INCONCLUSIVE and allowed to pass', async () => {
  const spaHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Modern React App</title></head>
      <body>
        <div id="root"></div>
        <script src="/bundle.js"></script>
      </body>
    </html>
  `;

  const mockFetch = async (url) => ({
    status: 200,
    url,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => spaHtml
  });

  const candidate = {
    url: 'https://modern-app.io/jobs/123',
    snippet: 'Looking for full-stack developer to build frontend'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, true, 'SPA / JS shell under 4KB must be permitted as INCONCLUSIVE');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.INCONCLUSIVE);
  assert.equal(res.validityReport.page_valid, true);
});

test('🧪 Gap 1.10: Insufficient content (< 30 chars) rejected at PAGE_VALIDITY', async () => {
  const emptyHtml = `<html><body>Hi</body></html>`;

  const mockFetch = async (url) => ({
    status: 200,
    url,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => emptyHtml
  });

  const candidate = {
    url: 'https://blank-page.com/sub/test',
    snippet: 'Need software team'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res.pass, false, 'Empty/minimal page must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_validity_reason, 'INSUFFICIENT_CONTENT');
});

// =============================================================
// GAP 2: VERIFICATION CACHE
// =============================================================

test('🧪 Gap 2.1: Cache miss on first call, cache hit on second call with zero additional network fetches', async () => {
  let networkFetches = 0;
  const mockFetch = async (url) => {
    networkFetches++;
    return {
      status: 200,
      url,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => '<html><body><h1>Project Page</h1><p>We are seeking an external development agency to build our software. Budget: $5,000</p></body></html>'
    };
  };

  const candidate = {
    url: 'https://company.org/project-post',
    snippet: 'Seeking development agency'
  };

  // First call -> Cache Miss
  const res1 = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res1.pass, true);
  assert.equal(res1.fromCache, undefined);
  assert.ok(networkFetches >= 1);

  const initialFetches = networkFetches;
  const stats1 = getVerificationCacheStats();
  assert.equal(stats1.cacheMisses, 1);
  assert.equal(stats1.cacheHits, 0);

  // Second call with same candidate -> Cache Hit
  const res2 = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(res2.pass, true);
  assert.equal(res2.fromCache, true, 'Second call must return fromCache: true');
  assert.equal(networkFetches, initialFetches, 'Zero additional network fetches must occur on cache hit');

  const stats2 = getVerificationCacheStats();
  assert.equal(stats2.cacheHits, 1);
});

test('🧪 Gap 2.2: Tracking parameters resolve to same canonical cache key', async () => {
  let networkFetches = 0;
  const mockFetch = async (url) => {
    networkFetches++;
    return {
      status: 200,
      url,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => '<html><body><h1>Project Requirement</h1><p>Our business needs a custom CRM platform developed. Contact: hr@b2b.com</p></body></html>'
    };
  };

  const candA = { url: 'https://b2b.com/careers/lead-post?utm_source=twitter&utm_medium=cpc' };
  const candB = { url: 'https://b2b.com/careers/lead-post?utm_campaign=spring&fbclid=xyz123' };

  await evaluateCandidateValidityGate(candA, { fetchFn: mockFetch, fetchPageContent: true });
  const fetchesAfterA = networkFetches;

  const resB = await evaluateCandidateValidityGate(candB, { fetchFn: mockFetch, fetchPageContent: true });
  assert.equal(resB.fromCache, true, 'Variants with tracking params must hit the canonical cache entry');
  assert.equal(networkFetches, fetchesAfterA, 'Zero additional fetches for tracking parameter variant');
});

test('🧪 Gap 2.3: clearVerificationCache resets cache completely for test isolation', async () => {
  const mockFetch = async () => ({
    status: 200,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => '<html><body><p>Readable content page with sufficient text length for passing validation.</p></body></html>'
  });

  const cand = { url: 'https://test-isolation.org/item1' };
  await evaluateCandidateValidityGate(cand, { fetchFn: mockFetch, fetchPageContent: true });

  assert.equal(getVerificationCacheStats().size, 1);
  clearVerificationCache();
  assert.equal(getVerificationCacheStats().size, 0);
  assert.equal(getVerificationCacheStats().cacheHits, 0);
  assert.equal(getVerificationCacheStats().cacheMisses, 0);
});

// =============================================================
// GAP 3: SOURCE ALLOCATION INTEGRATION
// =============================================================

test('🧪 Gap 3.1: computeSourceAllocation applies Bayesian smoothing, 15% floor, and exact 1.000 sum', () => {
  // Case A: Zero metrics (balanced default)
  const allocDefault = QueryRotatorService.computeSourceAllocation({});
  assert.equal(Number((allocDefault.reddit + allocDefault.hackernews + allocDefault.public_web).toFixed(3)), 1.000);
  assert.ok(allocDefault.reddit >= 0.15);
  assert.ok(allocDefault.hackernews >= 0.15);
  assert.ok(allocDefault.public_web >= 0.15);

  // Case B: Strong Reddit performance
  const allocReddit = QueryRotatorService.computeSourceAllocation({
    reddit: { actionableProjects: 15, processed: 20 },
    hackernews: { actionableProjects: 0, processed: 20 },
    public_web: { actionableProjects: 0, processed: 20 }
  });
  assert.equal(Number((allocReddit.reddit + allocReddit.hackernews + allocReddit.public_web).toFixed(3)), 1.000);
  assert.ok(allocReddit.reddit > allocReddit.hackernews);
  assert.ok(allocReddit.hackernews >= 0.15, '15% exploration floor must be preserved');

  // Case C: Strong HN performance
  const allocHN = QueryRotatorService.computeSourceAllocation({
    hackernews: { actionableProjects: 12, processed: 15 },
    reddit: { actionableProjects: 1, processed: 15 },
    public_web: { actionableProjects: 1, processed: 15 }
  });
  assert.equal(Number((allocHN.reddit + allocHN.hackernews + allocHN.public_web).toFixed(3)), 1.000);
  assert.ok(allocHN.hackernews > allocHN.reddit);
  assert.ok(allocHN.reddit >= 0.15);
});

test('🧪 Gap 3.2: calculateSourceQuotas generates integer quotas summing to EXACTLY batchSize', () => {
  const quotas = QueryRotatorService.calculateSourceQuotas({}, 20);
  assert.equal(quotas.reddit + quotas.hackernews + quotas.public_web, 20);
  assert.ok(quotas.reddit >= 3);
  assert.ok(quotas.hackernews >= 3);
  assert.ok(quotas.public_web >= 3);

  // With strong Reddit metrics
  const quotasReddit = QueryRotatorService.calculateSourceQuotas({
    reddit: { actionableProjects: 18, processed: 20 },
    hackernews: { actionableProjects: 0, processed: 20 },
    public_web: { actionableProjects: 0, processed: 20 }
  }, 20);
  assert.equal(quotasReddit.reddit + quotasReddit.hackernews + quotasReddit.public_web, 20);
  assert.ok(quotasReddit.reddit >= quotasReddit.hackernews);
  assert.ok(quotasReddit.hackernews >= 3, 'Floor guaranteed');
});

test('🧪 Gap 3.3: getQueriesForCycle emits exactly 20 prioritized queries matching allocated quotas', () => {
  const rotator = new QueryRotatorService({ cycle: 1, batchSize: 20 });
  const queries = rotator.getQueriesForCycle();

  assert.equal(queries.length, 20, 'Batch size must be exactly 20');

  const redditCount = queries.filter(q => q.sourceScope === 'reddit').length;
  const hnCount = queries.filter(q => q.sourceScope === 'hackernews').length;
  const webCount = queries.filter(q => q.sourceScope === 'public_web').length;

  assert.equal(redditCount + hnCount + webCount, 20, 'Sum of source queries must equal 20');
  assert.ok(redditCount >= 3, `Reddit queries: ${redditCount} >= 3`);
  assert.ok(hnCount >= 3, `HN queries: ${hnCount} >= 3`);
  assert.ok(webCount >= 3, `Web queries: ${webCount} >= 3`);
});

// =============================================================
// GAP 4: 20-QUERY PHASE D PILOT CONFIGURATION
// =============================================================

test('🧪 Gap 4.1: Rotator cycle 1 produces zero duplicate queries and exactly 20 items', () => {
  const rotator = new QueryRotatorService({ cycle: 1, batchSize: 20 });
  const queries = rotator.getQueriesForCycle();
  assert.equal(queries.length, 20);

  const queryStrings = queries.map(q => q.query);
  const uniqueStrings = new Set(queryStrings);
  assert.equal(uniqueStrings.size, 20, 'Zero duplicate queries allowed in 20-query batch');
});
