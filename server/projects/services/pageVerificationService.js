/**
 * LeadSpy Link Health + Page Validity Verification Service
 * File: server/projects/services/pageVerificationService.js
 * 
 * Implements a strict HARD PRE-CRAWL GATE between Canonical Deduplication and Project Intent Scoring.
 * Prevents dead, unreachable, login-walled, deleted, or static pages from entering the deep-crawl queue.
 * 
 * Strictly separated concepts:
 * 1. LINK_HEALTH: URL network & HTTP accessibility (ACTIVE, REDIRECTED, DEAD, UNREACHABLE, BLOCKED, RATE_LIMITED)
 * 2. PAGE_VALIDITY: Content type & availability (PROJECT_POST, PROJECT_PAGE, FORUM_POST, INCONCLUSIVE, LOGIN_PAGE, STATIC_PAGE, ERROR_PAGE, DICTIONARY_WIKI)
 * 3. PROJECT_STATUS: Lifecycle status of project (ACTIVE_PROJECT, POSSIBLY_CLOSED, COMPLETED) - downstream check
 * 4. CONTACTABILITY: Actionable outreach routes (EMAIL, PUBLIC_PROFILE_MESSAGE, etc.) - downstream check
 */

export const LINK_HEALTH_STATUS = {
  ACTIVE: 'ACTIVE',
  REDIRECTED: 'REDIRECTED',
  DEAD: 'DEAD',
  UNREACHABLE: 'UNREACHABLE',
  BLOCKED: 'BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN'
};

export const PAGE_TYPE = {
  PROJECT_POST: 'PROJECT_POST',
  PROJECT_PAGE: 'PROJECT_PAGE',
  FORUM_POST: 'FORUM_POST',
  RFP: 'RFP',
  INCONCLUSIVE: 'INCONCLUSIVE',
  LOGIN_PAGE: 'LOGIN_PAGE',
  STATIC_PAGE: 'STATIC_PAGE',
  ERROR_PAGE: 'ERROR_PAGE',
  DICTIONARY_WIKI: 'DICTIONARY_WIKI',
  MARKETPLACE_DIRECTORY: 'MARKETPLACE_DIRECTORY',
  ARTICLE: 'ARTICLE',
  UNKNOWN: 'UNKNOWN'
};

function extractHostname(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return 'unknown';
  }
}

/**
 * 1. Link Health Verification
 * Lightweight check: verifies HTTP status and resolves redirects without heavy browser overhead.
 * 
 * @param {string} url - Target URL to inspect
 * @param {Object} options - { fetchFn: globalThis.fetch, timeoutMs: 4000 }
 * @returns {Promise<Object>} Link health report
 */
export async function verifyLinkHealth(url, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 4000;
  const startTime = Date.now();

  const report = {
    original_url: url,
    final_url: url,
    http_status: 0,
    redirect_count: 0,
    response_time_ms: 0,
    content_type: null,
    is_accessible: false,
    is_dead: false,
    health_status: LINK_HEALTH_STATUS.UNKNOWN,
    health_checked_at: new Date().toISOString()
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const maxRetries = options.maxRetries ?? 1;
    const retryDelayMs = options.retryDelayMs ?? 100;
    report.retry_count = 0;

    const doFetch = async () => {
      try {
        const headRes = await fetchFn(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'LeadSpyBot/2.0 (+https://leadspy.app/crawler-verifier)'
          },
          redirect: 'follow',
          signal: controller.signal
        });
        if (headRes.status === 405 || headRes.status === 501) {
          throw new Error('HEAD_NOT_ALLOWED');
        }
        return headRes;
      } catch (headErr) {
        if (headErr.name === 'AbortError') throw headErr;
        return await fetchFn(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'LeadSpyBot/2.0 (+https://leadspy.app/crawler-verifier)'
          },
          redirect: 'follow',
          signal: controller.signal
        });
      }
    };

    let res = await doFetch();

    // HTTP 429: Temporary rate limit handling with retry/backoff
    while (res.status === 429 && report.retry_count < maxRetries) {
      report.retry_count++;
      await new Promise(r => setTimeout(r, retryDelayMs * (2 ** (report.retry_count - 1))));
      res = await doFetch();
    }

    clearTimeout(timeoutId);

    report.response_time_ms = Date.now() - startTime;
    report.http_status = res.status;
    report.final_url = res.url || url;
    report.content_type = res.headers?.get ? res.headers.get('content-type') : null;

    if (report.final_url !== url) {
      report.redirect_count = 1;
    }

    // Classify HTTP status
    if (res.status === 200) {
      report.is_accessible = true;
      report.health_status = report.redirect_count > 0 ? LINK_HEALTH_STATUS.REDIRECTED : LINK_HEALTH_STATUS.ACTIVE;
    } else if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      report.is_accessible = true;
      report.health_status = LINK_HEALTH_STATUS.REDIRECTED;
    } else if (res.status === 404 || res.status === 410) {
      report.is_dead = true;
      report.is_accessible = false;
      report.health_status = LINK_HEALTH_STATUS.DEAD;
    } else if (res.status === 403) {
      // 403 is BLOCKED without permanent source/domain penalty
      report.is_dead = false;
      report.is_accessible = false;
      report.health_status = LINK_HEALTH_STATUS.BLOCKED;
    } else if (res.status === 429) {
      // 429 remaining after retry is RATE_LIMITED
      report.is_dead = false;
      report.is_accessible = false;
      report.health_status = LINK_HEALTH_STATUS.RATE_LIMITED;
    } else {
      report.is_accessible = false;
      report.health_status = res.status >= 500 ? LINK_HEALTH_STATUS.UNREACHABLE : LINK_HEALTH_STATUS.UNKNOWN;
    }

  } catch (err) {
    report.response_time_ms = Date.now() - startTime;
    report.is_accessible = false;
    report.is_dead = false;
    report.health_status = LINK_HEALTH_STATUS.UNREACHABLE;
  }

  return report;
}

