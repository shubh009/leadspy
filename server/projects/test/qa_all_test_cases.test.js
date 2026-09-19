import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from '../services/projectDbService.js';

async function runOfficialQASuite() {
  console.log('================================================================');
  console.log('📋 RUNNING OFFICIAL QA TEST SUITE: IT_Project_Discovery_QA_Test_Cases.md');
  console.log('================================================================\n');

  const classifier = new ProjectClassifier();
  // Evaluate strictly with the current engine state
  classifier.apiKey = null;

  const testCases = [
    // ---------------------------------------------------------
    // CATEGORY A: Genuine Projects That MUST QUALIFY
    // ---------------------------------------------------------
    {
      id: 'TC-001',
      title: 'Website Development',
      candidate: {
        source: 'web',
        author: 'Apex Realty',
        rawTitle: 'Need a development team for our real estate website',
        rawContent: 'We are looking for a development team to build a new website for our real estate business. The website should have property listings, search filters, enquiry forms and an admin panel. Please contact us at hello@example.com.',
        sourceUrl: 'https://apex.com/rfp'
      },
      expectStatus: 'qualified',
      expectCategory: 'Web Development',
      expectContactType: 'email'
    },
    {
      id: 'TC-002',
      title: 'Mobile App Development',
      candidate: {
        source: 'web',
        author: 'FoodStartup',
        rawTitle: 'Need team to develop Flutter mobile application',
        rawContent: 'Our startup needs an experienced team to develop a Flutter mobile application for our food delivery business. We need customer login, restaurant listing, order tracking and online payments. Contact our company at dev@foodstartup.io for the project.',
        sourceUrl: 'https://foodstartup.io/hiring-project'
      },
      expectStatus: 'qualified',
      expectCategory: 'Mobile App'
    },
    {
      id: 'TC-003',
      title: 'SaaS MVP',
      candidate: {
        source: 'web',
        author: 'SaaS Founder',
        rawTitle: 'Looking for agency to build SaaS MVP',
        rawContent: 'We are building a SaaS platform for small businesses and need a development team to build the MVP. The product will include authentication, subscription payments, dashboard and reporting. Looking for an agency with SaaS experience. Contact: projects@saascompany.com',
        sourceUrl: 'https://saascompany.com/rfp'
      },
      expectStatus: 'qualified',
      expectCategory: 'SaaS',
      expectContactType: 'email'
    },
    {
      id: 'TC-004',
      title: 'Custom CRM',
      candidate: {
        source: 'web',
        author: 'ABC Corp',
        rawTitle: 'Need custom CRM software development',
        rawContent: 'Our sales company needs a custom CRM with lead management, follow-ups, user roles, reports and WhatsApp integration. We are looking for a software development company. Contact us at projects@abc.com.',
        sourceUrl: 'https://abc.com/crm'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-005',
      title: 'Website Redesign',
      candidate: {
        source: 'web',
        author: 'Design Studio',
        rawTitle: 'Website UI/UX Redesign & Development',
        rawContent: 'Our current company website is outdated. We need a complete UI/UX redesign, responsive implementation and performance improvements. We are looking for a web development agency. Contact: hello@company.com.',
        sourceUrl: 'https://company.com/redesign'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-006',
      title: 'AI Automation',
      candidate: {
        source: 'web',
        author: 'Automation Labs',
        rawTitle: 'Automate customer support using AI',
        rawContent: 'We are looking for a development team to automate customer support using AI. We need chatbot integration with our CRM and WhatsApp. This is a paid project. Contact: ai@example.com.',
        sourceUrl: 'https://example.com/ai-bot'
      },
      expectStatus: 'qualified',
      expectCategory: 'AI/ML',
      expectContactType: 'email'
    },
    {
      id: 'TC-007',
      title: 'Voice Agent',
      candidate: {
        source: 'web',
        author: 'Voice Realty',
        rawTitle: 'Build AI voice calling agent for real estate',
        rawContent: 'We need a team to build an AI voice calling agent for our real estate business. It should qualify leads, collect requirements and update our CRM. Contact us at projects@voiceagents.io.',
        sourceUrl: 'https://voiceagents.io/lead-caller'
      },
      expectStatus: 'qualified',
      expectCategory: 'AI/ML'
    },
    {
      id: 'TC-008',
      title: 'E-commerce',
      candidate: {
        source: 'web',
        author: 'Fashion Retail',
        rawTitle: 'E-commerce website development for fashion brand',
        rawContent: 'We need an e-commerce website for our fashion business. Shopify or WooCommerce is acceptable. Need payment gateway, product management and order tracking. Contact: ecommerce@fashionstore.com.',
        sourceUrl: 'https://fashionstore.com/new-store'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-009',
      title: 'UI/UX Project',
      candidate: {
        source: 'web',
        author: 'HealthSaaS',
        rawTitle: 'UI/UX designer needed to redesign SaaS dashboard',
        rawContent: 'We are looking for a UI/UX designer to redesign our healthcare SaaS dashboard. We already have the backend and need Figma designs for approximately 25 screens. Contact: design@healthsaas.com.',
        sourceUrl: 'https://healthsaas.com/figma'
      },
      expectStatus: 'qualified',
      expectCategory: 'UI/UX'
    },
    {
      id: 'TC-010',
      title: 'API Integration',
      candidate: {
        source: 'web',
        author: 'Commerce Integration',
        rawTitle: 'CRM with Shopify API Integration',
        rawContent: 'Our company needs help integrating our existing CRM with Shopify and our accounting software. Looking for a developer or agency for this project. Contact: integration@shopconnect.io.',
        sourceUrl: 'https://shopconnect.io/api'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },

    // ---------------------------------------------------------
    // CATEGORY B: JOBS MUST BE REJECTED
    // ---------------------------------------------------------
    {
      id: 'TC-011',
      title: 'Full-Time React Job',
      candidate: {
        source: 'reddit',
        author: 'hr_recruiter',
        rawTitle: 'Hiring React Developer Full-Time',
        rawContent: 'We are hiring a React developer for a full-time position. 3+ years experience required. Salary ₹8-12 LPA. Immediate joiner preferred.',
        sourceUrl: 'https://reddit.com/r/jobbit/comments/11'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 'TC-012',
      title: 'Node.js Employment',
      candidate: {
        source: 'web',
        author: 'TechCorp HR',
        rawTitle: 'Node.js backend developer opening',
        rawContent: 'Looking for a Node.js backend developer to join our engineering team. Full-time role. Immediate joiner preferred. 4 years experience required.',
        sourceUrl: 'https://hasjob.co/12'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 'TC-013',
      title: 'Frontend Engineer',
      candidate: {
        source: 'web',
        author: 'Software Ltd',
        rawTitle: 'Frontend Engineer - Permanent Position',
        rawContent: 'We are hiring a frontend engineer with React and TypeScript experience. This is a permanent position with annual CTC.',
        sourceUrl: 'https://careers.com/13'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 'TC-014',
      title: 'Fresher Hiring',
      candidate: {
        source: 'india_tech',
        author: 'Services Co',
        rawTitle: 'Fresher Hiring for Software Team',
        rawContent: 'We are hiring freshers for our software development team. Candidates with knowledge of JavaScript and React can apply.',
        sourceUrl: 'https://hasjob.co/14'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },

    // ---------------------------------------------------------
    // CATEGORY C: INTERNSHIPS MUST BE REJECTED
    // ---------------------------------------------------------
    {
      id: 'TC-015',
      title: 'React Internship',
      candidate: {
        source: 'web',
        author: 'Startup HR',
        rawTitle: 'React JS Internship',
        rawContent: 'React JS internship opportunity for college students. Stipend ₹10,000/month. Freshers welcome.',
        sourceUrl: 'https://hasjob.co/15'
      },
      expectStatus: 'rejected',
      expectReason: 'INTERNSHIP'
    },
    {
      id: 'TC-016',
      title: 'Software Development Internship',
      candidate: {
        source: 'web',
        author: 'EdTech',
        rawTitle: 'Software Development Intern (6 Months)',
        rawContent: 'We are looking for a software development intern for a 6-month internship program.',
        sourceUrl: 'https://hasjob.co/16'
      },
      expectStatus: 'rejected',
      expectReason: 'INTERNSHIP'
    },

    // ---------------------------------------------------------
    // CATEGORY D: FREELANCERS SEEKING WORK MUST BE REJECTED
    // ---------------------------------------------------------
    {
      id: 'TC-017',
      title: 'Developer Looking for Work',
      candidate: {
        source: 'reddit',
        author: 'react_guy',
        rawTitle: 'React Developer with 5 years experience',
        rawContent: 'I am a React developer with 5 years of experience and currently looking for freelance projects. DM me if you need a website.',
        sourceUrl: 'https://reddit.com/r/forhire/17'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 'TC-018',
      title: 'Freelancer Promotion',
      candidate: {
        source: 'reddit',
        author: 'code_freelance',
        rawTitle: 'Available for freelance work',
        rawContent: 'I can build React, Node.js and Next.js applications. Available for freelance work. Contact me for projects.',
        sourceUrl: 'https://reddit.com/r/freelance_forhire/18'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 'TC-019',
      title: 'Agency Looking for Clients',
      candidate: {
        source: 'reddit',
        author: 'agency_lead',
        rawTitle: 'Boutique dev agency looking for clients',
        rawContent: 'We are a software development agency specializing in website and mobile app development. We are looking for new clients.',
        sourceUrl: 'https://reddit.com/r/forhire/19'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },

    // ---------------------------------------------------------
    // CATEGORY E: GENERAL DISCUSSION MUST BE REJECTED
    // ---------------------------------------------------------
    {
      id: 'TC-020',
      title: 'Technology Question',
      candidate: {
        source: 'reddit',
        author: 'tech_user',
        rawTitle: 'Best technology stack?',
        rawContent: 'What is the best technology to use for building a real estate website?',
        sourceUrl: 'https://reddit.com/r/webdev/20'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 'TC-021',
      title: 'React Learning',
      candidate: {
        source: 'reddit',
        author: 'learner',
        rawTitle: 'How to start learning React?',
        rawContent: 'I want to learn React. What should I start with?',
        sourceUrl: 'https://reddit.com/r/webdev/21'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 'TC-022',
      title: 'Website Cost Discussion',
      candidate: {
        source: 'reddit',
        author: 'market_researcher',
        rawTitle: 'Average website development cost?',
        rawContent: 'I am researching website development costs. What is the average price for an e-commerce website?',
        sourceUrl: 'https://reddit.com/r/webdev/22'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 'TC-023',
      title: 'Developer Recommendation',
      candidate: {
        source: 'reddit',
        author: 'someone',
        rawTitle: 'React developer recommendation',
        rawContent: 'Can anyone recommend a good React developer?',
        sourceUrl: 'https://reddit.com/r/webdev/23'
      },
      expectStatus: 'rejected'
    },

    // ---------------------------------------------------------
    // CATEGORY F: REAL PROJECT BUT NO ACTIONABLE CONTACT
    // ---------------------------------------------------------
    {
      id: 'TC-024',
      title: 'Mobile App Without Contact',
      candidate: {
        source: 'web',
        author: 'Anonymous',
        rawTitle: 'Need mobile app built for startup',
        rawContent: 'We need someone to build a mobile app for our startup.',
        sourceUrl: 'https://someforum.com/24'
      },
      expectStatus: 'rejected',
      expectReason: 'NO_ACTIONABLE_CONTACT'
    },
    {
      id: 'TC-025',
      title: 'SaaS Project Without Contact',
      candidate: {
        source: 'web',
        author: 'Anonymous',
        rawTitle: 'Need developer for SaaS MVP',
        rawContent: 'Looking for a developer to build our SaaS MVP. Budget is $5,000.',
        sourceUrl: 'https://someforum.com/25'
      },
      expectStatus: 'rejected',
      expectReason: 'NO_ACTIONABLE_CONTACT'
    },

    // ---------------------------------------------------------
    // CATEGORY G: COMPANY OPPORTUNITIES
    // ---------------------------------------------------------
    {
      id: 'TC-026',
      title: 'Company + Public Contact Page',
      candidate: {
        source: 'web',
        author: 'ABC Realty',
        rawTitle: 'Need team to build property management mobile app',
        rawContent: 'ABC Realty is looking for a development team to build a property management mobile application. Submit project bids via https://abcrealty.com/contact',
        sourceUrl: 'https://abcrealty.com/rfp'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_business_contact'
    },
    {
      id: 'TC-027',
      title: 'Company + Public Business Email',
      candidate: {
        source: 'web',
        author: 'XYZ Healthcare',
        rawTitle: 'New website and online appointment system',
        rawContent: 'XYZ Healthcare needs a new website and online appointment system. Contact us at contact@xyzhealthcare.com',
        sourceUrl: 'https://xyzhealthcare.com/portal'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },

    // ---------------------------------------------------------
    // CATEGORY H: PUBLIC PROFILE OUTREACH
    // ---------------------------------------------------------
    {
      id: 'TC-028',
      title: 'Reddit Project With Usable Profile',
      candidate: {
        source: 'reddit',
        author: 'bistro_owner',
        rawTitle: 'Need restaurant website with table reservation',
        rawContent: 'We need a website for our restaurant with online ordering and table reservation functionality. Send me a chat / DM on Reddit.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/28',
        authorProfileUrl: 'https://reddit.com/user/bistro_owner'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_profile_message'
    },
    {
      id: 'TC-029',
      title: 'Reddit Freelancer Asking for DM',
      candidate: {
        source: 'reddit',
        author: 'coder_dave',
        rawTitle: 'Full-stack developer available',
        rawContent: "I'm a full-stack developer looking for freelance work. Please DM me if you have a project.",
        sourceUrl: 'https://reddit.com/r/forhire/comments/29'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },

    // ---------------------------------------------------------
    // CATEGORY I: AMBIGUOUS CASES
    // ---------------------------------------------------------
    {
      id: 'TC-030',
      title: 'Ambiguous Developer Requirement (No contact)',
      candidate: {
        source: 'web',
        author: 'unknown',
        rawTitle: 'Looking for React developer to build customer portal',
        rawContent: 'We are looking for a React developer to build our new customer portal.',
        sourceUrl: 'https://ambiguous.com/30'
      },
      expectStatus: 'rejected',
      expectReason: 'NO_ACTIONABLE_CONTACT'
    },
    {
      id: 'TC-031',
      title: 'Vague Startup Requirement (No deliverable)',
      candidate: {
        source: 'web',
        author: 'founder',
        rawTitle: 'Need developer ASAP for our startup',
        rawContent: 'We need a developer ASAP for our startup.',
        sourceUrl: 'https://vague.com/31'
      },
      expectStatus: 'rejected'
    },
    {
      id: 'TC-032',
      title: 'Developer for Mobile App (No contact)',
      candidate: {
        source: 'web',
        author: 'founder_x',
        rawTitle: 'Hiring a developer for our new mobile application',
        rawContent: 'Hiring a developer for our new mobile application.',
        sourceUrl: 'https://vague.com/32'
      },
      expectStatus: 'rejected'
    },

    // ---------------------------------------------------------
    // CATEGORY J: MARKETPLACE SOURCE EXCLUSION
    // ---------------------------------------------------------
    {
      id: 'TC-033',
      title: 'Freelancer.com Source Excluded',
      candidate: {
        source: 'freelancer',
        author: 'client_1',
        rawTitle: 'Need a developer to build a React website',
        rawContent: 'Need a developer to build a React website.',
        sourceUrl: 'https://freelancer.com/projects/33'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 'TC-034',
      title: 'Guru.com Source Excluded',
      candidate: {
        source: 'guru',
        author: 'client_2',
        rawTitle: 'Looking for a mobile application developer',
        rawContent: 'Looking for a mobile application developer.',
        sourceUrl: 'https://guru.com/job/34'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 'TC-035',
      title: 'PeoplePerHour Source Excluded',
      candidate: {
        source: 'peopleperhour',
        author: 'client_3',
        rawTitle: 'Need Shopify developer for e-commerce store',
        rawContent: 'Need Shopify developer for e-commerce store.',
        sourceUrl: 'https://peopleperhour.com/freelance-jobs/35'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },

    // ---------------------------------------------------------
    // CATEGORY K: FALSE POSITIVE TESTS
    // ---------------------------------------------------------
    {
      id: 'TC-036',
      title: 'Agency Self Promotion',
      candidate: {
        source: 'web',
        author: 'DevCo',
        rawTitle: 'Full-stack software agency',
        rawContent: 'Our company provides web development, mobile app development and AI services. We are looking for new clients.',
        sourceUrl: 'https://agency.com/36'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 'TC-037',
      title: 'Software Company Hiring Team Expansion',
      candidate: {
        source: 'web',
        author: 'TechTeam HR',
        rawTitle: 'Expanding engineering team',
        rawContent: 'We are expanding our engineering team and hiring React and Node.js developers.',
        sourceUrl: 'https://team.com/37'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 'TC-038',
      title: 'Website Maintenance Project',
      candidate: {
        source: 'web',
        author: 'WordPress Client',
        rawTitle: 'Need ongoing WordPress website maintenance',
        rawContent: 'We need someone to maintain our company WordPress website on a monthly basis. Please contact maintenance@sitecorp.com.',
        sourceUrl: 'https://sitecorp.com/wp-maint'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-039',
      title: 'Website Bug Fix Project',
      candidate: {
        source: 'web',
        author: 'Ecom Store',
        rawTitle: 'Need developer to fix website bugs and performance',
        rawContent: 'Our company website has several bugs and performance problems. We need a developer to fix them. Contact us at support@shopfix.com.',
        sourceUrl: 'https://shopfix.com/help'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },

    // ---------------------------------------------------------
    // CATEGORY L: DATA EXTRACTION
    // ---------------------------------------------------------
    {
      id: 'TC-040',
      title: 'USD Budget Extraction ($2,000-$5,000)',
      candidate: {
        source: 'web',
        author: 'client_usd',
        rawTitle: 'Need a React website development',
        rawContent: 'Need a React website. Budget $2,000-$5,000. Contact projects@usabuild.io.',
        sourceUrl: 'https://usabuild.io/rfp'
      },
      expectStatus: 'qualified',
      expectBudgetMin: 2000,
      expectBudgetMax: 5000,
      expectCurrency: 'USD'
    },
    {
      id: 'TC-041',
      title: 'INR Budget Extraction (₹80,000)',
      candidate: {
        source: 'india_tech',
        author: 'client_inr',
        rawTitle: 'Need a website for business in Mumbai',
        rawContent: 'Need a website for ₹80,000. Contact hello@mumbaistore.in.',
        sourceUrl: 'https://mumbaistore.in/rfp'
      },
      expectStatus: 'qualified',
      expectBudgetMin: 80000,
      expectBudgetMax: 80000,
      expectCurrency: 'INR'
    },
    {
      id: 'TC-042',
      title: 'No Budget -> Strictly null (Never guessed)',
      candidate: {
        source: 'web',
        author: 'client_nobudget',
        rawTitle: 'Need a website for our business',
        rawContent: 'Need a website for our business. Contact hello@nobudgetbiz.com.',
        sourceUrl: 'https://nobudgetbiz.com/contact'
      },
      expectStatus: 'qualified',
      expectBudget: null
    },
    {
      id: 'TC-043',
      title: 'Unknown Location -> Strictly null (Never guessed "Remote")',
      candidate: {
        source: 'web',
        author: 'client_nolocation',
        rawTitle: 'Need a developer for our SaaS platform',
        rawContent: 'Need a developer for our SaaS platform. Contact hello@cloudsaas.io.',
        sourceUrl: 'https://cloudsaas.io/project'
      },
      expectStatus: 'qualified',
      expectLocation: null
    },

    // ---------------------------------------------------------
    // CATEGORY M: CONTACT EXTRACTION
    // ---------------------------------------------------------
    {
      id: 'TC-044',
      title: 'Public Email Extraction',
      candidate: {
        source: 'web',
        author: 'Direct Emailer',
        rawTitle: 'We need a development team for our project',
        rawContent: 'We need a development team for our project. Contact us at projects@abcdev.com.',
        sourceUrl: 'https://abcdev.com/contact'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-045',
      title: 'Public Phone Extraction',
      candidate: {
        source: 'web',
        author: 'Caller Client',
        rawTitle: 'We need a development team for our project',
        rawContent: 'We need a development team for our project. Call us at +1 555 123 4567.',
        sourceUrl: 'https://phoneproject.com/rfp'
      },
      expectStatus: 'qualified',
      expectContactType: 'phone'
    },
    {
      id: 'TC-046',
      title: 'Public Company Contact Page URL Extraction',
      candidate: {
        source: 'web',
        author: 'Web Company',
        rawTitle: 'We need a development team for our website',
        rawContent: 'We need a development team for our website. Please contact us through https://mybizportal.com/contact.',
        sourceUrl: 'https://mybizportal.com/hiring'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_business_contact'
    },
    {
      id: 'TC-047',
      title: 'No Contact At All -> Rejected',
      candidate: {
        source: 'web',
        author: 'Ghost User',
        rawTitle: 'Need a development team to build our SaaS platform',
        rawContent: 'Need a development team to build our SaaS platform.',
        sourceUrl: 'https://ghostproject.com/47'
      },
      expectStatus: 'rejected',
      expectReason: 'NO_ACTIONABLE_CONTACT'
    },

    // ---------------------------------------------------------
    // CATEGORY N: DUPLICATES
    // ---------------------------------------------------------
    {
      id: 'TC-048-SEED',
      title: 'Exact Duplicate - Initial Seed',
      candidate: {
        source: 'web',
        sourcePostId: 'rfp-dup-48',
        author: 'Dupe Corp',
        rawTitle: 'Need a team to build an inventory tracking app',
        rawContent: 'Looking for a development team to build an inventory tracking application. Contact us at projects@inventorycorp.com.',
        sourceUrl: 'https://inventorycorp.com/rfp-inventory'
      },
      expectStatus: 'qualified',
      isSetup: true
    },
    {
      id: 'TC-048',
      title: 'Exact Duplicate Candidate (Same Source & Post ID)',
      candidate: {
        source: 'web',
        sourcePostId: 'rfp-dup-48',
        author: 'Dupe Corp',
        rawTitle: 'Need a team to build an inventory tracking app',
        rawContent: 'Looking for a development team to build an inventory tracking application. Contact us at projects@inventorycorp.com.',
        sourceUrl: 'https://inventorycorp.com/rfp-inventory'
      },
      expectStatus: 'rejected',
      expectReason: 'DUPLICATE'
    },
    {
      id: 'TC-049-SEED',
      title: 'Semantic Duplicate - Candidate A from Source 1',
      candidate: {
        source: 'web',
        sourcePostId: 'web-sem-49',
        author: 'RealEstate Corp',
        rawTitle: 'We need a real estate website with property listings and CRM',
        rawContent: 'We need a real estate website with property listings and CRM. Contact sales@realestatecorp49.com.',
        sourceUrl: 'https://realestatecorp49.com/rfp'
      },
      expectStatus: 'qualified',
      isSetup: true
    },
    {
      id: 'TC-049',
      title: 'Same Project Different Sources (Semantic Duplicate Clustering)',
      candidate: {
        source: 'reddit',
        sourcePostId: 'reddit-sem-49',
        author: 'ABC Realty',
        rawTitle: 'ABC Realty needs a real estate website with property listings and CRM',
        rawContent: 'ABC Realty needs a real estate website with property listings and CRM. Contact info@abcrealty49.com.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/sem49'
      },
      expectStatus: 'rejected',
      expectReason: 'DUPLICATE'
    },

    // ---------------------------------------------------------
    // CATEGORY O: SOURCE QUALITY
    // ---------------------------------------------------------
    {
      id: 'TC-050',
      title: 'Allowed Source + Valid Project + Contact',
      candidate: {
        source: 'web',
        author: 'Commerce Hub',
        rawTitle: 'Need an agency to build our e-commerce website',
        rawContent: 'We need an agency to build our e-commerce website. Contact ecommerce@allowedsource.com.',
        sourceUrl: 'https://allowedsource.com/ecommerce-rfp'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-051',
      title: 'Disallowed Source + Perfect Project',
      candidate: {
        source: 'freelancer',
        author: 'Commerce Hub',
        rawTitle: 'Need an agency to build our e-commerce website',
        rawContent: 'We need an agency to build our e-commerce website. Contact ecommerce@allowedsource.com.',
        sourceUrl: 'https://freelancer.com/projects/ecommerce-rfp'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },

    // ---------------------------------------------------------
    // CATEGORY P: NEGATIVE KEYWORD CONTEXT TESTS
    // ---------------------------------------------------------
    {
      id: 'TC-052',
      title: '"Salary" Used as a Product Feature (Must Not False-Reject)',
      candidate: {
        source: 'web',
        author: 'HR Software Co',
        rawTitle: 'Need developer to build salary calculation module',
        rawContent: 'Our HR software needs a salary calculation module integrated into the existing payroll system. Contact development@hrsoftportal.com.',
        sourceUrl: 'https://hrsoftportal.com/salary-module'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-053',
      title: '"Intern" Used in Product Context (Must Not False-Reject)',
      candidate: {
        source: 'web',
        author: 'University Labs',
        rawTitle: 'Build an internship management portal for universities',
        rawContent: 'We are building an internship management portal for universities. Need web development and an admin dashboard. Contact projects@eduportal.org.',
        sourceUrl: 'https://eduportal.org/intern-app'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },
    {
      id: 'TC-054',
      title: '"Hiring" Used for External Agency (Must Not False-Reject)',
      candidate: {
        source: 'web',
        author: 'Enterprise Corp',
        rawTitle: 'Hiring external development agency to build customer portal',
        rawContent: 'We are hiring an external development agency to build our customer portal. Contact agency@enterpriseportal.com.',
        sourceUrl: 'https://enterpriseportal.com/rfp'
      },
      expectStatus: 'qualified',
      expectContactType: 'email'
    },

    // ---------------------------------------------------------
    // CATEGORY Q: END-TO-END DISCOVERY PIPELINE
    // ---------------------------------------------------------
    {
      id: 'TC-055',
      title: 'End-to-End Real Crawler Discovery Flow',
      isPipelineTest: true,
      queries: [
        'need website developer',
        'looking for web development agency',
        'need mobile app development',
        'need SaaS development',
        'need AI automation'
      ],
      rawStream: [
        { source: 'freelancer', rawTitle: 'Need website developer', rawContent: 'Build website. Contact: test@test.com', sourceUrl: 'https://freelancer.com/1' },
        { source: 'web', rawTitle: 'Accountant needed', rawContent: 'Looking for accountant for tax filing', sourceUrl: 'https://jobs.com/2' },
        { source: 'web', rawTitle: 'Senior React Engineer', rawContent: 'Full-time position, salary 15 LPA. Join immediately.', sourceUrl: 'https://careers.com/3' },
        { source: 'web', rawTitle: 'Frontend Internship', rawContent: '3-month internship with stipend Rs 8000', sourceUrl: 'https://intern.com/4' },
        { source: 'reddit', rawTitle: 'For Hire: React developer', rawContent: 'I am available for freelance work. DM me.', sourceUrl: 'https://reddit.com/5' },
        { source: 'reddit', rawTitle: 'How to learn Vue 3?', rawContent: 'Is Vue 3 better than React? What are recommendations?', sourceUrl: 'https://reddit.com/6' },
        { source: 'web', rawTitle: 'Need SaaS application', rawContent: 'We need an experienced developer for our SaaS app.', sourceUrl: 'https://vague.com/7' },
        { source: 'web', rawTitle: 'Looking for web agency to build healthcare portal', rawContent: 'We are looking for a web agency to build our patient healthcare portal. Contact projects@healthhub.org.', sourceUrl: 'https://healthhub.org/rfp' },
        { source: 'web', rawTitle: 'Looking for web agency to build healthcare portal', rawContent: 'We are looking for a web agency to build our patient healthcare portal. Contact projects@healthhub.org.', sourceUrl: 'https://healthhub.org/rfp' }
      ],
      expectQualifiedCount: 1
    }
  ];

  let passed = 0;
  let failed = 0;
  const failureDetails = [];

  for (const tc of testCases) {
    if (tc.isPipelineTest) {
      // Execute End-to-End Crawler Pipeline Verification
      const pipelineResults = [];
      for (const cand of tc.rawStream) {
        const res = await classifier.qualifyAndExtract(cand);
        if (res.qualification_status === 'qualified' && res.has_actionable_contact) {
          pipelineResults.push(res);
        }
      }

      if (pipelineResults.length === tc.expectQualifiedCount) {
        console.log(`✅ [PASS] ${tc.id}: ${tc.title} (${pipelineResults.length} qualified out of ${tc.rawStream.length} raw candidates)`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${tc.id}: ${tc.title}`);
        console.error(`       -> Expected ${tc.expectQualifiedCount} qualified, got ${pipelineResults.length}`);
        failureDetails.push({ id: tc.id, title: tc.title, issues: [`Expected ${tc.expectQualifiedCount} qualified, got ${pipelineResults.length}`] });
        failed++;
      }
      continue;
    }

    const res = await classifier.qualifyAndExtract(tc.candidate);
    let ok = true;
    let issues = [];

    // Check Status
    if (res.qualification_status !== tc.expectStatus) {
      ok = false;
      issues.push(`Expected Status '${tc.expectStatus}', got '${res.qualification_status}'`);
    }

    // Check Rejection Reason
    if (tc.expectReason && res.rejection_reason !== tc.expectReason) {
      ok = false;
      issues.push(`Expected Reason '${tc.expectReason}', got '${res.rejection_reason}'`);
    }

    // Check Contact Type
    if (tc.expectContactType && res.contact_type !== tc.expectContactType) {
      ok = false;
      issues.push(`Expected Contact Type '${tc.expectContactType}', got '${res.contact_type}'`);
    }

    // Check Budget Min / Max
    if (tc.expectBudgetMin !== undefined && res.budgetMin !== tc.expectBudgetMin) {
      ok = false;
      issues.push(`Expected budgetMin ${tc.expectBudgetMin}, got ${res.budgetMin}`);
    }
    if (tc.expectBudgetMax !== undefined && res.budgetMax !== tc.expectBudgetMax) {
      ok = false;
      issues.push(`Expected budgetMax ${tc.expectBudgetMax}, got ${res.budgetMax}`);
    }

    // Check Null Budget
    if (tc.expectBudget !== undefined && res.budget !== tc.expectBudget) {
      ok = false;
      issues.push(`Expected budget '${tc.expectBudget}', got '${res.budget}'`);
    }

    // Check Null Location
    if (tc.expectLocation !== undefined && res.clientLocation !== tc.expectLocation) {
      ok = false;
      issues.push(`Expected location '${tc.expectLocation}', got '${res.clientLocation}'`);
    }

    if (ok) {
      console.log(`✅ [PASS] ${tc.id}: ${tc.title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${tc.id}: ${tc.title}`);
      issues.forEach(i => console.error(`       -> ${i}`));
      failureDetails.push({ id: tc.id, title: tc.title, issues, actual: res });
      failed++;
    }
  }

  console.log('\n================================================================');
  console.log(`QA TEST SUMMARY REPORT:`);
  console.log(`Total Cases Tested : ${testCases.length}`);
  console.log(`Passed Cases       : ${passed}`);
  console.log(`Failed Cases       : ${failed}`);
  console.log(`Success Rate       : ${((passed / testCases.length) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failureDetails.length > 0) {
    console.log('Detailed Failures for Inspection (No auto-fix applied):');
    failureDetails.forEach(f => {
      console.log(`- ${f.id} (${f.title}):`, f.issues.join(' | '));
    });
  }
}

runOfficialQASuite().catch(err => {
  console.error('QA Runner Error:', err);
  process.exit(1);
});
