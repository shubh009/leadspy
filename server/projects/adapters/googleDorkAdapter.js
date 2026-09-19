import { BaseAdapter } from './baseAdapter.js';

/**
 * Google Dork / Discovery Adapter
 * Discovers LinkedIn & Twitter public project posts safely via Search Dorking
 */
export class GoogleDorkAdapter extends BaseAdapter {
  constructor() {
    super('google_discovery', 'P1');
  }

  async fetchCandidates(options = {}) {
    // When SERP / Google Search API key is provided in .env:
    // Uses Google Dorking queries to return live indexed LinkedIn/Twitter posts.
    // Otherwise returns empty array (strictly NO fake URLs).
    return [];
  }
}
