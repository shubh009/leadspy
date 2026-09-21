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

import fs from 'fs';
import path from 'path';

import { QueryRotatorService, ROTATION_CYCLES } from '../services/queryRotatorService.js';
import { DISCOVERY_MODE } from '../config/projectQueryLibrary.js';
import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import { saveMasterProjects, validateProductionPersistenceConfig } from '../services/projectDbService.js';
export { validateProductionPersistenceConfig };
import {
  evaluateCandidateValidityGate,
  getVerificationCacheStats,
  clearVerificationCache,
  LINK_HEALTH_STATUS,
  PAGE_TYPE
} from '../services/pageVerificationService.js';

export function exportFunnelAuditCSVs({
  preNetworkApprovedCandidates = [],
  droppedCandidates = [],
  qualifiedProjects = [],
  rawCandidatePool = [],
  highIntentApprovedCandidates = []
}) {
  const exportDirs = [
    process.cwd(),
    '/Users/shubh/Downloads/leadspy_search_engine_files',
    '/Users/shubh/Downloads'
  ];

  for (const dir of exportDirs) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {}
    }
  }

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  // 1. CSV 1: Pre-Network Approved Candidates (Gate 0 + Dedup + Pre-Crawl Score passed)
  const approvedList = preNetworkApprovedCandidates.length > 0
    ? preNetworkApprovedCandidates
    : (highIntentApprovedCandidates.length > 0 ? highIntentApprovedCandidates : rawCandidatePool.filter(c => c.preCrawlEval?.decision === 'accept'));

  const csv1Headers = [
    'title',
    'url',
    'canonical_url',
    'source',
    'matched_queries',
    'query_count',
    'score',
    'positive_signals',
    'negative_signals',
    'source_scope',
    'intent_type',
    'deliverable_type',
    'quality_tier'
  ];
  const csv1Rows = [csv1Headers.join(',')];
  for (const item of approvedList) {
    const meta = item.queryContext || {};
    csv1Rows.push([
      escapeCsvCell(item.title),
      escapeCsvCell(item.url),
      escapeCsvCell(item.canonicalUrl || item.url),
      escapeCsvCell(item.source),
      escapeCsvCell(item.search_query),
      escapeCsvCell(item.query_count || 1),
      escapeCsvCell(item.preCrawlEval?.score ?? item.score ?? 0),
      escapeCsvCell((item.preCrawlEval?.positiveSignals || []).join('; ')),
      escapeCsvCell((item.preCrawlEval?.negativeSignals || []).join('; ')),
      escapeCsvCell(meta.sourceScope || item.source || 'public_web'),
      escapeCsvCell(meta.intentType || 'buyer_request'),
      escapeCsvCell(meta.deliverableType || 'custom_software'),
      escapeCsvCell(meta.qualityTier || item.priorityTier || 'B')
    ].join(','));
  }

  // 2. CSV 2: Dropped Audit (Every rejected candidate with exact gate and rejection reason)
  const csv2Headers = ['url', 'title', 'source', 'gate', 'rejection_reason', 'timestamp'];
  const csv2Rows = [csv2Headers.join(',')];
  for (const item of droppedCandidates) {
    csv2Rows.push([
      escapeCsvCell(item.url),
      escapeCsvCell(item.title),
      escapeCsvCell(item.source),
      escapeCsvCell(item.gate || item.rejection_stage || 'PRE_CRAWL'),
      escapeCsvCell(item.rejection_reason || item.preCrawlEval?.rejectionReason || 'LOW_SCORE'),
      escapeCsvCell(item.timestamp || item.discovered_at || new Date().toISOString())
    ].join(','));
  }

  // 3. CSV 3: Final Qualified Leads (Only leads that successfully passed full qualification pipeline)
  const csv3Headers = [
    'project_title',
    'canonical_url',
    'client_company',
    'requirements',
    'budget',
    'tech_stack',
    'freshness',
    'contact_information',
    'contact_type',
    'qualification_score',
    'final_confidence',
    'outreach_pitch'
  ];
  const csv3Rows = [csv3Headers.join(',')];
  for (const item of qualifiedProjects) {
    csv3Rows.push([
      escapeCsvCell(item.project_title || item.title),
      escapeCsvCell(item.canonical_url || item.canonicalUrl || item.sourceUrl || item.url),
      escapeCsvCell(item.client_company || item.company_name || 'Individual / Founder'),
      escapeCsvCell(Array.isArray(item.key_requirements) ? item.key_requirements.join('; ') : (item.key_requirements || item.deliverable_summary || '')),
      escapeCsvCell(item.estimated_budget || item.budget_range || 'Not specified'),
      escapeCsvCell(Array.isArray(item.tech_stack) ? item.tech_stack.join(', ') : (item.tech_stack || '')),
      escapeCsvCell(item.freshnessStatus || item.freshness || 'fresh'),
      escapeCsvCell(item.contact_channel || item.contact_value || item.clientEmail || 'none'),
      escapeCsvCell(item.contact_type || 'none'),
      escapeCsvCell(item.qualification_score ?? item.score ?? 70),
      escapeCsvCell(item.final_confidence ?? item.confidence ?? 80),
      escapeCsvCell(item.outreach_pitch || item.outreach_pitch_draft || item.outreachPitchDraft || '')
    ].join(','));
  }

  const files = [
    // Standard names per specification
    { name: 'csv1_pre_network_approved.csv', content: csv1Rows.join('\n') },
    { name: 'csv2_dropped_audit.csv', content: csv2Rows.join('\n') },
    { name: 'csv3_final_qualified_leads.csv', content: csv3Rows.join('\n') },
    // Backward-compatibility aliases
    { name: 'csv1_raw_serp_links.csv', content: csv1Rows.join('\n') },
    { name: 'csv2_in_memory_dropped_links.csv', content: csv2Rows.join('\n') },
    { name: 'csv3_high_intent_network_approved_links.csv', content: csv1Rows.join('\n') },
    { name: 'csv4_valid_accessible_project_pages.csv', content: csv3Rows.join('\n') }
  ];

  for (const file of files) {
    for (const dir of exportDirs) {
      const targetPath = path.join(dir, file.name);
      try {
        fs.writeFileSync(targetPath, file.content, 'utf8');
      } catch (err) {
        console.warn(`⚠️ Failed writing audit CSV to ${targetPath}:`, err.message);
      }
    }
  }
  console.log(`📁 Audit CSVs exported successfully to: ${exportDirs.join(', ')}`);
}

/**
 * GATE 0: Instant Ingestion Sanity Filter (Zero Network, Zero AI, Zero Dedup Cache)
 * Evaluates candidate immediately upon raw SERP/source ingestion.
 * 
 * @param {Object} rawItem - { url, title, snippet, source }
 * @returns {Object} { pass: boolean, gate: 'GATE_0', rejection_reason: string|null, category: string|null }
 */
