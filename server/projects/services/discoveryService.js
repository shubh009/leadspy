import { IndiaProjectsAdapter } from '../adapters/indiaProjectsAdapter.js';
import { HackerNewsAdapter } from '../adapters/hackerNewsAdapter.js';
import { RemoteOkAdapter } from '../adapters/remoteOkAdapter.js';
import { RedditAdapter } from '../adapters/redditAdapter.js';
import { GoogleDorkAdapter } from '../adapters/googleDorkAdapter.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from './projectDbService.js';

export class DiscoveryService {
  constructor() {
    this.adapters = [
      new IndiaProjectsAdapter(),
      new HackerNewsAdapter(),
      new RemoteOkAdapter(),
      new RedditAdapter(),
      new GoogleDorkAdapter()
    ];
    this.classifier = new ProjectClassifier();
    this.isSyncing = false;
  }

  /**
   * Run full discovery pipeline across all adapters
   * @param {string} specificSource - Optional filter for single adapter ('reddit', 'hackernews', etc.)
   */
  async runDiscovery({ specificSource = null } = {}) {
    if (this.isSyncing) {
      return { status: 'already_running', message: 'Discovery sync is already in progress' };
    }

    this.isSyncing = true;
    console.log('🔍 [DiscoveryService] Starting multi-source project crawl...');

    const stats = {
      candidatesFetched: 0,
      qualifiedProjects: 0,
      saved: 0,
      sourcesChecked: []
    };

    try {
      const activeAdapters = specificSource
        ? this.adapters.filter(a => a.name === specificSource)
        : this.adapters;

      for (const adapter of activeAdapters) {
        stats.sourcesChecked.push(adapter.name);
        try {
          console.log(`📡 [DiscoveryService] Fetching candidates from ${adapter.name}...`);
          const candidates = await adapter.fetchCandidates();
          stats.candidatesFetched += candidates.length;

          const qualifiedBatch = [];

          for (const cand of candidates) {
            try {
              const projectRecord = await this.classifier.qualifyAndExtract(cand);
              if (projectRecord) {
                qualifiedBatch.push(projectRecord);
              }
            } catch (err) {
              console.warn(`[DiscoveryService] Error qualifying candidate ${cand.sourceUrl}:`, err.message);
            }
          }

          stats.qualifiedProjects += qualifiedBatch.length;

          if (qualifiedBatch.length > 0) {
            const saveResult = await saveMasterProjects(qualifiedBatch);
            stats.saved += saveResult.inserted;
          }
        } catch (sourceErr) {
          console.error(`[DiscoveryService] Adapter ${adapter.name} failed:`, sourceErr.message);
        }
      }

      console.log(`✅ [DiscoveryService] Crawl complete: ${stats.candidatesFetched} candidates fetched, ${stats.qualifiedProjects} qualified, ${stats.saved} new saved.`);
      return { status: 'success', stats };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const discoveryService = new DiscoveryService();
