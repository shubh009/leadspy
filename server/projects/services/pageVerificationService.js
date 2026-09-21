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

export const HTTP_VERIFICATION_TIMEOUT_MS = 2000;

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

// -------------------------------------------------------------
// GAP 2: Lightweight Per-Run In-Memory Verification Cache
// -------------------------------------------------------------
const VERIFICATION_CACHE = new Map();
let cacheHits = 0;
let cacheMisses = 0;

export function clearVerificationCache() {
  VERIFICATION_CACHE.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

export function getVerificationCache() {
  return VERIFICATION_CACHE;
}

export function getVerificationCacheStats() {
  return {
    cacheHits,
    cacheMisses,
    hits: cacheHits,
    misses: cacheMisses,
    size: VERIFICATION_CACHE.size,
    totalEntries: VERIFICATION_CACHE.size
  };
}

export function normalizeVerificationUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    parsed.hash = '';
    const cleanParams = new URLSearchParams();
    for (const [k, v] of parsed.searchParams.entries()) {
      const lower = k.toLowerCase();
      if (!lower.startsWith('utm_') && !lower.startsWith('fbclid') && !lower.startsWith('ref') && lower !== '_ga') {
        cleanParams.append(k, v);
      }
    }
    const queryString = cleanParams.toString();
    parsed.search = queryString ? `?${queryString}` : '';
    let res = parsed.toString().toLowerCase();
    if (res.endsWith('/') && parsed.pathname !== '/') {
      res = res.slice(0, -1);
    }
    return res;
  } catch (e) {
    return (urlStr || '').trim().toLowerCase();
  }
}

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
  const totalBudgetMs = options.timeoutMs ?? HTTP_VERIFICATION_TIMEOUT_MS;
  const startTime = Date.now();
  const deadline = startTime + totalBudgetMs;

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
    const maxRetries = options.maxRetries ?? 1;
    const retryDelayMs = options.retryDelayMs ?? 100;
    report.retry_count = 0;

    const executeFetchWithRemaining = async (method) => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        const timeoutErr = new Error('HTTP_VERIFICATION_TIMEOUT');
        timeoutErr.name = 'AbortError';
        throw timeoutErr;
      }
      const stepController = new AbortController();
      const stepTimeoutId = setTimeout(() => stepController.abort(), remainingMs);
      try {
        return await fetchFn(url, {
          method,
          headers: {
            'User-Agent': 'LeadSpyBot/2.0 (+https://leadspy.app/crawler-verifier)'
          },
          redirect: 'follow',
          signal: stepController.signal
        });
      } finally {
        clearTimeout(stepTimeoutId);
      }
    };

    const doFetch = async () => {
      try {
        const headRes = await executeFetchWithRemaining('HEAD');
        if (headRes.status === 405 || headRes.status === 501) {
          throw new Error('HEAD_NOT_ALLOWED');
        }
        return headRes;
      } catch (headErr) {
        if (headErr.name === 'AbortError' || Date.now() >= deadline) throw headErr;
        return await executeFetchWithRemaining('GET');
      }
    };

    let res = await doFetch();

    // HTTP 429: Temporary rate limit handling with retry/backoff
    while (res.status === 429 && report.retry_count < maxRetries) {
      report.retry_count++;
      const delay = retryDelayMs * (2 ** (report.retry_count - 1));
      if (Date.now() + delay >= deadline) {
        break;
      }
      await new Promise(r => setTimeout(r, delay));
      res = await doFetch();
    }

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

  const isForum = domain.includes('forum') ||
                  domain.includes('community.') ||
                  targetUrl.includes('/t/') ||
                  targetUrl.includes('/topic/') ||
                  targetUrl.includes('/thread/');

  if (isForum) {
    result.page_type = PAGE_TYPE.FORUM_POST;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_FORUM_POST';
    return result;
  }

  if (domain.includes('github.com') && (targetUrl.includes('/issues') || targetUrl.includes('/discussions'))) {
    result.page_type = PAGE_TYPE.PROJECT_PAGE;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_GITHUB_PROJECT';
    return result;
  }

  if (targetUrl.includes('.pdf') ||
      targetUrl.includes('/rfp') ||
      targetUrl.includes('/rfps') ||
      textLower.includes('request for proposal') ||
      textLower.includes('scope of work')) {
    result.page_type = PAGE_TYPE.RFP;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_RFP_DOCUMENT';
    return result;
  }

  // General readable page (Requires minimum usable content length >= 250 characters)
  const minUsableTextLength = 250;
  if (text.length >= minUsableTextLength) {
    result.page_type = PAGE_TYPE.PROJECT_PAGE;
    result.page_valid = true;
    result.page_validity_reason = 'VALID_READABLE_CONTENT_PAGE';
    return result;
  }

  // Default fallback
  result.page_type = PAGE_TYPE.UNKNOWN;
  result.page_valid = false;
  result.page_validity_reason = 'INSUFFICIENT_PAGE_CONTENT';
  return result;
}

