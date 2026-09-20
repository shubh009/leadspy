/**
 * LeadSpy Query Selection & Rotation Service (Layer 1 Engine) - V2
 * File: server/projects/services/queryRotatorService.js
 * 
 * Supports:
 * 1. Balanced Query Quotas across categories (Packs A-E)
 * 2. Extended Query Metadata preservation through rotation
 * 3. Adaptive query performance telemetry tracking
 */

import { 
  projectQueryLibrary, 
  QUERY_PRIORITY, 
  DISCOVERY_MODE,
  highIntentProjectQueries,
  composeDynamicQueries, 
  applySiteFilter,
  TARGET_PLATFORM_DOMAINS,
  generateControlledCombinatorialQueries
} from '../config/projectQueryLibrary.js';

// Global query performance telemetry store
let QUERY_PERFORMANCE_METRICS = new Map();

export const ROTATION_CYCLES = {
  1: ['generic', 'website', 'software', 'mobileApp', 'saas', 'ai'],
  2: ['ecommerce', 'automation', 'crmErp', 'apiIntegration', 'agencyOutsourcing', 'companyIntent', 'projectIntent'],
  3: ['industry', 'mvp', 'maintenance', 'naturalLanguage', 'wordpress', 'shopify', 'budget', 'contact']
};

export class QueryRotatorService {
  constructor(config = {}) {
    this.config = {
      days: 30,
      batchSize: 20,
      cycle: 1,
      categories: null,
      siteFilter: null,
      location: null,
      ...config
    };
  }

  /**
   * Static reset of performance telemetry for tests
   */
  static resetPerformanceMetrics() {
    QUERY_PERFORMANCE_METRICS.clear();
  }

  /**
   * Static telemetry recording method matching test suite
   */
  static recordQueryPerformance(record = {}) {
    const q = record.query || 'unknown';
    const current = QUERY_PERFORMANCE_METRICS.get(q) || {
      query: q,
      source: record.source || 'all',
      rawResults: 0,
      uniqueResults: 0,
      qualifiedProjects: 0,
      rejectedResults: 0,
      contactableProjects: 0,
      qualificationRate: 0
    };

    current.rawResults += record.resultsFound || record.rawResults || 0;
    current.uniqueResults += record.uniqueResults || 0;
    current.qualifiedProjects += record.qualifiedProjects || 0;
    current.rejectedResults += record.rejectedResults || 0;
    current.contactableProjects += record.contactableProjects || 0;

    const denominator = current.uniqueResults || current.rawResults || 1;
    current.qualificationRate = Number((current.qualifiedProjects / denominator).toFixed(2));

    QUERY_PERFORMANCE_METRICS.set(q, current);
  }

  /**
   * Static performance summary retrieval
   */
  static getPerformanceSummary() {
    return Array.from(QUERY_PERFORMANCE_METRICS.values());
  }

  /**
   * Computes normalized source allocation weights with Bayesian smoothing and 15% exploration floor
   * @param {Object} sourceMetrics - { [source]: { actionableProjects, processed } }
   * @returns {Object} { [source]: normalizedWeight }
   */
  static computeSourceAllocation(sourceMetrics = {}) {
    const defaultSources = ['reddit', 'hackernews', 'public_web'];
    const alpha = 1;
    const beta = 10;
    const rawScores = {};
    let totalScore = 0;

    for (const src of defaultSources) {
      const stats = sourceMetrics[src] || { actionableProjects: 0, processed: 0 };
      // Laplace / Bayesian smoothed yield
      const smoothedYield = (stats.actionableProjects + alpha) / (stats.processed + beta);
      // Floor at 0.15 exploration budget
      const floored = Math.max(0.15, Math.min(0.60, smoothedYield * 3));
      rawScores[src] = floored;
      totalScore += floored;
    }

    // Normalize so sum equals exactly 1.0 (100%)
    const normalized = {};
    for (const src of defaultSources) {
      normalized[src] = Number((rawScores[src] / totalScore).toFixed(3));
    }

    // Ensure rounding equals exactly 1.000 (deterministic fix)
    const sum = Number((normalized.reddit + normalized.hackernews + normalized.public_web).toFixed(3));
    const diff = Number((1.0 - sum).toFixed(3));
    if (diff !== 0) {
      normalized.public_web = Number((normalized.public_web + diff).toFixed(3));
    }

    return normalized;
  }

  /**
   * Computes integer query quotas per source guaranteeing sum equals batchSize
   * @param {Object} sourceMetrics
   * @param {number} batchSize
   * @returns {Object} { reddit: number, hackernews: number, public_web: number }
   */
  static calculateSourceQuotas(sourceMetrics = {}, batchSize = 20) {
    const weights = QueryRotatorService.computeSourceAllocation(sourceMetrics);
    const minFloor = Math.max(2, Math.floor(batchSize * 0.15));

    let redditCount = Math.max(minFloor, Math.round(batchSize * weights.reddit));
    let hnCount = Math.max(minFloor, Math.round(batchSize * weights.hackernews));
    let webCount = batchSize - redditCount - hnCount;

    if (webCount < minFloor) {
      webCount = minFloor;
      if (redditCount >= hnCount) {
        redditCount = batchSize - hnCount - webCount;
      } else {
        hnCount = batchSize - redditCount - webCount;
      }
    }

    return {
      reddit: redditCount,
      hackernews: hnCount,
      public_web: webCount
    };
  }