export function evaluateGate0Sanity(rawItem) {
  const url = (rawItem.url || rawItem.source_url || '').trim();
  const title = (rawItem.title || '').trim();
  const snippet = (rawItem.snippet || rawItem.content || '').trim();
  const fullText = `${title} ${snippet}`;
  const textLower = fullText.toLowerCase();

  // 1. DOMAIN BLACKLIST
  let domain = 'unknown';
  let path = '';
  try {
    const parsed = new URL(url);
    domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    path = parsed.pathname.toLowerCase();
  } catch (e) {
    domain = url.toLowerCase();
  }

  const blacklistedDomains = [
    'dictionary.cambridge.org',
    'merriam-webster.com',
    'thefreedictionary.com',
    'seeking.com',
    'jooble.org',
    'naukri.com',
    'indeed.com',
    'glassdoor.com',
    'workindia.in',
    'workindia.com',
    'monster.com',
    'simplyhired.com',
    'ziprecruiter.com',
    'upwork.com',
    'fiverr.com',
    'freelancer.com',
    'peopleperhour.com',
    'guru.com',
    'toptal.com'
  ];

  if (blacklistedDomains.some(d => domain === d || domain.endsWith('.' + d))) {
    return {
      pass: false,
      gate: 'GATE_0',
      rejection_reason: `BLACKLISTED_DOMAIN: ${domain}`,
      category: 'DOMAIN'
    };
  }

  // LinkedIn Jobs check: linkedin.com/jobs
  if (domain.includes('linkedin.com') && path.startsWith('/jobs')) {
    return {
      pass: false,
      gate: 'GATE_0',
      rejection_reason: 'LINKEDIN_JOBS_BOARD',
      category: 'DOMAIN'
    };
  }

  // 2. URL / PATH PATTERNS
  const forbiddenPathPatterns = [
    /^\/jobs(?:\/|$)/i,
    /^\/job(?:\/|$)/i,
    /^\/careers(?:\/|$)/i,
    /^\/career(?:\/|$)/i,
    /^\/vacancy(?:\/|$)/i,
    /^\/hire(?:\/|$)/i,
    /^\/freelance(?:\/|$)/i,
    /^\/freelancers(?:\/|$)/i,
    /^\/pricing(?:\/|$)/i,
    /^\/features(?:\/|$)/i,
    /^\/docs(?:\/|$)/i,
    /^\/documentation(?:\/|$)/i,
    /^\/blog(?:\/|$)/i,
    /^\/category(?:\/|$)/i,
    /^\/tag(?:\/|$)/i,
    /^\/search(?:\/|$)/i
  ];

  for (const pattern of forbiddenPathPatterns) {
    if (pattern.test(path)) {
      return {
        pass: false,
        gate: 'GATE_0',
        rejection_reason: `FORBIDDEN_PATH_PATTERN: ${path}`,
        category: 'PATH'
      };
    }
  }

  // 3. SUPPLIER / SELF-PITCH SIGNALS
  // Immediate drop for suppliers pitching themselves (freelancer available, looking for clients, portfolio)
  const selfPitchPatterns = [
    /\[for hire\]/i,
    /\bfor hire\b/i,
    /\bseeking work\b/i,
    /\bhire me\b/i,
    /\bmy portfolio\b/i,
    /\bmy services\b/i,
    /\bavailable for freelance\b/i,
    /\bi am a developer\b/i,
    /\bi offer development\b/i,
    /\blooking for clients\b/i,
    /\bfreelancer available\b/i,
    /\bavailable for hire\b/i
  ];

  for (const pattern of selfPitchPatterns) {
    if (pattern.test(fullText)) {
      return {
        pass: false,
        gate: 'GATE_0',
        rejection_reason: `SUPPLIER_SELF_PITCH: ${pattern.toString()}`,
        category: 'SUPPLIER_SELF_PITCH'
      };
    }
  }

  // 4. EMPLOYMENT / CORPORATE JOB SIGNALS (Context-Aware)
  // Contextual check: Do not reject if "salary" or "full-time" appears with clear software project context
  const isSoftwareFeatureSalary = /salary\s*(calculation|module|component|system|slip|calculator|management)/i.test(fullText);
  const isNegatedEmployment = /\b(not\s+(a\s+)?(salaried|full-time|employee|job|w2|employment|in-house)|no\s+(full-time|salaried)\s+(agencies|roles|developers|staff)?|not\s+hiring\s+(employees|staff|in-house))\b/i.test(fullText);

  if (!isSoftwareFeatureSalary && !isNegatedEmployment) {
    const hardEmploymentPatterns = [
      /\bannual salary\b/i,
      /\bctc\s*[:=]\b/i,
      /\bbenefits include\b/i,
      /\byears of experience required\b/i,
      /\bfull[- ]time employee\b/i,
      /\bpermanent role\b/i,
      /\bresume\/cv submission\b/i,
      /\bjoin our team\b/i,
      /\bequal opportunity employer\b/i,
      /\bw2 role\b/i,
      /\bnotice period\b/i
    ];

    for (const pattern of hardEmploymentPatterns) {
      if (pattern.test(fullText)) {
        return {
          pass: false,
          gate: 'GATE_0',
          rejection_reason: `EMPLOYMENT_SIGNAL: ${pattern.toString()}`,
          category: 'EMPLOYMENT'
        };
      }
    }
  }

  return { pass: true, gate: 'GATE_0', rejection_reason: null, category: null };
}

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
  const buyerIntentRegex = /\b(need|needs|looking for|seeking|want to build|looking to outsource|our company|for our business|hiring (an?\s*)?(developer|agency|team|someone|firm)|request for proposal|rfp|scope of work|proposal|budget|quote|vendor|agency|technology partner|looking to hire|need someone who can|seeking agency|want to outsource|need a dev to build|mvp development)\b/i;
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

  // 1.3 Project / Procurement / Commercial Signal (+20)
  const procurementRegex = /\b(request for proposal|rfp|scope of work|statement of work|fixed price|contract project|budget\s*[:=$]|project budget|send proposal|quotation|paid contract|paid project|paid gig|paid|stipend|fee|milestone|invoice|retainer)\b/i;
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
  const contactSignalRegex = /\b(contact\s*(us|me)?|email|dm me|pm me|inbox|send details|reach out|apply at|quote)\b/i;
  if (contactSignalRegex.test(fullText)) {
    score += 10;
    positiveSignals.push('Outreach/Contact signal');
  }

  // Contextual metadata boost from Query Library
  if (context.qualityTier === 'A') {
    score += 5;
    positiveSignals.push('Query Quality Tier A');
  }

  // 2. NEGATIVE SIGNALS (Context-Aware with Negation Safeguard)
  // 2.1 Job / Employment Signal (-50)
  const isFeatureSalary = /salary\s*(calculation|module|component|system|slip)/i.test(fullText);
  const isNegatedEmployment = /\b(not\s+(a\s+)?(salaried|full-time|employee|job|w2|employment|in-house)|no\s+(full-time|salaried)\s+(agencies|roles|developers|staff)?|not\s+hiring\s+(employees|staff|in-house))\b/i.test(fullText);
  
  const employmentRegex = /\b(benefits include|years of experience required|apply at|competitive compensation|submit your application|we offer healthcare|equal opportunity employer|w2 role|notice period|senior\s*(software|react|node|frontend|backend)\s*developer|sde\b|full[- ]?time (job|role|position|employee)|permanent (role|position)|annual ctc|ctc\s*[:=]|[\d.]+\s*lpa|job vacancy|job opening|submit resume|send your cv|join our team|401k|benefits package|\$\d+k salary)\b/i;

  if (!isFeatureSalary && !isNegatedEmployment && employmentRegex.test(fullText)) {
    score -= 50;
    negativeSignals.push('Employment/Salaried job signal');
  }

  // 2.2 Supply-Side Freelancer Self-Pitch Lockout (-50)
  const selfPitchRegex = /\b(i am a developer|my portfolio|for hire|hire me|available for freelance|my agency is looking for clients|offering my services|check out my work|available for new projects|hire our team|we are an agency offering)\b/i;
  if (selfPitchRegex.test(fullText)) {
    score -= 50;
    negativeSignals.push('Supply-side freelancer/agency self-pitch');
  }

  // 2.3 Internship / Trainee (-50)
  if (/\b(intern\b|internship|apprenticeship|trainee|stipend)\b/i.test(fullText)) {
    score -= 50;
    negativeSignals.push('Internship/Trainee signal');
  }

  // 2.4 Educational / Informational Blog (-45)
  const informationalArticleRegex = /\b(why (you|businesses|companies) need|top \d+ reasons|reasons (you|businesses) need|how to (learn|build|use|setup|choose)|guide to|tutorial|course|learn react|documentation|step by step guide|definition of|read our blog)\b/i;
  if (informationalArticleRegex.test(fullText)) {
    score -= 45;
    negativeSignals.push('Informational blog/article/guide');
  }

  // 2.5 Technical Discussion / Comparison (-35)
  const discussionRegex = /\b(ask hn|what is the best|which (framework|stack|library) is better|what do you think of|pros and cons|vs\b|comparison|reddit discussion)\b/i;
  if (discussionRegex.test(fullText)) {
    score -= 35;
    negativeSignals.push('General technical discussion/question');
  }

  // 2.6 Product / Marketing URL Paths (-30)
  const isProductPath = /\/(pricing|features|blog|docs|documentation|about|services|category|tag|author)\b/i.test(url) ||
                        /\b(download (our|the)? (software|app|tool)|features and download|welcome to our (website|software))\b/i.test(fullText);
  if (isProductPath) {
    score -= 30;
    negativeSignals.push('Product homepage or marketing blog path');
  }

  // 2.7 Pure Marketing / Non-IT Gig (-45)
  const isCustomAutomationSoftware = /marketing automation\s*(software|platform|system|tool|app)/i.test(fullText);
  const nonItRegex = /\b(marketing agency|social media marketing|seo agency|copywriter|content writer|virtual assistant|va\b|video editor|manage instagram|reels creator)\b/i;
  if (!isCustomAutomationSoftware && nonItRegex.test(fullText)) {
    score -= 45;
    negativeSignals.push('Non-IT marketing/agency service');
  }

  // 2.8 Blacklisted Domains (-100)
  const domain = (item.sourceDomain || '').toLowerCase();
  const isBlacklisted = domain.includes('merriam-webster') ||
                        domain.includes('wikipedia.org') ||
                        domain.includes('dictionary') ||
                        domain.includes('naukri.com') ||
                        domain.includes('indeed.com') ||
                        domain.includes('glassdoor') ||
                        domain.includes('seeking.com') ||
                        domain.includes('workindia');
  if (isBlacklisted) {
    score -= 100;
    negativeSignals.push(`Blacklisted domain: ${domain}`);
  }

  if (context.crossQueryBoost) {
    score += context.crossQueryBoost;
    positiveSignals.push(`Cross-query corroboration boost (+${context.crossQueryBoost})`);
  }

  // 3. DYNAMIC DUAL-PATH QUALIFICATION EVALUATION
  const hasBuyerNeed = buyerIntentRegex.test(fullText);
  const hasITDeliverable = deliverableRegex.test(fullText);
  const hasActionVerb = actionVerbRegex.test(fullText);
  const hasSeverePenalty = score <= -40 || isBlacklisted;

  const threshold = Number(process.env.PRE_CRAWL_THRESHOLD) || 45;
  const passesScore = score >= threshold;
  // Path B (Strong Intent Override): Catches high-intent founders who omit budget upfront
  const passesStrongIntentOverride = (hasBuyerNeed && hasITDeliverable && hasActionVerb && !hasSeverePenalty);

  const decision = (passesScore || passesStrongIntentOverride) ? 'accept' : 'reject';
  let rejectionReason = null;
  if (decision === 'reject') {
    if (negativeSignals.length > 0) rejectionReason = negativeSignals[0];
    else rejectionReason = 'INSUFFICIENT_BUYER_INTENT_OR_DELIVERABLE';
  }

  let candidateState = 'REJECT';
  if (score >= 70) candidateState = 'HIGH_CONFIDENCE_PROJECT';
  else if (score >= 50 || passesStrongIntentOverride) candidateState = 'PROJECT_CANDIDATE';
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