/**
 * 2. Page Validity Verification
 * Answers ONLY: "Is this a valid, readable, non-deleted content page?"
 * Does NOT determine if it is an IT project (Project intent is separate downstream).
 * 
 * @param {string} url - Candidate URL
 * @param {Object} healthReport - Output from verifyLinkHealth
 * @param {string} previewContent - Available snippet or lightweight HTML preview
 * @returns {Object} Page validity decision
 */
export function verifyPageValidity(url, healthReport = {}, previewContent = '') {
  const result = {
    page_type: PAGE_TYPE.UNKNOWN,
    content_available: Boolean(previewContent && previewContent.trim().length > 0),
    page_valid: false,
    page_validity_reason: 'NONE'
  };

  const targetUrl = (healthReport.final_url || url || '').toLowerCase();
  const domain = extractHostname(targetUrl);
  const text = (previewContent || '').trim();
  const textLower = text.toLowerCase();

  // 1. If Link Health failed with dead/unreachable, immediately invalidate
  if (healthReport.health_status === LINK_HEALTH_STATUS.DEAD ||
      healthReport.health_status === LINK_HEALTH_STATUS.UNREACHABLE) {
    result.page_type = PAGE_TYPE.ERROR_PAGE;
    result.page_valid = false;
    result.page_validity_reason = `LINK_HEALTH_${healthReport.health_status}`;
    return result;
  }

  // 2. Wikipedia / Reference Dictionary detection
  if (domain.includes('wikipedia.org') ||
      domain.includes('wiktionary.org') ||
      domain.includes('merriam-webster.com') ||
      domain.includes('thefreedictionary.com') ||
      domain.includes('dictionary.cambridge.org')) {
    result.page_type = PAGE_TYPE.DICTIONARY_WIKI;
    result.page_valid = false;
    result.page_validity_reason = 'REFERENCE_DICTIONARY_OR_WIKI';
    return result;
  }

  // 3. Marketplace SEO directory detection (Upwork outcomes, Fiverr categories, Freelancer hire)
  if (targetUrl.includes('upwork.com/outcomes/') ||
      targetUrl.includes('upwork.com/hire/') ||
      targetUrl.includes('fiverr.com/categories/') ||
      targetUrl.includes('freelancer.com/hire/')) {
    result.page_type = PAGE_TYPE.MARKETPLACE_DIRECTORY;
    result.page_valid = false;
    result.page_validity_reason = 'MARKETPLACE_SEO_PAGE';
    return result;
  }

  // 4. Login Wall / Authentication page detection
  const isAuthUrl = targetUrl.includes('portal.office.com') ||
                    targetUrl.includes('login.microsoftonline.com') ||
                    targetUrl.includes('accounts.google.com') ||
                    /\b(login|signin|auth|oauth|authenticate)\b/i.test(targetUrl);
  
  const hasAuthContent = /\b(sign in to your account|enter your password|log in to continue|forgot password)\b/i.test(textLower) ||
                         textLower.includes('type="password"');

  if (isAuthUrl || hasAuthContent) {
    result.page_type = PAGE_TYPE.LOGIN_PAGE;
    result.page_valid = false;
    result.page_validity_reason = 'LOGIN_AUTHENTICATION_WALL';
    return result;
  }

  // 5. Soft-404 / Deleted / Removed Content detection (Reddit & generic)
  const isReddit = domain.includes('reddit.com');
  const isDeletedReddit = isReddit && (
    textLower.includes('[deleted]') ||
    textLower.includes('[removed]') ||
    textLower.includes('sorry, this post was removed') ||
    textLower.includes('this post was removed by moderators')
  );

  const isGenericSoft404 = textLower.includes('page not found') ||
                           textLower.includes('404 not found') ||
                           textLower.includes('the requested url was not found') ||
                           textLower.includes('this page doesn’t exist') ||
                           textLower.includes('this page does not exist');

  if (isDeletedReddit || isGenericSoft404) {
    result.page_type = PAGE_TYPE.ERROR_PAGE;
    result.page_valid = false;
    result.page_validity_reason = isDeletedReddit ? 'REDDIT_DELETED_POST' : 'SOFT_404_PAGE_NOT_FOUND';
    return result;
  }

  // 6. Generic root domain static homepage detection (e.g. "https://example.com" or "https://example.com/")
  try {
    const parsed = new URL(targetUrl);
    const path = parsed.pathname;
    const isRootHome = (!path || path === '/' || path === '/index.html' || path === '/home') &&
                       !parsed.search &&
                       !targetUrl.includes('reddit.com') &&
                       !targetUrl.includes('ycombinator.com') &&
                       !targetUrl.includes('github.com');
    if (isRootHome) {
      result.page_type = PAGE_TYPE.STATIC_PAGE;
      result.page_valid = false;
      result.page_validity_reason = 'GENERIC_HOMEPAGE_STATIC_PAGE';
      return result;
    }
  } catch (e) {}

  // 7. Client-Side Rendered SPA / JS Shell (Supports UNKNOWN/INCONCLUSIVE state per Amendment 2)
  const isJsShell = (textLower.includes('<div id="root">') || textLower.includes('<div id="app">') || textLower.includes('enable javascript to run this app')) &&
                    text.length < 500;
  if (isJsShell) {
    result.page_type = PAGE_TYPE.INCONCLUSIVE;
    result.page_valid = true; // Inconclusive JS shell is NOT prematurely discarded
    result.page_validity_reason = 'JS_SHELL_SPA_ALLOWED_FOR_DEEP_INSPECTION';
    return result;
  }

  // 8. Valid Forum / Project Post / RFP / Article
  if (isReddit) {
    result.page_type = PAGE_TYPE.FORUM_POST;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_FORUM_POST';
    return result;
  }

  if (domain.includes('ycombinator.com')) {
    result.page_type = PAGE_TYPE.FORUM_POST;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_HN_POST';
    return result;
  }

  if (targetUrl.includes('.pdf') || textLower.includes('request for proposal') || textLower.includes('scope of work')) {
    result.page_type = PAGE_TYPE.RFP;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_RFP_DOCUMENT';
    return result;
  }

  // General readable page
  if (text.length >= 80) {
    result.page_type = PAGE_TYPE.PROJECT_PAGE;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_READABLE_CONTENT_PAGE';
    return result;
  }

  // Default fallback
  result.page_type = PAGE_TYPE.UNKNOWN;
  result.page_valid = text.length > 30;
  result.page_validity_reason = result.page_valid ? 'MINIMAL_CONTENT_PAGE' : 'INSUFFICIENT_CONTENT';
  return result;
}

