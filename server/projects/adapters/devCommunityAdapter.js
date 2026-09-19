import { BaseAdapter } from './baseAdapter.js';

/**
 * DEV Community Adapter (P2 Priority)
 * Discovers project collaborations, contracts, and hiring posts from dev.to
 */
export class DevCommunityAdapter extends BaseAdapter {
  constructor() {
    super('dev_to', 'P2');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    const tags = ['hiring', 'freelance', 'contract', 'project'];

    for (const tag of tags) {
      try {
        const url = `https://dev.to/api/articles?tag=${tag}&per_page=15`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'LeadSpyBot/1.0 (+https://leadspy.app)'
          },
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const articles = await res.json();
          if (Array.isArray(articles)) {
            for (const a of articles) {
              if (!a.url || !a.title) continue;

              candidates.push(this.normalizeCandidate({
                id: `devto-${a.id}`,
                url: a.url,
                title: a.title,
                content: `${a.title} | Tags: ${a.tag_list?.join(', ')}. ${a.description || a.title}`,
                author: a.user?.name || a.user?.username || 'DEV Community Author',
                authorProfileUrl: a.user?.profile_image || a.url,
                postedAt: a.published_at || new Date().toISOString()
              }));
            }
          }
        }
      } catch (err) {
        console.warn(`[DevCommunityAdapter] Error fetching tag ${tag}:`, err.message);
      }
    }

    return candidates;
  }
}
