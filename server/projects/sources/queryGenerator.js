/**
 * LeadSpy Query Generator Interface
 * File: server/projects/sources/queryGenerator.js
 * 
 * Re-exports from the centralized projectQueryLibrary (Single Source of Truth)
 * and provides seamless compatibility with QueryRotatorService.
 */

import { 
  projectQueryLibrary, 
  QUERY_PRIORITY, 
  composeDynamicQueries, 
  applySiteFilter,
  TARGET_PLATFORM_DOMAINS 
} from '../config/projectQueryLibrary.js';

import { QueryRotatorService } from '../services/queryRotatorService.js';

// Backward compatibility exports
export const CORE_INTENT_QUERIES = [
  ...projectQueryLibrary.generic.filter(q => q.priority === QUERY_PRIORITY.HIGH).map(q => q.query),
  ...projectQueryLibrary.agencyOutsourcing.map(q => q.query)
];

export const PLATFORM_DORKS = [
  // Reddit targeted dorks
  { platform: 'reddit', dork: 'site:reddit.com/r/forhire "hiring" ("need website" OR "need developer" OR "build app" OR "build mvp")' },
  { platform: 'reddit', dork: 'site:reddit.com "need a website"' },
  { platform: 'reddit', dork: 'site:reddit.com "looking for web developer"' },
  { platform: 'reddit', dork: 'site:reddit.com "need an app"' },
  { platform: 'reddit', dork: 'site:reddit.com "looking for development agency"' },
  { platform: 'reddit', dork: 'site:reddit.com "need someone to build an MVP"' },
  { platform: 'reddit', dork: 'site:reddit.com "need someone to build a SaaS"' },

  // Indie Hackers targeted dorks
  { platform: 'indiehackers', dork: 'site:indiehackers.com "looking for developer"' },
  { platform: 'indiehackers', dork: 'site:indiehackers.com "need a developer"' },
  { platform: 'indiehackers', dork: 'site:indiehackers.com "looking for development agency"' },

  // GitHub Discussions & Public Contracts
  { platform: 'github', dork: 'site:github.com/orgs/community/discussions "looking for developer"' },
  { platform: 'github', dork: 'site:github.com "looking for web development agency"' },
  { platform: 'github', dork: 'site:github.com "need someone to build our platform"' },

  // Hacker News targeted dorks
  { platform: 'hackernews', dork: 'site:news.ycombinator.com "SEEKING FREELANCER"' },
  { platform: 'hackernews', dork: 'site:news.ycombinator.com "looking for developer"' },
  { platform: 'hackernews', dork: 'site:news.ycombinator.com "need a web developer"' }
];

/**
 * Generate a combined list of search queries with optional platform filter or rotator cycle
 */
export function generateSearchQueries(options = {}) {
  const { platform = null, limit = 20, cycle = 1, categories = null } = options;

  if (platform) {
    const list = PLATFORM_DORKS
      .filter(p => p.platform.toLowerCase() === platform.toLowerCase())
      .map(p => p.dork);
    return limit ? list.slice(0, limit) : list;
  }

  // Use QueryRotatorService for systematic query selection and prioritization
  const rotator = new QueryRotatorService({ batchSize: limit, cycle, categories });
  const selected = rotator.getQueriesForCycle();
  return selected.map(s => s.query);
}

export { 
  projectQueryLibrary, 
  QUERY_PRIORITY, 
  composeDynamicQueries, 
  applySiteFilter,
  TARGET_PLATFORM_DOMAINS,
  QueryRotatorService 
};
