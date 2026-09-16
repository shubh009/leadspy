import dotenv from 'dotenv';
dotenv.config();

/**
 * AI Project Classifier & Structured Entity Extractor
 * Uses OpenRouter LLM with intelligent heuristic backup.
 */
export class ProjectClassifier {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  }

  /**
   * Qualify and parse a candidate post
   * @param {Object} candidate - Normalized candidate post
   * @returns {Promise<Object|null>} - Returns structured project record or null if not IT project
   */
  async qualifyAndExtract(candidate) {
    // 1. Quick initial rejection of obvious non-leads / job seekers
    const lowerTitle = (candidate.rawTitle || '').toLowerCase();
    const lowerContent = (candidate.rawContent || '').toLowerCase();

    if (lowerTitle.includes('[for hire]') || lowerTitle.startsWith('for hire:') || lowerTitle.includes('seeking work')) {
      return null; // Competitor seeking work, discard immediately
    }

    // 2. Try LLM Qualification if API Key exists
    if (this.apiKey) {
      try {
        const llmResult = await this.callLLM(candidate);
        if (llmResult && typeof llmResult.is_it_project === 'boolean') {
          if (!llmResult.is_it_project) return null;
          return this.formatExtractedProject(candidate, llmResult);
        }
      } catch (err) {
        console.warn('[ProjectClassifier] LLM qualification fallback to heuristic:', err.message);
      }
    }

    // 3. Fallback Heuristic Classifier & Extractor
    return this.heuristicQualification(candidate);
  }

  async callLLM(candidate) {
    const prompt = `
You are an expert IT Project Evaluator.
Analyze this public post and determine if it represents an actual IT/Software project requirement or hiring intent.

Post Title: "${candidate.rawTitle}"
Author: "${candidate.author}"
Source: "${candidate.source}"
Content:
"""
${candidate.rawContent}
"""

Return ONLY a valid JSON object with NO MARKDOWN and NO BACKTICKS with the following schema:
{
  "is_it_project": true or false,
  "relevance_score": number between 1 and 100,
  "intent": "Looking for Developer" or "Looking for Agency" or "Contract Requirement" or "For Hire" or "General Discussion",
  "category": "Web Development" or "Mobile App" or "UI/UX" or "SaaS" or "AI/ML" or "Other IT",
  "title": "Clean concise project title",
  "short_summary": "1-2 sentence executive summary of what client needs",
  "skills": ["Skill1", "Skill2"],
  "features": ["Feature1", "Feature2"],
  "client_name": "Client or company name if found",
  "client_email": "Extracted email if found in text, else null",
  "client_location": "USA/Europe/Remote/etc if found, else 'Remote'",
  "budget": "Budget string e.g. '$3,000 - $5,000' or 'Hourly' or null",
  "budget_min": number or null,
  "budget_max": number or null,
  "project_type": "Fixed Price" or "Hourly" or "Contract" or "Agency"
}
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://leadspy.app',
        'X-Title': 'LeadSpy IT Project Engine'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 600
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`LLM API returned status ${response.status}`);
    }

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content || '';
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    return JSON.parse(text);
  }

  /**
   * Deterministic Heuristic Extractor (Works 100% offline with zero latency)
   */
  heuristicQualification(candidate) {
    // 1. Reject non-tech corporate roles & non-project corporate jobs
    if (/payroll|student assistant|recruiter|hr manager|receptionist|accountant|fashion communication|garment draping|business development manager/i.test(candidate.rawTitle)) {
      return null;
    }

    const text = `${candidate.rawTitle} ${candidate.rawContent}`;
    const lower = text.toLowerCase();

    // Skill detection
    const skillList = [
      'React', 'Next.js', 'Node.js', 'TypeScript', 'JavaScript', 'Python',
      'Flutter', 'React Native', 'Swift', 'Kotlin', 'iOS', 'Android',
      'Tailwind', 'Figma', 'UI/UX', 'Vue', 'Angular', 'PHP', 'Laravel',
      'WordPress', 'Shopify', 'Supabase', 'PostgreSQL', 'MongoDB',
      'FastAPI', 'AI', 'LangChain', 'OpenAI', 'AWS', 'Docker'
    ];
    const detectedSkills = skillList.filter(s => new RegExp(`\\b${s.replace('.', '\\.')}\\b`, 'i').test(text));

    // Category detection
    let category = 'Web Development';
    if (/\bmobile\b|flutter|react native|ios\b|android/i.test(text)) {
      category = 'Mobile App';
    } else if (/ui\/ux|ux design|ui design|web design|redesign/i.test(text)) {
      category = 'UI/UX';
    } else if (/langchain|llm\b|machine learning|openai|fastapi/i.test(text)) {
      category = 'AI/ML';
    } else if (/\bsaas\b|micro-saas|b2b/i.test(text)) {
      category = 'SaaS';
    } else if (/web|website|portal|next\.js|react|full stack|frontend|backend|node/i.test(text)) {
      category = 'Web Development';
    }

    // Email extraction
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
    const clientEmail = emailMatch ? emailMatch[1] : null;

    // Location detection (Supporting India & Indian Metros)
    let clientLocation = 'Global / Remote';
    if (/india|delhi|bangalore|bengaluru|mumbai|pune|hyderabad|noida|gurugram|gurgaon|surat|chennai/i.test(text)) {
      if (/delhi|noida|gurugram|gurgaon/i.test(text)) clientLocation = 'Delhi NCR, India';
      else if (/bangalore|bengaluru/i.test(text)) clientLocation = 'Bangalore, India';
      else if (/mumbai/i.test(text)) clientLocation = 'Mumbai, India';
      else if (/pune/i.test(text)) clientLocation = 'Pune, India';
      else if (/hyderabad/i.test(text)) clientLocation = 'Hyderabad, India';
      else clientLocation = 'India (Remote)';
    } else if (text.includes('USA') || text.includes('US') || text.includes('America')) {
      clientLocation = 'USA';
    } else if (text.includes('UK') || text.includes('London')) {
      clientLocation = 'UK';
    } else if (text.includes('Canada')) {
      clientLocation = 'Canada';
    }

    // Budget & Currency extraction (USD & INR)
    let budget = null;
    let budgetMin = null;
    let budgetMax = null;
    let currency = 'USD';

    const inrMatch = text.match(/₹\s*[\d,]+(\s*-\s*₹\s*[\d,]+)?/i) || text.match(/INR\s*[\d,]+/i) || text.match(/[\d.]+\s*Lakh/i);
    const budgetMatch = text.match(/\$[\d,]+(\s*-\s*\$[\d,]+)?/);

    if (inrMatch) {
      budget = inrMatch[0];
      currency = 'INR';
    } else if (budgetMatch) {
      budget = budgetMatch[0];
      currency = 'USD';
      const nums = budget.replace(/\$/g, '').replace(/,/g, '').split('-').map(n => parseFloat(n.trim())).filter(Boolean);
      if (nums.length === 1) {
        budgetMin = nums[0];
        budgetMax = nums[0];
      } else if (nums.length >= 2) {
        budgetMin = nums[0];
        budgetMax = nums[1];
      }
    }

    // Client contact method
    let contactMethod = 'external_link';
    if (clientEmail) contactMethod = 'email';
    else if (candidate.source === 'reddit') contactMethod = 'reddit_dm';
    else if (candidate.source === 'linkedin') contactMethod = 'linkedin_message';

    return {
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      sourcePostId: candidate.sourcePostId,
      title: candidate.rawTitle,
      shortSummary: candidate.rawContent.substring(0, 180).trim() + (candidate.rawContent.length > 180 ? '...' : ''),
      originalDescription: candidate.rawContent,
      category,
      skills: detectedSkills.length > 0 ? detectedSkills : ['Full Stack', 'Web'],
      features: ['Custom Deliverables', 'Project Milestones'],
      clientName: candidate.author || 'Client',
      clientUsername: candidate.author,
      clientEmail,
      clientProfileUrl: candidate.authorProfileUrl,
      clientContactMethod: contactMethod,
      clientLocation,
      budget: budget || 'Negotiable',
      budgetMin,
      budgetMax,
      currency,
      projectType: budget ? 'Fixed Milestone' : 'Contract / Gig',
      intent: 'Looking for Agency / Developer',
      relevanceScore: 90,
      postedAt: candidate.postedAt,
      discoveredAt: new Date().toISOString()
    };
  }

  formatExtractedProject(candidate, llmResult) {
    return {
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      sourcePostId: candidate.sourcePostId,
      title: llmResult.title || candidate.rawTitle,
      shortSummary: llmResult.short_summary || candidate.rawContent.substring(0, 180),
      originalDescription: candidate.rawContent,
      category: llmResult.category || 'Web Development',
      skills: Array.isArray(llmResult.skills) ? llmResult.skills : [],
      features: Array.isArray(llmResult.features) ? llmResult.features : [],
      clientName: llmResult.client_name || candidate.author,
      clientUsername: candidate.author,
      clientEmail: llmResult.client_email || null,
      clientProfileUrl: candidate.authorProfileUrl,
      clientContactMethod: llmResult.client_email ? 'email' : (candidate.source === 'reddit' ? 'reddit_dm' : 'external_link'),
      clientLocation: llmResult.client_location || 'Remote',
      budget: llmResult.budget || 'Negotiable',
      budgetMin: llmResult.budget_min || null,
      budgetMax: llmResult.budget_max || null,
      currency: 'USD',
      projectType: llmResult.project_type || 'Contract',
      intent: llmResult.intent || 'Looking for Developer',
      relevanceScore: llmResult.relevance_score || 80,
      postedAt: candidate.postedAt,
      discoveredAt: new Date().toISOString()
    };
  }
}