export function shouldPersistDiscoveryLeads(persistToDb, auditOnly) {
  return Boolean(persistToDb) && !auditOnly;
}

/**
 * Deterministically allocates queries across cycles with remainder distribution
 * Validates integer totalQueries within [100, 300] and non-empty cycles array.
 * 
 * @param {number} totalQueries
 * @param {Array<number>} cycles
 * @returns {Array<number>} batchSize for each cycle summing to totalQueries
 */
export function allocateQueriesAcrossCycles(totalQueries, cycles = [1, 2, 3]) {
  if (!Number.isInteger(totalQueries)) {
    throw new Error(`Invalid totalQueries: must be an integer, received ${totalQueries}`);
  }
  if (totalQueries < 100 || totalQueries > 300) {
    throw new Error(`Invalid totalQueries: must be between 100 and 300 (inclusive), received ${totalQueries}`);
  }
  if (!Array.isArray(cycles) || cycles.length === 0) {
    throw new Error(`Invalid cycles: must be a non-empty array, received ${JSON.stringify(cycles)}`);
  }

  const n = cycles.length;
  const base = Math.floor(totalQueries / n);
  const remainder = totalQueries % n;

  return cycles.map((_, idx) => (idx < remainder ? base + 1 : base));
}

/**
 * Global Crawl Safety Budget for Phase E Multi-Cycle Discovery (P0.1)
 * Enforces strict hard ceiling (default 50) across all cycles combined.
 */
export function createPhaseECrawlBudget(maxCrawls = 50) {
  let totalCrawls = 0;
  return {
    canCrawl() {
      return totalCrawls < maxCrawls;
    },
    recordCrawl() {
      if (totalCrawls >= maxCrawls) return false;
      totalCrawls++;
      return true;
    },
    getCrawlsCount() {
      return totalCrawls;
    },
    getRemaining() {
      return Math.max(0, maxCrawls - totalCrawls);
    },
    getMaxCrawls() {
      return maxCrawls;
    },
    getMetrics() {
      return {
        totalCrawls,
        maxCrawls,
        remaining: Math.max(0, maxCrawls - totalCrawls),
        capHit: totalCrawls >= maxCrawls
      };
    }
  };
}

/**
 * Global Source Diversity Budget for Phase E Multi-Cycle Discovery (P0.2)
 * Enforces cross-cycle domain and community caps:
 * - Public Web: max 3 per root domain
 * - Reddit: max 5 per subreddit, max 12 total
 * - Hacker News: max 10 total
 * - GitHub: max 8 total
 */
