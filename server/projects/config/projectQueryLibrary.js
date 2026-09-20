/**
 * LeadSpy Central IT Project Discovery Query Library - V2
 * File: server/projects/config/projectQueryLibrary.js
 * 
 * Supports:
 * 1. Extended Query Metadata Model (intentType, deliverableType, sourceScope, qualityTier, negativeTerms, allowedDomains)
 * 2. 5 Dedicated High-Intent Query Packs (A-E)
 * 3. Demoted Broad Queries (LOW priority probe status)
 * 4. Source-specific queries and negative operators
 */

export const QUERY_PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

export const DISCOVERY_MODE = {
  STANDARD: 'standard',
  HIGH_INTENT: 'high_intent'
};

export const DEFAULT_NEGATIVE_TERMS = [
  '-job', '-jobs', '-careers', '-salary', '-resume', '-internship',
  '-course', '-tutorial', '-dictionary', '-wikipedia', '-definition'
];

/**
 * Helper to construct normalized query objects with extended metadata
 */
function createQuery(query, opts = {}) {
  return {
    query,
    priority: opts.priority || QUERY_PRIORITY.HIGH,
    intentType: opts.intentType || 'buyer_request',
    deliverableType: opts.deliverableType || 'custom_software',
    sourceScope: opts.sourceScope || 'public_web',
    qualityTier: opts.qualityTier || 'A',
    negativeTerms: opts.negativeTerms || DEFAULT_NEGATIVE_TERMS,
    allowedDomains: opts.allowedDomains || null,
    category: opts.category || 'generic'
  };
}

/**
 * Dedicated High-Intent Project Discovery Queries (Packs A - E)
 */
