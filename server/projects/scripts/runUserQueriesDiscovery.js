import { ProjectClassifier } from '../ai/projectClassifier.js';
import { saveMasterProjects } from '../services/projectDbService.js';
import { supabase } from '../../config/supabase.js';

const USER_QUERIES = [
  'need someone to build a website',
  'looking for a web development agency',
  'need a development team',
  'looking for software development agency',
  'need someone to build an MVP',
  'looking for mobile app development agency',
  'need someone to build a SaaS',
  'need website redesign',
  'looking for AI development agency',
  'need someone to build our platform'
];

async function runTargetedDiscovery() {
  console.log('================================================================');
  console.log('🚀 RUNNING TARGETED DISCOVERY ON 10 USER QUERIES (P1, P2, P3)');
  console.log('================================================================\n');

  const classifier = new ProjectClassifier();
  // Ensure high quality deterministic qualification
  classifier.apiKey = null;

  const rawCandidates = [];

  // -------------------------------------------------------------
  // 1. P2: Hacker News Algolia Search for each of the 10 Queries
  // -------------------------------------------------------------
  console.log('📡 [P2: Hacker News] Searching 10 high-intent queries...');
  for (const query of USER_QUERIES) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const hits = data.hits || [];
        for (const h of hits) {
          const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0]?.substring(0, 100) || `Project Inquiry: ${query}`;

          rawCandidates.push({
            source: 'hackernews',
            priorityTier: 'P2',
            sourcePostId: `hn-${h.objectID}`,
            sourceUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
            rawTitle: title,
            rawContent: `${title} | Requirement: ${text.substring(0, 800)}`,
            author: h.author || 'HN Client',
            authorProfileUrl: `https://news.ycombinator.com/user?id=${h.author}`,
            postedAt: h.created_at || new Date().toISOString(),
            queryMatched: query
          });
        }
      }
    } catch (err) {
      console.warn(`[HackerNews] Search notice for "${query}":`, err.message);
    }
  }

  // Also scan recent Seeking Freelancer stories
  try {
    const threadRes = await fetch('https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent('"SEEKING FREELANCER"') + '&tags=comment&hitsPerPage=20', { signal: AbortSignal.timeout(5000) });
    if (threadRes.ok) {
      const threadData = await threadRes.json();
      for (const h of (threadData.hits || [])) {
        const text = (h.comment_text || '').replace(/<[^>]*>?/gm, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        rawCandidates.push({
          source: 'hackernews',
          priorityTier: 'P2',
          sourcePostId: `hn-sf-${h.objectID}`,
          sourceUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
          rawTitle: lines[0]?.substring(0, 100) || 'Seeking Freelance / Agency Developer',
          rawContent: text,
          author: h.author || 'HN Client',
          authorProfileUrl: `https://news.ycombinator.com/user?id=${h.author}`,
          postedAt: h.created_at || new Date().toISOString(),
          queryMatched: 'SEEKING FREELANCER thread'
        });
      }
    }
  } catch (err) {
    console.warn('[HackerNews] Seeking Freelancer notice:', err.message);
  }

  // -------------------------------------------------------------
  // 2. P2: DEV Community Public Articles / Contracts
  // -------------------------------------------------------------
  console.log('📡 [P2: DEV Community] Fetching contracts and project posts...');
  for (const tag of ['hiring', 'freelance', 'contract', 'project']) {
    try {
      const url = `https://dev.to/api/articles?tag=${tag}&per_page=15`;
      const res = await fetch(url, { headers: { 'User-Agent': 'LeadSpyBot/1.0 (+https://leadspy.app)' }, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const articles = await res.json();
        for (const a of articles) {
          rawCandidates.push({
            source: 'dev_to',
            priorityTier: 'P2',
            sourcePostId: `devto-${a.id}`,
            sourceUrl: a.url,
            rawTitle: a.title,
            rawContent: `${a.title} | Tags: ${a.tag_list?.join(', ')}. ${a.description || a.title}`,
            author: a.user?.name || a.user?.username || 'DEV Client',
            authorProfileUrl: a.url,
            postedAt: a.published_at || new Date().toISOString(),
            queryMatched: tag
          });
        }
      }
    } catch (err) {
      console.warn(`[DEV Community] Tag ${tag} notice:`, err.message);
    }
  }

  // -------------------------------------------------------------
  // 3. P3: Hasjob Live Tech Feed (Indian Startups & Projects)
  // -------------------------------------------------------------
  console.log('📡 [P3: Hasjob India Tech] Fetching live startup project feeds...');
  try {
    const res = await fetch('https://hasjob.co/feed', { headers: { 'User-Agent': 'LeadSpyBot/1.0' }, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const xml = await res.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      for (const e of entries) {
        const rawTitle = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
        const link = (e.match(/<link\s+href="([^"]+)"/) || [])[1] || '';
        const loc = (e.match(/<location>([\s\S]*?)<\/location>/) || [])[1]?.trim() || 'India';
        const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ').trim() || rawTitle;

        if (link && rawTitle) {
          rawCandidates.push({
            source: 'india_tech',
            priorityTier: 'P3',
            sourcePostId: `in-${Buffer.from(link).toString('base64').substring(0, 16)}`,
            sourceUrl: link,
            rawTitle: `${rawTitle} (${loc})`,
            rawContent: `${rawTitle} | Location: ${loc}, India | Project details: ${content}`,
            author: 'Indian Client / Startup',
            authorProfileUrl: link,
            postedAt: new Date().toISOString(),
            queryMatched: 'Hasjob feed'
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Hasjob] Notice:', err.message);
  }

  // -------------------------------------------------------------
  // 4. P2: RemoteOK Live Contracts API
  // -------------------------------------------------------------
  console.log('📡 [P2: RemoteOK] Fetching live developer contract feeds...');
  try {
    const res = await fetch('https://remoteok.com/api?tag=dev', { headers: { 'User-Agent': 'LeadSpyBot/1.0' }, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data.slice(1, 30) : [];
      for (const item of items) {
        if (!item.position || !item.url) continue;
        rawCandidates.push({
          source: 'remoteok',
          priorityTier: 'P2',
          sourcePostId: `remoteok-${item.id}`,
          sourceUrl: item.url,
          rawTitle: `${item.position} at ${item.company || 'Tech Company'}`,
          rawContent: `${item.position} | Company: ${item.company || 'Confidential'} | Location: ${item.location || 'Remote'} | Tags: ${(item.tags || []).join(', ')}. ${(item.description || '').replace(/<[^>]*>?/gm, ' ').substring(0, 500)}`,
          author: item.company || 'Tech Company',
          authorProfileUrl: item.url,
          postedAt: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
          queryMatched: 'RemoteOK dev'
        });
      }
    }
  } catch (err) {
    console.warn('[RemoteOK] Notice:', err.message);
  }

  console.log(`\n📥 Total Raw Candidates Ingested: ${rawCandidates.length}`);
  console.log('⚙️ Filtering through 9-Gate Qualification Engine with Zero Tolerance for Poor Quality...\n');

  const qualifiedProjects = [];
  const rejectionStats = {};

  for (const cand of rawCandidates) {
    const result = await classifier.qualifyAndExtract(cand);
    if (result.qualification_status === 'qualified' && result.has_actionable_contact) {
      qualifiedProjects.push(result);
      console.log(`🌟 [QUALIFIED] [${result.priorityTier || cand.priorityTier}] ${result.title.substring(0, 75)}`);
      console.log(`   -> Category: ${result.category} | Contact: ${result.contact_type} (${result.contact_value || result.clientEmail})`);
      console.log(`   -> Live Link: ${result.sourceUrl}\n`);
    } else {
      const reason = result.rejection_reason || 'UNQUALIFIED';
      rejectionStats[reason] = (rejectionStats[reason] || 0) + 1;
    }
  }

  console.log('================================================================');
  console.log('📊 QUALIFICATION SUMMARY:');
  console.log(`Total Candidates Scanned : ${rawCandidates.length}`);
  console.log(`Qualified Top-Notch Leads: ${qualifiedProjects.length}`);
  console.log('Rejection Breakdown:');
  Object.entries(rejectionStats).forEach(([reason, count]) => {
    console.log(` - ${reason}: ${count} filtered out`);
  });
  console.log('================================================================\n');

  if (qualifiedProjects.length > 0) {
    console.log(`💾 Saving ${qualifiedProjects.length} qualified projects into Supabase master_projects...`);
    const saveRes = await saveMasterProjects(qualifiedProjects);
    console.log(`✅ Saved ${saveRes.inserted} new projects into Supabase database!`);
  } else {
    console.log('ℹ️ No low-quality or fake posts were allowed into the database.');
  }

  // Verify final count in Supabase
  const { count } = await supabase.from('master_projects').select('*', { count: 'exact', head: true });
  console.log(`\n🎯 Total Active Projects Now in Supabase Database: ${count}`);
}

runTargetedDiscovery().catch(err => {
  console.error('Crawler execution error:', err);
  process.exit(1);
});
