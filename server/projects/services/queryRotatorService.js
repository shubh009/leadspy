/**
 * LeadSpy Query Selection & Rotation Service (Layer 1 Engine)
 * File: server/projects/services/queryRotatorService.js
 * 
 * Manages query batching, rotation cycles, priority sorting,
 * deduplication, and query performance tracking.
 */

import { 
  projectQueryLibrary, 
  QUERY_PRIORITY, 
  DISCOVERY_MODE,
  highIntentProjectQueries,
  composeDynamicQueries, 
  applySiteFilter,
  TARGET_PLATFORM_DOMAINS 
} from '../config/projectQueryLibrary.js';

// Global query performance telemetry store (Section 12)
const QUERY_PERFORMANCE_METRICS = new Map();

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
      categories: null, // null means use current rotation cycle categories
      siteFilter: null,
      location: null,
      ...config
    };
  }

  /**
   * Select and prioritize queries for the current cycle
   */
  getQueriesForCycle(customOptions = {}) {
    const options = { ...this.config, ...customOptions };
    const batchSize = options.batchSize || 20;
    const cycleNum = options.cycle || 1;
    const mode = options.mode || DISCOVERY_MODE.STANDARD;

    const candidateQueries = [];

    // Mode: HIGH_INTENT (Task 9)
    if (mode === DISCOVERY_MODE.HIGH_INTENT) {
      highIntentProjectQueries.forEach(q => candidateQueries.push({ ...q, category: 'high_intent' }));
    } else {
      // Standard Categorized Mode: Determine target categories
      let targetCategories = options.categories;
      if (!targetCategories || targetCategories.length === 0) {
        const cycleKey = ((cycleNum - 1) % 3) + 1;
        targetCategories = ROTATION_CYCLES[cycleKey] || ROTATION_CYCLES[1];
      }

      // Collect queries from selected categories
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

    // Append dynamic composed queries if needed
    if (options.includeDynamic) {
      const dynamicList = composeDynamicQueries(10);
      dynamicList.forEach(q => candidateQueries.push(q));
    }

    // Sort strictly by Priority: HIGH > MEDIUM > LOW (Section 4)
    const priorityWeight = {
      [QUERY_PRIORITY.HIGH]: 3,
      [QUERY_PRIORITY.MEDIUM]: 2,
      [QUERY_PRIORITY.LOW]: 1
    };

    candidateQueries.sort((a, b) => {
      const wA = priorityWeight[a.priority] || 1;
      const wB = priorityWeight[b.priority] || 1;
      return wB - wA;
    });

    // Deduplicate queries
    const uniqueQueries = [];
    const seenQueries = new Set();

    for (const item of candidateQueries) {
      let finalQuery = item.query.trim();

      // Apply location modifier if specified
      if (options.location) {
        finalQuery = `${finalQuery} in ${options.location}`;
      }

      // Apply site filter if requested (Section 6)
      if (options.siteFilter) {
        finalQuery = applySiteFilter(finalQuery, options.siteFilter);
      }

      if (!seenQueries.has(finalQuery.toLowerCase())) {
        seenQueries.add(finalQuery.toLowerCase());
        uniqueQueries.push({
          ...item,
          query: finalQuery,
          days: options.days || 30
        });
      }

      if (uniqueQueries.length >= batchSize) break;
    }

    return uniqueQueries;
  }

  /**
   * Record query execution and performance metrics (Section 12)
   */
  static recordQueryPerformance({
    query,
    source,
    resultsFound = 0,
    uniqueResults = 0,
    qualifiedProjects = 0,
    rejectedResults = 0,
    contactableProjects = 0
  }) {
    const existing = QUERY_PERFORMANCE_METRICS.get(query) || {
      query,
      source,
      searchCount: 0,
      totalResultsFound: 0,
      totalUniqueResults: 0,
      totalQualifiedProjects: 0,
      totalRejectedResults: 0,
      totalContactableProjects: 0,
      lastSearchTimestamp: new Date().toISOString()
    };

    existing.searchCount += 1;
    existing.totalResultsFound += resultsFound;
    existing.totalUniqueResults += uniqueResults;
    existing.totalQualifiedProjects += qualifiedProjects;
    existing.totalRejectedResults += rejectedResults;
    existing.totalContactableProjects += contactableProjects;
    existing.lastSearchTimestamp = new Date().toISOString();

    existing.qualificationRate = existing.totalUniqueResults > 0 
      ? Number((existing.totalQualifiedProjects / existing.totalUniqueResults).toFixed(3))
      : 0;

    QUERY_PERFORMANCE_METRICS.set(query, existing);
    return existing;
  }

  /**
   * Get telemetry summary of all tracked queries
   */
  static getPerformanceSummary() {
    return Array.from(QUERY_PERFORMANCE_METRICS.values()).sort((a, b) => b.totalQualifiedProjects - a.totalQualifiedProjects);
  }

  /**
   * Reset performance metrics (for testing)
   */
  static resetPerformanceMetrics() {
    QUERY_PERFORMANCE_METRICS.clear();
  }
}
