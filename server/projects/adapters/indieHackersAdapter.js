import { BaseAdapter } from './baseAdapter.js';

/**
 * Indie Hackers Adapter (P1 Priority)
 * Discovers projects, MVPs, and agency requirements posted by founders on Indie Hackers
 */
export class IndieHackersAdapter extends BaseAdapter {
  constructor() {
    super('indiehackers', 'P1');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    try {
      // Fetch public RSS feed of looking for partner / tech cofounder / developer projects
      const res = await fetch('https://feed.indiehackers.world', {
        headers: {
          'User-Agent': 'LeadSpyBot/1.0 (IT Project Discovery; +https://leadspy.app)'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const text = await res.text();
        const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

        const intentKeywords = [
          'developer', 'agency', 'contractor', 'build', 'mvp', 'saas', 'app',
          'website', 'looking for', 'need help', 'hiring', 'partner', 'technical'
        ];

        for (const item of items.slice(0, 30)) {
          const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
          const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
          const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>?/gm, ' ').trim() || title;
          const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();

          const lower = `${title} ${desc}`.toLowerCase();
          const hasIntent = intentKeywords.some(kw => lower.includes(kw));

          if (hasIntent && link) {
            candidates.push(this.normalizeCandidate({
              id: `ih-${Buffer.from(link).toString('base64').substring(0, 16)}`,
              url: link,
              title: title,
              content: `${title} | Indie Hackers Project: ${desc.substring(0, 600)}`,
              author: 'Indie Hacker Founder',
              authorProfileUrl: link,
              postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
            }));
          }
        }
      }
    } catch (err) {
      console.warn('[IndieHackersAdapter] Notice:', err.message);
    }

    return candidates;
  }
}
