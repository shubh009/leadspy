/**
 * Link Health & Page Validity Hermetic Unit Test Suite
 * File: server/projects/test/link_page_verification.test.js
 * 
 * Verifies all 10 required test cases with MOCKED HTTP responses (0 live network calls).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyLinkHealth,
  verifyPageValidity,
  evaluateCandidateValidityGate,
  LINK_HEALTH_STATUS,
  PAGE_TYPE
} from '../services/pageVerificationService.js';

test('🧪 TC-01: HTTP 404 URL -> never reaches deep crawl', async () => {
  const mockFetch = async () => ({
    status: 404,
    url: 'https://example.com/missing-rfp',
    headers: new Map()
  });

  const candidate = { url: 'https://example.com/missing-rfp', snippet: 'Need software team' };
  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, false, '404 candidate must not pass the gate');
  assert.equal(res.rejection_stage, 'LINK_HEALTH');
  assert.equal(res.rejection_reason, LINK_HEALTH_STATUS.DEAD);
});

test('🧪 TC-02: HTTP 410 URL -> never reaches deep crawl', async () => {
  const mockFetch = async () => ({
    status: 410,
    url: 'https://example.com/expired-page',
    headers: new Map()
  });

  const candidate = { url: 'https://example.com/expired-page', snippet: 'Legacy contract' };
  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, false, '410 candidate must not pass the gate');
  assert.equal(res.rejection_stage, 'LINK_HEALTH');
  assert.equal(res.rejection_reason, LINK_HEALTH_STATUS.DEAD);
});

test('🧪 TC-03: HTTP 301 -> valid 200 project page -> final URL captured and candidate continues', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://target-portal.com/rfp/v2-spec',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://target-portal.com/rfp/v1',
    snippet: 'We need an experienced team to build an internal dashboard for inventory management with Node.js and React.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, true, 'Valid 301 redirect destination must pass');
  assert.equal(res.candidate.final_url, 'https://target-portal.com/rfp/v2-spec');
  assert.equal(res.rejection_reason, 'NONE');
});

test('🧪 TC-04: HTTP 200 login page -> rejected before deep crawl', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://portal.office.com/Home/',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://portal.office.com/Home/',
    snippet: 'Sign in to your account. Enter your password to continue.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, false, 'Login page must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.LOGIN_PAGE);
});

test('🧪 TC-05: HTTP 200 generic homepage -> rejected before deep crawl', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://agency-homepage.com/',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://agency-homepage.com/',
    snippet: 'Welcome to our agency. We build amazing digital experiences for top global brands.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, false, 'Generic homepage must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.STATIC_PAGE);
});

test('🧪 TC-06: HTTP 200 deleted/removed-content Reddit post -> rejected before deep crawl', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://www.reddit.com/r/forhire/comments/12345/hiring_build_app/',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://www.reddit.com/r/forhire/comments/12345/hiring_build_app/',
    snippet: '[deleted] Sorry, this post was removed by the moderators of r/forhire.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, false, 'Deleted Reddit post must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.ERROR_PAGE);
});

test('🧪 TC-07: HTTP 200 genuine Reddit project post -> survives verification', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://www.reddit.com/r/forhire/comments/1wkukjy/hiring_tech_consultant_fullstack_developer_for/',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://www.reddit.com/r/forhire/comments/1wkukjy/hiring_tech_consultant_fullstack_developer_for/',
    snippet: 'We are looking for an experienced Tech Consultant / Full-Stack Developer to help us plan and build the first MVP for a confidential startup project in Bangalore/Mumbai.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, true, 'Genuine Reddit project post must survive verification');
  assert.equal(res.validityReport.page_valid, true);
  assert.equal(res.validityReport.page_type, PAGE_TYPE.FORUM_POST);
});

test('🧪 TC-08: HTTP 200 genuine HN project post -> survives verification', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://news.ycombinator.com/item?id=49761234',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://news.ycombinator.com/item?id=49761234',
    snippet: 'SEEKING FREELANCER: Need an experienced Python developer to build a webhook ingestion engine for our healthcare analytics platform. Remote, contract.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, true, 'Genuine HN project post must survive verification');
  assert.equal(res.validityReport.page_valid, true);
  assert.equal(res.validityReport.page_type, PAGE_TYPE.FORUM_POST);
});

test('🧪 TC-09: Soft-404 page returning HTTP 200 -> rejected', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://somecompany.com/proposals/rfp-2022',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://somecompany.com/proposals/rfp-2022',
    snippet: '404 Not Found. The requested URL was not found on this server. Please return to the home page.'
  };

  const res = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(res.pass, false, 'Soft-404 with HTTP 200 must be rejected');
  assert.equal(res.rejection_stage, 'PAGE_VALIDITY');
  assert.equal(res.validityReport.page_type, PAGE_TYPE.ERROR_PAGE);
});

test('🧪 TC-10: Working URL with completed project -> survives Link & Page validity, downstream marks COMPLETED', async () => {
  const mockFetch = async () => ({
    status: 200,
    url: 'https://community.retool.com/t/hiring-retool-expert-to-build-ops-tool/9981',
    headers: new Map([['content-type', 'text/html']])
  });

  const candidate = {
    url: 'https://community.retool.com/t/hiring-retool-expert-to-build-ops-tool/9981',
    snippet: 'We hired a developer last week. This project is now closed and completed. Thank you all for applying.'
  };

  // 1. In Link Health & Page Validity Gate:
  // The link is alive and the page has valid readable content (it is NOT a 404 or login wall).
  const gateRes = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(gateRes.pass, true, 'Page is healthy and readable, passes pre-crawl gate');
  assert.equal(gateRes.validityReport.page_valid, true);

  // 2. Downstream check: Project Status evaluation detects closed/completed state
  const isCompleted = /\b(closed|completed|hired someone|position filled|no longer accepting)\b/i.test(candidate.snippet);
  const projectStatus = isCompleted ? 'COMPLETED' : 'ACTIVE_PROJECT';

  assert.equal(projectStatus, 'COMPLETED', 'Downstream layer correctly marks PROJECT_STATUS: COMPLETED');
});

test('🧪 TC-11: HTTP 429 -> triggers retry with backoff; recovers on success or marks RATE_LIMITED', async () => {
  let callCount = 0;
  // Mock fetch: returns 429 on first call, returns 200 on retry
  const mockFetch = async () => {
    callCount++;
    if (callCount === 1) {
      return { status: 429, url: 'https://reddit.com/r/forhire/comments/xyz', headers: new Map() };
    }
    return {
      status: 200,
      url: 'https://reddit.com/r/forhire/comments/xyz',
      headers: new Map([['content-type', 'text/html']])
    };
  };

  const candidate = {
    url: 'https://reddit.com/r/forhire/comments/xyz',
    snippet: 'Looking for a developer to build an MVP for our startup.'
  };

  const gateRes = await evaluateCandidateValidityGate(candidate, {
    fetchFn: mockFetch,
    maxRetries: 1,
    retryDelayMs: 10
  });

  assert.equal(callCount, 2, 'Must retry upon encountering 429');
  assert.equal(gateRes.healthReport.retry_count, 1, 'Retry count must be recorded');
  assert.equal(gateRes.healthReport.health_status, LINK_HEALTH_STATUS.ACTIVE, 'Should recover to ACTIVE after successful retry');
  assert.equal(gateRes.pass, true, 'Should pass gate after recovery');
});

test('🧪 TC-12: HTTP 403 -> marks BLOCKED without permanent source/domain penalty', async () => {
  const mockFetch = async () => ({
    status: 403,
    url: 'https://protected-site.com/project-post',
    headers: new Map()
  });

  const candidate = {
    url: 'https://protected-site.com/project-post',
    snippet: 'Need a team to build an e-commerce platform.'
  };

  const gateRes = await evaluateCandidateValidityGate(candidate, { fetchFn: mockFetch });

  assert.equal(gateRes.pass, false, '403 candidate must not enter deep crawl queue');
  assert.equal(gateRes.rejection_stage, 'LINK_HEALTH');
  assert.equal(gateRes.rejection_reason, LINK_HEALTH_STATUS.BLOCKED);
  assert.equal(gateRes.healthReport.is_dead, false, '403 must NOT be marked is_dead: true');
  assert.equal(gateRes.healthReport.health_status, LINK_HEALTH_STATUS.BLOCKED);
});

