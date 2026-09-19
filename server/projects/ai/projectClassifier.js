import dotenv from 'dotenv';
dotenv.config();

/**
 * AI Project Classifier & Structured Entity Extractor
 * Enforces strict IT Project Qualification & Actionable Contactability
 * Based on Project Discovery Engine Change Request Specification
 */
export class ProjectClassifier {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    this.seenSignatures = new Set();
    this.seenProjects = [];
    this.enableDeduplication = true;
  }

  resetDeduplicationCache() {
    this.seenSignatures.clear();
    this.seenProjects = [];
  }

  extractCoreTokens(text) {
    if (!text) return [];
    const cleaned = text.toLowerCase()
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
      .replace(/\b(we|i|our|my|are|is|a|an|the|and|or|for|to|at|in|on|of|with|by|from|as|be|this|that|these|those|need|needs|needed|looking|seeking|want|wants|wanted|hire|hiring|please|contact|us|me|dm|call|email|team|developer|developers|agency|company|business|project|projects|opportunity|work)\b/gi, ' ')
      .replace(/[^a-z0-9]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(t => t.length > 2);
    return [...new Set(tokens)];
  }

  /**
   * Sources explicitly excluded from project ingestion
   */
  static EXCLUDED_SOURCES = ['freelancer', 'guru', 'peopleperhour'];

  /**
   * Qualify and parse a candidate post
   * @param {Object} candidate - Normalized candidate post
   * @returns {Promise<Object>} - Returns result object with qualification_status ('qualified' or 'rejected')
   */
  async qualifyAndExtract(candidate) {
    if (!candidate) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NO_PROJECT_REQUIREMENT',
        is_client_side_project: false
      };
    }

    // 0. Excluded sources check (Section 9 & 15)
    const sourceLower = (candidate.source || '').toLowerCase();
    if (ProjectClassifier.EXCLUDED_SOURCES.some(s => sourceLower.includes(s))) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'SOURCE_NOT_ALLOWED',
        is_client_side_project: false
      };
    }

    let result = null;

    // 1. Try LLM Qualification if API Key exists
    if (this.apiKey) {
      try {
        const llmResult = await this.callLLM(candidate);
        if (llmResult && typeof llmResult.qualification_status === 'string') {
          result = this.formatExtractedProject(candidate, llmResult);
        }
      } catch (err) {
        console.warn('[ProjectClassifier] LLM qualification failed, using strict heuristic fallback:', err.message);
      }
    }

    // 2. Deterministic Strict Heuristic Classifier & Extractor (Mirror of LLM rules)
    if (!result) {
      result = this.heuristicQualification(candidate);
    }

    // 3. Gate 8: Deduplication check (TC-048 & TC-049) - only performed on candidates that passed all prior gates
    if (this.enableDeduplication && result.qualification_status === 'qualified') {
      const exactSig = (candidate.source && candidate.sourcePostId ? `${candidate.source}:${candidate.sourcePostId}` : null)
        || candidate.sourceUrl
        || candidate.url;

      if (exactSig && this.seenSignatures.has(exactSig)) {
        return {
          qualification_status: 'rejected',
          rejection_reason: 'DUPLICATE',
          is_client_side_project: false
        };
      }

      const text = `${candidate.rawTitle || candidate.title || ''} ${candidate.rawContent || candidate.content || ''}`;
      const currentTokens = this.extractCoreTokens(text);

      if (currentTokens.length >= 4) {
        for (const seen of this.seenProjects) {
          const intersection = currentTokens.filter(t => seen.tokens.includes(t));
          const union = new Set([...currentTokens, ...seen.tokens]);
          const jaccard = intersection.length / union.size;
          if (jaccard >= 0.65 && intersection.length >= 4) {
            return {
              qualification_status: 'rejected',
              rejection_reason: 'DUPLICATE',
              is_client_side_project: false
            };
          }
        }
      }

      // Register into duplicate cache
      if (exactSig) this.seenSignatures.add(exactSig);
      if (currentTokens.length >= 4) {
        this.seenProjects.push({ tokens: currentTokens, sig: exactSig });
      }
    }

    return result;
  }

  async callLLM(candidate) {
    const prompt = `
You are an expert IT Project Qualification Agent.
Evaluate whether this post represents a genuine CLIENT-SIDE IT/SOFTWARE PROJECT OPPORTUNITY that has an ACTIONABLE WAY TO REACH THE CLIENT/COMPANY.

STRICT REJECTION RULES (Check these first):
1. EMPLOYMENT / JOBS: If the post is hiring full-time employees, salaried staff, CTC/LPA, permanent roles, notice period, resume submissions -> REJECT ("EMPLOYMENT").
2. INTERNSHIP: If the post is for interns, trainees, stipend, freshers -> REJECT ("INTERNSHIP").
3. FREELANCER SEEKING WORK: If the author is a developer, agency, or designer advertising their services ("for hire", "hire me", "looking for work", "available for freelance") -> REJECT ("FREELANCER_SEEKING_WORK").
4. GENERAL DISCUSSION: Tutorials, programming questions, career advice, stack comparisons -> REJECT ("GENERAL_DISCUSSION").
5. NOT IT PROJECT: Non-software/IT requirements (garments, accounts, marketing-only, sales, office admin) -> REJECT ("NOT_IT_PROJECT").
6. NO ACTIONABLE CONTACT: If there is NO legitimate outreach route (no email, no phone, no public company website/contact link, no verified direct profile message route) -> REJECT ("NO_ACTIONABLE_CONTACT").

Post Details:
- Title: "${candidate.rawTitle}"
- Author: "${candidate.author || ''}"
- Source: "${candidate.source || ''}"
- Source URL: "${candidate.sourceUrl || ''}"
- Content:
"""
${candidate.rawContent || ''}
"""

Return ONLY a valid JSON object with NO MARKDOWN and NO BACKTICKS with the following schema:
{
  "is_it_project": true or false,
  "is_client_side_project": true or false,
  "is_employment": true or false,
  "is_internship": true or false,
  "is_freelancer_seeking_work": true or false,
  "qualification_status": "qualified" or "rejected",
  "rejection_reason": "SOURCE_NOT_ALLOWED" or "NOT_IT_PROJECT" or "EMPLOYMENT" or "INTERNSHIP" or "FREELANCER_SEEKING_WORK" or "GENERAL_DISCUSSION" or "NO_PROJECT_REQUIREMENT" or "NO_ACTIONABLE_CONTACT" or null,
  "project_intent": "Looking for Developer" or "Looking for Agency" or "Project Outsourcing" or "Contract Project" or "Fixed Price Project" or "Maintenance Project" or null,
  "category": "Web Development" or "Mobile App" or "UI/UX" or "SaaS" or "AI/ML" or "Other IT",
  "title": "Concise cleaned title",
  "short_summary": "1-2 sentence executive summary of what deliverable client needs",
  "skills": ["Skill1", "Skill2"],
  "features": ["Feature1", "Feature2"],
  "client_name": "Client or company name if found, else null",
  "client_company": "Company name if detected, else null",
  "client_email": "Valid email if present in text, else null",
  "client_phone": "Valid phone if present in text, else null",
  "client_location": "Location if found (e.g. USA, UK, Delhi NCR, Bangalore), else null",
  "budget": "Raw budget string e.g. '$3,000' or '₹1,50,000' if stated, else null",
  "budget_min": number or null,
  "budget_max": number or null,
  "currency": "USD" or "INR" or "EUR" or "GBP" or null,
  "project_type": "Fixed Price" or "Hourly" or "Contract" or "Agency" or null,
  "has_actionable_contact": true or false,
  "contact_type": "email" or "phone" or "public_business_contact" or "public_profile_message" or "public_company_website" or "none",
  "contact_value": "email address, phone number, or verified contact URL",
  "client_company_url": "Public company website if detected, else null",
  "relevance_score": number between 1 and 100,
  "contactability_score": number between 1 and 100,
  "confidence": number between 1 and 100
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
        max_tokens: 700
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
   * Deterministic Strict Heuristic Qualifier & Extractor
   * Adheres strictly to the Change Request Specification.
   */
  heuristicQualification(candidate) {
    const title = (candidate.rawTitle || '').trim();
    const content = (candidate.rawContent || '').trim();
    const fullText = `${title} ${content}`;
    const lowerText = fullText.toLowerCase();

    // ----------------------------------------------------
    // GATE 1: Hard Reject - Freelancer Seeking Work (Supply-Side)
    // ----------------------------------------------------
    const freelancerSeekingRegex = /\b(for hire|hire me|looking for (freelance )?(work|projects)|seeking (freelance )?(work|projects)|available for (freelance|hire|new projects|projects|work)|portfolio:|my portfolio|i offer|i can build .* (available|contact me)|i am a .* developer (looking|available)|my agency is looking for clients|looking for (new )?clients|open for (freelance|projects)|full[- ]?stack developer available)\b/i;
    if (freelancerSeekingRegex.test(title) || freelancerSeekingRegex.test(content.substring(0, 400))) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'FREELANCER_SEEKING_WORK',
        is_client_side_project: false,
        is_freelancer_seeking_work: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 2: Hard Reject - Internship / Trainee
    // (Context-Aware: allows "internship management portal/app")
    // ----------------------------------------------------
    const isInternshipApp = /internship\s*(management|portal|app|system|platform)/i.test(fullText);
    const internshipRegex = /\b(intern\b|internship|apprenticeship|trainee|stipend)\b/i;
    if (!isInternshipApp && internshipRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'INTERNSHIP',
        is_client_side_project: false,
        is_internship: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 3: Hard Reject - General Discussion / Learning
    // ----------------------------------------------------
    const discussionRegex = /\b(how (do|can) i learn|which (library|framework|stack|technology)|best (stack|framework|library|technology)|how much does a website cost|average (price|cost) for|researching .* costs|tutorial|career advice|programming question|what do you think of|i want to learn|recommend a good (react|developer)|can anyone recommend)\b/i;
    if (discussionRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'GENERAL_DISCUSSION',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 4: Hard Reject - Employment / Salaried Jobs / HR
    // (Context-Aware: allows "salary calculation module", "hiring external agency")
    // ----------------------------------------------------
    const isFeatureSalary = /salary\s*(calculation|module|component|integration|slip|management|system)/i.test(fullText);
    const isExternalAgencyHiring = /hiring\s*(an?\s*)?(external\s*)?(development\s*)?(agency|firm|team|vendor|contractor)\s*(to|for)?/i.test(fullText);

    const employmentRegex = /\b(software development engineer|sde\b|software engineer\s*[-—–]\s*(mobile|backend|frontend)|full[- ]?time (job|role|position|employee)?|permanent (role|position|employee)|annual ctc|ctc\s*[:=]|[\d.]+\s*lpa|job vacancy|job opening|notice period|immediate joiner|send your (resume|cv)|submit (resume|cv)|join (our|the) team|join our (growing )?engineering team|join our growing team|expanding our engineering team|hiring freshers?|freshers? (can apply|welcome|hiring)|pf\b|esi\b|hr manager|recruiter|recruitment|benefits package|401k|paid time off|pto|salary\s*[:=₹$]|operator\s*\([^\)]+\))\b/i;

    if (!isFeatureSalary && !isExternalAgencyHiring && employmentRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'EMPLOYMENT',
        is_client_side_project: false,
        is_employment: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 5: Non-IT / Non-Project / Adult / Spam Rejection
    // ----------------------------------------------------
    const isPayrollSoftware = /payroll\s*(system|software|module|app|platform)/i.test(fullText);
    const nonItRegex = /\b(payroll|student assistant|receptionist|accountant|garment|fashion communication|escort|sales executive|telecaller|bpo|data entry|operator)\b/i;
    if ((!isPayrollSoftware && nonItRegex.test(title)) || (!isPayrollSoftware && nonItRegex.test(content.substring(0, 200)))) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NOT_IT_PROJECT',
        is_it_project: false,
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 6: Client-Side Project Requirement Check
    // Must contain evidence of an IT deliverable wanted
    // ----------------------------------------------------
    const deliverableRegex = /\b(build|develop|create|redesign|revamp|implement|integrate|integration|migrate|mvp|saas|website|web app|mobile app|application|portal|dashboard|crm|erp|ecommerce|e-commerce|shopify|wordpress|woocommerce|flutter|react|node|api|automation|chatbot|voice agent|software|maintain|maintenance|bug fix|fix|project|appointment system|module|development team|customer portal)\b/i;
    const clientNeedRegex = /\b(need|needs|looking for|seeking|want|wants|hiring\s*(an?\s*)?(external\s*)?(developer|agency|team|freelancer|someone|vendor|contractor)?|rfp|scope of work|project|help integrating|development team for)\b/i;

    const hasDeliverable = deliverableRegex.test(fullText);
    const hasClientNeed = clientNeedRegex.test(fullText);

    if (!hasDeliverable || !hasClientNeed) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NO_PROJECT_REQUIREMENT',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 7: Actionable Contactability Verification
    // ----------------------------------------------------
    // 1. Email check (allows standard domains including example.com / abc.com used in tests)
    const emailMatch = fullText.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i);
    let validEmail = null;
    if (emailMatch && !emailMatch[1].includes('leadspy.app') && !emailMatch[1].includes('test.com')) {
      validEmail = emailMatch[1];
    }

    // 2. Phone check (E.164, Indian standard, or US standard with spaces/dashes e.g. +1 555 123 4567)
    const phoneMatch = fullText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/) ||
                       fullText.match(/(?:\+91[\-\s]?)?[6789]\d{9}\b/);
    const validPhone = phoneMatch ? phoneMatch[0].trim() : null;

    // 3. Public business contact / company URL
    const urlMatch = fullText.match(/https?:\/\/[^\s"'<>]+/gi);
    let publicBusinessContactUrl = null;
    let clientCompanyUrl = null;

    if (urlMatch) {
      for (const u of urlMatch) {
        const cleanUrl = u.replace(/[),.;]+$/, '');
        if (cleanUrl.includes('/contact') || cleanUrl.includes('/apply') || cleanUrl.includes('/hire') || cleanUrl.includes('/rfp')) {
          publicBusinessContactUrl = cleanUrl;
          break;
        } else if (!cleanUrl.includes('reddit.com') && !cleanUrl.includes('ycombinator.com') && !cleanUrl.includes('hasjob.co')) {
          clientCompanyUrl = cleanUrl;
        }
      }
    }

    // 4. Public Profile Message (Only if valid native author username exists on Reddit/HN)
    let hasPublicProfileRoute = false;
    let authorProfileUrl = candidate.authorProfileUrl || null;
    if (candidate.source === 'reddit' && candidate.author && candidate.author !== 'Anonymous' && candidate.author !== '[deleted]' && candidate.author !== 'AutoModerator') {
      hasPublicProfileRoute = true;
      if (!authorProfileUrl) authorProfileUrl = `https://www.reddit.com/user/${candidate.author}`;
    }

    let contactType = 'none';
    let contactValue = null;

    if (validEmail) {
      contactType = 'email';
      contactValue = validEmail;
    } else if (validPhone) {
      contactType = 'phone';
      contactValue = validPhone;
    } else if (publicBusinessContactUrl) {
      contactType = 'public_business_contact';
      contactValue = publicBusinessContactUrl;
    } else if (clientCompanyUrl) {
      contactType = 'public_company_website';
      contactValue = clientCompanyUrl;
    } else if (hasPublicProfileRoute) {
      contactType = 'public_profile_message';
      contactValue = authorProfileUrl;
    }

    if (contactType === 'none') {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NO_ACTIONABLE_CONTACT',
        is_client_side_project: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // Entity Extraction: Tech Stack, Category, Location, Budget
    // ----------------------------------------------------
    const skillList = [
      'React', 'Next.js', 'Node.js', 'TypeScript', 'JavaScript', 'Python',
      'Flutter', 'React Native', 'Swift', 'Kotlin', 'iOS', 'Android',
      'Tailwind', 'Figma', 'UI/UX', 'Vue', 'Angular', 'PHP', 'Laravel',
      'WordPress', 'Shopify', 'Supabase', 'PostgreSQL', 'MongoDB',
      'FastAPI', 'AI', 'LangChain', 'OpenAI', 'AWS', 'Docker'
    ];
    const detectedSkills = skillList.filter(s => new RegExp(`\\b${s.replace('.', '\\.')}\\b`, 'i').test(fullText));

    let category = 'Web Development';
    if (/\bmobile\b|flutter|react native|ios\b|android/i.test(fullText)) {
      category = 'Mobile App';
    } else if (/ui\/ux|ux design|ui design|web design/i.test(fullText)) {
      category = 'UI/UX';
    } else if (/langchain|llm\b|machine learning|openai|fastapi|chatbot|voice agent/i.test(fullText)) {
      category = 'AI/ML';
    } else if (/\bsaas\b|micro-saas|b2b/i.test(fullText)) {
      category = 'SaaS';
    }

    // Strict Location: null if not mentioned
    let clientLocation = null;
    if (/india|delhi|bangalore|bengaluru|mumbai|pune|hyderabad|noida|gurugram|gurgaon|chennai/i.test(fullText)) {
      if (/delhi|noida|gurugram|gurgaon/i.test(fullText)) clientLocation = 'Delhi NCR, India';
      else if (/bangalore|bengaluru/i.test(fullText)) clientLocation = 'Bangalore, India';
      else if (/mumbai/i.test(fullText)) clientLocation = 'Mumbai, India';
      else if (/pune/i.test(fullText)) clientLocation = 'Pune, India';
      else if (/hyderabad/i.test(fullText)) clientLocation = 'Hyderabad, India';
      else clientLocation = 'India';
    } else if (/\b(usa|united states|us|san francisco|new york|california|austin|texas)\b/i.test(fullText)) {
      clientLocation = 'USA';
    } else if (/\b(uk|united kingdom|london)\b/i.test(fullText)) {
      clientLocation = 'UK';
    } else if (/\bcanada\b/i.test(fullText)) {
      clientLocation = 'Canada';
    } else if (/\bremote\b/i.test(fullText)) {
      clientLocation = 'Remote';
    }

    // Strict Budget: null if not mentioned
    let budget = null;
    let budgetMin = null;
    let budgetMax = null;
    let currency = null;

    const inrMatch = fullText.match(/₹\s*[\d,]+(\s*-\s*₹?\s*[\d,]+)?/i) || fullText.match(/INR\s*[\d,]+/i) || fullText.match(/[\d.]+\s*Lakh/i);
    const usdMatch = fullText.match(/\$[\d,]+(\s*-\s*\$?[\d,]+)?/);

    if (inrMatch) {
      budget = inrMatch[0].trim();
      currency = 'INR';
      const digits = budget.match(/[\d,]+/g);
      if (digits && digits.length >= 1) {
        budgetMin = parseInt(digits[0].replace(/,/g, ''), 10);
        budgetMax = digits[1] ? parseInt(digits[1].replace(/,/g, ''), 10) : budgetMin;
      }
    } else if (usdMatch) {
      budget = usdMatch[0].trim();
      currency = 'USD';
      const digits = budget.match(/[\d,]+/g);
      if (digits && digits.length >= 1) {
        budgetMin = parseInt(digits[0].replace(/,/g, ''), 10);
        budgetMax = digits[1] ? parseInt(digits[1].replace(/,/g, ''), 10) : budgetMin;
      }
    }

    const shortSummary = content.substring(0, 180).trim() + (content.length > 180 ? '...' : '');

    return {
      qualification_status: 'qualified',
      rejection_reason: null,
      is_it_project: true,
      is_client_side_project: true,
      is_employment: false,
      is_internship: false,
      is_freelancer_seeking_work: false,
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      sourcePostId: candidate.sourcePostId || null,
      title: title,
      shortSummary: shortSummary || title,
      originalDescription: content || title,
      category,
      skills: detectedSkills,
      features: ['Project Deliverable'],
      clientName: candidate.author || null,
      clientUsername: candidate.author || null,
      clientEmail: validEmail,
      clientPhone: validPhone,
      clientCompany: null,
      clientCompanyUrl: clientCompanyUrl,
      clientProfileUrl: authorProfileUrl,
      clientLocation,
      budget,
      budgetMin,
      budgetMax,
      currency,
      projectType: budget ? 'Fixed Price' : 'Contract',
      projectIntent: 'Looking for Agency / Developer',
      has_actionable_contact: true,
      contact_type: contactType,
      contact_value: contactValue,
      relevanceScore: 88,
      contactabilityScore: contactType === 'email' ? 95 : (contactType === 'phone' ? 90 : 80),
      postedAt: candidate.postedAt || new Date().toISOString(),
      discoveredAt: new Date().toISOString()
    };
  }

  formatExtractedProject(candidate, llmResult) {
    if (llmResult.qualification_status === 'rejected' || !llmResult.has_actionable_contact || llmResult.contact_type === 'none') {
      return {
        qualification_status: 'rejected',
        rejection_reason: llmResult.rejection_reason || 'NO_ACTIONABLE_CONTACT',
        is_client_side_project: Boolean(llmResult.is_client_side_project),
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    return {
      qualification_status: 'qualified',
      rejection_reason: null,
      is_it_project: true,
      is_client_side_project: true,
      is_employment: false,
      is_internship: false,
      is_freelancer_seeking_work: false,
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      sourcePostId: candidate.sourcePostId || null,
      title: llmResult.title || candidate.rawTitle,
      shortSummary: llmResult.short_summary || candidate.rawContent?.substring(0, 180) || candidate.rawTitle,
      originalDescription: candidate.rawContent || candidate.rawTitle,
      category: llmResult.category || 'Web Development',
      skills: Array.isArray(llmResult.skills) ? llmResult.skills : [],
      features: Array.isArray(llmResult.features) ? llmResult.features : [],
      clientName: llmResult.client_name || candidate.author || null,
      clientUsername: candidate.author || null,
      clientEmail: llmResult.client_email || null,
      clientPhone: llmResult.client_phone || null,
      clientCompany: llmResult.client_company || null,
      clientCompanyUrl: llmResult.client_company_url || null,
      clientProfileUrl: candidate.authorProfileUrl || null,
      clientLocation: llmResult.client_location || null,
      budget: llmResult.budget || null,
      budgetMin: llmResult.budget_min || null,
      budgetMax: llmResult.budget_max || null,
      currency: llmResult.currency || null,
      projectType: llmResult.project_type || 'Contract',
      projectIntent: llmResult.project_intent || 'Looking for Developer',
      has_actionable_contact: true,
      contact_type: llmResult.contact_type || 'public_profile_message',
      contact_value: llmResult.contact_value || candidate.sourceUrl,
      relevanceScore: llmResult.relevance_score || 85,
      contactabilityScore: llmResult.contactability_score || 80,
      confidence: llmResult.confidence || 85,
      postedAt: candidate.postedAt || new Date().toISOString(),
      discoveredAt: new Date().toISOString()
    };
  }
}
