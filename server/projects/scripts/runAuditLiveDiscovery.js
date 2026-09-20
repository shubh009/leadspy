/**
 * Multi-Cycle Live Discovery Runner
 * Executes Discovery Pipeline V2 across rotation cycles until 10+ genuine actionable projects are found
 * or 300 candidate evaluations are reached. Persists to Supabase for manual user verification.
 */

import dotenv from 'dotenv';
dotenv.config();

import { runFullDiscoveryPipeline } from './runSearchAndDirectDiscovery.js';

async function runMultiCycleDiscovery() {
  const TARGET_PROJECTS = 10;
  const MAX_CANDIDATE_LIMIT = 300;

  console.log('================================================================');
  console.log('🌐 STARTING REAL-TIME LIVE WEB DISCOVERY RUNNER');
  console.log(`   Goal: Discover ${TARGET_PROJECTS}+ Genuine Actionable IT Projects`);
  console.log(`   Safety Limit: Max ${MAX_CANDIDATE_LIMIT} Candidates Evaluated`);
  console.log('   Persistence: Active (Supabase master_projects enabled)');
  console.log('================================================================\n');

  const collectedProjects = new Map();
  let totalRawResults = 0;
  let totalUniqueResults = 0;
  let totalPreFilterAccepted = 0;
  let totalPreFilterRejected = 0;
  let totalDeepCrawled = 0;
  let totalExtractionFailures = 0;
  let totalClassifierCandidates = 0;
  let totalGate8Duplicates = 0;
  let totalCandidatesEvaluated = 0;
  const combinedRejectionReasons = {};
  const allQueryBreakdowns = [];
  let combinedProviderStatus = {};

  let cycle = 1;
  const maxCycles = 6;

  while (cycle <= maxCycles) {
    console.log(`\n▶️ === STARTING ROTATION CYCLE ${cycle} ===`);

    try {
      const result = await runFullDiscoveryPipeline({
        cycle,
        batchSize: 15,
        days: 30,
        persistToDb: true
      });

      const metrics = result.metrics || {};
      totalRawResults += (metrics.rawResults || 0);
      totalUniqueResults += (metrics.uniqueResults || 0);
      totalPreFilterAccepted += (metrics.preFilterAccepted || 0);
      totalPreFilterRejected += (metrics.preFilterRejected || 0);
      totalDeepCrawled += (metrics.deepCrawled || 0);
      totalExtractionFailures += (metrics.extractionFailures || 0);
      totalClassifierCandidates += (metrics.candidatesEnteringClassifier || 0);
      totalGate8Duplicates += (metrics.gate8Duplicates || 0);
      totalCandidatesEvaluated += (metrics.uniqueResults || 0);

      // Merge provider status
      combinedProviderStatus = { ...combinedProviderStatus, ...(result.providerStatus || {}) };

      // Merge rejection reasons
      for (const [r, count] of Object.entries(result.rejectionReasons || {})) {
        combinedRejectionReasons[r] = (combinedRejectionReasons[r] || 0) + count;
      }

      // Merge query breakdowns
      if (result.queryBreakdown) {
        allQueryBreakdowns.push(...result.queryBreakdown);
      }

      // Collect qualified projects
      const cycleProjects = result.projects || [];
      for (const p of cycleProjects) {
        const key = p.canonicalId || p.canonical_id || p.sourceUrl || p.source_url;
        if (!collectedProjects.has(key)) {
          collectedProjects.set(key, p);
        }
      }

      const actionableCount = Array.from(collectedProjects.values()).filter(p => p.has_actionable_contact || p.hasActionableContact).length;

      console.log(`\n📊 [Cycle ${cycle} Summary]`);
      console.log(`   - Candidates Evaluated (Cumul): ${totalCandidatesEvaluated}/${MAX_CANDIDATE_LIMIT}`);
      console.log(`   - Actionable Projects Found (Cumul): ${actionableCount}/${TARGET_PROJECTS}`);

      if (actionableCount >= TARGET_PROJECTS) {
        console.log(`\n🎯 TARGET REACHED: Found ${actionableCount} genuine actionable IT projects! Stopping rotation.`);
        break;
      }

      if (totalCandidatesEvaluated >= MAX_CANDIDATE_LIMIT) {
        console.log(`\n🛑 SAFETY LIMIT REACHED: Evaluated ${totalCandidatesEvaluated} candidates. Stopping rotation.`);
        break;
      }

    } catch (cycleErr) {
      console.error(`❌ Error in cycle ${cycle}:`, cycleErr.message);
    }

    cycle++;
    // Small delay between cycles to avoid tight rate-limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  const finalProjectsList = Array.from(collectedProjects.values());
  const actionableProjectsList = finalProjectsList.filter(p => p.has_actionable_contact || p.hasActionableContact);

  console.log('\n================================================================');
  console.log('🏁 FINAL EXECUTION & AUDIT REPORT');
  console.log('================================================================');
  console.log(`Total Cycles Run              : ${cycle > maxCycles ? maxCycles : cycle}`);
  console.log(`Raw Results Collected         : ${totalRawResults}`);
  console.log(`Unique Candidates Evaluated   : ${totalUniqueResults}`);
  console.log(`Pre-Filter Accepted           : ${totalPreFilterAccepted}`);
  console.log(`Pre-Filter Rejected           : ${totalPreFilterRejected}`);
  console.log(`Deep Crawled                  : ${totalDeepCrawled}`);
  console.log(`Extraction Failures           : ${totalExtractionFailures}`);
  console.log(`Candidates to Classifier      : ${totalClassifierCandidates}`);
  console.log(`Gate 8 Duplicates Suppressed  : ${totalGate8Duplicates}`);
  console.log(`Total Qualified Projects      : ${finalProjectsList.length}`);
  console.log(`Actionable Contactable Leads  : ${actionableProjectsList.length}`);
  const crawlReduction = totalRawResults > 0 ? (((totalRawResults - totalDeepCrawled) / totalRawResults) * 100).toFixed(1) : '0';
  console.log(`Crawl Reduction Rate          : ${crawlReduction}% (URLs saved from expensive crawler)`);
  console.log('================================================================\n');

  // Print all 13 fields for each actionable project
  actionableProjectsList.forEach((p, idx) => {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🌟 PROJECT #${idx + 1}: ${p.title}`);
    console.log(`------------------------------------------------------------`);
    console.log(`1.  Project Title       : ${p.title}`);
    console.log(`2.  What Client Needs   : ${p.shortSummary || p.short_summary || p.originalDescription || p.original_description}`);
    console.log(`3.  IT Deliverable      : ${p.category || 'Software/Web'} (Skills: ${(p.skills || []).join(', ') || 'IT Development'})`);
    console.log(`4.  Client / Company    : ${p.clientName || p.client_name || p.clientCompany || p.client_company || 'Direct Client'}`);
    console.log(`5.  Source              : ${p.source || 'Public Web'}`);
    console.log(`6.  Original Source URL : ${p.sourceUrl || p.source_url}`);
    console.log(`7.  Posted Date         : ${p.postedAt || p.posted_at || 'Recent'}`);
    console.log(`8.  Contact Type        : ${p.contact_type || p.contactType || p.client_contact_method || 'direct'}`);
    console.log(`9.  Contact Value       : ${p.contact_value || p.contactValue || p.clientEmail || p.client_email || p.clientProfileUrl || p.client_profile_url || p.sourceUrl || p.source_url}`);
    console.log(`10. Budget              : ${p.budget || (p.budgetMin ? `${p.currency || '$'}${p.budgetMin} - ${p.budgetMax}` : 'Not Specified')}`);
    console.log(`11. Location            : ${p.clientLocation || p.client_location || 'Remote / Not Specified'}`);
    console.log(`12. Why It Qualifies    : Meets 4-Pillar IT Framework (Direct Buyer Intent + Specific IT Deliverable + Active Opportunity + Actionable Contact Route)`);
    console.log(`13. Confidence / Score  : ${p.relevanceScore || p.relevance_score || 85}%`);
  });

  return {
    projects: finalProjectsList,
    actionableProjects: actionableProjectsList,
    metrics: {
      totalRawResults,
      totalUniqueResults,
      totalPreFilterAccepted,
      totalPreFilterRejected,
      totalDeepCrawled,
      totalExtractionFailures,
      totalClassifierCandidates,
      totalGate8Duplicates,
      totalCandidatesEvaluated,
      crawlReductionRate: `${crawlReduction}%`,
      totalQualified: finalProjectsList.length,
      totalActionable: actionableProjectsList.length
    },
    rejectionReasons: combinedRejectionReasons,
    providerStatus: combinedProviderStatus,
    queryBreakdown: allQueryBreakdowns
  };
}

runMultiCycleDiscovery()
  .then(res => {
    console.log('\n[RUNNER_DONE]');
  })
  .catch(err => {
    console.error('MultiCycle runner failed:', err);
    process.exit(1);
  });
