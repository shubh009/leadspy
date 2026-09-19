/**
 * Automated Verification Test Suite for Query Library & Rotation Layer
 * File: server/projects/test/query_library_and_rotation.test.js
 * 
 * Verifies all 17 specifications from the user request:
 * 1. Central query library integrity & completeness
 * 2. Query priority hierarchy (HIGH > MEDIUM > LOW)
 * 3. Query selection and batching
 * 4. Query rotation cycles (Cycle 1 vs Cycle 2 vs Cycle 3)
 * 5. Dynamic query composition grammar
 * 6. Site-specific queries & operator application
 * 7. Freshness / date metadata preservation
 * 8. Query deduplication
 * 9. Query performance tracking and telemetry calculation
 */

import { 
  projectQueryLibrary, 
  QUERY_PRIORITY, 
  composeDynamicQueries, 
  applySiteFilter,
  TARGET_PLATFORM_DOMAINS 
} from '../config/projectQueryLibrary.js';

import { 
  QueryRotatorService, 
  ROTATION_CYCLES 
} from '../services/queryRotatorService.js';

async function runQueryLibraryTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING QUERY LIBRARY & ROTATION ENGINE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Central Query Library Completeness
  // -------------------------------------------------------------
  const requiredCategories = [
    'generic', 'software', 'website', 'mobileApp', 'saas', 'ecommerce',
    'ai', 'automation', 'crmErp', 'apiIntegration', 'wordpress', 'shopify',
    'mvp', 'maintenance', 'agencyOutsourcing', 'companyIntent', 'projectIntent',
    'industry', 'naturalLanguage', 'budget', 'contact'
  ];

  let allCategoriesPresent = true;
  for (const cat of requiredCategories) {
    if (!projectQueryLibrary[cat]) {
      allCategoriesPresent = false;
      console.error(`Missing category: ${cat}`);
    }
  }
  assert(allCategoriesPresent, 'Test 1: All 21 required query categories exist in projectQueryLibrary');

  // Verify industry subcategories
  const ind = projectQueryLibrary.industry || {};
  const hasSubIndustries = ind.realEstate && ind.healthcare && ind.education && ind.hospitality && ind.finance;
  assert(Boolean(hasSubIndustries), 'Test 2: Industry category contains realEstate, healthcare, education, hospitality, finance');

  // -------------------------------------------------------------
  // TEST 2: Query Priority Tagging
  // -------------------------------------------------------------
  const highPrioritySample = projectQueryLibrary.generic.find(q => q.query === 'need someone to build a website');
  const mediumPrioritySample = projectQueryLibrary.generic.find(q => q.query === 'looking for developer');
  const lowPrioritySample = projectQueryLibrary.generic.find(q => q.query === 'developer');

  assert(highPrioritySample?.priority === QUERY_PRIORITY.HIGH, 'Test 3: "need someone to build a website" is tagged HIGH priority');
  assert(mediumPrioritySample?.priority === QUERY_PRIORITY.MEDIUM, 'Test 4: "looking for developer" is tagged MEDIUM priority');
  assert(lowPrioritySample?.priority === QUERY_PRIORITY.LOW, 'Test 5: "developer" is tagged LOW priority');

  // -------------------------------------------------------------
  // TEST 3: Query Selection & Batch Size
  // -------------------------------------------------------------
  const rotator = new QueryRotatorService({ batchSize: 15, cycle: 1 });
  const batch15 = rotator.getQueriesForCycle();
  assert(batch15.length === 15, `Test 6: Batch size configuration respected (requested 15, got ${batch15.length})`);

  // Verify priority ordering: HIGH queries must appear before MEDIUM/LOW
  const priorities = batch15.map(q => q.priority);
  const firstLowIdx = priorities.indexOf(QUERY_PRIORITY.LOW);
  const firstHighIdx = priorities.indexOf(QUERY_PRIORITY.HIGH);
  assert(firstHighIdx !== -1 && (firstLowIdx === -1 || firstHighIdx < firstLowIdx), 'Test 7: HIGH priority queries are prioritized before LOW priority');

  // -------------------------------------------------------------
  // TEST 4: Query Rotation Cycles
  // -------------------------------------------------------------
  const cycle1Rotator = new QueryRotatorService({ cycle: 1, batchSize: 20 });
  const cycle2Rotator = new QueryRotatorService({ cycle: 2, batchSize: 20 });
  const cycle3Rotator = new QueryRotatorService({ cycle: 3, batchSize: 20 });

  const c1Queries = cycle1Rotator.getQueriesForCycle().map(q => q.query);
  const c2Queries = cycle2Rotator.getQueriesForCycle().map(q => q.query);
  const c3Queries = cycle3Rotator.getQueriesForCycle().map(q => q.query);

  const c1HasWebsite = c1Queries.some(q => q.includes('website') || q.includes('software'));
  const c2HasCrmOrEcommerce = c2Queries.some(q => q.includes('CRM') || q.includes('ecommerce') || q.includes('automation'));
  const c3HasIndustryOrMvp = c3Queries.some(q => q.includes('real estate') || q.includes('MVP') || q.includes('redesign') || q.includes('healthcare'));

  assert(c1HasWebsite, 'Test 8: Cycle 1 focuses on generic, website, software, mobile, saas, ai');
  assert(c2HasCrmOrEcommerce, 'Test 9: Cycle 2 focuses on ecommerce, automation, crmErp, api, agency');
  assert(c3HasIndustryOrMvp, 'Test 10: Cycle 3 focuses on industry-specific, mvp, maintenance, natural language');

  // -------------------------------------------------------------
  // TEST 5: Dynamic Query Composition Grammar
  // -------------------------------------------------------------
  const dynamicList = composeDynamicQueries(5);
  assert(dynamicList.length === 5, 'Test 11: Dynamic query composition generates requested number of queries');
  const sampleDynamic = dynamicList[0].query;
  const isSensible = sampleDynamic.startsWith('need') || sampleDynamic.startsWith('looking for') || sampleDynamic.startsWith('want');
  assert(isSensible, `Test 12: Dynamic query adheres to grammar ("${sampleDynamic}")`);

  // -------------------------------------------------------------
  // TEST 6: Site-Specific Queries & Operators
  // -------------------------------------------------------------
  const siteFilterResult = applySiteFilter('need a website', 'reddit.com');
  assert(siteFilterResult === 'site:reddit.com "need a website"', `Test 13: applySiteFilter formats properly: ${siteFilterResult}`);

  const rotatorWithSite = new QueryRotatorService({ siteFilter: 'indiehackers.com', batchSize: 5 });
  const siteQueries = rotatorWithSite.getQueriesForCycle();
  const allHaveSite = siteQueries.every(q => q.query.startsWith('site:indiehackers.com'));
  assert(allHaveSite, 'Test 14: Rotator applies site operator across all selected queries');

  // -------------------------------------------------------------
  // TEST 7: Query Deduplication
  // -------------------------------------------------------------
  const rotatorDedupe = new QueryRotatorService({
    categories: ['website', 'generic'],
    batchSize: 50
  });
  const dedupeResults = rotatorDedupe.getQueriesForCycle();
  const queryTexts = dedupeResults.map(q => q.query.toLowerCase());
  const uniqueTexts = new Set(queryTexts);
  assert(queryTexts.length === uniqueTexts.size, 'Test 15: Zero duplicate queries emitted in the batch');

  // -------------------------------------------------------------
  // TEST 8: Query Performance Tracking Telemetry
  // -------------------------------------------------------------
  QueryRotatorService.resetPerformanceMetrics();
  QueryRotatorService.recordQueryPerformance({
    query: 'need someone to build a website',
    source: 'Google',
    resultsFound: 10,
    uniqueResults: 8,
    qualifiedProjects: 6,
    rejectedResults: 2,
    contactableProjects: 6
  });

  const perfSummary = QueryRotatorService.getPerformanceSummary();
  assert(perfSummary.length === 1, 'Test 16: Telemetry recorded execution');
  assert(perfSummary[0].qualificationRate === 0.75, `Test 17: Qualification rate calculated accurately (expected 0.75, got ${perfSummary[0].qualificationRate})`);

  console.log('\n================================================================');
  console.log(`QUERY TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runQueryLibraryTests().catch(err => {
  console.error('Test execution failure:', err);
  process.exit(1);
});
