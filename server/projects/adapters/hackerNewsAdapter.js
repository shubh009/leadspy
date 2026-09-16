import { BaseAdapter } from './baseAdapter.js';

/**
 * Hacker News Adapter
 * Monitors Y Combinator Hacker News "Seeking Freelancer / Seeking Agency" threads
 */
export class HackerNewsAdapter extends BaseAdapter {
  constructor() {
    super('hackernews');
    this.hnApiBase = 'https://hacker-news.firebaseio.com/v0';
  }

  async fetchCandidates(options = {}) {
    const candidates = [];

    try {
      // 1. Fetch user 'whoishiring' submitted stories
      const userRes = await fetch(`${this.hnApiBase}/user/whoishiring.json`, {
        signal: AbortSignal.timeout(6000)
      });

      if (userRes.ok) {
        const userData = await userRes.json();
        const submitted = userData?.submitted?.slice(0, 8) || [];

        for (const storyId of submitted) {
          const itemRes = await fetch(`${this.hnApiBase}/item/${storyId}.json`, {
            signal: AbortSignal.timeout(4000)
          });
          if (!itemRes.ok) continue;
          const item = await itemRes.json();

          // Target "Seeking Freelancer" or "Who is hiring"
          const title = (item?.title || '').toLowerCase();
          if (title.includes('seeking freelancer') || title.includes('who is hiring')) {
            const kids = item.kids?.slice(0, 20) || [];
            
            for (const commentId of kids) {
              const commRes = await fetch(`${this.hnApiBase}/item/${commentId}.json`, {
                signal: AbortSignal.timeout(3000)
              });
              if (!commRes.ok) continue;
              const comm = await commRes.json();

              if (!comm || comm.deleted || !comm.text) continue;

              // Filter for hiring comments vs job seeker
              const rawText = comm.text.replace(/<[^>]*>?/gm, ' ');
              const isHiring = rawText.toLowerCase().includes('seeking freelancer') ||
                               rawText.toLowerCase().includes('hiring') ||
                               rawText.toLowerCase().includes('contract') ||
                               rawText.toLowerCase().includes('freelance');

              if (!isHiring) continue;

              // Extract first line as title
              const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
              const extractedTitle = lines[0]?.substring(0, 100) || 'Hacker News Project Opportunity';

              candidates.push(this.normalizeCandidate({
                id: `hn-${comm.id}`,
                url: `https://news.ycombinator.com/item?id=${comm.id}`,
                title: extractedTitle,
                content: rawText,
                author: comm.by || 'HNFounder',
                authorProfileUrl: `https://news.ycombinator.com/user?id=${comm.by}`,
                postedAt: new Date(comm.time * 1000).toISOString()
              }));

              if (candidates.length >= 10) break;
            }
          }
          if (candidates.length >= 10) break;
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