/**
 * 3. Unified Candidate Health & Validity Evaluator (Hard Pre-Crawl Gate)
 * Both gates MUST pass for a candidate to proceed to Project Intent Scoring and Deep Crawl.
 * 
 * @param {Object} candidate - Candidate object { url, snippet, ... }
 * @param {Object} options - Options including fetchFn override for hermetic unit testing
 * @returns {Promise<Object>} Unified verification verdict
 */
export async function evaluateCandidateValidityGate(candidate, options = {}) {
  const url = candidate.url || candidate.source_url;
  const content = candidate.snippet || candidate.content || candidate.title || '';

  // Gate 1: Link Health Check
  const healthReport = await verifyLinkHealth(url, options);

  // If link is dead or unreachable, drop immediately
  if (healthReport.health_status === LINK_HEALTH_STATUS.DEAD ||
      healthReport.health_status === LINK_HEALTH_STATUS.UNREACHABLE) {
    return {
      pass: false,
      rejection_stage: 'LINK_HEALTH',
      rejection_reason: healthReport.health_status,
      healthReport,
      validityReport: { page_valid: false, page_type: PAGE_TYPE.ERROR_PAGE },
      candidate
    };
  }

  // If rate-limited or blocked, drop from deep crawl without domain ban
  if (healthReport.health_status === LINK_HEALTH_STATUS.BLOCKED ||
      healthReport.health_status === LINK_HEALTH_STATUS.RATE_LIMITED) {
    return {
      pass: false,
      rejection_stage: 'LINK_HEALTH',
      rejection_reason: healthReport.health_status,
      healthReport,
      validityReport: { page_valid: false, page_type: PAGE_TYPE.ERROR_PAGE },
      candidate
    };
  }

  // Gate 2: Page Validity Check
  const validityReport = verifyPageValidity(url, healthReport, content);

  if (!validityReport.page_valid) {
    return {
      pass: false,
      rejection_stage: 'PAGE_VALIDITY',
      rejection_reason: validityReport.page_validity_reason,
      healthReport,
      validityReport,
      candidate
    };
  }

  // Both Gates Passed
  return {
    pass: true,
    rejection_stage: 'NONE',
    rejection_reason: 'NONE',
    healthReport,
    validityReport,
    candidate: {
      ...candidate,
      final_url: healthReport.final_url,
      link_health_status: healthReport.health_status,
      page_type: validityReport.page_type
    }
  };
}
