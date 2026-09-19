import { RedditAdapter } from '../adapters/redditAdapter.js';
import { IndieHackersAdapter } from '../adapters/indieHackersAdapter.js';
import { GitHubDiscussionsAdapter } from '../adapters/githubDiscussionsAdapter.js';
import { GoogleDorkAdapter } from '../adapters/googleDorkAdapter.js';
import { HackerNewsAdapter } from '../adapters/hackerNewsAdapter.js';
import { XPublicAdapter } from '../adapters/xPublicAdapter.js';
import { DevCommunityAdapter } from '../adapters/devCommunityAdapter.js';
import { HashnodeAdapter } from '../adapters/hashnodeAdapter.js';
import { RemoteOkAdapter } from '../adapters/remoteOkAdapter.js';
import { StartupForumsAdapter } from '../adapters/startupForumsAdapter.js';
import { IndiaProjectsAdapter } from '../adapters/indiaProjectsAdapter.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from './projectDbService.js';

export class DiscoveryService {
  constructor() {
    // Structured by exact User Defined Priority Tiers:
    // P1: Reddit, Indie Hackers, GitHub Discussions, Public web / Google discovery
    this.p1Adapters = [
      new RedditAdapter(),
      new IndieHackersAdapter(),
      new GitHubDiscussionsAdapter(),
      new GoogleDorkAdapter()
    ];

    // P2: Hacker News, X public content, DEV Community, Hashnode, RemoteOK
    this.p2Adapters = [
      new HackerNewsAdapter(),
      new XPublicAdapter(),
      new DevCommunityAdapter(),
      new HashnodeAdapter(),
      new RemoteOkAdapter()
    ];

    // P3: Industry-specific communities, Startup forums, Niche business communities
    this.p3Adapters = [
      new StartupForumsAdapter(),
      new IndiaProjectsAdapter()
    ];

    // Consolidated prioritized list (P1 executes first, then P2, then P3)
    this.adapters = [
      ...this.p1Adapters,
      ...this.p2Adapters,
      ...this.p3Adapters
    ];

    this.classifier = new ProjectClassifier();
    this.isSyncing = false;
  }

  /**
   * Run full discovery pipeline across adapters in strict priority order (P1 -> P2 -> P3)
   * @param {Object} options
   * @param {string} options.specificSource - Optional filter for single adapter ('reddit', 'github', etc.)
   * @param {string} options.tier - Optional filter for tier ('P1', 'P2', 'P3')
   */
  async runDiscovery({ specificSource = null, tier = null } = {}) {
    if (this.isSyncing) {
      return { status: 'already_running', message: 'Discovery sync is already in progress' };
    }

    this.isSyncing = true;
    console.log('🔍 [DiscoveryService] Starting prioritized project crawl (P1 -> P2 -> P3)...');

    const stats = {
      candidatesFetched: 0,
      qualifiedProjects: 0,
      saved: 0,
      sourcesChecked: [],
      tierBreakdown: { P1: 0, P2: 0, P3: 0 }
    };

    try {
      let activeAdapters = this.adapters;

      if (specificSource) {
        activeAdapters = this.adapters.filter(a => a.name === specificSource);
      } else if (tier) {
        const targetTier = tier.toUpperCase();
        if (targetTier === 'P1') activeAdapters = this.p1Adapters;
        else if (targetTier === 'P2') activeAdapters = this.p2Adapters;
        else if (targetTier === 'P3') activeAdapters = this.p3Adapters;
      }

      for (const adapter of activeAdapters) {
        const currentTier = adapter.tier || 'P1';
        stats.sourcesChecked.push(`${adapter.name} (${currentTier})`);
        
        try {
          console.log(`📡 [DiscoveryService] [${currentTier}] Fetching from ${adapter.name}...`);
          const candidates = await adapter.fetchCandidates();
          stats.candidatesFetched += candidates.length;

          const qualifiedBatch = [];

          for (const cand of candidates) {
            try {
              const projectRecord = await this.classifier.qualifyAndExtract(cand);
              if (projectRecord && projectRecord.qualification_status === 'qualified' && projectRecord.has_actionable_contact === true) {
                qualifiedBatch.push(projectRecord);
                stats.tierBreakdown[currentTier] = (stats.tierBreakdown[currentTier] || 0) + 1;
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

      console.log(`✅ [DiscoveryService] Prioritized crawl complete: ${stats.candidatesFetched} fetched, ${stats.qualifiedProjects} qualified, ${stats.saved} new saved.`);
      return { status: 'success', stats };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const discoveryService = new DiscoveryService();
