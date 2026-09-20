/**
 * LeadSpy Pre-Classification Canonical Deduplication Service
 * File: server/projects/services/canonicalDeduplicator.js
 * 
 * Performs lightweight, fast deduplication BEFORE expensive network fetching 
 * and AI classification.
 * 
 * Hierarchy:
 * 1. Raw URL Exact Deduplication
 * 2. Generic URL Normalization (strip tracking query params, fragments, normalize casing/slashes)
 * 3. Source-Specific Canonical Identity (GitHub issues/comments, Reddit posts, Hacker News items)
 * 4. Content Fingerprint Deduplication (MD5 hash of normalized title + body prefix)
 */

import crypto from 'crypto';

export class CanonicalDeduplicator {
  constructor() {
    this.seenRawUrls = new Set();
    this.seenCanonicalUrls = new Set();
    this.seenSourceIds = new Set();
    this.seenContentFingerprints = new Set();
    this.candidateMetadataMap = new Map();

    this.metrics = {
      rawResults: 0,
      urlDuplicatesRemoved: 0,
      canonicalUrlDuplicatesRemoved: 0,
      sourceIdDuplicatesRemoved: 0,
      contentDuplicatesRemoved: 0,
      candidatesEnteringClassifier: 0
    };
  }

  reset() {
    this.seenRawUrls.clear();
    this.seenCanonicalUrls.clear();
    this.seenSourceIds.clear();
    this.seenContentFingerprints.clear();
    this.candidateMetadataMap.clear();
    this.metrics = {
      rawResults: 0,
      urlDuplicatesRemoved: 0,
      canonicalUrlDuplicatesRemoved: 0,
      sourceIdDuplicatesRemoved: 0,
      contentDuplicatesRemoved: 0,
      candidatesEnteringClassifier: 0
    };
  }

  /**
   * Generic URL Normalization (Task 4)
   * Strips tracking params, trailing slashes, fragments, normalizes host casing.
   * Preserves meaningful query params.
   */
  normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      let urlStr = rawUrl.trim();

      // Handle common search redirect wrappers if embedded
      if (urlStr.includes('bing.com/ck/a?') || urlStr.includes('google.com/url?')) {
        const parsedWrapper = new URL(urlStr);
        const actualUrl = parsedWrapper.searchParams.get('u') || parsedWrapper.searchParams.get('url') || parsedWrapper.searchParams.get('q');
        if (actualUrl && actualUrl.startsWith('http')) {
          urlStr = actualUrl;
        }
      }

      const parsed = new URL(urlStr);

      // 1. Hostname lowercase & protocol normalization
      parsed.protocol = parsed.protocol.toLowerCase();
      parsed.hostname = parsed.hostname.toLowerCase();

      // 2. Remove default ports
      if ((parsed.protocol === 'http:' && parsed.port === '80') ||
          (parsed.protocol === 'https:' && parsed.port === '443')) {
        parsed.port = '';
      }

