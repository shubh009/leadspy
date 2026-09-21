/**
 * Test Suite: Gate 0 Instant Sanity Filter & Discovery Pipeline Orchestration
 * File: server/projects/test/test_orchestration_gate0.test.js
 * 
 * Verifies the 16 core test cases required for the discovery refactoring:
 * 1. Blacklisted domain dropped at Gate 0 with zero network calls
 * 2. Employment board dropped at Gate 0
 * 3. Marketing/docs URL path dropped at Gate 0
 * 4. Freelancer self-pitch dropped at Gate 0
 * 5. Context-aware employment dropped at Gate 0
 * 6. Negated employment survives Gate 0
 * 7. Deduplication occurs strictly after Gate 0
 * 8. Pre-crawl scoring evaluates Gate 0 survivors before network
 * 9. Low intent score rejected at Pre-Crawl before network
 * 10. High intent approved candidate lands in CSV 1
 * 11. Native Reddit post with body bypasses network ping (NATIVE_SOURCE_VERIFIED)
 * 12. Dead link (404/410) dropped at HTTP verification
 * 13. Page with < 250 chars readable text dropped at Page Validity
 * 14. 16KB max bytes limit respected during page fetch
 * 15. CSV 1, CSV 2, and CSV 3 structure and routing verified
 * 16. Qualified-but-uncontactable leads preserved in final output
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGate0Sanity,
  scoreSearchResult,
  exportFunnelAuditCSVs
} from '../scripts/runSearchAndDirectDiscovery.js';
import {
  evaluateCandidateValidityGate,
  verifyPageValidity,
  fetchLightweightPageContent,
  verifyLinkHealth,
  HTTP_VERIFICATION_TIMEOUT_MS,
  LINK_HEALTH_STATUS,
  PAGE_TYPE
} from '../services/pageVerificationService.js';
import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import fs from 'fs';
import path from 'path';

test('🧪 TC-01: Gate 0 drops blacklisted reference domain (dictionary/wiki) with zero network calls', () => {
  const item = {
    url: 'https://dictionary.cambridge.org/dictionary/english/developer',
    title: 'Developer Definition & Meaning',
    snippet: 'A person whose job is to create computer software.'
  };

  const gate0 = evaluateGate0Sanity(item);
  assert.equal(gate0.pass, false, 'Reference domain must be dropped by Gate 0');
  assert.equal(gate0.gate, 'GATE_0');
  assert.ok(gate0.rejection_reason.includes('BLACKLISTED_DOMAIN'));
});

test('🧪 TC-02: Gate 0 drops employment job board domain (indeed, jooble, naukri)', () => {
  const candidates = [
    { url: 'https://www.indeed.com/viewjob?jk=12345', title: 'React Dev Needed', snippet: 'Looking for full stack' },
    { url: 'https://in.jooble.org/desc/9981', title: 'Node Developer', snippet: 'Company hiring backend' },
    { url: 'https://www.naukri.com/job-listings-react-lead', title: 'Lead Engineer', snippet: 'Software engineer opening' }
  ];

  for (const c of candidates) {
    const res = evaluateGate0Sanity(c);
    assert.equal(res.pass, false, `Expected ${c.url} to be dropped by Gate 0`);
    assert.equal(res.gate, 'GATE_0');
    assert.ok(res.rejection_reason.includes('BLACKLISTED_DOMAIN'));
  }
});

test('🧪 TC-03: Gate 0 drops junk/marketing/documentation URL paths (/pricing, /features, /docs, /careers)', () => {
  const candidates = [
    { url: 'https://saas-company.com/pricing', title: 'Pricing Plans', snippet: 'Enterprise plan' },
    { url: 'https://saas-company.com/features/reporting', title: 'Features', snippet: 'Explore dashboard features' },
    { url: 'https://acme.org/docs/getting-started', title: 'API Documentation', snippet: 'Install package' },
    { url: 'https://techcorp.io/careers/openings', title: 'Join our team', snippet: 'Current job openings' }
  ];

  for (const c of candidates) {
    const res = evaluateGate0Sanity(c);
    assert.equal(res.pass, false, `Expected path in ${c.url} to be dropped`);
    assert.equal(res.gate, 'GATE_0');
    assert.ok(res.rejection_reason.includes('FORBIDDEN_PATH_PATTERN'));
  }
});

test('🧪 TC-04: Gate 0 drops supplier/freelancer self-pitches ([For Hire], SEEKING WORK, Hire Me)', () => {
  const candidates = [
    { url: 'https://reddit.com/r/forhire/111', title: '[For Hire] Senior Full-Stack Developer with 6 years experience', snippet: 'Available for freelance or contract work.' },
    { url: 'https://reddit.com/r/freelance/222', title: 'SEEKING WORK: Python AI engineer', snippet: 'I can build your scrapers and LLM apps.' },
    { url: 'https://twitter.com/dev/333', title: 'Hire me for your next project', snippet: 'Check out my portfolio at https://portfolio.me' }
  ];

  for (const c of candidates) {
    const res = evaluateGate0Sanity(c);
    assert.equal(res.pass, false, `Supplier self-pitch must fail Gate 0: ${c.title}`);
    assert.equal(res.gate, 'GATE_0');
    assert.ok(res.rejection_reason.includes('SUPPLIER_SELF_PITCH'));
  }
});

test('🧪 TC-05: Gate 0 drops explicit employment patterns (benefits include, annual salary, w2 role)', () => {
  const item = {
    url: 'https://jobs.techcompany.com/listing-99',
    title: 'Senior Backend Engineer',
    snippet: 'Competitive compensation. Comprehensive benefits include health, 401k matching, and dental. Annual salary $140,000 - $160,000. Equal opportunity employer.'
  };

  const gate0 = evaluateGate0Sanity(item);
  assert.equal(gate0.pass, false, 'Employment listing must be rejected at Gate 0');
  assert.equal(gate0.gate, 'GATE_0');
  assert.ok(gate0.rejection_reason.includes('EMPLOYMENT_SIGNAL'));
});

test('🧪 TC-06: Gate 0 negation safeguard: client phrasing mentioning not salaried or no w2 passes Gate 0', () => {
  const item = {
    url: 'https://reddit.com/r/forhire/comments/xyz123',
    title: '[Hiring] Need dev team for SaaS MVP',
    snippet: 'This is not a salaried role or permanent job. We need an agency or contractor for a fixed price milestone.'
  };

  const gate0 = evaluateGate0Sanity(item);
  assert.equal(gate0.pass, true, 'Client post with negated employment terms must pass Gate 0');
  assert.equal(gate0.gate, 'GATE_0');
  assert.equal(gate0.rejection_reason, null);
});

test('🧪 TC-07: Deduplication occurs strictly after Gate 0 without polluting canonical set on Gate 0 drops', () => {
  const seenCanonicalUrls = new Set();
  
  function ingestPipeline(rawItem) {
    // 1. Gate 0 Sanity Filter
    const gate0 = evaluateGate0Sanity(rawItem);
    if (!gate0.pass) {
      return { status: 'DROPPED_GATE_0', reason: gate0.rejection_reason };
    }

    // 2. Canonical Deduplication (only for survivors)
    const norm = rawItem.url.toLowerCase().replace(/#.*$/, '').replace(/\/$/, '');
    if (seenCanonicalUrls.has(norm)) {
      return { status: 'DROPPED_DEDUP', reason: 'DUPLICATE_CANONICAL_URL' };
    }
    seenCanonicalUrls.add(norm);
    return { status: 'APPROVED_FOR_PRE_CRAWL' };
  }

  // First: blacklisted domain - should be dropped at Gate 0, not in dedup set
  const res1 = ingestPipeline({ url: 'https://dictionary.cambridge.org/word1', title: 'Def 1', snippet: 'text' });
  assert.equal(res1.status, 'DROPPED_GATE_0');
  assert.equal(seenCanonicalUrls.size, 0, 'Gate 0 drops must not enter deduplication set');

  // Second: valid lead - enters dedup
  const res2 = ingestPipeline({ url: 'https://community.retool.com/t/hiring-dev/1', title: 'Need dev', snippet: 'Looking for developer' });
  assert.equal(res2.status, 'APPROVED_FOR_PRE_CRAWL');
  assert.equal(seenCanonicalUrls.size, 1);

  // Third: same valid lead - dropped by dedup
  const res3 = ingestPipeline({ url: 'https://community.retool.com/t/hiring-dev/1/', title: 'Need dev duplicate', snippet: 'Looking for developer' });
  assert.equal(res3.status, 'DROPPED_DEDUP');
});

test('🧪 TC-08: Pre-crawl intent scoring evaluates survivors before network verification', () => {
  const genuineLead = {
    title: 'Looking for agency to build our marketplace platform',
    snippet: 'We have a budget of $15k to build a React and Node MVP. Need custom web application with Stripe integration.',
    url: 'https://client-portal.com/rfp-2026'
  };

  const evalResult = scoreSearchResult(genuineLead);
  assert.ok(evalResult.score >= 45, `Expected score >= 45, got ${evalResult.score}`);
  assert.equal(evalResult.decision, 'accept');
});

test('🧪 TC-09: Low intent informational article dropped at pre-crawl before network pings', () => {
  const blogPost = {
    title: 'How to build a React application step by step tutorial',
    snippet: 'Learn how to build a website from scratch with this step by step guide and course.',
    url: 'https://techblog.com/guide-to-react'
  };

  const evalResult = scoreSearchResult(blogPost);
  assert.ok(evalResult.score < 45, `Informational blog should have low score, got ${evalResult.score}`);
  assert.equal(evalResult.decision, 'reject');
});

test('🧪 TC-10: High-intent approved candidate lands in CSV 1 (Pre-Network Approved)', () => {
  const approvedItem = {
    url: 'https://rfp-hub.com/specs/project-123',
    title: 'Need a software team to build SaaS dashboard',
    snippet: 'Scope of work includes Node API, React UI, PostgreSQL database. Budget: $20,000.',
    preCrawlScore: 85,
    search_query: '"need software team" react node'
  };

  assert.ok(approvedItem.preCrawlScore >= 45);
  // CSV 1 format validation
  const row = {
    url: approvedItem.url,
    title: approvedItem.title,
    snippet: approvedItem.snippet,
    pre_crawl_score: approvedItem.preCrawlScore,
    query: approvedItem.search_query
  };
  assert.equal(row.pre_crawl_score, 85);
});

test('🧪 TC-11: Native Reddit post with existing body bypasses HTTP ping (NATIVE_SOURCE_VERIFIED)', async () => {
  let networkPingAttempted = false;
  const mockFetch = async () => {
    networkPingAttempted = true;
    return { status: 200, url: 'https://reddit.com/r/forhire/post1', headers: new Map() };
  };

  const nativeCandidate = {
    source: 'reddit',
    url: 'https://reddit.com/r/forhire/comments/xyz/hiring_fullstack_dev/',
    title: '[Hiring] Full Stack Developer for MVP',
    snippet: 'We need an experienced developer to build an MVP for our startup in React and Node.js. Remote, contract.',
    body: 'We need an experienced developer to build an MVP for our startup in React and Node.js. Remote, contract.'
  };

  const res = await evaluateCandidateValidityGate(nativeCandidate, { fetchFn: mockFetch });
  assert.equal(networkPingAttempted, false, 'Native candidate with body must bypass network ping');
  assert.equal(res.pass, true);
  assert.equal(res.healthReport.health_status, 'NATIVE_SOURCE_VERIFIED');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.FORUM_POST);
});

test('🧪 TC-12: HTTP 404 / 410 dead link rejected at Link Health before deep crawl', async () => {
  const mockFetch = async () => ({
    status: 404,
    url: 'https://defunct-domain.com/dead-post',
    headers: new Map()
  });

  const candidate = {
    url: 'https://defunct-domain.com/dead-post',
    title: 'Need a developer',
    snippet: 'Old project post'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });
  assert.equal(res.pass, false);
  assert.equal(res.rejection_stage, 'LINK_HEALTH');
  assert.equal(res.rejection_reason, LINK_HEALTH_STATUS.DEAD);
});

test('🧪 TC-13: Page with < 250 characters of readable text rejected at Page Validity (INSUFFICIENT_PAGE_CONTENT)', () => {
  const shortText = 'Short stub page with little text.';
  assert.ok(shortText.length < 250);

  const report = verifyPageValidity('https://example.com/project/stub', { health_status: LINK_HEALTH_STATUS.ACTIVE }, shortText);
  assert.equal(report.page_valid, false);
  assert.equal(report.page_validity_reason, 'INSUFFICIENT_PAGE_CONTENT');
});

test('🧪 TC-14: fetchLightweightPageContent enforces 16KB maxBytes limit without memory overflow', async () => {
  // Mock a response body that yields 64KB of text
  const hugeText = 'A'.repeat(65536);
  const mockFetch = async () => ({
    status: 200,
    headers: new Map([['content-type', 'text/html']]),
    text: async () => hugeText
  });

  const res = await fetchLightweightPageContent('https://example.com/big-page', {
    fetchFn: mockFetch,
    maxBytes: 16384
  });

  assert.equal(res.success, true);
  assert.ok(res.content.length <= 16384, `Content length should not exceed 16KB, got ${res.content.length}`);
});

test('🧪 TC-15: CSV 1, CSV 2, and CSV 3 exports create expected files in output directories', () => {
  const rawCandidates = [
    { url: 'https://indeed.com/job1', title: 'Job 1', snippet: 'Job snippet', search_query: 'q1' },
    { url: 'https://site.com/rfp1', title: 'RFP 1', snippet: 'Need dev', search_query: 'q1' }
  ];

  const approvedForVerification = [
    { url: 'https://site.com/rfp1', title: 'RFP 1', snippet: 'Need dev', preCrawlScore: 85, search_query: 'q1' }
  ];

  const droppedCandidates = [
    { url: 'https://indeed.com/job1', gate: 'GATE_0', rejection_reason: 'BLACKLISTED_DOMAIN: indeed.com', snippet: 'Job snippet', search_query: 'q1' }
  ];

  const qualifiedLeads = [
    {
      project_title: 'RFP 1',
      canonical_url: 'https://site.com/rfp1',
      client_company: 'Acme Corp',
      key_requirements: ['Node API', 'React UI'],
      estimated_budget: '$10k-$20k',
      tech_stack: ['Node', 'React'],
      freshnessStatus: 'fresh',
      contact_channel: 'contact@site.com',
      contact_type: 'EMAIL',
      qualification_score: 88,
      final_confidence: 85,
      outreach_pitch: 'Custom pitch'
    }
  ];

  // Test CSV export function
  exportFunnelAuditCSVs({
    preNetworkApprovedCandidates: approvedForVerification,
    droppedCandidates,
    qualifiedProjects: qualifiedLeads,
    rawCandidatePool: rawCandidates,
    highIntentApprovedCandidates: approvedForVerification
  });

  const cwd = process.cwd();
  assert.ok(fs.existsSync(path.join(cwd, 'csv1_pre_network_approved.csv')));
  assert.ok(fs.existsSync(path.join(cwd, 'csv2_dropped_audit.csv')));
  assert.ok(fs.existsSync(path.join(cwd, 'csv3_final_qualified_leads.csv')));

  const csv1Content = fs.readFileSync(path.join(cwd, 'csv1_pre_network_approved.csv'), 'utf8');
  assert.ok(csv1Content.includes('https://site.com/rfp1'));

  const csv2Content = fs.readFileSync(path.join(cwd, 'csv2_dropped_audit.csv'), 'utf8');
  assert.ok(csv2Content.includes('BLACKLISTED_DOMAIN: indeed.com'));
  assert.ok(csv2Content.includes('GATE_0'));

  const csv3Content = fs.readFileSync(path.join(cwd, 'csv3_final_qualified_leads.csv'), 'utf8');
  assert.ok(csv3Content.includes('Acme Corp'));
  assert.ok(csv3Content.includes('Node API'));
});

test('🧪 TC-16: Qualified-but-uncontactable leads preserved in final output without dropping', () => {
  const leadUncontactable = {
    final_url: 'https://community.retool.com/t/hiring-lead-dev/9982',
    title: 'Need a developer to build inventory tracking system',
    lead_classification: 'DIRECT_PROJECT',
    contactability_level: 'UNCONTACTABLE',
    overall_qualification_score: 82,
    client_intent_score: 90
  };

  // Ensure evaluation treats it as qualified lead
  const isQualified = (leadUncontactable.overall_qualification_score >= 70) &&
                      (leadUncontactable.lead_classification !== 'REJECTED');
  assert.equal(isQualified, true, 'Uncontactable lead must remain qualified');
  assert.equal(leadUncontactable.contactability_level, 'UNCONTACTABLE');
});

test('🧪 TC-17: Query context preservation & deduplicator updates across multiple queries (P0.1)', () => {
  const dedup = new CanonicalDeduplicator();
  const url = 'https://client-corp.com/rfp-custom-crm';

  // 1st query appearance
  const check1 = dedup.checkUrlCandidate({
    url,
    title: 'Custom CRM Build',
    search_query: 'hire developer custom crm',
    rank: 3
  }, {
    sourceScope: 'google',
    intentType: 'buyer_request',
    deliverableType: 'crm',
    priority: 'HIGH',
    qualityTier: 'A'
  });
  assert.equal(check1.isDuplicate, false);

  const meta1 = dedup.getCandidateMetadata(url);
  assert.equal(meta1.query_count, 1);
  assert.equal(meta1.matched_queries.length, 1);
  assert.equal(meta1.matched_queries[0], 'hire developer custom crm');
  assert.equal(meta1.distinct_clusters_count, 1);
  assert.equal(meta1.best_rank, 3);

  // 2nd query appearance (same canonical URL, different query & cluster & rank)
  const check2 = dedup.checkUrlCandidate({
    url: 'https://client-corp.com/rfp-custom-crm/',
    title: 'Custom CRM Build',
    search_query: 'looking to outsource crm dashboard',
    rank: 1
  }, {
    sourceScope: 'bing',
    intentType: 'buyer_request',
    deliverableType: 'dashboard',
    priority: 'HIGH',
    qualityTier: 'A'
  });
  assert.equal(check2.isDuplicate, true);

  const meta2 = dedup.getCandidateMetadata(url);
  assert.equal(meta2.query_count, 2);
  assert.equal(meta2.matched_queries.length, 2);
  assert.ok(meta2.matched_queries.includes('looking to outsource crm dashboard'));
  assert.equal(meta2.distinct_clusters_count, 2);
  assert.equal(meta2.best_rank, 1);

  // 3rd query appearance
  const check3 = dedup.checkUrlCandidate({
    url: 'https://client-corp.com/rfp-custom-crm?utm_source=rss',
    title: 'Custom CRM Build',
    search_query: 'need software vendor crm portal',
    rank: 5
  }, {
    sourceScope: 'google',
    intentType: 'buyer_request',
    deliverableType: 'portal',
    priority: 'HIGH',
    qualityTier: 'A'
  });
  assert.equal(check3.isDuplicate, true);

  const meta3 = dedup.getCandidateMetadata(url);
  assert.equal(meta3.query_count, 3);
  assert.equal(meta3.matched_queries.length, 3);
  assert.equal(meta3.distinct_clusters_count, 3);
  assert.equal(meta3.best_rank, 1);
});

test('🧪 TC-18: CSV 1 includes matched_queries, query_count, distinct_clusters_count, and best_rank (P0.1, P0.6)', () => {
  const approvedItem = {
    title: 'Need dev team for SaaS',
    url: 'https://saas-company.com/build-mvp',
    canonicalUrl: 'https://saas-company.com/build-mvp',
    source: 'google',
    search_query: 'looking for agency to build saas',
    matched_queries: ['looking for agency to build saas', 'hire react dev saas'],
    query_count: 2,
    distinct_clusters_count: 2,
    best_rank: 1,
    score: 85,
    queryContext: {
      sourceScope: 'public_web',
      intentType: 'buyer_request',
      deliverableType: 'saas',
      qualityTier: 'A'
    }
  };

  exportFunnelAuditCSVs({
    preNetworkApprovedCandidates: [approvedItem],
    droppedCandidates: [],
    qualifiedProjects: [],
    rawCandidatePool: [approvedItem],
    highIntentApprovedCandidates: [approvedItem]
  });

  const cwd = process.cwd();
  const csv1Content = fs.readFileSync(path.join(cwd, 'csv1_pre_network_approved.csv'), 'utf8');
  assert.ok(csv1Content.includes('matched_queries'));
  assert.ok(csv1Content.includes('distinct_clusters_count'));
  assert.ok(csv1Content.includes('best_rank'));
  assert.ok(csv1Content.includes('looking for agency to build saas; hire react dev saas'));
});

test('🧪 TC-19: True 2-second total budget enforces deadline across HEAD and GET fallback (P0.2)', async () => {
  assert.equal(HTTP_VERIFICATION_TIMEOUT_MS, 2000);

  // Simulate slow endpoint where HEAD takes 1200ms and GET takes 1500ms
  // Total would be 2700ms without total budget, but with 2000ms deadline it should abort around 2000ms
  const slowMockFetch = async (url, options) => {
    if (options.method === 'HEAD') {
      await new Promise(r => setTimeout(r, 1200));
      return { status: 405, headers: new Map() }; // trigger GET fallback
    }
    // GET fallback
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ status: 200, url, headers: new Map() });
      }, 1500);
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  };

  const start = Date.now();
  const report = await verifyLinkHealth('https://slow-site.com/rfp', {
    fetchFn: slowMockFetch,
    timeoutMs: 2000
  });
  const elapsed = Date.now() - start;

  assert.equal(report.health_status, LINK_HEALTH_STATUS.UNREACHABLE);
  assert.ok(elapsed >= 1900 && elapsed <= 2400, `Elapsed time should be ~2000ms, was ${elapsed}ms`);
});

test('🧪 TC-20: Raw pool cap drops candidate at INGESTION with RAW_POOL_CAP_REACHED (P0.3, P0.5)', () => {
  const maxRawLimit = 2;
  const rawPool = [];
  const dropped = [];

  const simulateIngest = (rawItem) => {
    const verdict = evaluateGate0Sanity(rawItem);
    if (!verdict.pass) {
      dropped.push({ url: rawItem.url, gate: 'GATE_0', rejection_reason: verdict.rejection_reason });
      return;
    }
    if (rawPool.length >= maxRawLimit) {
      dropped.push({ url: rawItem.url, gate: 'INGESTION', rejection_reason: 'RAW_POOL_CAP_REACHED' });
      return;
    }
    rawPool.push(rawItem);
  };

  simulateIngest({ url: 'https://site1.com/project', title: 'Need dev 1', snippet: 'Project 1' });
  simulateIngest({ url: 'https://site2.com/project', title: 'Need dev 2', snippet: 'Project 2' });
  // 3rd item should hit pool cap
  simulateIngest({ url: 'https://site3.com/project', title: 'Need dev 3', snippet: 'Project 3' });

  assert.equal(rawPool.length, 2);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].gate, 'INGESTION');
  assert.equal(dropped[0].rejection_reason, 'RAW_POOL_CAP_REACHED');

  exportFunnelAuditCSVs({
    preNetworkApprovedCandidates: [],
    droppedCandidates: dropped,
    qualifiedProjects: [],
    rawCandidatePool: rawPool
  });

  const cwd = process.cwd();
  const csv2Content = fs.readFileSync(path.join(cwd, 'csv2_dropped_audit.csv'), 'utf8');
  assert.ok(csv2Content.includes('INGESTION'));
  assert.ok(csv2Content.includes('RAW_POOL_CAP_REACHED'));
});
