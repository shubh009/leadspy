import { BaseAdapter } from './baseAdapter.js';

/**
 * India Projects Adapter
 * Discovers IT projects, web/mobile development contracts, and freelance gigs from Indian clients & startups
 * Locations: Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, Remote India
 */
export class IndiaProjectsAdapter extends BaseAdapter {
  constructor() {
    super('india_tech');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];

    // 1. Fetch live tech projects from Indian boards (Hasjob)
    try {
      const res = await fetch('https://hasjob.co/feed', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadSpyBot/1.0; +https://leadspy.app)' },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const xml = await res.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

        // Tech filter keywords
        const techKeywords = ['developer', 'engineer', 'frontend', 'backend', 'full stack', 'react', 'node', 'python', 'flutter', 'ui', 'ux', 'web', 'ai', 'mobile', 'software'];

        for (const e of entries) {
          const rawTitle = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
          const link = (e.match(/<link\s+href=\"([^\"]+)\"/) || [])[1] || '';
          const loc = (e.match(/<location>([\s\S]*?)<\/location>/) || [])[1]?.trim() || 'India';
          const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ').trim() || rawTitle;

          // Check if it's tech/IT
          const lower = `${rawTitle} ${content}`.toLowerCase();
          const isTech = techKeywords.some(kw => lower.includes(kw));

          if (isTech && link) {
            candidates.push(this.normalizeCandidate({
              id: `in-${Buffer.from(link).toString('base64').substring(0, 16)}`,
              url: link,
              title: `${rawTitle} (${loc}, India)`,
              content: `${rawTitle} | Location: ${loc}, India | Client Project Requirement: ${content.substring(0, 500)}`,
              author: 'Indian Startup / Client',
              authorProfileUrl: link,
              postedAt: new Date().toISOString()
            }));
          }
        }
      }
    } catch (err) {
      console.warn('[IndiaProjectsAdapter] Hasjob fetch error:', err.message);
    }

    return candidates;
  }
}