      // 3. Remove marketing/analytics tracking query parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'ref', 'source', 'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
        'spJobID', 'spReportId', '_hsenc', '_hsmi'
      ];
      trackingParams.forEach(p => parsed.searchParams.delete(p));

      // 4. Remove fragment if it points to internal comments/anchors
      parsed.hash = '';

      // 5. Normalize trailing slash on pathname
      if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      // 6. Sort query parameters deterministically
      parsed.searchParams.sort();

      return parsed.toString();
    } catch (e) {
      return rawUrl.trim();
    }
  }

  /**
   * Source-Specific Canonical Identity (Task 3)
   * Resolves:
   * - GitHub: /org/repo/issues/123, /org/repo/issues/123#issuecomment-456, api.github.com/repos/org/repo/issues/123
   *   -> github:org/repo:issue:123
   * - Reddit: reddit.com/r/sub/comments/abc/title/... -> reddit:submission:abc
   * - Hacker News: news.ycombinator.com/item?id=123 -> hackernews:item:123
   */
  extractSourceCanonicalId(url, source = null) {
    if (!url) return null;

    // 1. GitHub Issues Canonicalization
    const ghIssueMatch = url.match(/(?:api\.github\.com\/repos\/|github\.com\/)([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/i);
    if (ghIssueMatch) {
      const org = ghIssueMatch[1].toLowerCase();
      const repo = ghIssueMatch[2].toLowerCase();
      const issueNum = ghIssueMatch[3];
      return `github:${org}/${repo}:issue:${issueNum}`;
    }

    // GitHub Discussions
    const ghDiscMatch = url.match(/(?:api\.github\.com\/repos\/|github\.com\/)([\w.-]+)\/([\w.-]+)\/discussions\/(\d+)/i);
    if (ghDiscMatch) {
      const org = ghDiscMatch[1].toLowerCase();
      const repo = ghDiscMatch[2].toLowerCase();
      const discNum = ghDiscMatch[3];
      return `github:${org}/${repo}:discussion:${discNum}`;
    }

    // 2. Reddit Submissions Canonicalization
    const redditMatch = url.match(/reddit\.com\/r\/[\w.-]+\/comments\/([a-z0-9]+)/i);
    if (redditMatch) {
      return `reddit:submission:${redditMatch[1].toLowerCase()}`;
    }

    // 3. Hacker News Item Canonicalization
    const hnMatch = url.match(/news\.ycombinator\.com\/item\?id=(\d+)/i);
    if (hnMatch) {
      return `hackernews:item:${hnMatch[1]}`;
    }

    // 4. IndieHackers Post
    const ihMatch = url.match(/indiehackers\.com\/post\/([\w-]+)/i);
    if (ihMatch) {
      return `indiehackers:post:${ihMatch[1].toLowerCase()}`;
    }

    // 5. DEV Community Article
    const devMatch = url.match(/dev\.to\/[\w.-]+\/([\w-]+)/i);
    if (devMatch) {
      return `devto:article:${devMatch[1].toLowerCase()}`;
    }

    return null;
  }

  /**
   * Lightweight Content Fingerprint (Task 5)
   * Generates deterministic hash from normalized title + core text prefix.
   */
  generateContentFingerprint(title = '', content = '') {
    const cleanTitle = (title || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const cleanBody = (content || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 300);

    if (!cleanTitle && !cleanBody) return null;

    return crypto
      .createHash('sha256')
      .update(`${cleanTitle}|${cleanBody}`)
      .digest('hex');
  }

  /**
   * Step 1 Pre-Filter: URL & Source ID Checks (run before network fetch)
   */
  checkUrlCandidate(cand, queryContext = null) {
    this.metrics.rawResults++;
    const rawUrl = cand.url || cand.sourceUrl;

    if (!rawUrl) {
      return { isDuplicate: true, reason: 'EMPTY_URL' };
    }

    const context = queryContext || cand.queryContext || {};
    const canonicalUrl = this.normalizeUrl(rawUrl);

    // 1. Raw URL Deduplication
    if (this.seenRawUrls.has(rawUrl)) {
      this.metrics.urlDuplicatesRemoved++;
      this._updateMetadata(canonicalUrl || rawUrl, cand, context);
      return { isDuplicate: true, reason: 'RAW_URL_DUPLICATE', canonicalUrl };
    }
    this.seenRawUrls.add(rawUrl);

    // 2. Generic Normalized URL Deduplication
    if (this.seenCanonicalUrls.has(canonicalUrl)) {
      this.metrics.canonicalUrlDuplicatesRemoved++;
      this._updateMetadata(canonicalUrl, cand, context);
      return { isDuplicate: true, reason: 'CANONICAL_URL_DUPLICATE', canonicalUrl };
    }
    this.seenCanonicalUrls.add(canonicalUrl);

    // 3. Source-Specific Canonical ID Deduplication
    const sourceCanonicalId = this.extractSourceCanonicalId(rawUrl, cand.source) ||
      (cand.source && cand.sourcePostId ? `${cand.source}:${cand.sourcePostId}` : null);

    if (sourceCanonicalId) {
      if (this.seenSourceIds.has(sourceCanonicalId)) {
        this.metrics.sourceIdDuplicatesRemoved++;
        this._updateMetadata(canonicalUrl, cand, context);
        return { isDuplicate: true, reason: 'SOURCE_ID_DUPLICATE', canonicalId: sourceCanonicalId, canonicalUrl };
      }
      this.seenSourceIds.add(sourceCanonicalId);
    }

    // First time seeing this candidate: initialize cross-query metadata
    const cluster = context.deliverableType || context.intentType || 'general';
    this.candidateMetadataMap.set(canonicalUrl, {
      canonicalUrl,
      canonicalId: sourceCanonicalId,
      matched_queries: [cand.search_query || 'direct_source'],
      query_count: 1,
      best_rank: cand.rank || 1,
      distinct_clusters: new Set([cluster])
    });

    return {
      isDuplicate: false,
      canonicalUrl,
      canonicalId: sourceCanonicalId
    };
  }

  _updateMetadata(canonicalUrl, cand, queryContext = null) {
    const meta = this.candidateMetadataMap.get(canonicalUrl);
    if (meta) {
      meta.query_count++;
      if (cand.search_query && !meta.matched_queries.includes(cand.search_query)) {
        meta.matched_queries.push(cand.search_query);
      }
      if (cand.rank && cand.rank < meta.best_rank) {
        meta.best_rank = cand.rank;
      }
      const context = queryContext || cand.queryContext || {};
      const cluster = context.deliverableType || context.intentType || 'general';
      meta.distinct_clusters.add(cluster);
    }
  }

  getCandidateMetadata(canonicalUrl) {
    const meta = this.candidateMetadataMap.get(canonicalUrl);
    if (!meta) return null;
    return {
      ...meta,
      distinct_clusters_count: meta.distinct_clusters.size,
      distinct_clusters: Array.from(meta.distinct_clusters)
    };
  }

  /**
   * Step 2 Pre-Filter: Content Fingerprint Check (run after title & content are extracted)
   */
  checkContentCandidate(title, content) {
    const fingerprint = this.generateContentFingerprint(title, content);
    if (!fingerprint) return { isDuplicate: false };

    if (this.seenContentFingerprints.has(fingerprint)) {
      this.metrics.contentDuplicatesRemoved++;
      return { isDuplicate: true, reason: 'CONTENT_FINGERPRINT_DUPLICATE' };
    }

    this.seenContentFingerprints.add(fingerprint);
    this.metrics.candidatesEnteringClassifier++;
    return { isDuplicate: false, fingerprint };
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
