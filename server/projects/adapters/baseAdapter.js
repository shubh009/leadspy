/**
 * Base Adapter Interface for Project Discovery Sources
 */
export class BaseAdapter {
  constructor(name, tier = 'P1') {
    this.name = name;
    this.tier = tier;
  }

  /**
   * Fetch raw candidate posts from the source.
   * @param {Object} options - Search or pagination options
   * @returns {Promise<Array<RawCandidate>>}
   */
  async fetchCandidates(options = {}) {
    throw new Error(`fetchCandidates not implemented for ${this.name}`);
  }

  /**
   * Standardize raw source post to uniform candidate structure
   */
  normalizeCandidate(raw) {
    return {
      source: this.name,
      priorityTier: this.tier,
      sourcePostId: raw.id || '',
      sourceUrl: raw.url || '',
      rawTitle: raw.title || '',
      rawContent: raw.content || '',
      author: raw.author || 'Anonymous',
      authorProfileUrl: raw.authorProfileUrl || '',
      postedAt: raw.postedAt || new Date().toISOString()
    };
  }
}