export function createPhaseEDiversityBudget() {
  const domainCounts = {};
  const redditSubredditCounts = {};
  let hnCount = 0;
  let ghCount = 0;

  return {
    canAccept(candidate) {
      const url = candidate.final_url || candidate.url;
      const domain = getCandidateRootDomain(url);
      const source = candidate.sourceScope || candidate.source || 'public_web';

      if (source === 'reddit' || domain === 'reddit.com') {
        const sub = getRedditSubreddit(url);
        const subCount = redditSubredditCounts[sub] || 0;
        const totalReddit = Object.values(redditSubredditCounts).reduce((a, b) => a + b, 0);
        return subCount < 5 && totalReddit < 12;
      } else if (source === 'hackernews' || domain === 'ycombinator.com') {
        return hnCount < 10;
      } else if (source === 'github' || domain === 'github.com') {
        return ghCount < 8;
      } else {
        const domCount = domainCounts[domain] || 0;
        return domCount < 3;
      }
    },
    recordAccept(candidate) {
      const url = candidate.final_url || candidate.url;
      const domain = getCandidateRootDomain(url);
      const source = candidate.sourceScope || candidate.source || 'public_web';

      if (source === 'reddit' || domain === 'reddit.com') {
        const sub = getRedditSubreddit(url);
        redditSubredditCounts[sub] = (redditSubredditCounts[sub] || 0) + 1;
      } else if (source === 'hackernews' || domain === 'ycombinator.com') {
        hnCount++;
      } else if (source === 'github' || domain === 'github.com') {
        ghCount++;
      } else {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
    },
    getCounts() {
      return {
        domainCounts: { ...domainCounts },
        redditSubredditCounts: { ...redditSubredditCounts },
        hnCount,
        ghCount
      };
    }
  };
}

export function resolvePhaseDPilotConfig(options = {}) {
  return {
    ...options,
    cycle: 1,
    batchSize: 20,
    days: 30,
    persistToDb: false,
    auditOnly: true
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
    persistToDb = (process.env.PERSIST_TO_DB !== 'false'),
    auditOnly = false
  } = config;

  // Fail-fast validation of persistence configuration (Gap 7)
  validateProductionPersistenceConfig(persistToDb, auditOnly);

  // Safeguards and thresholds
  const preCrawlThreshold = Number(process.env.PRE_CRAWL_THRESHOLD) || 45;
  const maxCrawlsPerQuery = Number(process.env.MAX_CRAWLS_PER_QUERY) || 3;
  const maxTotalCrawlsPerRun = Number(process.env.MAX_TOTAL_CRAWLS_PER_RUN) || 50;

  // Global crawl and diversity budgets across runs/cycles (P0.1, P0.2)
  const crawlBudget = config.crawlBudget || createPhaseECrawlBudget(maxTotalCrawlsPerRun);
  const diversityBudget = config.diversityBudget || createPhaseEDiversityBudget();

  // DB-write safety guard: even if persistToDb is true, auditOnly=true strictly prevents DB writes
  const shouldPersist = shouldPersistDiscoveryLeads(persistToDb, auditOnly);

  console.log('================================================================');
  console.log(`🚀 RUNNING PROJECT DISCOVERY PIPELINE V2 [MODE: ${mode.toUpperCase()}]`);
  console.log(`   Config: Cycle ${cycle} | Batch Size: ${batchSize} | Days: ${days}`);
  console.log(`   Safeguards: Pre-Crawl Threshold: ${preCrawlThreshold} | Max/Query: ${maxCrawlsPerQuery} | Max Run Crawls: ${maxTotalCrawlsPerRun}`);
  console.log(`   Persistence Mode: ${shouldPersist ? 'ACTIVE (Persist to Supabase)' : `AUDIT ONLY (persistToDb=${persistToDb}, auditOnly=${auditOnly} -> DB writes BLOCKED)`}`);
  if (categories) console.log(`   Selected Categories: ${categories.join(', ')}`);
  if (siteFilter) console.log(`   Site Filter: ${siteFilter}`);
  if (location) console.log(`   Target Location: ${location}`);
  console.log('================================================================\n');

  const rotator = new QueryRotatorService({
    days,
    batchSize,
    cycle,
    categories,
    siteFilter,
    location,
    mode,
    sourceMetrics: config.sourceMetrics
  });
  const searchQueries = rotator.getQueriesForCycle({
    mode,
    batchSize,
    sourceMetrics: config.sourceMetrics
  });

  if (config.dryRun) {
    return {
      mode,
      cycle,
      days,
      batchSize: searchQueries.length,
      persistToDb,
      auditOnly,
      shouldPersist,
      queries: searchQueries
    };
  }

  console.log(`📋 Selected ${searchQueries.length} balanced prioritized queries [Mode: ${mode}]:`);
  searchQueries.forEach((q, i) => console.log(`   ${i + 1}. [${q.priority}|${q.intentType || 'gen'}|${q.qualityTier || 'A'}] ${q.query}`));
  console.log('');

  const searchManager = new MultiSearchManager();
  const contentExtractor = new ContentExtractor();
  // Shared Canonical Deduplicator support across multi-cycle runs (Gap 4)
  const canonicalDeduplicator = config.canonicalDeduplicator || new CanonicalDeduplicator();
  const initialRawResults = canonicalDeduplicator.getMetrics().rawResults;
  const classifier = config.classifier || new ProjectClassifier({
    strictContactRequirement: false,
    finalConfidenceThreshold: Number(process.env.FINAL_CONFIDENCE_THRESHOLD) || 70,
    maxDays: days
  });

  const maxRawLimit = config.maxRawLimit || 150;
  const rawCandidatePool = [];
  const droppedCandidates = [];
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

  let totalRawResultsIngested = 0;
  let gate0PassedCount = 0;
  let gate0RejectedCount = 0;

  function ingestCandidate(rawItem, queryContext = {}) {
    totalRawResultsIngested++;
    if (rawCandidatePool.length >= maxRawLimit) return;
    trackFound(rawItem.search_query, rawItem.source);

    // GATE 0: Instant Ingestion Sanity Filter (Zero Network, Zero AI, Zero Dedup Cache)
    const gate0Verdict = evaluateGate0Sanity(rawItem);
    if (!gate0Verdict.pass) {
      gate0RejectedCount++;
      droppedCandidates.push({
        url: rawItem.url || rawItem.source_url,
        title: rawItem.title,
        source: rawItem.source,
        gate: 'GATE_0',
        rejection_reason: gate0Verdict.rejection_reason,
        timestamp: rawItem.discovered_at || new Date().toISOString()
      });
      const stat = queryStatsMap.get(rawItem.search_query);
      if (stat) {
        stat.rejected++;
        stat.rejectionReasons[gate0Verdict.rejection_reason] = (stat.rejectionReasons[gate0Verdict.rejection_reason] || 0) + 1;
      }
      return;
    }

    gate0PassedCount++;

    // Pre-Classification Canonical Deduplication (Executed ONLY on candidates passing Gate 0)
    const check = canonicalDeduplicator.checkUrlCandidate(rawItem);
    if (check.isDuplicate) {
      droppedCandidates.push({
        url: rawItem.url || rawItem.source_url,
        title: rawItem.title,
        source: rawItem.source,
        gate: 'DEDUP',
        rejection_reason: 'DUPLICATE_CANONICAL_URL',
        timestamp: rawItem.discovered_at || new Date().toISOString()
      });
      return;
    }

    const stat = queryStatsMap.get(rawItem.search_query);
    if (stat) stat.uniqueResults++;

    rawCandidatePool.push({
      ...rawItem,
      canonicalUrl: check.canonicalUrl || rawItem.url,
      canonicalId: check.canonicalId || null,
      queryContext
    });
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
    if (rawCandidatePool.length >= maxRawLimit) break;
    const queryStr = item.query;
    try {
      const { provider, results, quality, fallbackOccurred } = await searchManager.searchWithFallback(queryStr, {
        timeRange: 'month',
        limit: 8,
        enrich: item.priority === 'HIGH' && item.qualityTier === 'A'
      });

      for (const r of results) {
        if (rawCandidatePool.length >= maxRawLimit) break;
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
  // 5. STEP 1 & 2: CHEAP URL FILTER & IN-MEMORY PRE-CRAWL INTENT SCORING
  // Runs ZERO-NETWORK pre-filtering first before sending any HTTP link health pings
  // -------------------------------------------------------------
  console.log(`\n🧠 Running In-Memory Pre-Crawl Intent Scoring on ${rawCandidatePool.length} raw candidates...`);
  const candidateStateCounts = {
    HIGH_CONFIDENCE_PROJECT: 0,
    PROJECT_CANDIDATE: 0,
    REVIEW: 0,
    REJECT: 0
  };
  let totalPreFilterAccepted = 0;
  let totalPreFilterRejected = 0;
  const scoredCandidates = [];

  for (const item of rawCandidatePool) {
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
      droppedCandidates.push(item);
      if (stat) {
        stat.preFilterRejected++;
        const r = evalResult.rejectionReason || 'LOW_SCORE';
        stat.rejectionReasons[r] = (stat.rejectionReasons[r] || 0) + 1;
      }
    }
  }

  console.log(`   -> Pre-Filter Accepted: ${totalPreFilterAccepted} | Pre-Filter Rejected (Dropped In-Memory): ${totalPreFilterRejected}`);
  console.log(`   -> Candidate States: HIGH_CONFIDENCE: ${candidateStateCounts.HIGH_CONFIDENCE_PROJECT} | CANDIDATE: ${candidateStateCounts.PROJECT_CANDIDATE} | REVIEW: ${candidateStateCounts.REVIEW} | REJECT: ${candidateStateCounts.REJECT}`);

  // -------------------------------------------------------------
  // 6. STEP 3: GLOBAL RANKING & CROSS-CYCLE DIVERSITY BUDGET ALLOCATION
  // -------------------------------------------------------------
  console.log(`\n📊 Global Candidate Ranking & Diversity Allocation across ${scoredCandidates.length} high-intent candidates...`);

  // Sort globally by intent score descending
  scoredCandidates.sort((a, b) => b.preCrawlEval.score - a.preCrawlEval.score);

  const approvedForVerification = [];
  const queryCrawlCounts = new Map();
  let crawlCapRejectedByQuery = 0;
  let crawlCapRejectedByDiversity = 0;

  for (const candidate of scoredCandidates) {
    if (!crawlBudget.canCrawl()) break;

    // Per-Query Crawl Cap Enforcement (Gap 3)
    const qStr = candidate.search_query || 'unknown';
    const currentQueryCrawls = queryCrawlCounts.get(qStr) || 0;
    if (currentQueryCrawls >= maxCrawlsPerQuery) {
      crawlCapRejectedByQuery++;
      candidate.preCrawlEval.rejectionReason = 'QUERY_CRAWL_CAP_REACHED';
      droppedCandidates.push(candidate);
      const stat = queryStatsMap.get(qStr);
      if (stat) {
        stat.rejectionReasons['QUERY_CRAWL_CAP_REACHED'] = (stat.rejectionReasons['QUERY_CRAWL_CAP_REACHED'] || 0) + 1;
      }
      continue;
    }

    // Cross-Cycle Diversity Cap Enforcement (P0.2)
    if (!diversityBudget.canAccept(candidate)) {
      crawlCapRejectedByDiversity++;
      candidate.preCrawlEval.rejectionReason = 'DIVERSITY_CAP_REACHED';
      droppedCandidates.push(candidate);
      continue;
    }

    diversityBudget.recordAccept(candidate);
    queryCrawlCounts.set(qStr, currentQueryCrawls + 1);
    approvedForVerification.push(candidate);
  }

  console.log(`   -> High-Intent Candidates Approved for Network Verification: ${approvedForVerification.length} (Global Cap: ${crawlBudget.getMaxCrawls()} | Per-Query Rejections: ${crawlCapRejectedByQuery} | Diversity Rejections: ${crawlCapRejectedByDiversity})`);

  // -------------------------------------------------------------
  // 7. STEP 4 & 5: LINK HEALTH + PAGE VALIDITY VERIFICATION GATE
  // Executed ONLY on pre-filtered, high-intent candidates (zero network waste)
  // -------------------------------------------------------------
  console.log(`\n🛡️ Running Link Health & Page Validity Gate ONLY on ${approvedForVerification.length} high-intent candidates...`);

  const linkHealthChecked = approvedForVerification.length;
  let linkHealthPassed = 0;
  let linkHealthFailed = 0;
  let pageValidityChecked = 0;
  let pageValidityPassed = 0;
  let pageValidityFailed = 0;
  let pageFetchAttempts = 0;
  let pageFetchSuccesses = 0;
  let pageFetchFailures = 0;
  let verificationCacheHits = 0;
  let verificationCacheMisses = 0;
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
            rejection_reason: 'VERIFICATION_EXCEPTION',
            verificationTelemetry: {
              cacheHit: false,
              linkHealthFetchAttempted: true,
              pageFetchAttempted: false,
              pageFetchSucceeded: false,
              pageFetchFailed: false
            }
          };
        }
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  const gateResults = await verifyCandidatePool(approvedForVerification, 6);

  for (let i = 0; i < approvedForVerification.length; i++) {
    const item = approvedForVerification[i];
    const gateRes = gateResults[i];
    const stat = queryStatsMap.get(item.search_query);

    if (!gateRes) continue;

    // Extract explicit telemetry from gate result
    const telem = gateRes.verificationTelemetry || {
      cacheHit: Boolean(gateRes.fromCache),
      linkHealthFetchAttempted: !gateRes.fromCache,
      pageFetchAttempted: !gateRes.fromCache && Boolean(gateRes.healthReport?.is_accessible),
      pageFetchSucceeded: !gateRes.fromCache && Boolean(gateRes.candidate?.pageContentPreview || gateRes.pass),
      pageFetchFailed: !gateRes.fromCache && !gateRes.pass && gateRes.rejection_reason === 'PAGE_CONTENT_FETCH_FAILED'
    };

    if (telem.cacheHit) {
      verificationCacheHits++;
    } else {
      verificationCacheMisses++;
    }

    // Cached verification must NOT count as a new page fetch attempt
    if (telem.pageFetchAttempted) {
      pageFetchAttempts++;
      if (telem.pageFetchSucceeded) {
        pageFetchSuccesses++;
      }
      if (telem.pageFetchFailed) {
        pageFetchFailures++;
      }
    }

    // Check Link Health
    if (gateRes.healthReport && gateRes.healthReport.is_accessible) {
      linkHealthPassed++;
      // Gate 2: Page Validity was evaluated
      pageValidityChecked++;

      if (gateRes.validityReport && gateRes.validityReport.page_valid) {
        pageValidityPassed++;
        verifiedCandidatePool.push({
          ...item,
          final_url: gateRes.candidate?.final_url || item.url,
          link_health_status: gateRes.candidate?.link_health_status,
          page_type: gateRes.candidate?.page_type,
          verificationGate: gateRes
        });
      } else {
        pageValidityFailed++;
        const reason = gateRes.rejection_reason || 'INSUFFICIENT_PAGE_CONTENT';
        verificationRejections[reason] = (verificationRejections[reason] || 0) + 1;
        droppedCandidates.push({
          url: item.url || item.source_url,
          title: item.title,
          source: item.source,
          gate: 'PAGE_VALIDITY',
          rejection_reason: reason,
          timestamp: item.discovered_at || new Date().toISOString()
        });
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
      droppedCandidates.push({
        url: item.url || item.source_url,
        title: item.title,
        source: item.source,
        gate: 'HTTP',
        rejection_reason: reason,
        timestamp: item.discovered_at || new Date().toISOString()
      });
      if (stat) {
        stat.preFilterRejected++;
        stat.rejectionReasons[reason] = (stat.rejectionReasons[reason] || 0) + 1;
      }
    }
  }

  console.log(`   -> Link Health: Checked: ${linkHealthChecked} | Passed: ${linkHealthPassed} | Failed: ${linkHealthFailed}`);
  console.log(`   -> Page Validity: Checked: ${pageValidityChecked} | Passed: ${pageValidityPassed} | Failed: ${pageValidityFailed}`);
  console.log(`   -> Page Fetch: Attempts: ${pageFetchAttempts} | Successes: ${pageFetchSuccesses} | Failures: ${pageFetchFailures}`);
  console.log(`   -> Verification Cache: Hits: ${verificationCacheHits} | Misses: ${verificationCacheMisses}`);
  console.log(`   -> Candidates Surviving Verification Gate: ${verifiedCandidatePool.length}`);

  // -------------------------------------------------------------
  // 8. STEP 6: SELECTIVE DEEP CRAWL & CONTENT FINGERPRINT DEDUPLICATION
  // -------------------------------------------------------------
  console.log(`\n🔍 Selectively Deep Crawling ${verifiedCandidatePool.length} verified candidate URLs...`);
  const enrichedCandidates = [];
  let extractionFailures = 0;

  for (const item of verifiedCandidatePool) {
    if (!crawlBudget.canCrawl()) break;
    crawlBudget.recordCrawl();

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
        } else {
          droppedCandidates.push({
            url: item.url || item.source_url,
            title: item.title,
            source: item.source,
            gate: 'DEDUP',
            rejection_reason: 'DUPLICATE_CONTENT_FINGERPRINT',
            timestamp: item.discovered_at || new Date().toISOString()
          });
        }
      } else {
        extractionFailures++;
        droppedCandidates.push({
          url: item.url || item.source_url,
          title: item.title,
          source: item.source,
          gate: 'DEEP_CRAWL',
          rejection_reason: 'EXTRACTION_EMPTY_CONTENT',
          timestamp: item.discovered_at || new Date().toISOString()
        });
      }
    } catch (err) {
      extractionFailures++;
      droppedCandidates.push({
        url: item.url || item.source_url,
        title: item.title,
        source: item.source,
        gate: 'DEEP_CRAWL',
        rejection_reason: `EXTRACTION_EXCEPTION: ${err.message}`,
        timestamp: item.discovered_at || new Date().toISOString()
      });
    }
  }

  console.log(`✨ ${enrichedCandidates.length} successfully extracted candidates sent to 9-Gate Classifier.`);

  // -------------------------------------------------------------
  // 9. STEP 7: QUALIFICATION VIA 9-GATE ENGINE & POST-QUALIFICATION LLM SYNTHESIS
  // -------------------------------------------------------------
  const qualifiedProjects = [];
  const contactableProjects = [];
  const rejectionReasons = {};
  let gate8Duplicates = 0;

  for (const candidate of enrichedCandidates) {
    const result = await classifier.qualifyAndExtract(candidate);
    const qStat = queryStatsMap.get(candidate.search_query);

    // Retain all qualified projects without destroying qualified uncontactable leads (Gap 5)
    if (result.qualification_status === 'qualified') {
      result.freshnessStatus = candidate.freshnessStatus || 'fresh';
      result.status = candidate.freshnessStatus === 'archive' ? 'archive' : 'active';
      result.search_query = candidate.search_query;
      result.search_source = candidate.search_source;

      qualifiedProjects.push(result);
      if (qStat) qStat.qualified++;

      if (result.has_actionable_contact) {
        contactableProjects.push(result);
        if (qStat) qStat.contactable++;
      }

      console.log(`🌟 [QUALIFIED] [${result.source.toUpperCase()}] ${result.title.substring(0, 70)}`);
      console.log(`   -> Executive Summary: ${result.executive_summary || result.short_summary || 'N/A'}`);
      console.log(`   -> Outreach Pitch: ${result.outreach_pitch_draft ? result.outreach_pitch_draft.substring(0, 90) + '...' : 'N/A'}`);
      console.log(`   -> Contact: ${result.contact_type} (${result.contact_value || result.clientEmail || 'none'}) | Actionable: ${Boolean(result.has_actionable_contact)}`);
      console.log(`   -> Link: ${result.sourceUrl}\n`);
    } else {
      const reason = result.rejection_reason || 'UNQUALIFIED';
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      if (reason === 'DUPLICATE') gate8Duplicates++;
      if (qStat) qStat.rejected++;
      droppedCandidates.push({
        url: candidate.url || candidate.sourceUrl || candidate.search_result_url,
        title: candidate.title,
        source: candidate.source,
        gate: result.rejection_gate || 'QUALIFICATION',
        rejection_reason: reason,
        timestamp: candidate.discovered_at || new Date().toISOString()
      });
    }
  }

  const dedupMetrics = canonicalDeduplicator.getMetrics();
  const finalUniqueCandidates = enrichedCandidates.length - gate8Duplicates;

  // Crawl reduction rate diagnostic
  const totalEvaluated = rawCandidatePool.length;
  const crawlReductionRate = totalEvaluated > 0
    ? `${((1 - (approvedForVerification.length / totalEvaluated)) * 100).toFixed(1)}%`
    : '0.0%';

  // -------------------------------------------------------------
  // 8. STRUCTURED FUNNEL METRICS REPORT
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log(`📊 COMPLETE RETRIEVAL FUNNEL & EFFICIENCY METRICS [MODE: ${mode.toUpperCase()}]:`);
  console.log(`   Raw Results Ingested             : ${totalRawResultsIngested}`);
  console.log(`   Gate 0 Sanity Passed             : ${gate0PassedCount}`);
  console.log(`   Gate 0 Sanity Rejected           : ${gate0RejectedCount}`);
  console.log(`   Canonical Unique Candidates      : ${totalEvaluated}`);
  console.log(`   Pre-Crawl Intent Accepted        : ${totalPreFilterAccepted}`);
  console.log(`   Pre-Crawl Intent Rejected        : ${totalPreFilterRejected}`);
  console.log(`   Approved for Verification        : ${approvedForVerification.length}`);
  console.log(`   Link Health Checked / Passed     : ${linkHealthChecked} / ${linkHealthPassed} (Failed: ${linkHealthFailed})`);
  console.log(`   Page Validity Checked / Passed   : ${pageValidityChecked} / ${pageValidityPassed} (Failed: ${pageValidityFailed})`);
  console.log(`   Verification Cache Hits / Misses : ${verificationCacheHits} / ${verificationCacheMisses}`);
  console.log(`   Candidate State Breakdown        :`, candidateStateCounts);
  console.log(`   Crawl Cap Rejected (Per-Query)   : ${crawlCapRejectedByQuery}`);
  console.log(`   Deep Crawled (Promising URLs)    : ${verifiedCandidatePool.length}`);
  console.log(`   Extraction Failures              : ${extractionFailures}`);
  console.log(`   Candidates Entering Classifier   : ${enrichedCandidates.length}`);
  console.log(`   Gate 8 Semantic Duplicates       : ${gate8Duplicates}`);
  console.log(`   Final Qualified Projects         : ${qualifiedProjects.length}`);
  console.log(`   Contactable Leads Verified       : ${contactableProjects.length}`);
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
  // 9. DATABASE PERSISTENCE (Auditable with PERSIST_TO_DB & auditOnly)
  // -------------------------------------------------------------
  let persistenceResult = { attempted: false, success: true, inserted: 0, updated: 0, total: 0, error: null };
  if (shouldPersist && qualifiedProjects.length > 0) {
    console.log(`💾 Persisting ${qualifiedProjects.length} qualified leads into Database...`);
    const dbRes = await saveMasterProjects(qualifiedProjects);
    persistenceResult = {
      attempted: true,
      success: Boolean(dbRes.success),
      inserted: dbRes.inserted || 0,
      updated: dbRes.updated || 0,
      total: dbRes.total || 0,
      error: dbRes.error || null
    };
    if (dbRes.success) {
      console.log(`✅ Supabase Database updated! Inserted: ${dbRes.inserted}, Updated: ${dbRes.updated}, Total: ${dbRes.total}`);
    } else {
      console.error(`❌ Supabase Database update FAILED: ${dbRes.error}`);
    }
  } else if (!shouldPersist && qualifiedProjects.length > 0) {
    console.log(`🔍 [AUDIT RUN] Persistence disabled (persistToDb=${persistToDb}, auditOnly=${auditOnly}). Generated ${qualifiedProjects.length} qualified leads without modifying DB.`);
  }

  exportFunnelAuditCSVs({
    preNetworkApprovedCandidates: scoredCandidates,
    rawCandidatePool,
    droppedCandidates,
    highIntentApprovedCandidates: approvedForVerification,
    qualifiedProjects
  });

  return {
    mode,
    cycle,
    projects: qualifiedProjects,
    contactableProjects,
    persistence: persistenceResult,
    metrics: {
      rawResults: totalRawResultsIngested || (dedupMetrics.rawResults - initialRawResults),
      cumulativeRawResults: dedupMetrics.rawResults,
      gate0Passed: gate0PassedCount,
      gate0Rejected: gate0RejectedCount,
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
      verificationCacheHits,
      verificationCacheMisses,
      candidateStates: candidateStateCounts,
      preFilterAccepted: totalPreFilterAccepted,
      preFilterRejected: totalPreFilterRejected,
      crawlCapRejectedByQuery,
      deepCrawled: verifiedCandidatePool.length,
      extractionFailures,
      candidatesEnteringClassifier: enrichedCandidates.length,
      gate8Duplicates,
      finalUniqueCandidates,
      qualifiedProjects: qualifiedProjects.length,
      contactableProjects: contactableProjects.length,
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
 * Guarantees cycle=1, batchSize=20, days=30, persistToDb=false, auditOnly=true
 * Callers CANNOT override these locked values.
 */
export async function runPhaseDPilot(options = {}) {
  clearVerificationCache();
  console.log('🏁 [PHASE D PILOT] Initializing 1 controlled cycle of exactly 20 queries (Audit Mode, 0 DB persistence)...');
  const lockedConfig = resolvePhaseDPilotConfig(options);
  return runFullDiscoveryPipeline(lockedConfig);
}

/**
 * PHASE E: Scaled Multi-Cycle Production Discovery Runner
 * Supports running across cycles 1, 2, and 3 (scaled batch: 100 - 300 queries).
 * Supports AUDIT mode (auditOnly=true, persistToDb=false) and
 * PRODUCTION mode (persistToDb=true, auditOnly=false) which writes qualified leads to Supabase.
 * 
 * @param {Object} options - { totalQueries: 100, cycles: [1, 2, 3], persistToDb: false, auditOnly: true, dryRun: false, ... }
 * @returns {Promise<Object>} Aggregated run results and funnel metrics across all cycles
 */
export async function runProductionScaledDiscovery(options = {}) {
  const {
    totalQueries = 100,
    cycles = [1, 2, 3],
    days = 30,
    persistToDb = false,
    auditOnly = true,
    dryRun = false,
    mode = DISCOVERY_MODE.STANDARD
  } = options;

  // Clear verification cache before starting scaled run (P1.6)
  clearVerificationCache();

  // Fail-fast environment validation (Gap 7)
  validateProductionPersistenceConfig(persistToDb, auditOnly);

  // Exact query allocation across cycles with remainder distribution (Gap 1)
  const cycleBatchSizes = allocateQueriesAcrossCycles(totalQueries, cycles);

  // Global shared crawl safety and diversity budgets across all cycles (P0.1, P0.2)
  const sharedCrawlBudget = options.crawlBudget || createPhaseECrawlBudget(Number(process.env.MAX_TOTAL_CRAWLS_PER_RUN) || 50);
  const sharedDiversityBudget = options.diversityBudget || createPhaseEDiversityBudget();

  console.log('================================================================');
  console.log(`🚀 [PHASE E] PRODUCTION SCALED DISCOVERY RUNNER`);
  console.log(`   Target Queries: ${totalQueries} (Distribution: ${cycleBatchSizes.join(', ')}) | Cycles: ${cycles.join(', ')} | Days: ${days}`);
  console.log(`   Safeguards: Global Deep Crawl Ceiling: ${sharedCrawlBudget.getMaxCrawls()}`);
  console.log(`   Persistence Mode: ${persistToDb && !auditOnly ? 'ACTIVE (Supabase DB writes ENABLED)' : 'AUDIT ONLY (DB writes BLOCKED)'}`);
  console.log('================================================================\n');

  // Shared Canonical Deduplicator across all Phase E cycles (Gap 4)
  const sharedCanonicalDeduplicator = options.canonicalDeduplicator || new CanonicalDeduplicator();

  // Adaptive source metrics feedback accumulator (Gap 2)
  const cumulativeSourceMetrics = {
    reddit: { actionableProjects: 0, processed: 0 },
    hackernews: { actionableProjects: 0, processed: 0 },
    public_web: { actionableProjects: 0, processed: 0 }
  };

  function normalizeSourceKey(src = '') {
    const s = String(src).toLowerCase();
    if (s.includes('reddit')) return 'reddit';
    if (s.includes('hacker') || s.includes('hn')) return 'hackernews';
    return 'public_web';
  }

  const cycleResults = [];
  const allQualifiedProjects = [];
  const allContactableProjects = [];
  const aggregatedMetrics = {
    totalQueriesExecuted: 0,
    rawResults: 0,
    uniqueResults: 0,
    linkHealthChecked: 0,
    linkHealthPassed: 0,
    linkHealthFailed: 0,
    pageValidityChecked: 0,
    pageValidityPassed: 0,
    pageValidityFailed: 0,
    pageFetchAttempts: 0,
    pageFetchSuccesses: 0,
    pageFetchFailures: 0,
    verificationCacheHits: 0,
    verificationCacheMisses: 0,
    crawlCapRejectedByQuery: 0,
    deepCrawled: 0,
    qualifiedProjects: 0,
    contactableProjects: 0,
    phaseECrawlBudget: sharedCrawlBudget.getMetrics(),
    diversityCounts: sharedDiversityBudget.getCounts()
  };

  for (let i = 0; i < cycles.length; i++) {
    const cycleNum = cycles[i];
    const batchSize = cycleBatchSizes[i];

    // Compute and log adaptive source quotas before each cycle (Gap 2)
    const currentQuotas = QueryRotatorService.calculateSourceQuotas(cumulativeSourceMetrics, batchSize);
    console.log(`[PHASE E] Source allocation before Cycle ${cycleNum}:`, JSON.stringify(cumulativeSourceMetrics));
    console.log(`[PHASE E] Source quotas for Cycle ${cycleNum}:`, JSON.stringify(currentQuotas));

    console.log(`\n--- Executing Cycle ${cycleNum} (${batchSize} queries) ---`);
    const cycleRes = await runFullDiscoveryPipeline({
      ...options,
      cycle: cycleNum,
      batchSize,
      days,
      persistToDb,
      auditOnly,
      dryRun,
      mode,
      canonicalDeduplicator: sharedCanonicalDeduplicator,
      crawlBudget: sharedCrawlBudget,
      diversityBudget: sharedDiversityBudget,
      sourceMetrics: { ...cumulativeSourceMetrics }
    });

    cycleResults.push(cycleRes);

    if (dryRun) {
      aggregatedMetrics.totalQueriesExecuted += (cycleRes.queries?.length || batchSize);
      continue;
    }

    // Accumulate source performance feedback from cycle
    for (const item of (cycleRes.queryBreakdown || [])) {
      const key = normalizeSourceKey(item.source);
      cumulativeSourceMetrics[key].processed += (item.rawResults || item.uniqueResults || 0);
      cumulativeSourceMetrics[key].actionableProjects += (item.contactable || item.qualified || 0);
    }

    if (cycleRes.projects && cycleRes.projects.length > 0) {
      allQualifiedProjects.push(...cycleRes.projects);
    }
    if (cycleRes.contactableProjects && cycleRes.contactableProjects.length > 0) {
      allContactableProjects.push(...cycleRes.contactableProjects);
    }

    if (cycleRes.metrics) {
      aggregatedMetrics.totalQueriesExecuted += batchSize;
      aggregatedMetrics.rawResults += cycleRes.metrics.rawResults || 0;
      aggregatedMetrics.uniqueResults += cycleRes.metrics.uniqueResults || 0;
      aggregatedMetrics.linkHealthChecked += cycleRes.metrics.linkHealthChecked || 0;
      aggregatedMetrics.linkHealthPassed += cycleRes.metrics.linkHealthPassed || 0;
      aggregatedMetrics.linkHealthFailed += cycleRes.metrics.linkHealthFailed || 0;
      aggregatedMetrics.pageValidityChecked += cycleRes.metrics.pageValidityChecked || 0;
      aggregatedMetrics.pageValidityPassed += cycleRes.metrics.pageValidityPassed || 0;
      aggregatedMetrics.pageValidityFailed += cycleRes.metrics.pageValidityFailed || 0;
      aggregatedMetrics.pageFetchAttempts += cycleRes.metrics.pageFetchAttempts || 0;
      aggregatedMetrics.pageFetchSuccesses += cycleRes.metrics.pageFetchSuccesses || 0;
      aggregatedMetrics.pageFetchFailures += cycleRes.metrics.pageFetchFailures || 0;
      aggregatedMetrics.verificationCacheHits += cycleRes.metrics.verificationCacheHits || 0;
      aggregatedMetrics.verificationCacheMisses += cycleRes.metrics.verificationCacheMisses || 0;
      aggregatedMetrics.crawlCapRejectedByQuery += cycleRes.metrics.crawlCapRejectedByQuery || 0;
      aggregatedMetrics.deepCrawled += cycleRes.metrics.deepCrawled || 0;
      aggregatedMetrics.qualifiedProjects += cycleRes.metrics.qualifiedProjects || 0;
      aggregatedMetrics.contactableProjects += cycleRes.metrics.contactableProjects || 0;
    }
    aggregatedMetrics.phaseECrawlBudget = sharedCrawlBudget.getMetrics();
    aggregatedMetrics.diversityCounts = sharedDiversityBudget.getCounts();
  }

  // Authoritative total raw results directly from shared deduplicator (prevents multi-cycle sum drift)
  aggregatedMetrics.rawResults = sharedCanonicalDeduplicator.getMetrics().rawResults;

  const overallCrawlReductionRate = aggregatedMetrics.uniqueResults > 0
    ? `${((1 - (aggregatedMetrics.deepCrawled / aggregatedMetrics.uniqueResults)) * 100).toFixed(1)}%`
    : '0.0%';

  let persistenceStatus = 'NOT_ATTEMPTED';
  let overallStatus = 'COMPLETED';
  if (persistToDb && !auditOnly) {
    const attemptedCycles = cycleResults.filter(cr => cr.persistence && cr.persistence.attempted);
    const anyFailed = attemptedCycles.some(cr => !cr.persistence.success);
    if (anyFailed) {
      persistenceStatus = 'PERSISTENCE_FAILURE';
      overallStatus = allQualifiedProjects.length > 0 ? 'PARTIAL_SUCCESS' : 'PERSISTENCE_FAILURE';
    } else {
      persistenceStatus = `PERSISTED_TO_SUPABASE (${allQualifiedProjects.length} leads)`;
      overallStatus = 'COMPLETED';
    }
  } else {
    persistenceStatus = 'AUDIT_ONLY (0 DB mutations)';
  }

  console.log('\n================================================================');
  console.log(`🏁 [PHASE E COMPLETE] AGGREGATED PRODUCTION DISCOVERY METRICS:`);
  console.log(`   Status                           : ${overallStatus}`);
  console.log(`   Cycles Executed                  : ${cycles.join(', ')}`);
  console.log(`   Total Queries Run                : ${aggregatedMetrics.totalQueriesExecuted}`);
  console.log(`   Total Raw Results                : ${aggregatedMetrics.rawResults}`);
  console.log(`   Total Unique Results             : ${aggregatedMetrics.uniqueResults}`);
  console.log(`   Link Health Checked / Passed     : ${aggregatedMetrics.linkHealthChecked} / ${aggregatedMetrics.linkHealthPassed}`);
  console.log(`   Page Validity Checked / Passed   : ${aggregatedMetrics.pageValidityChecked} / ${aggregatedMetrics.pageValidityPassed}`);
  console.log(`   Crawl Cap Rejected (Per-Query)   : ${aggregatedMetrics.crawlCapRejectedByQuery}`);
  console.log(`   Total Deep Crawled               : ${aggregatedMetrics.deepCrawled} (Crawl Reduction: ${overallCrawlReductionRate})`);
  console.log(`   Total Qualified Leads Found      : ${aggregatedMetrics.qualifiedProjects}`);
  console.log(`   Actionable Contactable Leads     : ${aggregatedMetrics.contactableProjects}`);
  console.log(`   Persistence Status               : ${persistenceStatus}`);
  console.log('================================================================\n');

  return {
    status: overallStatus,
    persistenceStatus,
    mode,
    totalQueries,
    cycles,
    persistToDb: Boolean(persistToDb && !auditOnly),
    auditOnly,
    projects: allQualifiedProjects,
    contactableProjects: allContactableProjects,
    aggregatedMetrics,
    cycleResults
  };
}

if (process.argv[1]?.endsWith('runSearchAndDirectDiscovery.js')) {
  const isPilot = process.argv.includes('--pilot') || process.argv.includes('--phase-d');
  const isScale = process.argv.includes('--scale') || process.argv.includes('--phase-e') || process.argv.includes('--production');
  const shouldPersist = process.argv.includes('--persist');

  if (isPilot) {
    runPhaseDPilot()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Fatal Discovery Pipeline Error:', err);
        process.exit(1);
      });
  } else if (isScale) {
    const scaleArgIdx = process.argv.indexOf('--scale');
    let totalQueries = 100;
    if (scaleArgIdx !== -1 && process.argv[scaleArgIdx + 1] && !process.argv[scaleArgIdx + 1].startsWith('--')) {
      const parsed = parseInt(process.argv[scaleArgIdx + 1], 10);
      if (!isNaN(parsed) && parsed > 0) totalQueries = parsed;
    }

    runProductionScaledDiscovery({
      totalQueries,
      cycles: [1, 2, 3],
      days: 30,
      persistToDb: shouldPersist,
      auditOnly: !shouldPersist
    })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Fatal Scaled Discovery Error:', err);
        process.exit(1);
      });
  } else {
    runFullDiscoveryPipeline({ cycle: 1, batchSize: 20, days: 30, persistToDb: shouldPersist, auditOnly: !shouldPersist })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Fatal Discovery Pipeline Error:', err);
        process.exit(1);
      });
  }
}
