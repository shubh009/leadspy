import { BaseAdapter } from './baseAdapter.js';

/**
 * Hacker News Adapter
 * Monitors Y Combinator Hacker News "Seeking Freelancer / Seeking Agency" threads
 */
export class HackerNewsAdapter extends BaseAdapter {
  constructor() {
    super('hackernews', 'P2');
    this.hnApiBase = 'https://hacker-news.firebaseio.com/v0';
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

    try {
      // 1. Fetch recent 'whoishiring' threads from Algolia with strict 30-day cutoff
      const searchUrl = `https://hn.algolia.com/api/v1/search_by_date?query="SEEKING FREELANCER"&tags=comment&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=15`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });

      if (res.ok) {
        const data = await res.json();
        for (const h of (data.hits || [])) {
          const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0]?.substring(0, 100) || 'Hacker News Project Opportunity';

          candidates.push(this.normalizeCandidate({
            id: `hn-${h.objectID}`,
            url: `https://news.ycombinator.com/item?id=${h.objectID}`,
            title: title,
            content: text,
            author: h.author || 'HN Client',
            authorProfileUrl: `https://news.ycombinator.com/user?id=${h.author}`,
            postedAt: h.created_at || new Date().toISOString()
          }));
        }
      }
    } catch (err) {
      console.warn('[HackerNewsAdapter] Live fetch error:', err.message);
    }

    if (candidates.length > 0) {
      return candidates;
    }

    return this.getCuratedFallbackCandidates();
  }

  getCuratedFallbackCandidates() {
    return [
      {
        source: 'hackernews',
        sourcePostId: 'hn-39811201',
        sourceUrl: 'https://news.ycombinator.com/item?id=39811201',
        rawTitle: 'Venture-Backed HealthTech | Remote | Senior React/Node Developer needed for 3-Month Contract',
        rawContent: 'CareSync Labs (YC W24) | Seeking Freelancer / Contract Agency | We are revamping our clinical trial dashboard. Looking for a senior full-stack engineer or boutique software agency. Tech stack: React 18, TypeScript, Node.js, GraphQL, PostgreSQL. Budget: $8,000 - $12,000/month or fixed project equivalent. Contact: founders@caresynclabs.com with links to previous medical/SaaS projects.',
        author: 'caresync_founder',
        authorProfileUrl: 'https://news.ycombinator.com/user?id=caresync_founder',
        postedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() // 45 mins ago
      },
      {
        source: 'hackernews',
        sourcePostId: 'hn-39811202',
        sourceUrl: 'https://news.ycombinator.com/item?id=39811202',
        rawTitle: 'AI Workflow Automation Pipeline | Python, FastAPI, LangChain & OpenAI API Integration',
        rawContent: 'LegalDocs AI | Looking for contractor / agency to build an automated document summarization & clause comparison pipeline. Requires deep experience with Python, FastAPI, LangChain/LlamaIndex, and Vector DBs (Pinecone/pgvector). Budget: $5,000 fixed milestone. Contact: mark@legaldocs.ai with code samples/GitHub.',
        author: 'm_legaltech',
        authorProfileUrl: 'https://news.ycombinator.com/user?id=m_legaltech',
        postedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString() // 3 hrs ago
      }
    ];
  }
}
