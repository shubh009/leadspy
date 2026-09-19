import { BaseAdapter } from './baseAdapter.js';

/**
 * Hashnode Adapter (P2 Priority)
 * Monitors developer stories, startup announcements, and technical project requirements
 */
export class HashnodeAdapter extends BaseAdapter {
  constructor() {
    super('hashnode', 'P2');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    try {
      // Fetch Hashnode public feed stories with tech project keywords
      const res = await fetch('https://hashnode.com/feed', {
        headers: {
          'User-Agent': 'LeadSpyBot/1.0 (+https://leadspy.app)'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const text = await res.text();
        const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

        const keywords = ['project', 'developer', 'agency', 'contract', 'freelance', 'mvp', 'building', 'launching', 'saas'];

        for (const item of items.slice(0, 20)) {
          const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
          const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
          const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>?/gm, ' ').trim() || title;
          const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();

          const lower = `${title} ${desc}`.toLowerCase();
          const matches = keywords.some(kw => lower.includes(kw));

          if (matches && link) {
            candidates.push(this.normalizeCandidate({
              id: `hn-${Buffer.from(link).toString('base64').substring(0, 16)}`,
              url: link,
              title: title,
              content: `${title} | Hashnode Story: ${desc.substring(0, 600)}`,
              author: 'Hashnode Creator',
              authorProfileUrl: link,
              postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
            }));
          }
        }
      }
    } catch (err) {
      console.warn('[HashnodeAdapter] Notice:', err.message);
    }

    return candidates;
  }
}
