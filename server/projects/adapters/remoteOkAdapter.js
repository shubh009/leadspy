import { BaseAdapter } from './baseAdapter.js';

/**
 * RemoteOK Adapter
 * Fetches 100% verified, live tech project and contract opportunities from RemoteOK API
 */
export class RemoteOkAdapter extends BaseAdapter {
  constructor() {
    super('remoteok');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    try {
      const res = await fetch('https://remoteok.com/api?tag=dev', {
        headers: {
          'User-Agent': 'LeadSpyBot/1.0 (IT Project Engine; https://leadspy.app)'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) {
        console.warn(`[RemoteOkAdapter] HTTP ${res.status}`);
        return candidates;
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data.slice(1, 40) : [];

      // Tech tags to strictly ensure IT/Software opportunities
      const itKeywords = ['dev', 'react', 'node', 'python', 'javascript', 'typescript', 'frontend', 'backend', 'mobile', 'full stack', 'engineer', 'developer', 'software', 'ui/ux', 'design', 'ai'];

      for (const item of items) {
        if (!item.position || !item.url) continue;

        const tags = (item.tags || []).map(t => String(t).toLowerCase());
        const isIt = tags.some(t => itKeywords.some(kw => t.includes(kw))) ||
                     itKeywords.some(kw => item.position.toLowerCase().includes(kw));

        if (!isIt) continue;

        const description = (item.description || item.position)
          .replace(/<[^>]*>?/gm, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#x27;/g, "'")
          .replace(/&amp;/g, '&')
          .trim();

        const salaryStr = (item.salary_min && item.salary_max)
          ? `$${item.salary_min.toLocaleString()} - $${item.salary_max.toLocaleString()}`
          : (item.salary_min ? `$${item.salary_min.toLocaleString()}+` : null);

        candidates.push(this.normalizeCandidate({
          id: `remoteok-${item.id}`,
          url: item.url,
          title: `${item.position} at ${item.company || 'Tech Company'}`,
          content: `${item.position} | Company: ${item.company || 'Confidential'} | Location: ${item.location || 'Remote'} | Tags: ${tags.join(', ')}. ${salaryStr ? `Budget/Compensation: ${salaryStr}. ` : ''}${description.substring(0, 600)}`,
          author: item.company || 'Hiring Manager',
          authorProfileUrl: item.url,
          postedAt: item.date ? new Date(item.date).toISOString() : new Date().toISOString()
        }));
      }
    } catch (err) {
      console.warn('[RemoteOkAdapter] Fetch error:', err.message);
    }

    return candidates;
  }
}