export const highIntentProjectQueries = [
  // PACK A — Direct Buyer Intent
  createQuery('looking for development agency web application', { intentType: 'outsourcing', deliverableType: 'web_app', qualityTier: 'A' }),
  createQuery('need someone to build SaaS', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
  createQuery('looking to outsource software development', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('seeking software development agency', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('looking for development team MVP', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
  createQuery('need custom software developed', { intentType: 'buyer_request', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('looking for software development company', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('need technology partner', { intentType: 'company_request', deliverableType: 'custom_software', qualityTier: 'A' }),

  // PACK B — Project / Procurement
  createQuery('request for proposal software development', { intentType: 'rfp', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('RFP web application', { intentType: 'rfp', deliverableType: 'web_app', qualityTier: 'A' }),
  createQuery('scope of work custom software', { intentType: 'project_requirement', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('fixed price project developer', { intentType: 'project_requirement', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('send proposal mobile app development', { intentType: 'rfp', deliverableType: 'mobile_app', qualityTier: 'A' }),
  createQuery('software development project proposal', { intentType: 'rfp', deliverableType: 'custom_software', qualityTier: 'A' }),

  // PACK C — Business Requirements
  createQuery('need CRM for our business', { intentType: 'business_problem', deliverableType: 'crm', qualityTier: 'A' }),
  createQuery('need customer portal built', { intentType: 'business_problem', deliverableType: 'web_app', qualityTier: 'A' }),
  createQuery('need booking system developed', { intentType: 'business_problem', deliverableType: 'booking', qualityTier: 'A' }),
  createQuery('need property management software built', { intentType: 'business_problem', deliverableType: 'custom_software', qualityTier: 'A' }),
  createQuery('need inventory management software', { intentType: 'business_problem', deliverableType: 'erp', qualityTier: 'A' }),
  createQuery('need internal dashboard', { intentType: 'business_problem', deliverableType: 'web_app', qualityTier: 'A' }),

  // PACK D — Deliverable Specific
  createQuery('need web application built', { intentType: 'buyer_request', deliverableType: 'web_app', qualityTier: 'B' }),
  createQuery('need mobile app developed', { intentType: 'buyer_request', deliverableType: 'mobile_app', qualityTier: 'B' }),
  createQuery('need SaaS platform built', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'B' }),
  createQuery('need AI agent developed', { intentType: 'buyer_request', deliverableType: 'ai', qualityTier: 'B' }),
  createQuery('need automation system built', { intentType: 'buyer_request', deliverableType: 'automation', qualityTier: 'B' }),
  createQuery('need API integration', { intentType: 'buyer_request', deliverableType: 'api', qualityTier: 'B' }),
  createQuery('need custom WordPress development', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'B' }),
  createQuery('need Shopify app developed', { intentType: 'buyer_request', deliverableType: 'ecommerce', qualityTier: 'B' }),

  // PACK E — Maintenance / Existing Projects
  createQuery('need website redesign', { intentType: 'maintenance', deliverableType: 'website', qualityTier: 'B' }),
  createQuery('need web app maintenance', { intentType: 'maintenance', deliverableType: 'web_app', qualityTier: 'B' }),
  createQuery('need developer to fix production app', { intentType: 'maintenance', deliverableType: 'custom_software', qualityTier: 'B' }),
  createQuery('looking for agency to maintain software', { intentType: 'maintenance', deliverableType: 'custom_software', qualityTier: 'B' })
];

/**
 * Categorized Master Project Query Library with Extended Metadata
 */
export const projectQueryLibrary = {
  // 1. Generic High-Intent Client Queries
  generic: [
    createQuery('need someone to build a website', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('looking for someone to build a website', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need someone to build an app', { intentType: 'buyer_request', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('looking for someone to build an app', { intentType: 'buyer_request', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('need someone to build a platform', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('looking for someone to build a platform', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('need someone to build our platform', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('need someone to build an MVP', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('looking for someone to build an MVP', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('need someone to develop software', { intentType: 'buyer_request', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('looking for developer', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('need developer', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('developer', { priority: QUERY_PRIORITY.LOW, qualityTier: 'C' }) // Demoted probe query
  ],

  // 2. Custom Software Development
  software: [
    createQuery('need custom software', { intentType: 'buyer_request', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('need custom software development', { intentType: 'buyer_request', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('looking for custom software development agency', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('looking for software development agency', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('looking for software development company', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('need software developed for our business', { intentType: 'business_problem', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('looking for software development team', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('need software development partner', { intentType: 'company_request', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('planning to build custom software', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('software development project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('software development', { priority: QUERY_PRIORITY.LOW, qualityTier: 'C' }) // Demoted probe query
  ],

  // 3. Website & Web Applications
  website: [
    createQuery('need a website', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need a website built', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('looking for web development agency', { intentType: 'outsourcing', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('looking for web development company', { intentType: 'outsourcing', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need web application developed', { intentType: 'buyer_request', deliverableType: 'web_app', qualityTier: 'A' }),
    createQuery('looking for agency to build website', { intentType: 'outsourcing', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need a modern web application', { intentType: 'buyer_request', deliverableType: 'web_app', qualityTier: 'A' }),
    createQuery('need full stack web developer for project', { intentType: 'project_requirement', deliverableType: 'web_app', qualityTier: 'A' }),
    createQuery('planning to build a website', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('web development project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('website project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('website', { priority: QUERY_PRIORITY.LOW, qualityTier: 'C' }) // Demoted probe query
  ],

  // 4. Mobile Apps (iOS, Android, Cross-platform)
  mobileApp: [
    createQuery('need mobile app development', { intentType: 'buyer_request', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('looking for mobile app development agency', { intentType: 'outsourcing', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('need an app built for our business', { intentType: 'business_problem', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('looking for iOS app developer for project', { intentType: 'project_requirement', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('looking for Flutter developer to build app', { intentType: 'project_requirement', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('need React Native app built', { intentType: 'buyer_request', deliverableType: 'mobile_app', qualityTier: 'A' }),
    createQuery('mobile application project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('mobile application', { priority: QUERY_PRIORITY.LOW, qualityTier: 'C' })
  ],

  // 5. SaaS Platforms & MVP
  saas: [
    createQuery('need SaaS platform built', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('looking for agency to build SaaS MVP', { intentType: 'outsourcing', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('need development team to build MVP', { intentType: 'outsourcing', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('seeking developers for micro SaaS', { intentType: 'project_requirement', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('SaaS development project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('SaaS platform', { priority: QUERY_PRIORITY.LOW, qualityTier: 'C' })
  ],

  // 6. E-Commerce
  ecommerce: [
    createQuery('need ecommerce website built', { intentType: 'buyer_request', deliverableType: 'ecommerce', qualityTier: 'A' }),
    createQuery('looking for Shopify expert to build store', { intentType: 'project_requirement', deliverableType: 'ecommerce', qualityTier: 'A' }),
    createQuery('need custom WooCommerce development', { intentType: 'buyer_request', deliverableType: 'ecommerce', qualityTier: 'A' }),
    createQuery('need marketplace website developed', { intentType: 'buyer_request', deliverableType: 'ecommerce', qualityTier: 'A' }),
    createQuery('ecommerce development project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' })
  ],

  // 7. AI & Intelligent Automation
  ai: [
    createQuery('need AI agent developed', { intentType: 'buyer_request', deliverableType: 'ai', qualityTier: 'A' }),
    createQuery('looking for agency to build AI chatbot', { intentType: 'outsourcing', deliverableType: 'ai', qualityTier: 'A' }),
    createQuery('need custom LLM application built', { intentType: 'buyer_request', deliverableType: 'ai', qualityTier: 'A' }),
    createQuery('need LangChain developer for project', { intentType: 'project_requirement', deliverableType: 'ai', qualityTier: 'A' }),
    createQuery('AI application project', { priority: QUERY_PRIORITY.MEDIUM, qualityTier: 'B' }),
    createQuery('AI development', { priority: QUERY_PRIORITY.LOW, qualityTier: 'C' })
  ],

  // 8. Workflow Automation
  automation: [
    createQuery('need workflow automation built', { intentType: 'business_problem', deliverableType: 'automation', qualityTier: 'A' }),
    createQuery('need web scraping automation developed', { intentType: 'buyer_request', deliverableType: 'automation', qualityTier: 'A' }),
    createQuery('need Zapier Make automation consultant', { intentType: 'project_requirement', deliverableType: 'automation', qualityTier: 'A' })
  ],

  // 9. CRM & ERP Business Systems
  crmErp: [
    createQuery('need custom CRM developed', { intentType: 'business_problem', deliverableType: 'crm', qualityTier: 'A' }),
    createQuery('need ERP system built for business', { intentType: 'business_problem', deliverableType: 'erp', qualityTier: 'A' }),
    createQuery('looking for developer to build dashboard', { intentType: 'project_requirement', deliverableType: 'web_app', qualityTier: 'A' })
  ],

  // 10. API & System Integrations
  apiIntegration: [
    createQuery('need API integration developer', { intentType: 'buyer_request', deliverableType: 'api', qualityTier: 'A' }),
    createQuery('need developer to connect third party API', { intentType: 'project_requirement', deliverableType: 'api', qualityTier: 'A' }),
    createQuery('need payment gateway integrated', { intentType: 'buyer_request', deliverableType: 'api', qualityTier: 'A' })
  ],

  // 11. CMS & Specialized Platforms
  wordpress: [
    createQuery('need custom WordPress plugin developed', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need WordPress developer to rebuild website', { intentType: 'maintenance', deliverableType: 'website', qualityTier: 'A' })
  ],
  shopify: [
    createQuery('need custom Shopify app built', { intentType: 'buyer_request', deliverableType: 'ecommerce', qualityTier: 'A' }),
    createQuery('need developer to customize Shopify theme', { intentType: 'maintenance', deliverableType: 'ecommerce', qualityTier: 'A' })
  ],

  // 12. Startup MVP Development
  mvp: [
    createQuery('need MVP developed for startup', { intentType: 'buyer_request', deliverableType: 'saas', qualityTier: 'A' }),
    createQuery('looking for technical partner to build MVP', { intentType: 'company_request', deliverableType: 'saas', qualityTier: 'A' })
  ],

  // 13. Maintenance, Revamps & Bug Fixes
  maintenance: [
    createQuery('need developer to fix bugs in web app', { intentType: 'maintenance', deliverableType: 'web_app', qualityTier: 'A' }),
    createQuery('need website maintenance and updates', { intentType: 'maintenance', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need agency to take over web project', { intentType: 'maintenance', deliverableType: 'custom_software', qualityTier: 'A' })
  ],

  // 14. Agency & Outsourcing Direct Requests
  agencyOutsourcing: [
    createQuery('looking to outsource web development', { intentType: 'outsourcing', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('need external development team for project', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('seeking development agency for contract', { intentType: 'outsourcing', deliverableType: 'custom_software', qualityTier: 'A' })
  ],

  // 15. Explicit Business/Company Needs
  companyIntent: [
    createQuery('our company needs a website built', { intentType: 'company_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('our business needs a mobile app', { intentType: 'company_request', deliverableType: 'mobile_app', qualityTier: 'A' })
  ],

  // 16. Explicit Project Requirement Language
  projectIntent: [
    createQuery('scope of work for web application', { intentType: 'project_requirement', deliverableType: 'web_app', qualityTier: 'A' }),
    createQuery('RFP web development', { intentType: 'rfp', deliverableType: 'website', qualityTier: 'A' })
  ],

  // 17. Industry-Specific Projects
  industry: {
    realEstate: [
      createQuery('need real estate website developed', { intentType: 'business_problem', deliverableType: 'website', qualityTier: 'A' })
    ],
    healthcare: [
      createQuery('need clinic appointment booking system', { intentType: 'business_problem', deliverableType: 'booking', qualityTier: 'A' })
    ],
    education: [
      createQuery('need learning management system portal', { intentType: 'business_problem', deliverableType: 'web_app', qualityTier: 'A' })
    ],
    hospitality: [
      createQuery('need hotel booking engine developed', { intentType: 'business_problem', deliverableType: 'booking', qualityTier: 'A' })
    ],
    finance: [
      createQuery('need fintech loan calculator dashboard', { intentType: 'business_problem', deliverableType: 'web_app', qualityTier: 'A' })
    ]
  },

  // 18. Natural Conversational Queries
  naturalLanguage: [
    createQuery('can someone build a website for me', { intentType: 'buyer_request', deliverableType: 'website', qualityTier: 'A' }),
    createQuery('who can build a mobile app for our business', { intentType: 'buyer_request', deliverableType: 'mobile_app', qualityTier: 'A' })
  ],

  // 19. Budget & Payment Signaled Queries
  budget: [
    createQuery('budget for custom web development project', { intentType: 'project_requirement', deliverableType: 'web_app', qualityTier: 'A' }),
    createQuery('fixed budget to develop web app', { intentType: 'project_requirement', deliverableType: 'web_app', qualityTier: 'A' })
  ],

  // 20. Direct Contact Intent
  contact: [
    createQuery('contact developer to build software', { intentType: 'buyer_request', deliverableType: 'custom_software', qualityTier: 'A' }),
    createQuery('contact agency to develop app', { intentType: 'outsourcing', deliverableType: 'mobile_app', qualityTier: 'A' })
  ]
};

// ----------------------------------------------------
// DYNAMIC QUERY GENERATION ENGINE (Section 5)
// ----------------------------------------------------
export const QUERY_COMPONENTS = {
  INTENTS: [
    'need someone to build',
    'looking for someone to build',
    'need a team to build',
    'looking for agency to build',
    'need developer to build',
    'hiring agency to build',
    'looking to outsource',
    'need custom'
  ],
  DELIVERABLES: [
    'website',
    'web application',
    'mobile app',
    'custom software',
    'SaaS',
    'platform',
    'MVP',
    'ecommerce store',
    'CRM',
    'ERP',
    'AI application',
    'AI agent',
    'automation',
    'API integration',
    'booking system'
  ],
  PROVIDERS: [
    'developer',
    'development team',
    'development agency',
    'software company',
    'technology partner',
    'outsourcing company'
  ]
};

export function composeDynamicQueries(limit = 20) {
  const generated = [];
  for (const intent of QUERY_COMPONENTS.INTENTS) {
    for (const deliv of QUERY_COMPONENTS.DELIVERABLES) {
      for (const prov of QUERY_COMPONENTS.PROVIDERS) {
        generated.push(createQuery(`${intent} ${deliv} ${prov}`, {
          category: 'dynamic_composed',
          intentType: 'buyer_request',
          deliverableType: 'custom_software',
          qualityTier: 'A'
        }));
        if (generated.length >= limit) return generated;
      }
    }
  }
  return generated;
}

export const TARGET_PLATFORM_DOMAINS = [
  'reddit.com',
  'indiehackers.com',
  'github.com/orgs/community/discussions',
  'news.ycombinator.com'
];

export function applySiteFilter(queryStr, domain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanQuery = queryStr.replace(/^["']|["']$/g, '').trim();
  return `site:${cleanDomain} "${cleanQuery}"`;
}

// -------------------------------------------------------------
// STEP-1 V2: CONTROLLED COMBINATORIAL QUERY MATRIX & FOOTPRINTS
// -------------------------------------------------------------
export const NEGATIVE_SEARCH_OPERATORS = '-job -jobs -career -careers -salary -resume -internship -recruiter -recruitment';

export const COMBINATORIAL_DIMENSIONS = {
  BUYER_INTENTS: [
    'looking for developer',
    'need development team',
    'seeking technical partner',
    'outsourcing development',
    'looking for software team',
    'need help building'
  ],
  PROJECT_STAGES: [
    'MVP',
    'prototype',
    'new product',
    'internal tool',
    'v1',
    'migration',
    'redesign',
    'automation'
  ],
  DELIVERABLES: [
    'SaaS',
    'mobile app',
    'web application',
    'CRM',
    'ERP',
    'dashboard',
    'customer portal',
    'API integration',
    'ecommerce platform',
    'workflow automation',
    'AI application',
    'voice agent'
  ],
  BUSINESS_CONTEXTS: [
    'for our business',
    'for our startup',
    'for internal use',
    'for customers',
    'for our company'
  ]
};

export const CONTROLLED_QUERY_TEMPLATES = [
  // 1. Primary Buyer Need (Quoted intent + open terms + negative operators)
  (intent, stage, deliv, ctx) => `"${intent}" ${deliv} ${ctx} ${NEGATIVE_SEARCH_OPERATORS}`,
  // 2. Stage + Deliverable
  (intent, stage, deliv, ctx) => `"${intent}" ${stage} ${deliv} ${NEGATIVE_SEARCH_OPERATORS}`,
  // 3. Reddit Platform Footprints
  (intent, stage, deliv, ctx) => `site:reddit.com/r/forhire "[Hiring]" ${deliv}`,
  (intent, stage, deliv, ctx) => `site:reddit.com/r/freelance_forhire "[Hiring]" ${deliv}`,
  // 4. Hacker News Footprint
  (intent, stage, deliv, ctx) => `site:news.ycombinator.com "SEEKING FREELANCER" ${deliv}`,
  // 5. RFP / Procurement Footprint
  (intent, stage, deliv, ctx) => `filetype:pdf "request for proposal" "${deliv}" 2026`,
  // 6. Exploratory Query (15% allocation)
  (intent, stage, deliv, ctx) => `"${intent}" ${deliv} ${NEGATIVE_SEARCH_OPERATORS}`
];

/**
 * Deterministically generates a controlled set of queries for a cycle
 * Driven by adaptive source allocation quotas (Reddit, Hacker News, Public Web)
 * 
 * @param {Object} options - { cycle, batchSize, sourceQuotas }
 * @returns {Array<Object>} List of query objects
 */
export function generateControlledCombinatorialQueries({ cycle = 1, batchSize = 20, sourceQuotas = null } = {}) {
  const { BUYER_INTENTS, PROJECT_STAGES, DELIVERABLES, BUSINESS_CONTEXTS } = COMBINATORIAL_DIMENSIONS;
  const cycleOffset = (cycle - 1) * 3;

  // Default quota if not supplied: balanced with 15% minimum floor
  const quotas = sourceQuotas || {
    reddit: Math.max(3, Math.round(batchSize * 0.30)),
    hackernews: Math.max(3, Math.round(batchSize * 0.20)),
    public_web: batchSize - Math.max(3, Math.round(batchSize * 0.30)) - Math.max(3, Math.round(batchSize * 0.20))
  };

  const redditQueries = [];
  const hnQueries = [];
  const webQueries = [];

  // 1. Reddit Platform Footprints (quotas.reddit)
  const subreddits = ['forhire', 'freelance_forhire', 'jobbit'];
  for (let i = 0; i < quotas.reddit; i++) {
    const sub = subreddits[i % subreddits.length];
    const deliv = DELIVERABLES[(i + cycleOffset) % DELIVERABLES.length];
    const qStr = (i === 0)
      ? `site:reddit.com/r/${sub} "[Hiring]" "${deliv}"`
      : (i % 2 === 0)
        ? `site:reddit.com/r/${sub} "[Hiring]" "${deliv}" OR "custom software"`
        : `site:reddit.com/r/${sub} "need developer" OR "looking to hire" ${deliv}`;

    redditQueries.push(createQuery(qStr, {
      priority: QUERY_PRIORITY.HIGH,
      intentType: 'buyer_request',
      deliverableType: deliv.toLowerCase().replace(/\s+/g, '_'),
      sourceScope: 'reddit',
      qualityTier: 'A',
      category: 'footprint_reddit'
    }));
  }

  // 2. Hacker News Platform Footprints (quotas.hackernews)
  const hnFootprints = ['"SEEKING FREELANCER"', '"need someone to build"', '"looking for agency"'];
  for (let i = 0; i < quotas.hackernews; i++) {
    const fp = hnFootprints[i % hnFootprints.length];
    const shift = Math.floor(i / hnFootprints.length);
    const deliv = DELIVERABLES[(i * 2 + cycleOffset + shift) % DELIVERABLES.length];
    hnQueries.push(createQuery(`site:news.ycombinator.com ${fp} ${deliv}`, {
      priority: QUERY_PRIORITY.HIGH,
      intentType: 'buyer_request',
      deliverableType: deliv.toLowerCase().replace(/\s+/g, '_'),
      sourceScope: 'hackernews',
      qualityTier: 'A',
      category: 'footprint_hackernews'
    }));
  }

  // 3. Public Web Combinatorial, RFP & Exploratory Queries (quotas.public_web)
  let webCount = quotas.public_web;
  // RFP query as part of public web
  if (webCount > 0) {
    const rfpDeliv = DELIVERABLES[(cycleOffset + 2) % DELIVERABLES.length];
    webQueries.push(createQuery(`filetype:pdf "request for proposal" "${rfpDeliv}" 2026`, {
      priority: QUERY_PRIORITY.HIGH,
      intentType: 'rfp',
      deliverableType: rfpDeliv.toLowerCase().replace(/\s+/g, '_'),
      sourceScope: 'public_web',
      qualityTier: 'A',
      category: 'footprint_rfp'
    }));
    webCount--;
  }

  // Exploratory queries (at least 1, up to 3)
  const exploratoryCount = Math.min(3, Math.max(1, Math.floor(webCount * 0.25)));
  const targetedCount = webCount - exploratoryCount;

  // Targeted Combinatorial queries
  for (let i = 0; i < targetedCount; i++) {
    const intent = BUYER_INTENTS[(i + cycleOffset) % BUYER_INTENTS.length];
    const stage = PROJECT_STAGES[(i + cycleOffset) % PROJECT_STAGES.length];
    const deliv = DELIVERABLES[(i + cycleOffset) % DELIVERABLES.length];
    const ctx = BUSINESS_CONTEXTS[(i + cycleOffset) % BUSINESS_CONTEXTS.length];

    const qStr = (i % 2 === 0)
      ? `"${intent}" ${stage} ${deliv} ${NEGATIVE_SEARCH_OPERATORS}`
      : `"${intent}" ${deliv} ${ctx} ${NEGATIVE_SEARCH_OPERATORS}`;

    webQueries.push(createQuery(qStr, {
      priority: QUERY_PRIORITY.HIGH,
      intentType: 'buyer_request',
      deliverableType: deliv.toLowerCase().replace(/\s+/g, '_'),
      sourceScope: 'public_web',
      qualityTier: 'A',
      category: 'combinatorial_targeted'
    }));
  }

  // Exploratory queries
  for (let i = 0; i < exploratoryCount; i++) {
    const intent = BUYER_INTENTS[(i + cycleOffset + 4) % BUYER_INTENTS.length];
    const deliv = DELIVERABLES[(i + cycleOffset + 6) % DELIVERABLES.length];
    webQueries.push(createQuery(`"${intent}" ${deliv} ${NEGATIVE_SEARCH_OPERATORS}`, {
      priority: QUERY_PRIORITY.MEDIUM,
      intentType: 'buyer_request',
      deliverableType: deliv.toLowerCase().replace(/\s+/g, '_'),
      sourceScope: 'public_web',
      qualityTier: 'B',
      category: 'exploratory'
    }));
  }

  // Combine in prioritized balanced sequence
  const combined = [...redditQueries, ...hnQueries, ...webQueries];
  return combined.slice(0, batchSize);
}