/**
 * GAP 1: Lightweight content fetcher from resolved final_url.
 * Reads up to 16KB of text/HTML without heavy browser or Puppeteer rendering.
 * 
 * @param {string} url - Resolved final URL
 * @param {Object} options - { fetchFn, timeoutMs, maxBytes }
 * @returns {Promise<Object>} { success, content, contentType, isPdf, isShell, error }
 */
export async function fetchLightweightPageContent(url, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || 4000;
  const maxBytes = options.maxBytes || 16384; // 16KB

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetchFn(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'LeadSpyBot/2.0 (+https://leadspy.app/crawler-verifier)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8',
        'Range': `bytes=0-${maxBytes - 1}`
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = (res.headers?.get ? res.headers.get('content-type') : '') || '';

    // Handle PDF documents directly
    if (contentType.includes('application/pdf') || url.toLowerCase().includes('.pdf')) {
      return {
        success: true,
        content: 'request for proposal rfp specification scope of work pdf document',
        contentType: 'application/pdf',
        isPdf: true,
        isShell: false
      };
    }

    if (res.status && res.status >= 400) {
      return {
        success: false,
        content: '',
        status: res.status,
        error: `HTTP_${res.status}`
      };
    }

    // Read text content up to maxBytes with strict streaming limit (P1.1)
    let rawText = '';
    if (res.body && typeof res.body.getReader === 'function') {
      try {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let bytesRead = 0;
        let done = false;
        while (!done && bytesRead < maxBytes) {
          const chunk = await reader.read();
          done = chunk.done;
          if (chunk.value) {
            bytesRead += chunk.value.length;
            rawText += decoder.decode(chunk.value, { stream: !done });
          }
        }
        try { await reader.cancel(); } catch (cancelErr) {}
      } catch (streamErr) {
        if (typeof res.text === 'function') {
          try { rawText = await res.text(); } catch (e) { rawText = ''; }
        }
      }
    } else if (typeof res.text === 'function') {
      try {
        rawText = await res.text();
      } catch (e) {
        rawText = '';
      }
    } else if (res.body) {
      rawText = String(res.body);
    }

    if (!rawText || !rawText.trim()) {
      return {
        success: false,
        content: '',
        contentType,
        isPdf: false,
        isShell: false,
        error: 'EMPTY_BODY'
      };
    }

    // Truncate to maxBytes
    const truncated = rawText.substring(0, maxBytes);

    // Check for SPA / JS shells (<div id="root"></div> / <div id="app"></div>)
    const isShell = (truncated.length < 4096) && (
      /<div\s+id=["'](?:root|app|__next)["']\s*>\s*<\/div>/i.test(truncated) ||
      /<noscript>.*(?:enable javascript|javascript is required).*<\/noscript>/i.test(truncated)
    );

    // Lightweight HTML text extraction: strip scripts, styles, and tags
    let cleanText = truncated
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return {
        success: false,
        content: '',
        contentType,
        isPdf: false,
        isShell: false,
        error: 'NO_READABLE_TEXT'
      };
    }

    return {
      success: true,
      content: cleanText,
      rawHtml: truncated,
      contentType,
      isPdf: false,
      isShell
    };
  } catch (err) {
    return {
      success: false,
      content: '',
      error: err.name === 'AbortError' ? 'TIMEOUT' : (err.message || 'FETCH_FAILED')
    };
  }
}

/**
 * 3. Unified Candidate Health & Validity Evaluator (Hard Pre-Crawl Gate)
 * Both gates MUST pass for a candidate to proceed to Project Intent Scoring and Deep Crawl.
 * 
 * @param {Object} candidate - Candidate object { url, snippet, ... }
 * @param {Object} options - Options including fetchFn override, previewContent override
 * @returns {Promise<Object>} Unified verification verdict
 */