  /**
   * Balanced query selection preventing category monopolization
   * Preserves extended metadata on every query object.
   */
  getQueriesForCycle(customOptions = {}) {
    const options = { ...this.config, ...customOptions };
    const batchSize = options.batchSize || 20;
    const cycleNum = options.cycle || 1;
    const mode = options.mode || DISCOVERY_MODE.STANDARD;

    // STEP-1 V2: Controlled Combinatorial Queries with platform footprints & adaptive source allocation
    if (options.useCombinatorial !== false && !options.categories && !options.siteFilter && mode !== DISCOVERY_MODE.HIGH_INTENT) {
      const sourceMetrics = options.sourceMetrics || this.config.sourceMetrics || {};
      const sourceQuotas = QueryRotatorService.calculateSourceQuotas(sourceMetrics, batchSize);
      return generateControlledCombinatorialQueries({
        cycle: cycleNum,
        batchSize,
        sourceQuotas
      });
    }

    const candidateQueries = [];

    // Mode: HIGH_INTENT
    if (mode === DISCOVERY_MODE.HIGH_INTENT) {
      highIntentProjectQueries.forEach(q => candidateQueries.push({ ...q, category: 'high_intent' }));
    } else {
      let targetCategories = options.categories;
      if (!targetCategories || targetCategories.length === 0) {
        const cycleKey = ((cycleNum - 1) % 3) + 1;
        targetCategories = ROTATION_CYCLES[cycleKey] || ROTATION_CYCLES[1];
      }

      for (const cat of targetCategories) {
        if (cat === 'industry') {
          const industryObj = projectQueryLibrary.industry || {};
          for (const subInd of Object.keys(industryObj)) {
            const list = industryObj[subInd] || [];
            list.forEach(q => candidateQueries.push({ ...q, category: `industry_${subInd}` }));
          }
        } else if (projectQueryLibrary[cat]) {
          const list = projectQueryLibrary[cat];
          list.forEach(q => candidateQueries.push({ ...q, category: cat }));
        }
      }
    }

    if (options.includeDynamic) {
      const dynamicList = composeDynamicQueries(10);
      dynamicList.forEach(q => candidateQueries.push(q));
    }

    // BALANCED SELECTION QUOTA
    const selected = [];
    const seenQueries = new Set();

    function tryAdd(q) {
      if (!seenQueries.has(q.query)) {
        seenQueries.add(q.query);
        selected.push(q);
        return true;
      }
      return false;
    }

    // Sort candidates by priority and qualityTier
    const tierWeight = { 'A': 3, 'B': 2, 'C': 1 };
    const priorityWeight = { [QUERY_PRIORITY.HIGH]: 3, [QUERY_PRIORITY.MEDIUM]: 2, [QUERY_PRIORITY.LOW]: 1 };

    candidateQueries.sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return (tierWeight[b.qualityTier] || 1) - (tierWeight[a.qualityTier] || 1);
    });

    // Group candidates into balanced quota buckets
    const buckets = {
      buyer_request: candidateQueries.filter(q => q.intentType === 'buyer_request' || q.intentType === 'outsourcing'),
      business_problem: candidateQueries.filter(q => q.intentType === 'business_problem' || q.intentType === 'company_request'),
      deliverable: candidateQueries.filter(q => q.priority === QUERY_PRIORITY.HIGH && !['rfp', 'maintenance'].includes(q.intentType)),
      rfp: candidateQueries.filter(q => q.intentType === 'rfp' || q.intentType === 'project_requirement'),
      maintenance: candidateQueries.filter(q => q.intentType === 'maintenance')
    };

    const quotaPerBucket = Math.max(2, Math.floor(batchSize / 5));

    for (const key of Object.keys(buckets)) {
      let count = 0;
      for (const q of buckets[key]) {
        if (tryAdd(q)) {
          count++;
          if (count >= quotaPerBucket) break;
        }
      }
    }

    for (const q of candidateQueries) {
      if (selected.length >= batchSize) break;
      if (q.priority !== QUERY_PRIORITY.LOW) {
        tryAdd(q);
      }
    }

    const finalQueries = selected.slice(0, batchSize).map(q => {
      let qStr = q.query;
      if (options.siteFilter) {
        qStr = applySiteFilter(qStr, options.siteFilter);
      }
      if (options.location) {
        qStr = `${qStr} "${options.location}"`;
      }
      return {
        ...q,
        query: qStr
      };
    });

    return finalQueries;
  }

  recordQueryPerformance(queryStr, stats = {}) {
    QueryRotatorService.recordQueryPerformance({
      query: queryStr,
      resultsFound: stats.rawResults,
      uniqueResults: stats.uniqueResults,
      qualifiedProjects: stats.qualified,
      contactableProjects: stats.contactable,
      rejectedResults: stats.rejected
    });
  }

  getQueryTelemetry() {
    return QueryRotatorService.getPerformanceSummary();
  }
}
