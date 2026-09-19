/**
 * LeadSpy Multi-Provider Search Engine Abstraction (Layer 2)
 * Orchestrates web queries across Bing, SearXNG, DuckDuckGo, and Google.
 * Prevents single-point-of-failure or IP rate-limit blocks.
 */

export class BaseSearchProvider {
  constructor(name) {
    this.name = name;
  }

  async search(query, options = {}) {
    throw new Error(`search() not implemented in ${this.name}`);
  }
}

/**
 * 1. Bing Web Search Provider
 * Supports date filtering and decodes destination URLs from base64 redirects.
 */
export class BingSearchProvider extends BaseSearchProvider {
  constructor() {
    super('bing');
  }

  async search(query, options = {}) {
    const { timeRange = 'month', limit = 15 } = options;
    const results = [];

    try {
      // Bing freshness filter: 'filterui:age-14d' or 'filterui:age-1m'
      const ageFilter = timeRange === 'month' ? 'filterui:age-1m' : 'filterui:age-14d';
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&qft=+${ageFilter}`;

      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(7000)
      });

      if (!res.ok) return results;

      const html = await res.text();
      const blocks = [...html.matchAll(/<li\s+class=\"b_algo\"[\s\S]*?<\/li>/g)];

      for (const block of blocks) {
        const uMatch = block[0].match(/u=a1([A-Za-z0-9+/=_-]+)/);
        const titleMatch = block[0].match(/<h2><a[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block[0].match(/<p[^>]*>([\s\S]*?)<\/p>/) || block[0].match(/<div class=\"b_caption\"[^>]*>([\s\S]*?)<\/div>/);

        if (uMatch) {
          try {
            const rawBase64 = uMatch[1].replace(/-/g, '+').replace(/_/g, '/');
            const targetUrl = Buffer.from(rawBase64, 'base64').toString('utf-8');

            if (targetUrl.startsWith('http')) {
              results.push({
                url: targetUrl,
                title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : query,
                snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '',
                engine: 'bing',
                query
              });
            }
          } catch (e) {
            // Ignore decoding error
          }
        }

        if (results.length >= limit) break;
      }
    } catch (err) {
      console.warn(`[BingSearchProvider] Notice for "${query}":`, err.message);
    }

    return results;
  }
}

/**
 * 2. SearXNG Search Provider
 * Rotates across public SearXNG instances for privacy-focused web results.
 */
export class SearXNGSearchProvider extends BaseSearchProvider {
  constructor() {
    super('searxng');
    this.instances = [
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
          signal: AbortSignal.timeout(3500)
        });

        if (res.ok && res.headers.get('content-type')?.includes('json')) {
          const data = await res.json();
          for (const item of (data.results || []).slice(0, limit)) {
            if (item.url && item.title) {
              results.push({
                url: item.url,
                title: item.title,
                snippet: item.content || item.snippet || '',
                engine: 'searxng',
                query
              });
            }
          }
          if (results.length > 0) break; // Succeeded on this instance
        }
      } catch (err) {
        // Try next instance
      }
    }

    return results;
  }
}

/**
 * 3. DuckDuckGo / Fallback Search Provider
 */
export class DuckDuckGoSearchProvider extends BaseSearchProvider {
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const html = await res.text();
        const rawLinks = [...html.matchAll(/uddg=([^&\"\']+)/g)].map(m => decodeURIComponent(m[1]));
        for (const link of rawLinks) {
          if (link.startsWith('http') && !link.includes('duckduckgo.com') && !link.includes('bing.com/aclick')) {
            results.push({
              url: link,
              title: query,
              snippet: '',
              engine: 'duckduckgo',
              query
            });
          }
          if (results.length >= limit) break;
        }
      }
    } catch (e) {}

    return results;
  }
}

/**
 * 4. Multi-Provider Search Manager
 * Executes queries through available providers with fallback redundancy.
 */
export class MultiSearchManager {
  constructor(providers = null) {
    this.providers = providers || [
      new BingSearchProvider(),
      new SearXNGSearchProvider(),
      new DuckDuckGoSearchProvider()
    ];
  }

  /**
   * Search across providers with automatic fallback
   */
  async searchWithFallback(query, options = {}) {
    for (const provider of this.providers) {
      try {
        const results = await provider.search(query, options);
        if (results && results.length > 0) {
          return { provider: provider.name, results };
        }
      } catch (err) {
        console.warn(`[MultiSearchManager] Provider ${provider.name} failed:`, err.message);
      }
    }
    return { provider: 'none', results: [] };
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
        // Clean URL of tracking parameters
        const cleanUrl = r.url.split('?utm_')[0].split('&utm_')[0];
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          allResults.push({ ...r, url: cleanUrl });
        }
      }
      // Small pause between search engine queries
      await new Promise(res => setTimeout(res, 400));
    }

    return allResults;
  }
}