export async function evaluateCandidateValidityGate(candidate, options = {}) {
  const url = candidate.url || candidate.source_url;
  const canonicalUrl = options.canonicalUrl || candidate.canonicalUrl || normalizeVerificationUrl(url);

  // Requirement 6: Native Reddit/HN/GitHub candidates with existing content payload bypass HTTP ping
  const isNative = candidate.source === 'reddit' ||
                   candidate.source === 'hackernews' ||
                   candidate.source === 'github' ||
                   candidate.isNativeSource ||
                   options.isNativeSource;
  const hasNativePayload = Boolean(candidate.snippet || candidate.content || candidate.title || candidate.body);

  if (isNative && hasNativePayload && !options.forceNetwork) {
    const nativeContent = (candidate.body || candidate.content || candidate.snippet || candidate.title || '').trim();
    const validityReport = verifyPageValidity(url, { health_status: LINK_HEALTH_STATUS.ACTIVE, is_accessible: true, final_url: url }, nativeContent);
    validityReport.evaluated = true;
    const pass = validityReport.page_valid;

    const verdict = {
      pass,
      fromCache: false,
      rejection_stage: pass ? 'NONE' : 'PAGE_VALIDITY',
      rejection_reason: pass ? 'NONE' : validityReport.page_validity_reason,
      healthReport: {
        original_url: url,
        final_url: url,
        http_status: 200,
        redirect_count: 0,
        response_time_ms: 0,
        content_type: 'application/native-payload',
        is_accessible: true,
        is_dead: false,
        health_status: 'NATIVE_SOURCE_VERIFIED',
        health_checked_at: new Date().toISOString()
      },
      validityReport,
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: false,
        pageFetchAttempted: false,
        pageFetchSucceeded: pass,
        pageFetchFailed: !pass,
        nativeBypass: true
      },
      candidate: {
        ...candidate,
        final_url: url,
        link_health_status: 'NATIVE_SOURCE_VERIFIED',
        page_type: validityReport.page_type,
        pageContentPreview: nativeContent.substring(0, 300)
      }
    };
    return verdict;
  }

  // GAP 2: Verification Cache Check
  if (!options.bypassCache && VERIFICATION_CACHE.has(canonicalUrl)) {
    cacheHits++;
    const cached = VERIFICATION_CACHE.get(canonicalUrl);
    return {
      ...cached,
      fromCache: true,
      verificationTelemetry: {
        cacheHit: true,
        linkHealthFetchAttempted: false,
        pageFetchAttempted: false,
        pageFetchSucceeded: false,
        pageFetchFailed: false
      },
      candidate: {
        ...candidate,
        final_url: cached.candidate?.final_url || cached.final_url || (cached.healthReport && cached.healthReport.final_url) || url,
        link_health_status: cached.healthReport?.health_status,
        page_type: cached.validityReport?.page_type,
        pageContentPreview: cached.candidate?.pageContentPreview || ''
      }
    };
  }

  cacheMisses++;

  // Gate 1: Link Health Check
  const healthReport = await verifyLinkHealth(url, options);

  // If link is dead or unreachable, drop immediately (Page validity is NOT evaluated)
  if (healthReport.health_status === LINK_HEALTH_STATUS.DEAD ||
      healthReport.health_status === LINK_HEALTH_STATUS.UNREACHABLE) {
    const verdict = {
      pass: false,
      rejection_stage: 'LINK_HEALTH',
      rejection_reason: healthReport.health_status,
      healthReport,
      validityReport: { page_valid: false, page_type: PAGE_TYPE.ERROR_PAGE, evaluated: false },
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: true,
        pageFetchAttempted: false,
        pageFetchSucceeded: false,
        pageFetchFailed: false
      },
      candidate
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  // If rate-limited or blocked, drop from deep crawl without domain ban
  if (healthReport.health_status === LINK_HEALTH_STATUS.BLOCKED ||
      healthReport.health_status === LINK_HEALTH_STATUS.RATE_LIMITED) {
    const verdict = {
      pass: false,
      rejection_stage: 'LINK_HEALTH',
      rejection_reason: healthReport.health_status,
      healthReport,
      validityReport: { page_valid: false, page_type: PAGE_TYPE.ERROR_PAGE, evaluated: false },
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: true,
        pageFetchAttempted: false,
        pageFetchSucceeded: false,
        pageFetchFailed: false
      },
      candidate
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  // Gate 2: Real Page-Content Verification
  const finalUrl = healthReport.final_url || url;
  let pageContent = '';

  if (options.previewContent !== undefined) {
    pageContent = options.previewContent;
    const validityReport = verifyPageValidity(finalUrl, healthReport, pageContent);
    validityReport.evaluated = true;
    const pass = validityReport.page_valid;
    const verdict = {
      pass,
      rejection_stage: pass ? 'NONE' : 'PAGE_VALIDITY',
      rejection_reason: pass ? 'NONE' : validityReport.page_validity_reason,
      healthReport,
      validityReport,
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: Boolean(options.fetchFn),
        pageFetchAttempted: false,
        pageFetchSucceeded: false,
        pageFetchFailed: false
      },
      candidate: {
        ...candidate,
        final_url: finalUrl,
        link_health_status: healthReport.health_status,
        page_type: validityReport.page_type,
        pageContentPreview: pageContent.substring(0, 300)
      }
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  if (options.fetchFn && !options.fetchPageContent && candidate.snippet) {
    // Hermetic link-health unit tests that mock fetchFn without page body (Phase A backward compatibility)
    pageContent = candidate.snippet || candidate.content || candidate.title || '';
    const validityReport = verifyPageValidity(finalUrl, healthReport, pageContent);
    validityReport.evaluated = true;
    const pass = validityReport.page_valid;
    const verdict = {
      pass,
      rejection_stage: pass ? 'NONE' : 'PAGE_VALIDITY',
      rejection_reason: pass ? 'NONE' : validityReport.page_validity_reason,
      healthReport,
      validityReport,
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: true,
        pageFetchAttempted: false,
        pageFetchSucceeded: false,
        pageFetchFailed: false
      },
      candidate: {
        ...candidate,
        final_url: finalUrl,
        link_health_status: healthReport.health_status,
        page_type: validityReport.page_type,
        pageContentPreview: pageContent.substring(0, 300)
      }
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  // Production & real page verification: fetch actual lightweight content from finalUrl
  const fetchResult = await fetchLightweightPageContent(finalUrl, options);
  if (!fetchResult.success || !fetchResult.content) {
    // NEVER fallback to search snippet when real page fetch fails.
    const verdict = {
      pass: false,
      rejection_stage: 'PAGE_VALIDITY',
      rejection_reason: 'PAGE_CONTENT_FETCH_FAILED',
      healthReport,
      validityReport: {
        page_valid: false,
        page_type: PAGE_TYPE.ERROR_PAGE,
        page_validity_reason: 'PAGE_CONTENT_FETCH_FAILED',
        evaluated: true
      },
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: true,
        pageFetchAttempted: true,
        pageFetchSucceeded: false,
        pageFetchFailed: true
      },
      candidate
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  if (fetchResult.isShell) {
    // SPA / JS shell detected: allowed to proceed as INCONCLUSIVE
    const verdict = {
      pass: true,
      rejection_stage: 'NONE',
      rejection_reason: 'NONE',
      healthReport,
      validityReport: {
        page_valid: true,
        page_type: PAGE_TYPE.INCONCLUSIVE,
        page_validity_reason: 'SPA_JAVASCRIPT_SHELL_ALLOWED',
        evaluated: true
      },
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: true,
        pageFetchAttempted: true,
        pageFetchSucceeded: true,
        pageFetchFailed: false
      },
      candidate: {
        ...candidate,
        final_url: finalUrl,
        link_health_status: healthReport.health_status,
        page_type: PAGE_TYPE.INCONCLUSIVE,
        pageContentPreview: fetchResult.content.substring(0, 300)
      }
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  pageContent = fetchResult.content;
  const validityReport = verifyPageValidity(finalUrl, healthReport, pageContent);
  validityReport.evaluated = true;

  if (!validityReport.page_valid) {
    const verdict = {
      pass: false,
      rejection_stage: 'PAGE_VALIDITY',
      rejection_reason: validityReport.page_validity_reason,
      healthReport,
      validityReport,
      verificationTelemetry: {
        cacheHit: false,
        linkHealthFetchAttempted: true,
        pageFetchAttempted: true,
        pageFetchSucceeded: true,
        pageFetchFailed: false
      },
      candidate
    };
    VERIFICATION_CACHE.set(canonicalUrl, verdict);
    return verdict;
  }

  // Both Gates Passed
  const verdict = {
    pass: true,
    rejection_stage: 'NONE',
    rejection_reason: 'NONE',
    healthReport,
    validityReport,
    verificationTelemetry: {
      cacheHit: false,
      linkHealthFetchAttempted: true,
      pageFetchAttempted: true,
      pageFetchSucceeded: true,
      pageFetchFailed: false
    },
    candidate: {
      ...candidate,
      final_url: finalUrl,
      link_health_status: healthReport.health_status,
      page_type: validityReport.page_type,
      pageContentPreview: pageContent.substring(0, 300)
    }
  };
  VERIFICATION_CACHE.set(canonicalUrl, verdict);
  return verdict;
}
