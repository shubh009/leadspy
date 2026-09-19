import { BaseAdapter } from './baseAdapter.js';

/**
 * X (Twitter) Public Content Adapter (P2 Priority)
 * Discovers public RFP, web dev, and mobile dev opportunities posted on X / Twitter
 */
export class XPublicAdapter extends BaseAdapter {
  constructor() {
    super('x_twitter', 'P2');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    try {
      // Free public syndication / Nitter RSS feeds for targeted keywords
      // Safe fallback when Twitter official API key is not configured
      const queries = [
        'looking for developer -filter:replies',
        'need web development agency -filter:replies'
      ];

      for (const q of queries) {
        try {
          const rssUrl = `https://nitter.privacydev.net/search/rss?f=tweets&q=${encodeURIComponent(q)}`;
          const res = await fetch(rssUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            signal: AbortSignal.timeout(5000)
          });

          if (res.ok) {
            const text = await res.text();
            const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

            for (const item of items.slice(0, 10)) {
              const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
              const link = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '';
              const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>?/gm, ' ').trim() || title;
              const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim();

              if (title && link) {
                // Convert to direct x.com URL
                const cleanUrl = link.replace(/https?:\/\/[^\/]+/, 'https://x.com');
                candidates.push(this.normalizeCandidate({
                  id: `x-${Buffer.from(cleanUrl).toString('base64').substring(0, 16)}`,
                  url: cleanUrl,
                  title: title.substring(0, 120),
                  content: `${title} | X Post: ${desc.substring(0, 500)}`,
                  author: 'X User',
                  authorProfileUrl: cleanUrl,
                  postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
                }));
              }
            }
          }
        } catch (queryErr) {
          // Quietly skip if public Nitter mirror is busy
        }
      }
    } catch (err) {
      console.warn('[XPublicAdapter] Notice:', err.message);
    }

    return candidates;
  }
}
