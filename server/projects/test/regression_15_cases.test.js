import { ProjectClassifier } from '../ai/projectClassifier.js';

async function runRegression15() {
  console.log('================================================================');
  console.log('🧪 RUNNING MANDATORY 15-CASE REGRESSION TEST SUITE');
  console.log('================================================================\n');

  const classifier = new ProjectClassifier();
  classifier.apiKey = null; // Test deterministic qualification engine

  const tests = [
    {
      id: 1,
      name: 'GitHub issue with genuine software development requirement',
      candidate: {
        source: 'github',
        author: 'project_founder',
        rawTitle: '[Help Wanted] Need external agency to develop React & Node customer dashboard',
        rawContent: 'Our startup is seeking a development agency or contractor to build our React dashboard and PostgreSQL API. We have a paid budget of $5,000 for this project. Please reach out to dev-team@cloudsaas.io',
        sourceUrl: 'https://github.com/my-org/project-repo/issues/101'
      },
      expectStatus: 'qualified'
    },
    {
      id: 2,
      name: 'Hacker News technical discussion',
      candidate: {
        source: 'hackernews',
        author: 'hn_coder',
        rawTitle: 'Ask HN: Which frontend framework is better for production?',
        rawContent: 'I am wondering whether React or Svelte is more maintainable in long-term enterprise applications. What are your experiences?',
        sourceUrl: 'https://news.ycombinator.com/item?id=49756122'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 3,
      name: 'Reddit: [HIRING] Hiring marketers $50 weekly',
      candidate: {
        source: 'reddit',
        author: 'marketing_lead',
        rawTitle: '[HIRING] Hiring marketers $50 weekly',
        rawContent: 'Looking for marketers to promote our social media and do Instagram posting. $50 weekly pay.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/mk1'
      },
      expectStatus: 'rejected',
      expectReason: ['NON_IT_SERVICE', 'NOT_IT_PROJECT', 'EMPLOYMENT']
    },
    {
      id: 4,
      name: 'Normal product homepage: https://www.opautoclicker.com/',
      candidate: {
        source: 'web',
        author: 'OPAutoClicker Team',
        rawTitle: 'OP Auto Clicker - Free Automated Mouse Clicker Tool',
        rawContent: 'A full-fledged autokey clicker with two modes of clicking, at your dynamic cursor location or at a prespecified location. Download our software tool.',
        sourceUrl: 'https://www.opautoclicker.com/'
      },
      expectStatus: 'rejected',
      expectReason: ['PRODUCT_OR_COMPANY_PAGE', 'NO_PROJECT_REQUIREMENT', 'GENERAL_DISCUSSION']
    },
    {
      id: 5,
      name: 'I need someone to build a website for my company',
      candidate: {
        source: 'web',
        author: 'Biz Owner',
        rawTitle: 'I need someone to build a website for my company',
        rawContent: 'We need someone to build a modern website for our consultancy company. Contact us at projects@bizconsult.org.',
        sourceUrl: 'https://bizconsult.org/hiring-dev'
      },
      expectStatus: 'qualified'
    },
    {
      id: 6,
      name: 'I am a React developer available for freelance projects',
      candidate: {
        source: 'reddit',
        author: 'react_dev_99',
        rawTitle: 'I am a React developer available for freelance projects',
        rawContent: 'I am a developer looking for freelance projects. Available for hire. Check my portfolio at https://portfolio.me. Contact me via DM.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/dev99'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 7,
      name: 'Looking for an agency to build our SaaS',
      candidate: {
        source: 'web',
        author: 'SaaS Founder',
        rawTitle: 'Looking for an agency to build our SaaS',
        rawContent: 'We are looking for an agency to build our SaaS platform with payments and analytics. Email us at founder@launchsaas.io.',
        sourceUrl: 'https://launchsaas.io/rfp'
      },
      expectStatus: 'qualified'
    },
    {
      id: 8,
      name: 'Which stack should I use for my SaaS?',
      candidate: {
        source: 'reddit',
        author: 'curious_coder',
        rawTitle: 'Which stack should I use for my SaaS?',
        rawContent: 'I am debating between Node.js and Python for my SaaS backend. Which one scales better?',
        sourceUrl: 'https://reddit.com/r/webdev/comments/stack1'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 9,
      name: 'Need a marketer to manage Instagram',
      candidate: {
        source: 'reddit',
        author: 'brand_growth',
        rawTitle: 'Need a marketer to manage Instagram',
        rawContent: 'We need a marketer to create daily reels and manage Instagram community. Pay is $20/hr. DM me.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/mkt2'
      },
      expectStatus: 'rejected',
      expectReason: ['NON_IT_SERVICE', 'NOT_IT_PROJECT']
    },
    {
      id: 10,
      name: 'Need marketing automation software',
      candidate: {
        source: 'web',
        author: 'Marketing Firm',
        rawTitle: 'Need marketing automation software built for our agency',
        rawContent: 'We need a developer or agency to build custom marketing automation software to sync leads from Meta ads to our database. Contact engineering@growthagency.com.',
        sourceUrl: 'https://growthagency.com/project'
      },
      expectStatus: 'qualified'
    },
    {
      id: 11,
      name: 'Need a developer for a full-time position, $120k salary',
      candidate: {
        source: 'reddit',
        author: 'tech_hr',
        rawTitle: 'Need a developer for a full-time position, $120k salary',
        rawContent: 'We are hiring a full-time frontend developer for a permanent employee role. $120k salary with 401k. Send resume to hr@corp.com.',
        sourceUrl: 'https://reddit.com/r/jobbit/comments/sal1'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 12,
      name: 'Hiring external software development agency for our CRM',
      candidate: {
        source: 'web',
        author: 'Enterprise Sales',
        rawTitle: 'Hiring external software development agency for our CRM',
        rawContent: 'Our company is hiring an external software development agency to build and customize our CRM platform. Contact us at vendor@enterprisecrm.com.',
        sourceUrl: 'https://enterprisecrm.com/rfp'
      },
      expectStatus: 'qualified'
    },
    {
      id: 13,
      name: 'Software project I completed last year',
      candidate: {
        source: 'web',
        author: 'Showcase Dev',
        rawTitle: 'Software project I completed last year',
        rawContent: 'Here is a retrospective of a software project I completed last year using React and PostgreSQL. Read my thoughts on architecture.',
        sourceUrl: 'https://devblog.io/my-project'
      },
      expectStatus: 'rejected',
      expectReason: ['NO_PROJECT_REQUIREMENT', 'GENERAL_DISCUSSION']
    },
    {
      id: 14,
      name: 'Here is our software website',
      candidate: {
        source: 'web',
        author: 'App Team',
        rawTitle: 'Here is our software website',
        rawContent: 'Welcome to our software website. We build tools for productivity. Check out our features and download.',
        sourceUrl: 'https://ourcoolsoftware.io/'
      },
      expectStatus: 'rejected',
      expectReason: ['PRODUCT_OR_COMPANY_PAGE', 'NO_PROJECT_REQUIREMENT']
    },
    {
      id: 15,
      name: 'Need someone to fix our production API',
      candidate: {
        source: 'web',
        author: 'CTO FinTech',
        rawTitle: 'Need someone to fix our production API',
        rawContent: 'Our payment webhook service is throwing 500 errors. We need an experienced Node.js developer to fix our production API ASAP. Budget $1,500. Contact: cto@payquick.io',
        sourceUrl: 'https://payquick.io/urgent-fix'
      },
      expectStatus: 'qualified'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const res = await classifier.qualifyAndExtract(t.candidate);
    let ok = true;
    let errs = [];

    if (res.qualification_status !== t.expectStatus) {
      ok = false;
      errs.push(`Expected '${t.expectStatus}', got '${res.qualification_status}'`);
    }

    if (t.expectReason) {
      const allowed = Array.isArray(t.expectReason) ? t.expectReason : [t.expectReason];
      if (!allowed.includes(res.rejection_reason)) {
        ok = false;
        errs.push(`Expected reason in [${allowed.join(', ')}], got '${res.rejection_reason}'`);
      }
    }

    if (ok) {
      console.log(`✅ [PASS] TEST ${t.id}: ${t.name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] TEST ${t.id}: ${t.name}`);
      errs.forEach(e => console.error(`       -> ${e}`));
      console.error(`       -> Result:`, JSON.stringify(res, null, 2));
      failed++;
    }
  }

  console.log('\n================================================================');
  console.log(`REGRESSION TEST SUMMARY: Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runRegression15().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
