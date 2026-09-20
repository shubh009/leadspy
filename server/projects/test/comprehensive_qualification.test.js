import { ProjectClassifier } from '../ai/projectClassifier.js';
import { getProjects, saveMasterProjects } from '../services/projectDbService.js';
import { supabase } from '../../config/supabase.js';

async function runComprehensiveTestSuite() {
  console.log('================================================================');
  console.log('🧪 LEADSPY IT PROJECT ENGINE: 25-CASE COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  const classifier = new ProjectClassifier();
  // Ensure strict deterministic heuristic testing
  classifier.apiKey = null;

  const testCases = [
    // ----------------------------------------------------------------
    // CATEGORY A: EMPLOYMENT & SALARIED JOB REJECTIONS (GATE 3)
    // ----------------------------------------------------------------
    {
      id: 1,
      category: 'EMPLOYMENT',
      name: 'Full-time salaried React role with annual salary',
      candidate: {
        source: 'reddit',
        author: 'recruiter_corp',
        rawTitle: 'Hiring React Developer for Full-Time Position',
        rawContent: 'Looking for a permanent full-time frontend engineer. Annual salary $120,000 + 401k benefits. Send your resume/cv to careers@bigtech.com.',
        sourceUrl: 'https://reddit.com/r/jobbit/comments/c1'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 2,
      category: 'EMPLOYMENT',
      name: 'Indian IT firm hiring with CTC / LPA',
      candidate: {
        source: 'india_tech',
        author: 'TCS Recruiter',
        rawTitle: 'Urgent Hiring: Senior Node.js Engineer',
        rawContent: 'Software development engineer needed. CTC: 15-20 LPA. Notice period: 15 days or immediate joiner. PF and ESI provided. Submit CV to hr@techcorp.in',
        sourceUrl: 'https://hasjob.co/c2'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 3,
      category: 'EMPLOYMENT',
      name: 'Job opening asking to join our growing team',
      candidate: {
        source: 'web',
        author: 'Staffing Partner',
        rawTitle: 'Company is looking for a creative Web Designer to join our growing team',
        rawContent: 'Permanent position in our Bangalore office. Salary: ₹8 LPA. Resume submission required at jobs@agency.com',
        sourceUrl: 'https://boards.greenhouse.io/c3'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },
    {
      id: 4,
      category: 'EMPLOYMENT',
      name: 'SDE title (Software Development Engineer)',
      candidate: {
        source: 'india_tech',
        author: 'Tech Startup',
        rawTitle: 'Software Development Engineer (SDE) — Mobile & Backend',
        rawContent: 'We are hiring an SDE 2 with 3 years experience. Hybrid role in Bengaluru. Send resume to jobs@vexar.in',
        sourceUrl: 'https://hasjob.co/c4'
      },
      expectStatus: 'rejected',
      expectReason: 'EMPLOYMENT'
    },

    // ----------------------------------------------------------------
    // CATEGORY B: INTERNSHIPS & FRESHERS (GATE 2)
    // ----------------------------------------------------------------
    {
      id: 5,
      category: 'INTERNSHIP',
      name: 'React Frontend Internship with stipend',
      candidate: {
        source: 'reddit',
        author: 'early_founder',
        rawTitle: 'React Developer Internship',
        rawContent: '3-month summer internship for web developers. Stipend: ₹10,000/month. Freshers welcome to apply at hr@startup.in',
        sourceUrl: 'https://reddit.com/r/forhire/comments/c5'
      },
      expectStatus: 'rejected',
      expectReason: 'INTERNSHIP'
    },
    {
      id: 6,
      category: 'INTERNSHIP',
      name: 'Apprentice / Trainee opening for college graduates',
      candidate: {
        source: 'india_tech',
        author: 'EdTech Labs',
        rawTitle: 'Python Trainee / Apprentice opening for 2026 graduates',
        rawContent: 'Trainee program with certificate and ₹8,000 stipend. Freshers can email cv@edtech.com',
        sourceUrl: 'https://hasjob.co/c6'
      },
      expectStatus: 'rejected',
      expectReason: 'INTERNSHIP'
    },

    // ----------------------------------------------------------------
    // CATEGORY C: FREELANCERS SEEKING WORK / SUPPLY-SIDE ADS (GATE 1)
    // ----------------------------------------------------------------
    {
      id: 7,
      category: 'FREELANCER_SEEKING_WORK',
      name: '[For Hire] post with portfolio link',
      candidate: {
        source: 'reddit',
        author: 'freelance_ninja',
        rawTitle: '[For Hire] Full-Stack Developer available for new projects',
        rawContent: 'Hire me! I build web apps using React, Next.js and Supabase. Check my portfolio at https://johndev.com. Looking for new clients. Email me at john@johndev.com',
        sourceUrl: 'https://reddit.com/r/forhire/comments/c7'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 8,
      category: 'FREELANCER_SEEKING_WORK',
      name: 'Agency looking for clients self-promotion',
      candidate: {
        source: 'reddit',
        author: 'agency_owner',
        rawTitle: 'My agency is looking for clients to build MVPs',
        rawContent: 'We offer UI/UX and mobile development services. Open for freelance contracts. Contact: hello@agencydev.com',
        sourceUrl: 'https://reddit.com/r/freelance_forhire/comments/c8'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },
    {
      id: 9,
      category: 'FREELANCER_SEEKING_WORK',
      name: 'Developer "Available for freelance" pitching services',
      candidate: {
        source: 'web',
        author: 'alex_coder',
        rawTitle: 'Available for freelance React & Flutter projects',
        rawContent: 'I am a senior frontend dev looking for work. Rate: $40/hr. Portfolio: https://alex.dev',
        sourceUrl: 'https://community.com/c9'
      },
      expectStatus: 'rejected',
      expectReason: 'FREELANCER_SEEKING_WORK'
    },

    // ----------------------------------------------------------------
    // CATEGORY D: GENERAL DISCUSSIONS & TUTORIALS (GATE 4)
    // ----------------------------------------------------------------
    {
      id: 10,
      category: 'GENERAL_DISCUSSION',
      name: 'Stack advice question',
      candidate: {
        source: 'reddit',
        author: 'learner_101',
        rawTitle: 'Which library or framework is best for real estate portal?',
        rawContent: 'How do I learn React in 2026? What is the best stack between Next.js and Remix? Any tutorial recommendations?',
        sourceUrl: 'https://reddit.com/r/webdev/comments/c10'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },
    {
      id: 11,
      category: 'GENERAL_DISCUSSION',
      name: 'Career and cost question',
      candidate: {
        source: 'reddit',
        author: 'curious_dev',
        rawTitle: 'How much does a website cost to build?',
        rawContent: 'Just curious how much agencies charge for building a custom SaaS MVP. Career advice needed.',
        sourceUrl: 'https://reddit.com/r/webdev/comments/c11'
      },
      expectStatus: 'rejected',
      expectReason: 'GENERAL_DISCUSSION'
    },

    // ----------------------------------------------------------------
    // CATEGORY E: NON-IT & SPAM REJECTIONS (GATE 5)
    // ----------------------------------------------------------------
    {
      id: 12,
      category: 'NOT_IT_PROJECT',
      name: 'Accounting / Payroll / Receptionist corporate role',
      candidate: {
        source: 'web',
        author: 'office_admin',
        rawTitle: 'Urgent: Receptionist and Accountant needed for clinic',
        rawContent: 'Need receptionist to manage phone calls and patient billing at front desk.',
        sourceUrl: 'https://localclassifieds.in/c12'
      },
      expectStatus: 'rejected',
      expectReason: ['NOT_IT_PROJECT', 'NON_IT_SERVICE']
    },
    {
      id: 13,
      category: 'NOT_IT_PROJECT',
      name: 'Garment / Fashion / Operator non-software role',
      candidate: {
        source: 'india_tech',
        author: 'Textile Firm',
        rawTitle: 'Garment draping operator needed (Surat)',
        rawContent: 'Looking for fashion communication operator for textile printing factory.',
        sourceUrl: 'https://hasjob.co/c13'
      },
      expectStatus: 'rejected',
      expectReason: ['NOT_IT_PROJECT', 'NON_IT_SERVICE']
    },
    {
      id: 14,
      category: 'NOT_IT_PROJECT',
      name: 'Escort / Adult spam keyword',
      candidate: {
        source: 'web',
        author: 'spammer_ad',
        rawTitle: 'Choosing the Right Escort Design Agency for Online Presentation',
        rawContent: 'Call us for escort services and night booking.',
        sourceUrl: 'https://spamfeed.com/c14'
      },
      expectStatus: 'rejected',
      expectReason: ['NOT_IT_PROJECT', 'NON_IT_SERVICE']
    },

    // ----------------------------------------------------------------
    // CATEGORY F: FORBIDDEN MARKETPLACE SOURCES (GATE 0)
    // ----------------------------------------------------------------
    {
      id: 15,
      category: 'SOURCE_NOT_ALLOWED',
      name: 'Freelancer.com marketplace lead',
      candidate: {
        source: 'freelancer',
        author: 'client_77',
        rawTitle: 'Need React dev for CRM portal',
        rawContent: 'Build CRM in 2 weeks. Budget $500.',
        sourceUrl: 'https://freelancer.com/projects/c15'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 16,
      category: 'SOURCE_NOT_ALLOWED',
      name: 'Guru.com marketplace lead',
      candidate: {
        source: 'guru',
        author: 'guru_buyer',
        rawTitle: 'Shopify theme customization required',
        rawContent: 'Modify existing Shopify theme header and product page.',
        sourceUrl: 'https://guru.com/job/c16'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },
    {
      id: 17,
      category: 'SOURCE_NOT_ALLOWED',
      name: 'PeoplePerHour marketplace lead',
      candidate: {
        source: 'peopleperhour',
        author: 'pph_poster',
        rawTitle: 'Looking for Python API integration',
        rawContent: 'Connect Stripe webhook to database.',
        sourceUrl: 'https://peopleperhour.com/freelance-jobs/c17'
      },
      expectStatus: 'rejected',
      expectReason: 'SOURCE_NOT_ALLOWED'
    },

    // ----------------------------------------------------------------
    // CATEGORY G: MISSING ACTIONABLE CONTACT (GATE 7)
    // ----------------------------------------------------------------
    {
      id: 18,
      category: 'NO_ACTIONABLE_CONTACT',
      name: 'Genuine requirement but zero contact details (no email, phone, or route)',
      candidate: {
        source: 'web',
        author: 'Anonymous',
        rawTitle: 'Need a mobile app built in Flutter for restaurant ordering',
        rawContent: 'We have all Figma mockups ready. Need backend and frontend development for Android & iOS.',
        sourceUrl: 'https://unreachable-forum.com/thread/c18'
      },
      expectStatus: 'rejected',
      expectReason: 'NO_ACTIONABLE_CONTACT'
    },

    // ----------------------------------------------------------------
    // CATEGORY H: GENUINE QUALIFIED PROJECTS (ALL CRITERIA MET)
    // ----------------------------------------------------------------
    {
      id: 19,
      category: 'QUALIFIED_PROJECT',
      name: 'Real Estate portal with verified email & USD budget',
      candidate: {
        source: 'web',
        author: 'David Miller',
        rawTitle: 'Need an agency to build a website for our real estate business',
        rawContent: 'We need an agency or full-stack developer to build a modern property listing portal with search, filters and admin dashboard. Tech: React, Node.js, PostgreSQL. Budget: $4,500 fixed milestone. Location: USA. Contact us at hello@apexrealty.org',
        sourceUrl: 'https://apexrealty.org/rfp'
      },
      expectStatus: 'qualified',
      expectContactType: 'email',
      expectBudget: '$4,500',
      expectLocation: 'USA',
      expectCategory: 'Web Development'
    },
    {
      id: 20,
      category: 'QUALIFIED_PROJECT',
      name: 'Delhi NCR B2B logistics dashboard with INR budget & email',
      candidate: {
        source: 'india_tech',
        author: 'Delhi Logistics',
        rawTitle: 'Need React & Node.js Agency / Dev for B2B Logistics Dispatch Portal',
        rawContent: 'Delhi NCR Logistics Startup | We need an experienced web development agency or freelance developer team to build our dispatch and fleet tracking dashboard. Tech Stack: React, Node.js, Express, PostgreSQL, Google Maps API. Budget: ₹1,50,000 - ₹2,50,000. Location: Delhi NCR. Contact: tech@delhilogistics.in',
        sourceUrl: 'https://hasjob.co/delhi-logistics'
      },
      expectStatus: 'qualified',
      expectContactType: 'email',
      expectBudget: '₹1,50,000 - ₹2,50,000',
      expectLocation: 'Delhi NCR, India'
    },
    {
      id: 21,
      category: 'QUALIFIED_PROJECT',
      name: 'Bangalore Doctor Consultation App with verified email',
      candidate: {
        source: 'india_tech',
        author: 'HealthPlus Clinics',
        rawTitle: 'Looking for Flutter Developer / Agency for Doctor Consultation App',
        rawContent: 'Bangalore HealthTech | Looking for mobile app dev agency or Flutter dev for consultation & booking app with Razorpay. Budget: ₹2,00,000 - ₹3,50,000. Location: Bangalore. Send proposals to: founders@healthpluscare.in',
        sourceUrl: 'https://hasjob.co/healthplus-bangalore'
      },
      expectStatus: 'qualified',
      expectContactType: 'email',
      expectBudget: '₹2,00,000 - ₹3,50,000',
      expectLocation: 'Bangalore, India'
    },
    {
      id: 22,
      category: 'QUALIFIED_PROJECT',
      name: 'Reddit Hiring post with verified author profile message',
      candidate: {
        source: 'reddit',
        author: 'verified_founder_99',
        rawTitle: 'Looking for agency to develop an AI Chatbot MVP',
        rawContent: 'We need a chatbot integrated with OpenAI API and vector database for our customer portal. Send me a direct Reddit DM with your previous work.',
        sourceUrl: 'https://reddit.com/r/forhire/comments/c22'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_profile_message'
    },
    {
      id: 23,
      category: 'QUALIFIED_PROJECT',
      name: 'Company requirement with verified public contact page',
      candidate: {
        source: 'web',
        author: 'Acme Logistics',
        rawTitle: 'Looking for developer to build custom Shopify inventory sync app',
        rawContent: 'We need custom inventory API sync between ERP and Shopify. Budget: $2,500. Submit proposals at https://acmelogistics.com/contact',
        sourceUrl: 'https://acmelogistics.com/careers/project'
      },
      expectStatus: 'qualified',
      expectContactType: 'public_business_contact'
    },
    {
      id: 24,
      category: 'QUALIFIED_PROJECT',
      name: 'Project without budget -> budget is strictly null (never guessed)',
      candidate: {
        source: 'reddit',
        author: 'london_tech',
        rawTitle: 'Need React developer to revamp our customer portal in UK',
        rawContent: 'Looking to overhaul our Next.js frontend in London, UK. Contact: engineering@uksaas.co.uk',
        sourceUrl: 'https://reddit.com/r/forhire/comments/c24'
      },
      expectStatus: 'qualified',
      expectBudget: null
    },
    {
      id: 25,
      category: 'QUALIFIED_PROJECT',
      name: 'Unknown location -> clientLocation is strictly null (never guessed "Remote")',
      candidate: {
        source: 'reddit',
        author: 'cloud_builder',
        rawTitle: 'Seeking dev to build custom Stripe billing dashboard',
        rawContent: 'Need a small dashboard created in React and Supabase. Contact: dev@saasbilling.io',
        sourceUrl: 'https://reddit.com/r/forhire/comments/c25'
      },
      expectStatus: 'qualified',
      expectLocation: null
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = await classifier.qualifyAndExtract(tc.candidate);
    let ok = true;
    let failReasons = [];

    // 1. Status Check
    if (result.qualification_status !== tc.expectStatus) {
      ok = false;
      failReasons.push(`Status: Expected '${tc.expectStatus}' but got '${result.qualification_status}'`);
    }

    // 2. Rejection Reason Check
    if (tc.expectReason) {
      const allowed = Array.isArray(tc.expectReason) ? tc.expectReason : [tc.expectReason];
      if (!allowed.includes(result.rejection_reason)) {
        ok = false;
        failReasons.push(`Rejection Reason: Expected '${tc.expectReason}' but got '${result.rejection_reason}'`);
      }
    }

    // 3. Contact Type Check
    if (tc.expectContactType && result.contact_type !== tc.expectContactType) {
      ok = false;
      failReasons.push(`Contact Type: Expected '${tc.expectContactType}' but got '${result.contact_type}'`);
    }

    // 4. Budget Null/Extraction Check
    if (tc.expectBudget !== undefined && result.budget !== tc.expectBudget) {
      ok = false;
      failReasons.push(`Budget: Expected '${tc.expectBudget}' but got '${result.budget}'`);
    }

    // 5. Location Null/Extraction Check
    if (tc.expectLocation !== undefined && result.clientLocation !== tc.expectLocation) {
      ok = false;
      failReasons.push(`Location: Expected '${tc.expectLocation}' but got '${result.clientLocation}'`);
    }

    if (ok) {
      console.log(`✅ [PASS] Case #${tc.id.toString().padStart(2, '0')} [${tc.category}] ${tc.name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Case #${tc.id.toString().padStart(2, '0')} [${tc.category}] ${tc.name}`);
      failReasons.forEach(r => console.error(`       -> ${r}`));
      failed++;
    }
  }

  console.log('\n================================================================');
  console.log(`FINAL RESULT: ${passed}/${testCases.length} Tests Passed (${((passed/testCases.length)*100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveTestSuite().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
