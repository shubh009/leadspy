import { CanonicalDeduplicator } from '../services/canonicalDeduplicator.js';

console.log('================================================================');
console.log('🧪 RUNNING CANONICAL DEDUPLICATOR TEST SUITE');
console.log('================================================================\n');

const dedup = new CanonicalDeduplicator();
let passed = 0;
let total = 0;

function assert(condition, desc) {
  total++;
  if (condition) {
    console.log(`✅ [PASS] Test ${total}: ${desc}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] Test ${total}: ${desc}`);
  }
}

// 1. Generic URL Normalization (Task 4)
const rawUrl1 = 'https://example.com/projects/web-app?utm_source=twitter&utm_medium=social#comment-456';
const norm1 = dedup.normalizeUrl(rawUrl1);
assert(norm1 === 'https://example.com/projects/web-app', 'Strips utm params and fragment');

const rawUrl2 = 'http://EXAMPLE.COM:80/path/?b=2&a=1';
const norm2 = dedup.normalizeUrl(rawUrl2);
assert(norm2 === 'http://example.com/path?a=1&b=2', 'Lowercases host, removes default port 80, sorts query params, removes trailing slash');

// 2. GitHub Canonicalization (Task 3)
const gh1 = 'https://github.com/kubernetes/minikube/issues/23746';
const gh2 = 'https://github.com/kubernetes/minikube/issues/23746#issuecomment-998877';
const gh3 = 'https://api.github.com/repos/kubernetes/minikube/issues/23746';

const id1 = dedup.extractSourceCanonicalId(gh1);
const id2 = dedup.extractSourceCanonicalId(gh2);
const id3 = dedup.extractSourceCanonicalId(gh3);

assert(id1 === 'github:kubernetes/minikube:issue:23746', 'GitHub issue maps to canonical identity');
assert(id2 === 'github:kubernetes/minikube:issue:23746', 'GitHub comment anchor maps to same issue identity');
assert(id3 === 'github:kubernetes/minikube:issue:23746', 'GitHub API endpoint maps to same issue identity');

// 3. Reddit Canonicalization
const r1 = 'https://www.reddit.com/r/forhire/comments/1izw99/hiring_build_a_website_in_nextjs/';
const r2 = 'https://reddit.com/r/forhire/comments/1izw99';
assert(dedup.extractSourceCanonicalId(r1) === 'reddit:submission:1izw99', 'Reddit full permalink canonical identity');
assert(dedup.extractSourceCanonicalId(r2) === 'reddit:submission:1izw99', 'Reddit short submission canonical identity');

// 4. Hacker News Canonicalization
const hn1 = 'https://news.ycombinator.com/item?id=49763222';
assert(dedup.extractSourceCanonicalId(hn1) === 'hackernews:item:49763222', 'Hacker news canonical identity');

// 5. Pre-Filter Pipeline Metrics (Task 7)
dedup.reset();
const c1 = dedup.checkUrlCandidate({ url: gh1, source: 'github' });
assert(!c1.isDuplicate, 'First GitHub item passes');

const c2 = dedup.checkUrlCandidate({ url: gh1, source: 'github' });
assert(c2.isDuplicate && c2.reason === 'RAW_URL_DUPLICATE', 'Exact raw URL duplicate caught');

const c3 = dedup.checkUrlCandidate({ url: gh2, source: 'github' });
assert(c3.isDuplicate && (c3.reason === 'CANONICAL_URL_DUPLICATE' || c3.reason === 'SOURCE_ID_DUPLICATE'), 'Comment anchor duplicate caught via Canonical URL or Source-ID');

const c4 = dedup.checkUrlCandidate({ url: gh3, source: 'github' });
assert(c4.isDuplicate && c4.reason === 'SOURCE_ID_DUPLICATE', 'API endpoint duplicate caught via Source-ID');

// 6. Content Fingerprinting (Task 5)
const f1 = dedup.checkContentCandidate('Build React MVP', 'We need a React developer to build an MVP.');
assert(!f1.isDuplicate, 'First unique content fingerprint passes');

const f2 = dedup.checkContentCandidate('build react mvp!', 'We need a React developer to build an MVP.');
assert(f2.isDuplicate && f2.reason === 'CONTENT_FINGERPRINT_DUPLICATE', 'Normalized content duplicate caught before AI classification');

console.log('\n================================================================');
console.log(`DEDUPLICATION TEST SUMMARY: Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
console.log('================================================================\n');

if (passed === total) process.exit(0);
else process.exit(1);
