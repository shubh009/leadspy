/**
 * Natural Language Query Parser
 * Converts plain-English queries into structured database filter parameters
 */
export function parseNaturalLanguageQuery(query) {
  if (!query || typeof query !== 'string') {
    return { filters: {}, explanation: 'Showing all recent projects' };
  }

  const q = query.trim().toLowerCase();
  const filters = {};
  const explanationChips = [];

  // 1. Detect Category
  if (/mobile|android|ios|flutter|react native|swift|kotlin/i.test(q)) {
    filters.category = 'Mobile App';
    explanationChips.push('Category: Mobile App');
  } else if (/ui|ux|design|figma|redesign|wireframe/i.test(q)) {
    filters.category = 'UI/UX';
    explanationChips.push('Category: UI/UX');
  } else if (/saas|crm|erp|platform|dashboard/i.test(q)) {
    filters.category = 'SaaS';
    explanationChips.push('Category: SaaS');
  } else if (/ai|machine learning|llm|agent|chatbot|gpt/i.test(q)) {
    filters.category = 'AI/ML';
    explanationChips.push('Category: AI/ML');
  } else if (/web|website|frontend|backend|fullstack|full-stack/i.test(q)) {
    filters.category = 'Web Development';
    explanationChips.push('Category: Web Development');
  }

  // 2. Detect Specific Technology / Skills
  const techMap = {
    'react': 'React',
    'next.js': 'Next.js',
    'nextjs': 'Next.js',
    'node': 'Node.js',
    'nodejs': 'Node.js',
    'node.js': 'Node.js',
    'flutter': 'Flutter',
    'python': 'Python',
    'typescript': 'TypeScript',
    'tailwind': 'Tailwind',
    'figma': 'Figma',
    'wordpress': 'WordPress',
    'shopify': 'Shopify',
    'supabase': 'Supabase',
    'vue': 'Vue'
  };

  for (const [key, val] of Object.entries(techMap)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(q)) {
      filters.tech = val;
      explanationChips.push(`Tech: ${val}`);
      break;
    }
  }

  // 3. Detect Budget filters
  const underMatch = q.match(/under\s*\$?([\d,]+)/i) || q.match(/less than\s*\$?([\d,]+)/i);
  if (underMatch) {
    const maxVal = parseFloat(underMatch[1].replace(/,/g, ''));
    filters.budgetMax = maxVal;
    explanationChips.push(`Budget < $${maxVal}`);
  }

  const minMatch = q.match(/over\s*\$?([\d,]+)/i) || q.match(/above\s*\$?([\d,]+)/i) || q.match(/more than\s*\$?([\d,]+)/i);
  if (minMatch) {
    const minVal = parseFloat(minMatch[1].replace(/,/g, ''));
    filters.budgetMin = minVal;
    explanationChips.push(`Budget > $${minVal}`);
  }

  // 4. Detect Freshness / Time
  if (q.includes('today') || q.includes('24 hour') || q.includes('24h') || q.includes('last day')) {
    filters.freshness = '24h';
    explanationChips.push('Posted: Today (Last 24h)');
  } else if (q.includes('hour') || q.includes('just posted') || q.includes('1 hour') || q.includes('fresh')) {
    filters.freshness = '1h';
    explanationChips.push('Posted: Last 1-2 Hours');
  } else if (q.includes('week') || q.includes('recent')) {
    filters.freshness = '7d';
    explanationChips.push('Posted: This Week');
  }

  // 5. Detect Location
  if (q.includes('usa') || q.includes('us') || q.includes('america') || q.includes('united states')) {
    filters.location = 'USA';
    explanationChips.push('Location: USA');
  } else if (q.includes('uk') || q.includes('united kingdom') || q.includes('london')) {
    filters.location = 'UK';
    explanationChips.push('Location: UK');
  } else if (q.includes('remote') || q.includes('global')) {
    filters.location = 'Remote';
    explanationChips.push('Location: Remote');
  }

  return {
    rawQuery: query,
    filters,
    explanationChips: explanationChips.length > 0 ? explanationChips : ['Keyword search: ' + query]
  };
}
