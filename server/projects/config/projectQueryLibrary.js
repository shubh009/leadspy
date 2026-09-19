/**
 * LeadSpy Central IT Project Discovery Query Library
 * File: server/projects/config/projectQueryLibrary.js
 * 
 * Single Source of Truth for all Search & Discovery queries.
 * DO NOT duplicate search strings in other files.
 */

export const QUERY_PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

/**
 * Categorized Master Project Query Library
 * Similar wordings are intentional to maximize search engine result variety.
 */
export const projectQueryLibrary = {
  // 1. Generic High-Intent Client Queries
  generic: [
    { query: 'need someone to build a website', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for someone to build a website', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to build an app', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for someone to build an app', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to build a platform', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for someone to build a platform', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to build our platform', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to build an MVP', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for someone to build an MVP', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to develop software', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for developer', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'need developer', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'developer', priority: QUERY_PRIORITY.LOW }
  ],

  // 2. Custom Software Development
  software: [
    { query: 'need custom software', priority: QUERY_PRIORITY.HIGH },
    { query: 'need custom software development', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for custom software development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for software development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for software development company', priority: QUERY_PRIORITY.HIGH },
    { query: 'need software developed for our business', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for software development team', priority: QUERY_PRIORITY.HIGH },
    { query: 'need software development partner', priority: QUERY_PRIORITY.HIGH },
    { query: 'planning to build custom software', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'software development project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'software development', priority: QUERY_PRIORITY.LOW }
  ],

  // 3. Website & Web Applications
  website: [
    { query: 'need a website', priority: QUERY_PRIORITY.HIGH },
    { query: 'need a website built', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for web development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for web development company', priority: QUERY_PRIORITY.HIGH },
    { query: 'need web application developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build website', priority: QUERY_PRIORITY.HIGH },
    { query: 'need a modern web application', priority: QUERY_PRIORITY.HIGH },
    { query: 'need full stack web developer for project', priority: QUERY_PRIORITY.HIGH },
    { query: 'planning to build a website', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'web development project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'website project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'website', priority: QUERY_PRIORITY.LOW }
  ],

  // 4. Mobile Apps (iOS, Android, Cross-platform)
  mobileApp: [
    { query: 'need mobile app development', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for mobile app development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'need iOS and Android app developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for Flutter developer for mobile app', priority: QUERY_PRIORITY.HIGH },
    { query: 'need React Native app developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'need mobile app built from scratch', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for mobile app development company', priority: QUERY_PRIORITY.HIGH },
    { query: 'planning to build an app', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'mobile app project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'mobile application', priority: QUERY_PRIORITY.LOW }
  ],

  // 5. SaaS Platforms & MVPs
  saas: [
    { query: 'need someone to build a SaaS', priority: QUERY_PRIORITY.HIGH },
    { query: 'need SaaS development', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build SaaS platform', priority: QUERY_PRIORITY.HIGH },
    { query: 'need B2B SaaS platform built', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for development team for SaaS MVP', priority: QUERY_PRIORITY.HIGH },
    { query: 'need micro-SaaS built', priority: QUERY_PRIORITY.HIGH },
    { query: 'planning to build a SaaS', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'SaaS development project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'SaaS platform', priority: QUERY_PRIORITY.LOW }
  ],

  // 6. E-Commerce & Online Stores
  ecommerce: [
    { query: 'need custom ecommerce store developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for ecommerce development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'need online shopping portal built', priority: QUERY_PRIORITY.HIGH },
    { query: 'need multi-vendor marketplace developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build ecommerce platform', priority: QUERY_PRIORITY.HIGH },
    { query: 'ecommerce website project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'online store development', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 7. Artificial Intelligence & ML
  ai: [
    { query: 'need AI development', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for AI development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'need AI agent development', priority: QUERY_PRIORITY.HIGH },
    { query: 'need custom LLM application developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build AI chatbot', priority: QUERY_PRIORITY.HIGH },
    { query: 'need voice AI agent built', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for AI/ML engineering team', priority: QUERY_PRIORITY.HIGH },
    { query: 'AI application project', priority: QUERY_PRIORITY.MEDIUM },
    { query: 'AI development', priority: QUERY_PRIORITY.LOW }
  ],

  // 8. Workflow Automation & Integration
  automation: [
    { query: 'need automation development', priority: QUERY_PRIORITY.HIGH },
    { query: 'need workflow automation built', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency for business process automation', priority: QUERY_PRIORITY.HIGH },
    { query: 'need Python automation script and dashboard', priority: QUERY_PRIORITY.HIGH },
    { query: 'need RPA automation developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'automation project', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 9. CRM & ERP Systems
  crmErp: [
    { query: 'need custom CRM development', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build custom ERP', priority: QUERY_PRIORITY.HIGH },
    { query: 'need customer portal and CRM built', priority: QUERY_PRIORITY.HIGH },
    { query: 'need inventory management system developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for developer for internal ERP system', priority: QUERY_PRIORITY.HIGH },
    { query: 'CRM development project', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 10. API Development & Third-Party Integration
  apiIntegration: [
    { query: 'need API integration developer', priority: QUERY_PRIORITY.HIGH },
    { query: 'need payment gateway integration developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build RESTful API backend', priority: QUERY_PRIORITY.HIGH },
    { query: 'need custom API development and webhook sync', priority: QUERY_PRIORITY.HIGH },
    { query: 'API integration project', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 11. WordPress & CMS Solutions
  wordpress: [
    { query: 'need custom WordPress website built', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for WordPress development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'need custom WordPress theme and plugin development', priority: QUERY_PRIORITY.HIGH },
    { query: 'WordPress development project', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 12. Shopify Store & Apps
  shopify: [
    { query: 'need Shopify expert to build store', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for Shopify development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'need custom Shopify app developed', priority: QUERY_PRIORITY.HIGH },
    { query: 'Shopify store development', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 13. Startup MVP Building
  mvp: [
    { query: 'need MVP development', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to build MVP', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to build startup MVP', priority: QUERY_PRIORITY.HIGH },
    { query: 'need rapid prototype and MVP development', priority: QUERY_PRIORITY.HIGH },
    { query: 'startup MVP project', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 14. Redesign & Maintenance
  maintenance: [
    { query: 'need website redesign', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for agency to revamp our website', priority: QUERY_PRIORITY.HIGH },
    { query: 'need ongoing website maintenance partner', priority: QUERY_PRIORITY.HIGH },
    { query: 'need bug fixing and maintenance for web app', priority: QUERY_PRIORITY.HIGH },
    { query: 'website redesign project', priority: QUERY_PRIORITY.MEDIUM }
  ],

  // 15. Agency Outsourcing & Dedicated Teams
  agencyOutsourcing: [
    { query: 'looking for web development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for software development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'need a development team', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for development team', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking for technology partner', priority: QUERY_PRIORITY.HIGH },
    { query: 'looking to outsource software development project', priority: QUERY_PRIORITY.HIGH },
    { query: 'RFP software development agency', priority: QUERY_PRIORITY.HIGH }
  ],

  // 16. Company Project Intent
  companyIntent: [
    { query: 'our company is looking for a development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'our startup needs a development team', priority: QUERY_PRIORITY.HIGH },
    { query: 'seeking external software development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'hiring software development agency for upcoming project', priority: QUERY_PRIORITY.HIGH },
    { query: 'request for proposal software development', priority: QUERY_PRIORITY.HIGH }
  ],

  // 17. Project Intent Keywords
  projectIntent: [
    { query: 'scope of work software development project', priority: QUERY_PRIORITY.HIGH },
    { query: 'project requirements document web application', priority: QUERY_PRIORITY.HIGH },
    { query: 'fixed price software development project', priority: QUERY_PRIORITY.HIGH },
    { query: 'contract software development project', priority: QUERY_PRIORITY.HIGH }
  ],

  // 18. Industry-Specific Client Opportunities
  industry: {
    realEstate: [
      { query: 'need real estate website with MLS integration', priority: QUERY_PRIORITY.HIGH },
      { query: 'looking for agency to build real estate portal', priority: QUERY_PRIORITY.HIGH },
      { query: 'need property listing mobile app developed', priority: QUERY_PRIORITY.HIGH }
    ],
    healthcare: [
      { query: 'need healthcare portal and appointment booking system', priority: QUERY_PRIORITY.HIGH },
      { query: 'looking for agency to develop clinic management software', priority: QUERY_PRIORITY.HIGH },
      { query: 'need telemedicine mobile application built', priority: QUERY_PRIORITY.HIGH }
    ],
    education: [
      { query: 'need custom LMS learning management system built', priority: QUERY_PRIORITY.HIGH },
      { query: 'looking for agency to develop edtech platform', priority: QUERY_PRIORITY.HIGH },
      { query: 'need student portal and course website developed', priority: QUERY_PRIORITY.HIGH }
    ],
    hospitality: [
      { query: 'need hotel booking and reservation website built', priority: QUERY_PRIORITY.HIGH },
      { query: 'looking for agency to develop restaurant ordering system', priority: QUERY_PRIORITY.HIGH }
    ],
    finance: [
      { query: 'need fintech dashboard and payment portal built', priority: QUERY_PRIORITY.HIGH },
      { query: 'looking for agency to develop investment platform', priority: QUERY_PRIORITY.HIGH }
    ]
  },

  // 19. Natural Language Client Expressions
  naturalLanguage: [
    { query: 'can anyone recommend a good web development agency', priority: QUERY_PRIORITY.HIGH },
    { query: 'who can build our startup MVP', priority: QUERY_PRIORITY.HIGH },
    { query: 'where can I hire a reliable development team for a project', priority: QUERY_PRIORITY.HIGH },
    { query: 'need someone to take over our web development project', priority: QUERY_PRIORITY.HIGH }
  ],

  // 20. Budgeted Intent Signals
  budget: [
    { query: 'budget $5000 to build website', priority: QUERY_PRIORITY.HIGH },
    { query: 'budget $10000 custom software development', priority: QUERY_PRIORITY.HIGH },
    { query: 'fixed price contract web application', priority: QUERY_PRIORITY.HIGH }
  ],

  // 21. Contact Direct Signals
  contact: [
    { query: 'send portfolio and quote web development', priority: QUERY_PRIORITY.HIGH },
    { query: 'send proposal for software development project', priority: QUERY_PRIORITY.HIGH },
    { query: 'email proposals to software project', priority: QUERY_PRIORITY.HIGH }
  ]
};

// ----------------------------------------------------
// DYNAMIC QUERY COMPOSITION GRAMMAR (Section 5)
// ----------------------------------------------------
export const QUERY_COMPONENTS = {
  INTENTS: [
    'need',
    'looking for',
    'searching for',
    'want',
    'planning to',
    'seeking'
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
  ],
  MODIFIERS: [
    'custom',
    'new',
    'from scratch',
    'redesign',
    'development',
    'build',
    'implementation'
  ]
};

/**
 * Generate sensible dynamic queries based on grammar combinations
 */
export function composeDynamicQueries(limit = 20) {
  const generated = [];
  const templates = [
    (intent, deliverable, provider) => `${intent} ${deliverable} ${provider}`,
    (intent, modifier, deliverable) => `${intent} ${modifier} ${deliverable}`,
    (intent, deliverable) => `${intent} someone to build a ${deliverable}`,
    (intent, provider, deliverable) => `${intent} ${provider} to build ${deliverable}`
  ];

  for (const intent of QUERY_COMPONENTS.INTENTS) {
    for (const deliv of QUERY_COMPONENTS.DELIVERABLES) {
      for (const prov of QUERY_COMPONENTS.PROVIDERS) {
        generated.push({
          query: `${intent} ${deliv} ${prov}`,
          priority: QUERY_PRIORITY.HIGH,
          category: 'dynamic_composed'
        });
        if (generated.length >= limit) return generated;
      }
    }
  }

  return generated;
}

// ----------------------------------------------------
// SITE-SPECIFIC PREFIXES & OPERATORS (Section 6)
// ----------------------------------------------------
export const TARGET_PLATFORM_DOMAINS = [
  'reddit.com',
  'indiehackers.com',
  'github.com/orgs/community/discussions',
  'news.ycombinator.com'
];

/**
 * Attach site operator to a query
 */
export function applySiteFilter(queryStr, domain) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanQuery = queryStr.replace(/^["']|["']$/g, '').trim();
  return `site:${cleanDomain} "${cleanQuery}"`;
}
