import { BaseAdapter } from './baseAdapter.js';

/**
 * Startup Forums & Niche Communities Adapter (P3 Priority)
 * Discovers opportunities across startup communities, niche tech forums, and regional boards
 */
export class StartupForumsAdapter extends BaseAdapter {
  constructor() {
    super('startup_forums', 'P3');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    try {
      // Echoing tech forums & niche boards (e.g. Lobste.rs, Startup communities)
      const res = await fetch('https://lobste.rs/rss', {
        headers: { 'User-Agent': 'LeadSpyBot/1.0 (+https://leadspy.app)' },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const text = await res.text();
        const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

        const keywords = ['looking for', 'need developer', 'hiring agency', 'rfp', 'freelance project', 'mvp contract'];

        for (const item of items.slice(0, 20)) {
          const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
          const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
          const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>?/gm, ' ').trim() || title;
          const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();

          const lower = `${title} ${desc}`.toLowerCase();
          if (keywords.some(kw => lower.includes(kw)) && link) {
            candidates.push(this.normalizeCandidate({
              id: `sf-${Buffer.from(link).toString('base64').substring(0, 16)}`,
              url: link,
              title: title,
              content: `${title} | Forum Post: ${desc.substring(0, 500)}`,
              author: 'Community Founder',
              authorProfileUrl: link,
              postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
            }));
          }
        }
      }
    } catch (err) {
      console.warn('[StartupForumsAdapter] Notice:', err.message);
    }

    return candidates;
  }
}
