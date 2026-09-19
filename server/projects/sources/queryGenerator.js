/**
 * LeadSpy Dynamic Query & Dork Generator (Layer 1)
 * Generates platform-specific dorks and general web discovery queries.
 */

export const CORE_INTENT_QUERIES = [
  'need someone to build a website',
  'looking for a web development agency',
  'need a development team',
  'looking for software development agency',
  'need someone to build an MVP',
  'looking for mobile app development agency',
  'need someone to build a SaaS',
  'need website redesign',
  'looking for AI development agency',
  'need someone to build our platform'
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
 * Generate a combined list of search queries with optional platform filter
 */
export function generateSearchQueries(options = {}) {
  const { platform = null, limit = 20 } = options;
  let queries = [];

  if (platform) {
    queries = PLATFORM_DORKS
      .filter(p => p.platform.toLowerCase() === platform.toLowerCase())
      .map(p => p.dork);
  } else {
    // Interleave platform dorks and core intent queries
    queries = [
      ...PLATFORM_DORKS.map(p => p.dork),
      ...CORE_INTENT_QUERIES
    ];
  }

  return limit ? queries.slice(0, limit) : queries;
}
