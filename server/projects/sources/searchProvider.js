/**
 * LeadSpy Multi-Provider Search Engine Abstraction (Layer 2) - V2
 * File: server/projects/sources/searchProvider.js
 * 
 * Supports:
 * 1. Discrete search providers: Bing, SearXNG, DuckDuckGo, Serper.dev, SerpApi
 * 2. Standardized normalized output schema (url, title, snippet, engine, query, rank, sourceDomain)
 * 3. Fully deterministic evaluateSearchResultQuality() using all 4 core metrics
 * 4. Fallback chain architecture (Primary -> Quality check -> Fallback chain -> Selective enrichment)
 */

import dotenv from 'dotenv';
dotenv.config();

function extractHostname(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Base Search Provider Interface
 */
export class BaseSearchProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Execute search query
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Array<Object>>} Normalized results array
   */
  async search(query, options = {}) {
    throw new Error(`search() not implemented in ${this.name}`);
  }
}

/**
 * 1. Bing Web Search Provider
 */
export class BingProvider extends BaseSearchProvider {
  constructor() {
    super('bing');
  }

  async search(query, options = {}) {
    const { timeRange = 'month', limit = 15 } = options;
    const results = [];

    try {
      const ageFilter = timeRange === 'month' ? 'filterui:age-1m' : 'filterui:age-14d';
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&qft=+${ageFilter}`;

      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) return results;

      const html = await res.text();
      const blocks = [...html.matchAll(/<li\s+class=\"b_algo\"[\s\S]*?<\/li>/g)];
      let rank = 1;

      for (const block of blocks) {
        const uMatch = block[0].match(/u=a1([A-Za-z0-9+/=_-]+)/);
        const titleMatch = block[0].match(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/i) || block[0].match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        const snippetMatch = block[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i) || block[0].match(/<div class=\"b_caption\"[^>]*>([\s\S]*?)<\/div>/i);

        let targetUrl = null;
        if (uMatch) {
          try {
            const rawBase64 = uMatch[1].replace(/-/g, '+').replace(/_/g, '/');
            targetUrl = Buffer.from(rawBase64, 'base64').toString('utf-8');
          } catch (e) {}
        } else {
          const directHref = block[0].match(/href=\"(https?:\/\/[^\"]+)\"/i);
          if (directHref && !directHref[1].includes('bing.com/ck')) targetUrl = directHref[1];
        }

        if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('bing.com')) {
          const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : query;
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';

          results.push({
            url: targetUrl,
            title: title || query,
            snippet: snippet || '',
            engine: 'bing',
            query,
            rank: rank++,
            sourceDomain: extractHostname(targetUrl)
          });
        }

        if (results.length >= limit) break;
      }
    } catch (err) {
      console.warn(`[BingProvider] Search failed for "${query}":`, err.message);
    }

    return results;
  }
}

// Backward compatibility alias
export const BingSearchProvider = BingProvider;

/**
 * 2. SearXNG Search Provider
 */
export class SearXNGProvider extends BaseSearchProvider {
  constructor(instances = null) {
    super('searxng');
    this.instances = instances || [
      'https://searx.be',
      'https://search.sapti.me',
      'https://searx.perennialte.ch',
      'https://search.demoniak.ch'
    ];
  }

  async search(query, options = {}) {
    const { timeRange = 'month', limit = 15 } = options;
    const results = [];

    for (const inst of this.instances) {
      try {
        const url = `${inst}/search?q=${encodeURIComponent(query)}&format=json&time_range=${timeRange}`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(4000)
        });

        if (res.ok && res.headers.get('content-type')?.includes('json')) {
          const data = await res.json();
          let rank = 1;
          for (const item of (data.results || []).slice(0, limit)) {
            if (item.url && item.title) {
              results.push({
                url: item.url,
                title: item.title.replace(/<[^>]*>/g, '').trim(),
                snippet: (item.content || item.snippet || '').replace(/<[^>]*>/g, '').trim(),
                engine: 'searxng',
                query,
                rank: rank++,
                sourceDomain: extractHostname(item.url)
              });
            }
          }
          if (results.length > 0) break;
        }
      } catch (err) {
        // Try next instance
      }
    }

    return results;
  }
}

export const SearXNGSearchProvider = SearXNGProvider;

/**
 * 3. DuckDuckGo Search Provider
 */
export class DuckDuckGoProvider extends BaseSearchProvider {
  constructor() {
    super('duckduckgo');
  }

  async search(query, options = {}) {
    const { limit = 10 } = options;
    const results = [];

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&df=m`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const html = await res.text();
        const snippetBlocks = [...html.matchAll(/<div class=\"result__body\">([\s\S]*?)<\/div>/g)];
        let rank = 1;

        if (snippetBlocks.length > 0) {
          for (const b of snippetBlocks) {
            const linkMatch = b[1].match(/href=\"([^\"]*uddg=[^\"]+)\"/) || b[1].match(/href=\"(https?:\/\/[^\"]+)\"/);
            const titleMatch = b[1].match(/<a class=\"result__url\"[^>]*>([\s\S]*?)<\/a>/) || b[1].match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
            const snipMatch = b[1].match(/<a class=\"result__snippet\"[^>]*>([\s\S]*?)<\/a>/);

            let cleanUrl = null;
            if (linkMatch) {
              if (linkMatch[1].includes('uddg=')) {
                const uMatch = linkMatch[1].match(/uddg=([^&]+)/);
                if (uMatch) cleanUrl = decodeURIComponent(uMatch[1]);
              } else {
                cleanUrl = linkMatch[1];
              }
            }

            if (cleanUrl && cleanUrl.startsWith('http') && !cleanUrl.includes('duckduckgo.com')) {
              results.push({
                url: cleanUrl,
                title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : query,
                snippet: snipMatch ? snipMatch[1].replace(/<[^>]*>/g, '').trim() : '',
                engine: 'duckduckgo',
                query,
                rank: rank++,
                sourceDomain: extractHostname(cleanUrl)
              });
            }
            if (results.length >= limit) break;
          }
        } else {
          // Fallback regex parsing
          const rawLinks = [...html.matchAll(/uddg=([^&\"\']+)/g)].map(m => decodeURIComponent(m[1]));
          for (const link of rawLinks) {
            if (link.startsWith('http') && !link.includes('duckduckgo.com') && !link.includes('bing.com/aclick')) {
              results.push({
                url: link,
                title: query,
                snippet: '',
                engine: 'duckduckgo',
                query,
                rank: rank++,
                sourceDomain: extractHostname(link)
              });
            }
            if (results.length >= limit) break;
          }
        }
      }
    } catch (e) {
      console.warn(`[DuckDuckGoProvider] Notice for "${query}":`, e.message);
    }

    return results;
  }
}

export const DuckDuckGoSearchProvider = DuckDuckGoProvider;

/**
 * 4. Serper.dev Google Search Provider
 */
export class SerperProvider extends BaseSearchProvider {
  constructor(apiKey = null) {
    super('serper');
    this.apiKey = apiKey || process.env.SERPER_API_KEY;
  }

  async search(query, options = {}) {
    const { limit = 15, timeRange = 'm' } = options;
    const results = [];

    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY is not configured');
    }

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: limit,
          tbs: timeRange === 'm' ? 'qdr:m' : 'qdr:w'
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        throw new Error(`Serper API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      let rank = 1;

      for (const item of (data.organic || [])) {
        if (item.link) {
          results.push({
            url: item.link,
            title: item.title || query,
            snippet: item.snippet || '',
            engine: 'serper',
            query,
            rank: rank++,
            sourceDomain: extractHostname(item.link)
          });
        }
        if (results.length >= limit) break;
      }
    } catch (err) {
      console.warn(`[SerperProvider] Query "${query}" failed:`, err.message);
      throw err;
    }

    return results;
  }
}

/**
 * 5. SerpApi Google Search Provider
 */
export class SerpApiProvider extends BaseSearchProvider {
  constructor(apiKey = null) {
    super('serpapi');
    this.apiKey = apiKey || process.env.SERPAPI_API_KEY;
  }

  async search(query, options = {}) {
    const { limit = 15 } = options;
    const results = [];

    if (!this.apiKey) {
      throw new Error('SERPAPI_API_KEY is not configured');
    }

    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${limit}&tbs=qdr:m&api_key=${this.apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (!res.ok) {
        throw new Error(`SerpApi returned HTTP ${res.status}`);
      }

      const data = await res.json();
      let rank = 1;

      for (const item of (data.organic_results || [])) {
        if (item.link) {
          results.push({
            url: item.link,
            title: item.title || query,
            snippet: item.snippet || '',
            engine: 'serpapi',
            query,
            rank: rank++,
            sourceDomain: extractHostname(item.link)
          });
        }
        if (results.length >= limit) break;
      }
    } catch (err) {
      console.warn(`[SerpApiProvider] Query "${query}" failed:`, err.message);
      throw err;
    }

    return results;
  }
}

/**
 * Evaluates SERP result set quality deterministically.
 * Uses ALL 4 core metrics:
 * 1. validCandidateRatio
 * 2. emptySnippetRatio
 * 3. irrelevantDomainRatio
 * 4. duplicateRatio
 * 
 * @param {Array<Object>} results 
 * @returns {Object} { isHighQuality, qualityScore, metrics, summary }
 */
export function evaluateSearchResultQuality(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      isHighQuality: false,
      qualityScore: 0,
      metrics: {
        count: 0,
        validCandidateRatio: 0,
        emptySnippetRatio: 1,
        irrelevantDomainRatio: 1,
        duplicateRatio: 0
      },
      summary: 'Empty results set'
    };
  }

  const total = results.length;
  const IRRELEVANT_DOMAINS = new Set([
    'merriam-webster.com',
    'dictionary.cambridge.org',
    'en.wikipedia.org',
    'wikipedia.org',
    'thefreedictionary.com',
    'vocabulary.com',
    'dictionary.com',
    'imdb.com',
    'workindia.in',
    'naukri.com',
    'indeed.com',
    'glassdoor.com',
    'jooble.org',
    'coursera.org',
    'udemy.com',
    'geeksforgeeks.org',
    'w3schools.com'
  ]);

  let emptySnippets = 0;
  let irrelevantDomains = 0;
  const seenUrls = new Set();
  let duplicateCount = 0;
  let validCandidates = 0;

  for (const r of results) {
    const d = (r.sourceDomain || extractHostname(r.url)).toLowerCase();
    
    // Check duplicate
    if (seenUrls.has(r.url)) {
      duplicateCount++;
    } else {
      seenUrls.add(r.url);
    }

    // Check snippet density
    const hasSnippet = typeof r.snippet === 'string' && r.snippet.trim().length >= 15;
    if (!hasSnippet) {
      emptySnippets++;
    }

    // Check irrelevant/blocked domains
    const isIrrelevant = IRRELEVANT_DOMAINS.has(d) ||
                         d.includes('dictionary') ||
                         d.includes('wiki') ||
                         /\b(jobs?|career|vacancy)\b/i.test(d);
    if (isIrrelevant) {
      irrelevantDomains++;
    }

    // Candidate is valid if not irrelevant and has content
    if (!isIrrelevant && hasSnippet) {
      validCandidates++;
    }
  }

  const validCandidateRatio = Number((validCandidates / total).toFixed(3));
  const emptySnippetRatio = Number((emptySnippets / total).toFixed(3));
  const irrelevantDomainRatio = Number((irrelevantDomains / total).toFixed(3));
  const duplicateRatio = Number((duplicateCount / total).toFixed(3));

  // Deterministic Quality Score Formula combining all 4 metrics:
  // Quality increases with valid candidates and penalizes empty snippets, irrelevant domains, and duplicates
  let qualityScore = (validCandidateRatio * 0.50) +
                     ((1 - irrelevantDomainRatio) * 0.25) +
                     ((1 - emptySnippetRatio) * 0.15) +
                     ((1 - duplicateRatio) * 0.10);
  
  qualityScore = Number(Math.max(0, Math.min(1, qualityScore)).toFixed(3));

  // A result set is considered high-quality if it has at least 3 results and qualityScore >= 0.40
  const isHighQuality = total >= 3 && qualityScore >= 0.40 && irrelevantDomainRatio < 0.60;

  return {
    isHighQuality,
    qualityScore,
    metrics: {
      count: total,
      validCandidateRatio,
      emptySnippetRatio,
      irrelevantDomainRatio,
      duplicateRatio
    },
    summary: isHighQuality
      ? `High quality: score ${qualityScore} (valid ${validCandidateRatio}, irrelevant ${irrelevantDomainRatio})`
      : `Poor quality: score ${qualityScore} (valid ${validCandidateRatio}, irrelevant ${irrelevantDomainRatio})`
  };
}

/**
 * 6. Multi-Provider Search Manager V2
 * Supports primary provider, deterministic quality check, fallback chain, and enrichment
 */
export class MultiSearchManager {
  constructor(config = {}) {
    this.primaryName = config.primaryProvider || process.env.SEARCH_PROVIDER || 'bing';
    this.fallbackChain = config.fallbackChain || (process.env.FALLBACK_SEARCH_PROVIDERS
      ? process.env.FALLBACK_SEARCH_PROVIDERS.split(',').map(s => s.trim().toLowerCase())
      : ['searxng', 'duckduckgo']);
    this.enableEnrichment = config.enableEnrichment ?? (process.env.ENABLE_SEARCH_ENRICHMENT === 'true');

    this.providerMap = new Map([
      ['bing', new BingProvider()],
      ['searxng', new SearXNGProvider()],
      ['duckduckgo', new DuckDuckGoProvider()],
      ['serper', new SerperProvider()],
      ['serpapi', new SerpApiProvider()]
    ]);
  }

  getProvider(name) {
    return this.providerMap.get(name.toLowerCase()) || null;
  }

  /**
   * Executes search with deterministic quality check and fallback chain
   * @param {string} query
   * @param {Object} options
   * @returns {Promise<Object>} { provider, results, quality, fallbackOccurred }
   */
  async searchWithFallback(query, options = {}) {
    const primary = this.getProvider(this.primaryName) || this.getProvider('bing');
    let activeResults = [];
    let activeProvider = primary ? primary.name : 'none';
    let fallbackOccurred = false;

    // Step 1: Run Primary Provider
    if (primary) {
      try {
        activeResults = await primary.search(query, options);
      } catch (err) {
        console.warn(`[MultiSearchManager] Primary ${primary.name} threw error: ${err.message}`);
      }
    }

    // Step 2: Evaluate Result Quality Deterministically
    let qualityEval = evaluateSearchResultQuality(activeResults);

    // Step 3: Trigger Fallback Chain if count < 3 OR quality is poor OR provider failed
    const needsFallback = activeResults.length < 3 || !qualityEval.isHighQuality;

    if (needsFallback) {
      for (const fallbackName of this.fallbackChain) {
        if (fallbackName === activeProvider) continue;
        const fallbackProvider = this.getProvider(fallbackName);
        if (!fallbackProvider) continue;

        try {
          const fallbackResults = await fallbackProvider.search(query, options);
          const fbQuality = evaluateSearchResultQuality(fallbackResults);

          // If fallback returns better quality or at least valid results, adopt it
          if (fallbackResults.length >= 3 && (fbQuality.qualityScore > qualityEval.qualityScore || fallbackResults.length > activeResults.length)) {
            activeResults = fallbackResults;
            activeProvider = fallbackProvider.name;
            qualityEval = fbQuality;
            fallbackOccurred = true;
            break;
          }
        } catch (fbErr) {
          // Continue down fallback chain
        }
      }
    }

    // Step 4: Optional Enrichment for high-value queries
    if (this.enableEnrichment && options.enrich) {
      const enrichmentName = this.fallbackChain.find(name => name !== activeProvider) || 'duckduckgo';
      const enrichmentProvider = this.getProvider(enrichmentName);
      if (enrichmentProvider) {
        try {
          const extra = await enrichmentProvider.search(query, { ...options, limit: 5 });
          const seen = new Set(activeResults.map(r => r.url));
          for (const item of extra) {
            if (!seen.has(item.url)) {
              seen.add(item.url);
              activeResults.push(item);
            }
          }
        } catch (e) {}
      }
    }

    return {
      provider: activeProvider,
      results: activeResults,
      quality: qualityEval,
      fallbackOccurred
    };
  }

  /**
   * Run a batch of queries with deduplication
   */
  async batchSearch(queries = [], options = {}) {
    const allResults = [];
    const seenUrls = new Set();

    for (const q of queries) {
      const { provider, results } = await this.searchWithFallback(q, options);
      for (const r of results) {
        const cleanUrl = r.url.split('?utm_')[0].split('&utm_')[0];
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          allResults.push({ ...r, url: cleanUrl });
        }
      }
      await new Promise(res => setTimeout(res, 400));
    }

    return allResults;
  }
}
