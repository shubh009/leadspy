import { BaseAdapter } from './baseAdapter.js';

/**
 * GitHub Discussions & Issues Adapter (P1 Priority)
 * Discovers public RFP, freelance contracts, and project bounties posted on GitHub
 */
export class GitHubDiscussionsAdapter extends BaseAdapter {
  constructor() {
    super('github', 'P1');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];
    try {
      // Query GitHub public search API for open developer / agency / RFP contracts
      const query = encodeURIComponent('is:open "looking for developer" OR "need agency" OR "contract project" OR "hiring developer" in:title,body');
      const url = `https://api.github.com/search/issues?q=${query}&sort=updated&order=desc&per_page=20`;

      const headers = {
        'User-Agent': 'LeadSpyBot-Search/1.0 (+https://leadspy.app)',
        'Accept': 'application/vnd.github.v3+json'
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];

        for (const item of items) {
          if (!item.html_url || !item.title) continue;

          // Skip PRs, only take issues / discussions
          if (item.pull_request) continue;

          candidates.push(this.normalizeCandidate({
            id: `gh-${item.id}`,
            url: item.html_url,
            title: item.title,
            content: `${item.title} | Repo: ${item.repository_url?.split('/').slice(-2).join('/') || 'GitHub'}. ${item.body?.substring(0, 700) || item.title}`,
            author: item.user?.login || 'GitHub User',
            authorProfileUrl: item.user?.html_url || item.html_url,
            postedAt: item.created_at || new Date().toISOString()
          }));
        }
      }
    } catch (err) {
      console.warn('[GitHubDiscussionsAdapter] Notice:', err.message);
    }

    return candidates;
  }
}
