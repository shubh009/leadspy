import { ProjectClassifier } from '../ai/projectClassifier.js';

async function runTests() {
  const classifier = new ProjectClassifier();
  // Force heuristic evaluation for offline deterministic assertions
  classifier.apiKey = null;

  const tests = [
    {
      id: 1,
      name: 'Full-time React job -> rejected (EMPLOYMENT)',
      candidate: {
        source: 'reddit',
        author: 'recruiter_bob',
        rawTitle: 'Hiring React Developer - Full-time position',
        rawContent: 'We are hiring a React developer for a full-time position. Annual CTC: ₹12 LPA. Send your resume/cv to hr@test.com.',
        sourceUrl: 'https://reddit.com/r/jobbit/comments/1'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 2,
      name: 'React internship -> rejected (INTERNSHIP)',
      candidate: {
        source: 'reddit',
        author: 'startup_guy',
        rawTitle: 'React Frontend Internship',
        rawContent: 'React internship, ₹10,000 stipend per month, freshers welcome. Email us at jobs@agency.in',
        sourceUrl: 'https://reddit.com/r/forhire/comments/2'
      },
      expectStatus: 'rejected',
      expectReason: 'INTERNSHIP'
    },
    {
      id: 3,
      name: 'Fresher developer job -> rejected (INTERNSHIP / EMPLOYMENT)',
      candidate: {
        source: 'reddit',
        author: 'hr_lead',
        rawTitle: 'Fresher Node.js Trainee opening',
        rawContent: 'Immediate joiner required for Junior developer job. Freshers can apply with CV.',
        sourceUrl: 'https://reddit.com/r/jobbit/comments/3'
      },
      expectStatus: 'rejected',
      expectReason: ['INTERNSHIP', 'EMPLOYMENT']
    },
    {
      id: 4,
      name: 'Freelancer seeking clients ("for hire") -> rejected (FREELANCER_SEEKING_WORK)',
      candidate: {
        source: 'reddit',
        author: 'dev_john',
        rawTitle: '[For Hire] Full Stack React & Node Developer available for freelance projects',
        rawContent: 'Hire me! I offer web development services and portfolio at https://johndoe.dev. Looking for clients. Contact: john@freelance.org',
        sourceUrl: 'https://reddit.com/r/forhire/comments/4'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 5,
      name: 'Genuine website project with email -> qualified',
      candidate: {
        source: 'web',
        author: 'Sarah Jenkins',
        rawTitle: 'Need an agency to build a website for our real estate business',
        rawContent: 'We need an experienced developer or agency to build a responsive property listing website with enquiry forms and admin dashboard. Budget: $3,500. Location: USA. Contact us at hello@apexrealestate.io',
        sourceUrl: 'https://apexrealestate.io/rfp'
      },
      expectStatus: 'qualified',
      expectContactType: 'email',
      expectBudget: '$3,500',
      expectLocation: 'USA'
    },
    {
      id: 6,
      name: 'Genuine app project with public business contact -> qualified',
      candidate: {
        source: 'web',
        author: 'Delhi Logistics',
        rawTitle: 'Looking for Flutter & Node agency to develop logistics tracking app',
        rawContent: 'We want to build a fleet management mobile application in Delhi NCR. Budget: ₹1,50,000 - ₹2,50,000. Apply or submit proposals at https://delhilogistics.in/contact',
        sourceUrl: 'https://hasjob.co/delhi-logistics'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_business_contact',
      expectBudget: '₹1,50,000 - ₹2,50,000',
      expectLocation: 'Delhi NCR, India'
    },
    {
      id: 7,
      name: 'Genuine project without actionable contact -> rejected (NO_ACTIONABLE_CONTACT)',
      candidate: {
        source: 'web',
        author: 'Anonymous',
        rawTitle: 'Need a developer to build mobile app',
        rawContent: 'We need an iOS & Android app built for our cafe. We have all designs in Figma.',
        sourceUrl: 'https://unknownboard.com/post/7'
      },
      expectStatus: 'rejected',
      expectReason: 'NO_ACTIONABLE_CONTACT'
    },
    {
      id: 8,
      name: 'General React discussion -> rejected (GENERAL_DISCUSSION)',
      candidate: {
        source: 'reddit',
        author: 'curious_dev',
        rawTitle: 'Which library or framework is best for building a real estate website?',
        rawContent: 'How do I learn React and what is the best stack for a portal in 2026? Any tutorial recommendations?',
        sourceUrl: 'https://reddit.com/r/webdev/comments/8'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 9,
      name: 'Freelancer source -> excluded (SOURCE_NOT_ALLOWED)',
      candidate: {
        source: 'freelancer',
        author: 'client99',
        rawTitle: 'Build CRM web app',
        rawContent: 'Need CRM built in React.',
        sourceUrl: 'https://freelancer.com/projects/9'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 10,
      name: 'Guru source -> excluded (SOURCE_NOT_ALLOWED)',
      candidate: {
        source: 'guru',
        author: 'client_guru',
        rawTitle: 'Shopify expert wanted',
        rawContent: 'Need Shopify store redesign.',
        sourceUrl: 'https://guru.com/job/10'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 11,
      name: 'PeoplePerHour source -> excluded (SOURCE_NOT_ALLOWED)',
      candidate: {
        source: 'peopleperhour',
        author: 'pph_client',
        rawTitle: 'Laravel API backend needed',
        rawContent: 'Need API for booking system.',
        sourceUrl: 'https://peopleperhour.com/freelance-jobs/11'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 12,
      name: 'Project with budget -> budget extracted',
      candidate: {
        source: 'reddit',
        author: 'startup_cto',
        rawTitle: 'Need React developer to build MVP dashboard',
        rawContent: 'Looking to build an analytics dashboard. Budget: $4,000 fixed milestone. Reach out to cto@launchmetrics.co',
        sourceUrl: 'https://reddit.com/r/forhire/comments/12'
      },
      expectStatus: 'qualified',
      expectBudget: '$4,000'
    },
    {
      id: 13,
      name: 'Project without budget -> budget null (never guessed)',
      candidate: {
        source: 'reddit',
        author: 'tech_lead_uk',
        rawTitle: 'Looking for agency to revamp our SaaS app in UK',
        rawContent: 'We need to revamp our Next.js customer portal in London, UK. Contact: engineering@uksaas.co.uk',
        sourceUrl: 'https://reddit.com/r/forhire/comments/13'
      },
      expectStatus: 'qualified',
      expectBudget: null
    },
    {
      id: 14,
      name: 'Unknown location -> location null (never guessed "Remote")',
      candidate: {
        source: 'reddit',
        author: 'solo_founder',
        rawTitle: 'Seeking developer to build Shopify custom app',
        rawContent: 'Need a custom inventory sync app created for Shopify. Contact: dev@solostore.com',
        sourceUrl: 'https://reddit.com/r/forhire/comments/14'
      },
      expectStatus: 'qualified',
      expectLocation: null
    },
    {
      id: 15,
      name: 'Reddit candidate with direct author profile message -> qualified with public_profile_message',
      candidate: {
        source: 'reddit',
        author: 'real_client_user',
        rawTitle: 'Looking for a dev team to build an MVP web application',
        rawContent: 'We need a full stack MVP built for real estate listing. Send me a chat / DM on Reddit.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/15'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_profile_message'
    }
  ];

  console.log('🧪 Running LeadSpy IT Project Qualification Engine Test Suite (15 Test Cases)...\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const result = await classifier.qualifyAndExtract(t.candidate);
    let ok = true;
    let failMsg = '';

    if (result.qualification_status !== t.expectStatus) {
      ok = false;
      failMsg += `Expected status '${t.expectStatus}' but got '${result.qualification_status}'. `;
    }

    if (t.expectReason) {
      const allowedReasons = Array.isArray(t.expectReason) ? t.expectReason : [t.expectReason];
      if (!allowedReasons.includes(result.rejection_reason)) {
        ok = false;
        failMsg += `Expected rejection reason ${JSON.stringify(t.expectReason)} but got '${result.rejection_reason}'. `;
      }
    }

    if (t.expectContactType && result.contact_type !== t.expectContactType) {
      ok = false;
      failMsg += `Expected contact_type '${t.expectContactType}' but got '${result.contact_type}'. `;
    }

    if (t.expectBudget !== undefined && result.budget !== t.expectBudget) {
      ok = false;
      failMsg += `Expected budget '${t.expectBudget}' but got '${result.budget}'. `;
    }

    if (t.expectLocation !== undefined && result.clientLocation !== t.expectLocation) {
      ok = false;
      failMsg += `Expected location '${t.expectLocation}' but got '${result.clientLocation}'. `;
    }

    if (ok) {
      console.log(`✅ Test ${t.id}: ${t.name}`);
      passed++;
    } else {
      console.error(`❌ Test ${t.id} FAILED: ${t.name}\n   -> Reason: ${failMsg}\n   -> Result:`, JSON.stringify(result));
      failed++;
    }
  }

  console.log(`\n==================================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed out of ${tests.length}`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
