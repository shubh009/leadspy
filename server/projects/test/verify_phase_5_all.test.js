/**
 * Automated Verification Suite for Phase 5: Search Strategy V2, Provider V2 & Pre-Crawl Filter
 * File: server/projects/test/verify_phase_5_all.test.js
 */

import { scoreSearchResult } from '../scripts/runSearchAndDirectDiscovery.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { evaluateSearchResultQuality, MultiSearchManager } from '../sources/searchProvider.js';
import { projectQueryLibrary, QUERY_PRIORITY } from '../config/projectQueryLibrary.js';

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 5 INTEGRATION & REGRESSION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // PART 1: 10 Pre-Crawl Scorer Test Cases
  // -------------------------------------------------------------
  console.log('--- 1. Testing Pre-Crawl Scoring Cases ---');

  const acceptCases = [
    { title: 'We need a developer to build our SaaS', snippet: 'Looking for development team with React and Node experience to build MVP. Budget $5k.' },
    { title: 'Looking for software development agency', snippet: 'Our company is seeking an external agency to develop our custom web application.' },
    { title: 'Need a CRM for our company', snippet: 'We need a custom CRM developed with lead tracking and customer portal.' },
    { title: 'Need marketing automation software', snippet: 'Seeking developers to build custom marketing automation software to sync our ads.' },
    { title: 'Need an AI agent built for our business', snippet: 'Looking for developer to build an autonomous AI customer support agent.' },
    { title: 'Looking to outsource our web application', snippet: 'Request for proposal: seeking technology partner to develop our client portal.' }
  ];

  for (let i = 0; i < acceptCases.length; i++) {
    const res = scoreSearchResult(acceptCases[i], { qualityTier: 'A' });
    assert(res.decision === 'accept', `Accept Case ${i + 1}: "${acceptCases[i].title}" -> score ${res.score}`);
  }

  const rejectCases = [
    { title: 'Senior React Developer - $120k salary', snippet: 'Join our team as full-time senior engineer. 401k, PTO, submit resume to hr@corp.com' },
    { title: 'React tutorial for beginners', snippet: 'Learn how to build a website from scratch with this step by step guide and course.' },
    { title: 'What is the best SaaS architecture?', snippet: 'Ask HN: which framework is better for SaaS? What do you think of Next.js vs Remix?' },
    { title: 'Why you need custom software in 2026', snippet: 'Read our blog guide on reasons businesses need custom applications.' },
    { title: 'Need an SEO agency', snippet: 'Looking for digital marketing agency to manage social media and SEO ranking.' },
    { title: 'Need social media marketing', snippet: 'Looking for virtual assistant to post reels on Instagram daily.' }
  ];

  for (let i = 0; i < rejectCases.length; i++) {
    const res = scoreSearchResult(rejectCases[i], { qualityTier: 'A' });
    assert(res.decision === 'reject', `Reject Case ${i + 1}: "${rejectCases[i].title}" -> score ${res.score} (${res.rejectionReason})`);
  }

  // -------------------------------------------------------------
  // PART 2: Four Problematic Regression URLs Pre-Filter Verification
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing 4 Problematic Regression URLs at Pre-Crawl ---');

  const reg1 = scoreSearchResult({
    url: 'https://www.opautoclicker.com/',
    title: 'OP Auto Clicker - Free Automated Mouse Clicker Tool',
    snippet: 'Download our free software tool. A full-fledged autokey clicker with features and download.',
    sourceDomain: 'opautoclicker.com'
  });
  assert(reg1.decision === 'reject', `opautoclicker.com -> Pre-Crawl Rejected (Score: ${reg1.score})`);

  const reg2 = scoreSearchResult({
    url: 'https://github.com/affanorangetoolz/fleet-pilot/issues/2',
    title: 'Short links actually redirect · Issue #2 · affanorangetoolz/fleet-pilot',
    snippet: 'When clicking on shortened URLs, they redirect. Unit test bug report.',
    sourceDomain: 'github.com'
  }, { sourceScope: 'github' });
  assert(reg2.decision === 'reject', `GitHub Issue #2 bug report -> Pre-Crawl Rejected (Score: ${reg2.score})`);

  const reg3 = scoreSearchResult({
    url: 'https://news.ycombinator.com/item?id=49756122',
    title: 'Ask HN: Which frontend framework is better for production?',
    snippet: 'What are your experiences with React vs Svelte? General tech discussion.',
    sourceDomain: 'news.ycombinator.com'
  }, { sourceScope: 'hackernews' });
  assert(reg3.decision === 'reject', `HN Discussion #49756122 -> Pre-Crawl Rejected (Score: ${reg3.score})`);

  const reg4 = scoreSearchResult({
    url: 'https://reddit.com/r/forhire/comments/mk1',
    title: '[HIRING] Hiring marketers $50 weekly',
    snippet: 'Looking for marketers to manage Instagram and social media marketing.',
    sourceDomain: 'reddit.com'
  }, { sourceScope: 'reddit' });
  assert(reg4.decision === 'reject', `Reddit Marketing gig -> Pre-Crawl Rejected (Score: ${reg4.score})`);

  // -------------------------------------------------------------
  // PART 3: Verify Core Qualification Engine Untouched & 100% Intact
  // -------------------------------------------------------------
  console.log('\n--- 3. Verifying Classifier Regression Intact ---');
  const classifier = new ProjectClassifier();
  classifier.apiKey = null; // Test deterministic classifier

  const genuineProject = await classifier.qualifyAndExtract({
    source: 'web',
    author: 'Founder',
    rawTitle: 'Need external agency to build our React dashboard',
    rawContent: 'Looking for software development agency to build our customer portal and Node API. Budget $5,000. Contact: dev@saascorp.io',
    sourceUrl: 'https://saascorp.io/rfp'
  });

  assert(genuineProject.qualification_status === 'qualified', 'Classifier verifies genuine project');
  assert(genuineProject.contact_type === 'email', 'Classifier preserves contactability');

  console.log('\n================================================================');
  console.log(`INTEGRATION TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runPhase5Tests().catch(e => {
  console.error('Fatal Test Error:', e);
  process.exit(1);
});
