/**
 * Forensic Analysis CSV Exporter
 * Runs the discovery retrieval & classification flow across Cycles 1-3
 * and exports complete granular forensic data into 3 CSV files directly to ~/Downloads.
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { QueryRotatorService } from '../services/queryRotatorService.js';
import { MultiSearchManager } from '../sources/searchProvider.js';
import { ContentExtractor } from '../services/contentExtractor.js';
import { ProjectClassifier } from '../ai/projectClassifier.js';
import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';
import { scoreSearchResult } from './runSearchAndDirectDiscovery.js';

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = Array.isArray(val) ? val.join('; ') : String(val);
  return `"${str.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

function extractHostname(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch (e) {
    return 'unknown';
  }
}

async function runForensicExport() {
  console.log('================================================================');
  console.log('🔬 RUNNING FORENSIC ANALYSIS DATA CAPTURE');
  console.log('   Executing exact retrieval flow across Cycles 1, 2, 3');
  console.log('   Exporting CSV 1 (Raw), CSV 2 (Pre-Crawl), CSV 3 (Deep Crawled)');
  console.log('================================================================\n');

  const rotator = new QueryRotatorService({ days: 30, batchSize: 15 });
  const searchManager = new MultiSearchManager();
  const contentExtractor = new ContentExtractor();
  const canonicalDeduplicator = new CanonicalDeduplicator();
  const classifier = new ProjectClassifier();

  const csv1Rows = [];
  const csv2Rows = [];
  const csv3Rows = [];

  const providerStats = {};
  const queryStats = {};

  function initStats(pName, qStr) {
    if (!providerStats[pName]) {
      providerStats[pName] = { raw: 0, unique: 0, preAccepted: 0, deepCrawled: 0, qualified: 0 };
    }
    if (!queryStats[qStr]) {
      queryStats[qStr] = { raw: 0, preAccepted: 0, deepCrawled: 0, qualified: 0 };
    }
  }

  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`▶️ Processing Forensic Cycle ${cycle}/3...`);
    const searchQueries = rotator.getQueriesForCycle({ cycle, batchSize: 15 });

    const rawCandidatePool = [];

    function ingest(rawItem, queryContext = {}) {
      const q = rawItem.search_query || 'direct_source';
      const p = rawItem.search_provider || rawItem.source || 'unknown';
      initStats(p, q);

      providerStats[p].raw++;
      queryStats[q].raw++;

      // Row for CSV 1: ALL RAW SEARCH RESULTS
      csv1Rows.push({
        query: q,
        source: rawItem.source || 'web_search',
        search_provider: p,
        rank: rawItem.rank || 1,
        title: rawItem.title || '',
        snippet: rawItem.snippet || '',
        url: rawItem.url || '',
        sourceDomain: extractHostname(rawItem.url),
        sourceScope: queryContext.sourceScope || 'public_web',
        intentType: queryContext.intentType || 'buyer_request',
        deliverableType: queryContext.deliverableType || 'custom_software',
        priority: queryContext.priority || 'HIGH',
        qualityTier: queryContext.qualityTier || 'A'
      });

      const check = canonicalDeduplicator.checkUrlCandidate(rawItem);
      if (!check.isDuplicate) {
        providerStats[p].unique++;
        rawCandidatePool.push({
          ...rawItem,
          canonicalUrl: check.canonicalUrl || rawItem.url,
          canonicalId: check.canonicalId || null,
          queryContext
        });
      }
    }

    // Direct Source 1: Hacker News
    try {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
      const searchUrl = `https://hn.algolia.com/api/v1/search_by_date?query=need+someone+to+build&tags=comment&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=10`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        for (const [idx, h] of (data.hits || []).entries()) {
          const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
          const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ');
          ingest({
            source: 'hackernews',
            search_provider: 'hackernews_api',
            rank: idx + 1,
            url: itemUrl,
            title: text.substring(0, 80) || 'Hacker News Thread',
            snippet: text.substring(0, 300),
            author: h.author,
            postedAt: h.created_at,
            search_query: 'need someone to build',
            search_source: 'hackernews'
          }, { sourceScope: 'hackernews', intentType: 'buyer_request', priority: 'HIGH', qualityTier: 'A' });
        }
      }
    } catch (e) {}

    // Direct Source 2: Reddit RSS Feeds
    const subreddits = ['forhire', 'freelance_forhire', 'jobbit'];
    const projectIntentFilter = /\b(hiring|need|looking for|seeking|build|develop|create|saas|app|website|software|crm|platform|mvp|agency|developer|team)\b/i;

    for (const sub of subreddits) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/new/.rss`, {
          headers: { 'User-Agent': 'LeadSpyBot/1.0 (IT Project Engine; https://leadspy.app)' },
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const xml = await res.text();
          const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
          for (const [idx, e] of entries.entries()) {
            const rawTitle = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/&amp;/g, '&') || '';
            const link = (e.match(/<link\s+href="([^"]+)"/) || [])[1] || '';
            const updated = (e.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || null;
            const author = (e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || 'RedditUser';
            const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ') || rawTitle;

            if (projectIntentFilter.test(rawTitle) || projectIntentFilter.test(content.substring(0, 200))) {
              ingest({
                source: 'reddit',
                search_provider: 'reddit_rss',
                rank: idx + 1,
                url: link,
                title: rawTitle.replace(/^\[hiring\]\s*/i, ''),
                snippet: content.substring(0, 700),
                author,
                postedAt: updated,
                search_query: `r/${sub}/new.rss`,
                search_source: 'reddit'
              }, { sourceScope: 'reddit', intentType: 'buyer_request', priority: 'HIGH', qualityTier: 'A' });
            }
          }
        }
      } catch (err) {}
      await new Promise(r => setTimeout(r, 400));
    }

    // Search Queries
    for (const item of searchQueries) {
      const queryStr = item.query;
      try {
        const { provider, results } = await searchManager.searchWithFallback(queryStr, { limit: 8 });
        results.forEach((r, idx) => {
          ingest({
            source: r.engine || provider || 'web_search',
            search_provider: provider || 'bing',
            rank: idx + 1,
            url: r.url,
            title: r.title,
            snippet: r.snippet,
            search_query: queryStr,
            search_source: provider
          }, {
            sourceScope: item.sourceScope || 'public_web',
            intentType: item.intentType || 'buyer_request',
            deliverableType: item.deliverableType || 'custom_software',
            priority: item.priority || 'HIGH',
            qualityTier: item.qualityTier || 'A'
          });
        });
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }

    // Pre-Crawl Scoring Filter
    const queryCandidatesMap = new Map();

    for (const cand of rawCandidatePool) {
      const evalRes = scoreSearchResult(cand, cand.queryContext);
      const q = cand.search_query || 'direct_source';
      const p = cand.search_provider || cand.source || 'unknown';

      if (!queryCandidatesMap.has(q)) queryCandidatesMap.set(q, []);

      if (evalRes.decision && evalRes.decision.toLowerCase() === 'accept') {
        providerStats[p].preAccepted++;
        queryStats[q].preAccepted++;
        queryCandidatesMap.get(q).push({ ...cand, preCrawlEval: evalRes });

        // Row for CSV 2: PRE-CRAWL ACCEPTED
        csv2Rows.push({
          query: q,
          source: cand.source,
          url: cand.url,
          title: cand.title,
          snippet: cand.snippet,
          sourceDomain: extractHostname(cand.url),
          preCrawlScore: evalRes.score,
          decision: evalRes.decision,
          positiveSignals: evalRes.positiveSignals,
          negativeSignals: evalRes.negativeSignals,
          sourceScope: cand.queryContext?.sourceScope || 'public_web',
          intentType: cand.queryContext?.intentType || 'buyer_request',
          deliverableType: cand.queryContext?.deliverableType || 'custom_software',
          priority: cand.queryContext?.priority || 'HIGH',
          qualityTier: cand.queryContext?.qualityTier || 'A',
          rejectionReason: evalRes.rejectionReason || 'NONE'
        });
      }
    }

    // Sort each query group by score descending and take up to 3 for deep crawl
    const approvedForCrawl = [];
    for (const [qKey, candidates] of queryCandidatesMap.entries()) {
      candidates.sort((a, b) => b.preCrawlEval.score - a.preCrawlEval.score);
      const allowed = candidates.slice(0, 3);
      for (const c of allowed) {
        if (approvedForCrawl.length < 50) {
          approvedForCrawl.push(c);
        }
      }
    }

    // Deep Crawl & Classifier
    for (const cand of approvedForCrawl) {
      const q = cand.search_query || 'direct_source';
      const p = cand.search_provider || cand.source || 'unknown';
      providerStats[p].deepCrawled++;
      queryStats[q].deepCrawled++;

      let rawContent = cand.snippet || '';
      try {
        const ext = await contentExtractor.extractFromUrl(cand.url);
        if (ext && ext.content) rawContent = ext.content;
      } catch (e) {}

      const enriched = {
        ...cand,
        title: cand.title,
        description: rawContent,
        rawContent,
        source: cand.source,
        sourceUrl: cand.url,
        url: cand.url,
        postedAt: cand.postedAt || new Date().toISOString()
      };

      const qResult = await classifier.qualifyAndExtract(enriched);

      if (qResult.qualification_status === 'qualified') {
        providerStats[p].qualified++;
        queryStats[q].qualified++;
      }

      // Row for CSV 3: DEEP CRAWLED / CLASSIFIED
      csv3Rows.push({
        query: q,
        source: cand.source,
        url: cand.url,
        title: cand.title,
        preCrawlScore: cand.preCrawlEval?.score || 0,
        rawContent: rawContent.substring(0, 1000),
        qualification_status: qResult.qualification_status || 'rejected',
        rejection_reason: qResult.rejection_reason || (qResult.qualification_status === 'qualified' ? 'NONE' : 'UNQUALIFIED'),
        rejection_gate: qResult.rejection_gate || (qResult.qualification_status === 'qualified' ? 'NONE' : 'GATE_FILTER'),
        is_it_project: qResult.is_it_project ?? false,
        is_client_side_project: qResult.is_client_side_project ?? false,
        is_employment: qResult.is_employment ?? false,
        is_internship: qResult.is_internship ?? false,
        is_freelancer_seeking_work: qResult.is_freelancer_seeking_work ?? false,
        has_actionable_contact: qResult.has_actionable_contact ?? false,
        contact_type: qResult.contact_type || 'none',
        contact_value: qResult.contact_value || '',
        client_name: qResult.client_name || '',
        client_company: qResult.client_company || '',
        client_email: qResult.client_email || '',
        client_profile_url: qResult.client_profile_url || ''
      });
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // -------------------------------------------------------------
  // BUILD CSV STRINGS
  // -------------------------------------------------------------
  const csv1Headers = ['query', 'source', 'search_provider', 'rank', 'title', 'snippet', 'url', 'sourceDomain', 'sourceScope', 'intentType', 'deliverableType', 'priority', 'qualityTier'];
  const csv1Content = [
    csv1Headers.join(','),
    ...csv1Rows.map(r => csv1Headers.map(h => escapeCsv(r[h])).join(','))
  ].join('\n');

  const csv2Headers = ['query', 'source', 'url', 'title', 'snippet', 'sourceDomain', 'preCrawlScore', 'decision', 'positiveSignals', 'negativeSignals', 'sourceScope', 'intentType', 'deliverableType', 'priority', 'qualityTier', 'rejectionReason'];
  const csv2Content = [
    csv2Headers.join(','),
    ...csv2Rows.map(r => csv2Headers.map(h => escapeCsv(r[h])).join(','))
  ].join('\n');

  const csv3Headers = ['query', 'source', 'url', 'title', 'preCrawlScore', 'rawContent', 'qualification_status', 'rejection_reason', 'rejection_gate', 'is_it_project', 'is_client_side_project', 'is_employment', 'is_internship', 'is_freelancer_seeking_work', 'has_actionable_contact', 'contact_type', 'contact_value', 'client_name', 'client_company', 'client_email', 'client_profile_url'];
  const csv3Content = [
    csv3Headers.join(','),
    ...csv3Rows.map(r => csv3Headers.map(h => escapeCsv(r[h])).join(','))
  ].join('\n');

  // Paths
  const downloadDir = '/Users/shubh/Downloads';
  const backupDir = '/Users/shubh/Downloads/leadspy_search_engine_files';

  fs.writeFileSync(path.join(downloadDir, 'csv1_all_raw_search_results.csv'), csv1Content, 'utf8');
  fs.writeFileSync(path.join(downloadDir, 'csv2_pre_crawl_accepted_results.csv'), csv2Content, 'utf8');
  fs.writeFileSync(path.join(downloadDir, 'csv3_deep_crawled_classified_results.csv'), csv3Content, 'utf8');

  if (fs.existsSync(backupDir)) {
    fs.writeFileSync(path.join(backupDir, 'csv1_all_raw_search_results.csv'), csv1Content, 'utf8');
    fs.writeFileSync(path.join(backupDir, 'csv2_pre_crawl_accepted_results.csv'), csv2Content, 'utf8');
    fs.writeFileSync(path.join(backupDir, 'csv3_deep_crawled_classified_results.csv'), csv3Content, 'utf8');
  }

  console.log(`\n✅ CSV 1 Saved: ${path.join(downloadDir, 'csv1_all_raw_search_results.csv')} (${csv1Rows.length} rows)`);
  console.log(`✅ CSV 2 Saved: ${path.join(downloadDir, 'csv2_pre_crawl_accepted_results.csv')} (${csv2Rows.length} rows)`);
  console.log(`✅ CSV 3 Saved: ${path.join(downloadDir, 'csv3_deep_crawled_classified_results.csv')} (${csv3Rows.length} rows)`);

  console.log('\n================================================================');
  console.log('📊 PROVIDER-WISE SUMMARY:');
  console.log('================================================================');
  console.table(Object.entries(providerStats).map(([provider, s]) => ({
    provider,
    raw_results: s.raw,
    unique_results: s.unique,
    pre_filter_accepted: s.preAccepted,
    deep_crawled: s.deepCrawled,
    qualified: s.qualified
  })));

  console.log('\n================================================================');
  console.log('📊 QUERY-WISE SUMMARY (Top queries producing results):');
  console.log('================================================================');
  const sortedQueries = Object.entries(queryStats).map(([query, s]) => ({
    query: query.substring(0, 50),
    raw_results: s.raw,
    pre_accepted: s.preAccepted,
    deep_crawled: s.deepCrawled,
    qualified: s.qualified
  })).sort((a, b) => b.raw_results - a.raw_results);
  console.table(sortedQueries.slice(0, 25));
}

runForensicExport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Forensic export failed:', err);
    process.exit(1);
  });
