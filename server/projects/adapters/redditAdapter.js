import { BaseAdapter } from './baseAdapter.js';

/**
 * Reddit Adapter
 * Monitors r/forhire, r/freelance_forhire, r/jobbit for [Hiring] opportunities
 */
export class RedditAdapter extends BaseAdapter {
  constructor() {
    super('reddit');
    this.targetSubreddits = ['forhire', 'freelance_forhire', 'jobbit', 'webdev'];
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    const headers = {
      'User-Agent': 'LeadSpyBot/1.0 (IT Project Discovery Engine; contact@leadspy.app)'
    };

    for (const sub of this.targetSubreddits) {
      try {
        const url = `https://www.reddit.com/r/${sub}/new.json?limit=25`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
        
        if (!res.ok) {
          console.warn(`[RedditAdapter] Subreddit r/${sub} returned HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const children = data?.data?.children || [];

        for (const item of children) {
          const post = item.data;
          if (!post) continue;

          // In r/forhire and r/freelance_forhire, skip obvious "[For Hire]" posts immediately
          const title = post.title || '';
          if (title.toLowerCase().includes('[for hire]') || title.toLowerCase().startsWith('for hire')) {
            continue;
          }

          // Filter for hiring indicator or tech terms
          const isHiring = title.toLowerCase().includes('[hiring]') || 
                          title.toLowerCase().includes('hiring') ||
                          title.toLowerCase().includes('looking for') ||
                          title.toLowerCase().includes('need a') ||
                          sub === 'jobbit';

          if (!isHiring && sub !== 'forhire') continue;

          candidates.push(this.normalizeCandidate({
            id: `reddit-${post.id}`,
            url: `https://www.reddit.com${post.permalink}`,
            title: post.title.replace(/^\[hiring\]\s*/i, '').trim(),
            content: post.selftext || post.title,
            author: post.author || 'RedditUser',
            authorProfileUrl: `https://www.reddit.com/user/${post.author}`,
            postedAt: new Date(post.created_utc * 1000).toISOString()
          }));
        }
      } catch (err) {
        console.warn(`[RedditAdapter] Error fetching r/${sub}:`, err.message);
      }
    }

    return candidates;
  }
}
