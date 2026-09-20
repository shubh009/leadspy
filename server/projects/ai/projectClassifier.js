import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
// Also attempt loading server/.env if invoked from root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const CLASSIFICATION_MODE = {
  HEURISTIC: 'heuristic',
  LLM: 'llm',
  HYBRID: 'hybrid'
};

/**
 * Hard Freshness Gate (P0.4)
 * Evaluates candidate post age against configured window (default 30 days).
 * Strict rejection for stale candidates; never invents fake Date.now().
 */
export function evaluateFreshnessGate(candidate = {}, maxDays = 30) {
  const postedAt = candidate.postedAt;
  const text = `${candidate.title || ''} ${candidate.snippet || ''} ${candidate.content || ''} ${candidate.rawContent || ''}`.toLowerCase();

  // 1. Explicit date evaluation
  if (postedAt) {
    const postTime = new Date(postedAt).getTime();
    if (!isNaN(postTime)) {
      const ageDays = (Date.now() - postTime) / (86400 * 1000);
      if (Math.floor(ageDays) > maxDays) {
        return {
          pass: false,
          rejection_gate: 'GATE_5',
          rejection_reason: 'STALE_PROJECT',
          evidence: `Project posted ${Math.round(ageDays)} days ago, exceeding ${maxDays}d window`,
          freshnessStatus: 'archive',
          postedAt: new Date(postTime).toISOString(),
          ageDays: Math.round(ageDays)
        };
      }
      return {
        pass: true,
        freshnessStatus: 'fresh',
        postedAt: new Date(postTime).toISOString(),
        ageDays: Math.round(ageDays)
      };
    }
  }

  // 2. Date missing: check for past-year stale text markers (e.g. 2020-2025 or "posted X years ago")
  const staleYearRegex = /\b(201\d|2020|2021|2022|2023|2024|2025)\b|posted\s*(\d+)\s*(months?|years?)\s*ago/i;
  if (staleYearRegex.test(text)) {
    return {
      pass: false,
      rejection_gate: 'GATE_5',
      rejection_reason: 'STALE_PROJECT',
      evidence: 'Stale date/year markers detected in content text',
      freshnessStatus: 'archive',
      postedAt: null,
      ageDays: null
    };
  }

  // 3. No explicit date and no stale markers -> explicit recent_discovery (preserves null postedAt)
  return {
    pass: true,
    freshnessStatus: 'recent_discovery',
    postedAt: null,
    ageDays: null
  };
}

/**
 * Deterministic Final Confidence Gate (P0.3)
 * Formula: clamp(0, 100, relevance * 0.50 + deliverable * 0.30 + intent * 0.20 + crossQueryBoost - vaguenessPenalty)
 */
export function evaluateFinalConfidenceGate(candidate = {}, result = {}, threshold = null) {
  const finalThreshold = Number(threshold ?? process.env.FINAL_CONFIDENCE_THRESHOLD) || 70;
  const relevanceScore = Number(result?.relevanceScore) || 85;

  const fullText = `${candidate?.title || ''} ${candidate?.snippet || ''} ${candidate?.content || ''} ${candidate?.rawContent || ''}`.toLowerCase();
  const concreteDeliverableRegex = /\b(crm|erp|saas|mvp|mobile app|web app|ios|android|dashboard|portal|api integration|ecommerce platform|automation|software)\b/i;
  const deliverableScore = concreteDeliverableRegex.test(fullText) ? 90 : 60;

  const explicitProcurementRegex = /\b(hire|hiring|budget|quote|rfp|scope of work|statement of work|looking for agency|looking for developer|need developer|fixed price|\$|₹)\b/i;
  const buyerIntentScore = explicitProcurementRegex.test(fullText) ? 90 : 60;

  let crossQueryBoost = 0;
  if (candidate?.crossQueryBoost) {
    crossQueryBoost = Number(candidate.crossQueryBoost);
  } else if (candidate?.matched_queries && candidate.matched_queries.length > 1) {
    crossQueryBoost = 5;
  }

  let vaguenessPenalty = 0;
  const cleanLen = (candidate?.rawContent || candidate?.content || candidate?.snippet || '').trim().length;
  if (cleanLen < 50) {
    vaguenessPenalty = 15;
  }

  const rawConfidence = (relevanceScore * 0.50) + (deliverableScore * 0.30) + (buyerIntentScore * 0.20) + crossQueryBoost - vaguenessPenalty;
  const finalConfidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));

  if (finalConfidence < finalThreshold) {
    return {
      pass: false,
      finalConfidence,
      threshold: finalThreshold,
      rejection_gate: 'GATE_9',
      rejection_reason: 'LOW_FINAL_CONFIDENCE',
      evidence_summary: `Final confidence score ${finalConfidence} is below threshold ${finalThreshold}`
    };
  }

  return {
    pass: true,
    finalConfidence,
    threshold: finalThreshold
  };
}

/**
 * AI Project Classifier & Structured Entity Extractor
 * Enforces strict IT Project Qualification & Actionable Contactability
 * Based on Project Discovery Engine Change Request Specification
 */
export class ProjectClassifier {
  constructor(options = {}) {
    this.classificationMode = options.classificationMode || process.env.CLASSIFICATION_MODE || CLASSIFICATION_MODE.HYBRID;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    this.seenSignatures = new Set();
    this.seenProjects = [];
    this.enableDeduplication = options.enableDeduplication ?? true;
    this.strictContactRequirement = options.strictContactRequirement ?? true;
    this.finalConfidenceThreshold = options.finalConfidenceThreshold ?? (Number(process.env.FINAL_CONFIDENCE_THRESHOLD) || 70);
    this.maxDays = options.maxDays || 30;
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
   * Sources explicitly excluded from project ingestion (P1.4)
   */
  static EXCLUDED_SOURCES = ['freelancer', 'guru', 'peopleperhour', 'upwork', 'seeking'];

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
        rejection_gate: 'GATE_0',
        evidence_summary: 'Candidate object is empty or null',
        is_client_side_project: false
      };
    }

    // 0. Excluded sources & marketplace landing page check (P1.4)
    const sourceLower = (candidate.source || '').toLowerCase();
    const targetUrl = (candidate.sourceUrl || candidate.url || '').toLowerCase();
    const isExcludedMarketplaceUrl = 
      targetUrl.includes('upwork.com/freelance') ||
      targetUrl.includes('upwork.com/hire') ||
      targetUrl.includes('upwork.com/outcomes') ||
      targetUrl.includes('upwork.com/jobs') ||
      targetUrl.includes('freelancer.com/jobs') ||
      targetUrl.includes('freelancer.com/hire') ||
      targetUrl.includes('guru.com/d/jobs') ||
      targetUrl.includes('peopleperhour.com/freelance') ||
      targetUrl.includes('seeking.com');

    if (ProjectClassifier.EXCLUDED_SOURCES.some(s => sourceLower.includes(s)) || isExcludedMarketplaceUrl) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'SOURCE_NOT_ALLOWED',
        rejection_gate: 'GATE_0',
        evidence_summary: `Source platform '${candidate.source || targetUrl}' is on the excluded platform list`,
        is_client_side_project: false
      };
    }

    // 1. DETERMINISTIC HARD REJECTION PRE-CHECKS (Gates 1 - 7)
    const heuristicCheck = this.heuristicQualification(candidate);
    if (heuristicCheck.qualification_status === 'rejected') {
      return heuristicCheck;
    }

    // 2. GATE 8 DEDUPLICATION
    const dedupedResult = this.applyGate8Deduplication(candidate, heuristicCheck);
    if (dedupedResult.qualification_status === 'rejected') {
      return dedupedResult;
    }

    // 3. GATE 9 CONFIDENCE EVALUATION
    const qualifiedResult = this.applyGate9Confidence(candidate, dedupedResult);

    // 4. POST-QUALIFICATION LLM SYNTHESIS & OUTREACH PITCH GENERATION
    if (qualifiedResult.qualification_status === 'qualified') {
      return await this.synthesizeQualifiedLead(candidate, qualifiedResult);
    }

    return qualifiedResult;
  }

  /**
   * Post-Qualification LLM Synthesis & Outreach Pitch Generator
   * Enriches qualified leads with executive summaries and personalized cold outreach pitches.
   */
  async synthesizeQualifiedLead(candidate, projectResult) {
    if (!projectResult || projectResult.qualification_status !== 'qualified') {
      return projectResult;
    }

    if (!this.geminiApiKey && !this.apiKey) {
      projectResult.executive_summary = projectResult.short_summary || projectResult.title;
      projectResult.outreach_pitch_draft = `Hi! I saw your project posting regarding "${projectResult.title}". Our engineering team specializes in ${projectResult.category || 'custom software development'} and we would love to assist you. Let's connect!`;
      return projectResult;
    }

    const prompt = `
You are an expert IT Lead Synthesis & Cold Outreach Assistant.
Below is a QUALIFIED client-side IT project opportunity discovered from the web:

Title: "${projectResult.title || candidate.title}"
Category: "${projectResult.category || 'Web Development'}"
Source: "${projectResult.source}"
URL: "${projectResult.sourceUrl}"
Content:
"""
${candidate.rawContent || candidate.snippet || projectResult.short_summary || ''}
"""

Generate a structured JSON response (NO MARKDOWN, NO BACKTICKS) with:
1. "executive_summary": A concise 1-2 sentence executive summary of what deliverable the client needs.
2. "skills": An array of technical skills/stacks required (e.g. ["React", "Node.js"]).
3. "outreach_pitch_draft": A short, highly persuasive, professional 3-sentence cold outreach proposal email/DM pitch to send to this client to pitch our agency's services.

Schema:
{
  "executive_summary": "string",
  "skills": ["string"],
  "outreach_pitch_draft": "string"
}
`;

    try {
      let llmData = null;
      if (this.geminiApiKey) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 500, responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const gData = await res.json();
          let rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          if (rawText) llmData = JSON.parse(rawText);
        }
      }

      if (!llmData && this.apiKey) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 500
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const orData = await res.json();
          const text = orData.choices?.[0]?.message?.content || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) llmData = JSON.parse(jsonMatch[0]);
        }
      }

      if (llmData) {
        if (llmData.executive_summary) projectResult.executive_summary = llmData.executive_summary;
        if (Array.isArray(llmData.skills) && llmData.skills.length > 0) projectResult.skills = llmData.skills;
        if (llmData.outreach_pitch_draft) projectResult.outreach_pitch_draft = llmData.outreach_pitch_draft;
      }
    } catch (err) {
      console.warn('[ProjectClassifier] LLM synthesis fallback engaged:', err.message);
    }

    if (!projectResult.executive_summary) {
      projectResult.executive_summary = projectResult.short_summary || projectResult.title;
    }
    if (!projectResult.outreach_pitch_draft) {
      projectResult.outreach_pitch_draft = `Hi! I saw your requirement regarding "${projectResult.title}". Our engineering team specializes in ${projectResult.category || 'custom software development'} and we have built similar solutions. Let's discuss your timeline and scope!`;
    }

    return projectResult;
  }

  applyGate9Confidence(candidate, result) {
    if (!result || result.qualification_status !== 'qualified') return result;
    const gate9Check = evaluateFinalConfidenceGate(candidate, result, this.finalConfidenceThreshold);
    if (!gate9Check.pass) {
      return {
        qualification_status: 'rejected',
        rejection_reason: gate9Check.rejection_reason || 'LOW_FINAL_CONFIDENCE',
        rejection_gate: gate9Check.rejection_gate || 'GATE_9',
        evidence_summary: gate9Check.evidence_summary || `Final confidence below threshold ${gate9Check.threshold}`,
        finalConfidence: gate9Check.finalConfidence,
        threshold: gate9Check.threshold,
        is_client_side_project: Boolean(result.is_client_side_project),
        has_actionable_contact: Boolean(result.has_actionable_contact),
        contact_type: result.contact_type || 'none'
      };
    }
    result.finalConfidence = gate9Check.finalConfidence;
    result.confidenceThreshold = gate9Check.threshold;
    return result;
  }

  applyGate8Deduplication(candidate, result) {
    // Gate 8: Deduplication check (TC-048 & TC-049) - only performed on candidates that passed all prior gates
    if (this.enableDeduplication && result.qualification_status === 'qualified') {
      const exactSig = (candidate.source && candidate.sourcePostId ? `${candidate.source}:${candidate.sourcePostId}` : null)
        || candidate.sourceUrl
        || candidate.url;

      if (exactSig && this.seenSignatures.has(exactSig)) {
        return {
          qualification_status: 'rejected',
          rejection_reason: 'DUPLICATE',
          rejection_gate: 'GATE_8',
          evidence_summary: `Exact signature duplicate found: ${exactSig}`,
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
              rejection_gate: 'GATE_8',
              evidence_summary: `Semantic token duplicate: Jaccard similarity ${jaccard.toFixed(2)} exceeds 0.65 threshold`,
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

STRICT REJECTION RULES:
1. EMPLOYMENT / JOBS: If the post is hiring full-time employees, salaried staff, CTC/LPA, permanent roles, notice period, resume submissions -> REJECT ("EMPLOYMENT").
2. INTERNSHIP: If the post is for interns, trainees, stipend, freshers -> REJECT ("INTERNSHIP").
3. FREELANCER SEEKING WORK: If the author is a developer, agency, or designer advertising their services ("for hire", "hire me", "looking for work", "available for freelance") -> REJECT ("FREELANCER_SEEKING_WORK").
4. GENERAL DISCUSSION: Technical opinions, "which framework is better", tutorials, retrospectives, bug reports, showcase of past projects -> REJECT ("GENERAL_DISCUSSION").
5. NON-IT SERVICE: Marketing gigs, SEO services, social media posting, VA, content writing, unless it is custom IT software/platform engineering -> REJECT ("NON_IT_SERVICE").
6. PRODUCT OR COMPANY PAGE: Product homepage, consumer tool, download portal, company about page -> REJECT ("PRODUCT_OR_COMPANY_PAGE").
7. NO ACTIONABLE CONTACT: No direct email, phone, valid RFP/contact link, or native social profile -> REJECT ("NO_ACTIONABLE_CONTACT").

Post Details:
- Title: "${candidate.rawTitle || candidate.title || ''}"
- Author: "${candidate.author || ''}"
- Source: "${candidate.source || ''}"
- Source URL: "${candidate.sourceUrl || ''}"
- Content:
"""
${candidate.rawContent || candidate.snippet || ''}
"""

Return ONLY a valid JSON object with NO MARKDOWN and NO BACKTICKS with the following schema:
{
  "is_it_project": true or false,
  "is_client_side_project": true or false,
  "is_employment": true or false,
  "is_internship": true or false,
  "is_freelancer_seeking_work": true or false,
  "qualification_status": "qualified" or "rejected",
  "rejection_reason": "SOURCE_NOT_ALLOWED" or "NOT_IT_PROJECT" or "EMPLOYMENT" or "INTERNSHIP" or "FREELANCER_SEEKING_WORK" or "GENERAL_DISCUSSION" or "NO_PROJECT_REQUIREMENT" or "NON_IT_SERVICE" or "PRODUCT_OR_COMPANY_PAGE" or "NO_ACTIONABLE_CONTACT" or null,
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
  "contact_type": "email" or "phone" or "public_business_contact" or "public_profile_message" or "none",
  "contact_value": "email address, phone number, or verified contact URL",
  "client_company_url": "Public company website if detected, else null",
  "relevance_score": number between 1 and 100,
  "contactability_score": number between 1 and 100,
  "confidence": number between 1 and 100
}
`;

    // 1. Try Gemini if API Key is present
    if (this.geminiApiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 1000,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (res.ok) {
          const gData = await res.json();
          let rawText = gData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          if (rawText) {
            return JSON.parse(rawText);
          }
        } else {
          console.warn(`[ProjectClassifier] Gemini returned HTTP ${res.status}, trying OpenRouter fallback`);
        }
      } catch (geminiErr) {
        console.warn('[ProjectClassifier] Gemini error:', geminiErr.message);
      }
    }

    // 2. OpenRouter Fallback
    if (this.apiKey) {
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
          max_tokens: 500
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (response.ok) {
        const data = await response.json();
        let text = data?.choices?.[0]?.message?.content || '';
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        if (text) return JSON.parse(text);
      }
    }

    throw new Error('All LLM endpoints failed');
  }

  /**
   * Deterministic Strict Heuristic Qualifier & Extractor
   * Adheres strictly to the Change Request Specification.
   */
  heuristicQualification(candidate) {
    const title = (candidate.rawTitle || candidate.title || '').trim();
    const content = (candidate.rawContent || candidate.snippet || '').trim();
    const fullText = `${title} ${content}`;
    const sourceUrl = candidate.sourceUrl || candidate.url || '';

    // ----------------------------------------------------
    // GATE 1: Hard Reject - Freelancer Seeking Work (Supply-Side)
    // ----------------------------------------------------
    const isDevSelfIntro = /(location\s*[:=-].*remote\s*[:=-]|willing to relocate\s*[:=-]|technologies\s*[:=-]|my name('s|\s+is)|i would make a good candidate|hire me|i'm open to|i am open to (roles|contracts)|available for hire|available for contract|looking for (contract|work|roles|projects)|seeking (contract|work|roles|projects))/i.test(fullText);
    const freelancerSeekingRegex = /\b(for hire|hire me|i am a developer|my portfolio|available for freelance|my agency is looking for clients|offering my services|check out my work|available for new projects|hire our team|we are an agency offering|looking for (freelance )?(work|projects)|seeking (freelance )?(work|projects)|available for (freelance|hire|new projects|projects|work)|portfolio:|i offer|i can build .* (available|contact me)|i am a .* developer (looking|available)|looking for (new )?clients|open for (freelance|projects)|full[- ]?stack developer available|seeking work|willing to relocate\s*[:=-]|technologies\s*[:=-]|rates?\s*[:=-]\s*[\$€£]|hourly rate)\b/i;

    if (isDevSelfIntro || freelancerSeekingRegex.test(title) || freelancerSeekingRegex.test(content.substring(0, 400))) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'FREELANCER_SEEKING_WORK',
        rejection_gate: 'GATE_1',
        evidence_summary: 'Supply-side freelancer or agency self-pitch advertising availability',
        is_client_side_project: false,
        is_freelancer_seeking_work: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 1B: Hard Reject - Foreign Country / Non-Offshore Lockout
    // ----------------------------------------------------
    const locationLockoutRegex = /\b(u\.?s\.?\s*(based|citizens?|residents?|only)\s*(only|freelancers?|developers?|engineers?)?|us\s+only|usa\s+only|must be in (the\s+)?(us|usa|united states|uk|canada|europe)|must be (located in|based in) (the\s+)?(us|usa|united states|uk|canada|europe)|(uk|canada|europe|australia)\s+only|(uk|canada|europe|australia)\s+based\s+only|no offshore|no overseas|no agency offshore|local candidates only|onsite only in\s+[a-z]+)\b/i;

    if (locationLockoutRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'RESTRICTED_LOCATION_NON_OFFSHORE',
        rejection_gate: 'GATE_1B',
        evidence_summary: 'Strict geographic restriction forbidding remote or offshore developers',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 2: Hard Reject - Internship / Trainee
    // ----------------------------------------------------
    const isInternshipApp = /internship\s*(management|portal|app|system|platform)/i.test(fullText);
    const internshipRegex = /\b(intern\b|internship|apprenticeship|trainee|stipend)\b/i;
    if (!isInternshipApp && internshipRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'INTERNSHIP',
        rejection_gate: 'GATE_2',
        evidence_summary: 'Educational internship or trainee role without professional contract budget',
        is_client_side_project: false,
        is_internship: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 3: Hard Reject - General Discussion / Learning / Technical Q&A / Repo Bug Issues / Product Homepages
    // ----------------------------------------------------
    const isQuoting = /^\s*(&gt;|>)/.test(content) || /^\s*(&gt;|>)/.test(title);
    const isForumQa = /\b(ask hn|how (do|can|to) (i|we|you) (add|configure|setup|use|fix|implement|connect|access|install|solve))\b/i.test(fullText) ||
                      /devforum\.zoom\.us|stackoverflow\.com/i.test(sourceUrl);
    const isConsumerTool = /\b(calculator|converter|calculatorsoup|online tool|math calculator|autoclicker|auto clicker|game hack|cheat engine|dyno bot)\b/i.test(fullText) ||
                           /opautoclicker\.com|sourceforge\.net/i.test(sourceUrl);
    const isProductHomepage = /\b(welcome to our software website|download our software|a full-fledged .* with two modes|free automated .* tool)\b/i.test(fullText) ||
                              /\b(features and download|download now|product features)\b/i.test(fullText);
    const isRepoBugIssue = /\b(issue #\d+|pull request|pr #\d+|merge branch|git commit|make lint|ci\/cd pipeline failed|unit tests? failing|stack trace|nullpointerexception|undefined is not a function|short links actually redirect)\b/i.test(fullText) ||
                           (candidate.source === 'github' && /\/issues\/\d+/i.test(sourceUrl) && !/\b(bounty|paid|budget|\$|agency|rfp|hire)\b/i.test(fullText));

    const discussionRegex = /\b(ask hn|which (frontend )?(framework|library|stack|technology) is (better|best)|how (do|can) i learn|which (library|framework|stack|technology)|best (stack|framework|library|technology)|how much does a website cost|average (price|cost) for|researching .* costs|tutorial|career advice|programming question|what do you think of|i want to learn|recommend a good (react|developer)|can anyone recommend|i believe this is a .* way of thinking|seems to be a lot of overlap|in my opinion|from my experience|it just occurred to me|i was never able|my specialty was|i spent (years|most of that time)|that being said|to me, it's just|i suppose the one thing|speaking also as someone who|i like and believe in this|people were always able to|what are your experiences\??)\b/i;
    
    if (isProductHomepage || isConsumerTool) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'PRODUCT_OR_COMPANY_PAGE',
        rejection_gate: 'GATE_3',
        evidence_summary: 'Static consumer tool or software product homepage rather than a project inquiry',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    if (isQuoting || isForumQa || isRepoBugIssue || discussionRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'GENERAL_DISCUSSION',
        rejection_gate: 'GATE_3',
        evidence_summary: 'Technical discussion, Q&A question, or codebase bug report without commercial hiring intent',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 4: Hard Reject - Employment / Salaried Jobs / HR
    // ----------------------------------------------------
    const isFeatureSalary = /salary\s*(calculation|module|component|integration|slip|management|system)/i.test(fullText);
    const isExternalAgencyHiring = /hiring\s*(an?\s*)?(external\s*)?(development\s*)?(agency|firm|team|vendor|contractor)\s*(to|for)?/i.test(fullText);
    const isNegatedEmployment = /\b(not\s+(a\s+)?(salaried|full-time|employee|job|w2|employment|in-house)|no\s+(full-time|salaried)\s+(agencies|roles|developers|staff)?|not\s+hiring\s+(employees|staff|in-house))\b/i.test(fullText);

    const employmentRegex = /\b(benefits include|years of experience required|apply at|competitive compensation|submit your application|we offer healthcare|equal opportunity employer|w2 role|notice period|software development engineer|sde\b|software engineer\s*[-—–]\s*(mobile|backend|frontend)|senior (software )?engineer|staff engineer|principal engineer|full[- ]?time (job|role|position|employee)?|permanent (role|position|employee)|annual ctc|ctc\s*[:=]|[\d.]+\s*lpa|job vacancy|job opening|immediate joiner|send your (resume|cv)|submit (resume|cv)|join (our|the) team|join our (growing )?engineering team|join our growing team|expanding our engineering team|hiring freshers?|freshers? (can apply|welcome|hiring)|pf\b|esi\b|hr manager|recruiter|recruitment|benefits package|401k|paid time off|pto|salary\s*[:=₹$]|operator\s*\([^\)]+\)|onsite preferred|hybrid\s*\d+x|director\s*(of)?|vp\s*(of)?|head of\b|\$\d+k salary)\b/i;

    if (!isFeatureSalary && !isExternalAgencyHiring && !isNegatedEmployment && employmentRegex.test(fullText)) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'EMPLOYMENT',
        rejection_gate: 'GATE_4',
        evidence_summary: 'Full-time salaried employment or internal employee recruitment',
        is_client_side_project: false,
        is_employment: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 5: Non-IT / Non-Project / Adult / Marketing Services Rejection
    // Context-Aware: "marketing automation software" or "CRM software" is IT;
    // marketing gigs, SEO campaigns, Instagram posting, VA are rejected.
    // ----------------------------------------------------
    const isItDeliverableWithMarketing = /\b(marketing automation\s*(software|system|tool|platform|app)|email marketing\s*(engine|platform|software|api)|marketing\s*(dashboard|portal|crm|api))\b/i.test(fullText) ||
                                         /\b(build|develop|create|code)\s*(custom\s*)?(marketing automation|automation software)\b/i.test(fullText);

    const isPayrollSoftware = /payroll\s*(system|software|module|app|platform)/i.test(fullText);
    const nonItRegex = /\b(dating|matchmaking|sugar daddy|sugar baby|seeking\.com|payroll|student assistant|receptionist|accountant|garment|fashion communication|escort|sales executive|telecaller|bpo|data entry|operator|marketer|marketers|marketing|social media marketing|copywriter|content writer|va\b|virtual assistant|video editor|thumbnail|voice actor|graphic designer for social media|posting on (instagram|tiktok|facebook|reddit)|manage instagram)\b/i;

    if (!isItDeliverableWithMarketing && !isPayrollSoftware && (nonItRegex.test(title) || nonItRegex.test(content.substring(0, 300)))) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NON_IT_SERVICE',
        rejection_gate: 'GATE_5',
        evidence_summary: 'Non-IT service offering or marketing/VA gig without custom software engineering deliverable',
        is_it_project: false,
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // Gate 5 Freshness check (P0.4)
    const freshnessCheck = evaluateFreshnessGate(candidate, this.maxDays);
    if (!freshnessCheck.pass) {
      return {
        qualification_status: 'rejected',
        rejection_reason: freshnessCheck.rejection_reason || 'STALE_PROJECT',
        rejection_gate: freshnessCheck.rejection_gate || 'GATE_5',
        evidence_summary: freshnessCheck.evidence || 'Stale project exceeding freshness window',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 6: Client-Side Project Requirement Check
    // Must contain evidence of an IT deliverable wanted AND buyer intent
    // ----------------------------------------------------
    const pastCompletedProject = /\b(i completed last year|project i (built|created|developed|completed) last year|retrospective of a .* project|thoughts on architecture)\b/i.test(fullText);
    if (pastCompletedProject) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NO_PROJECT_REQUIREMENT',
        rejection_gate: 'GATE_6',
        evidence_summary: 'Retrospective of completed past work rather than an active commercial requirement',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    const deliverableRegex = /\b(build|develop|create|redesign|revamp|implement|integrate|integration|migrate|mvp|saas|website|web app|mobile app|application|portal|dashboard|crm|erp|ecommerce|e-commerce|shopify|wordpress|woocommerce|flutter|react|node|api|automation|chatbot|voice agent|software|maintain|maintenance|bug fix|fix|project|appointment system|module|development team|customer portal)\b/i;
    const clientNeedRegex = /\b(need|needs|looking for|seeking|want|wants|hiring\s*(an?\s*)?(external\s*)?(developer|agency|team|freelancer|someone|vendor|contractor)?|rfp|scope of work|project|help integrating|development team for)\b/i;

    const hasDeliverable = deliverableRegex.test(fullText);
    const hasClientNeed = clientNeedRegex.test(fullText);

    if (!hasDeliverable || !hasClientNeed) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NO_PROJECT_REQUIREMENT',
        rejection_gate: 'GATE_6',
        evidence_summary: 'Missing explicit IT deliverable requirement or client-side buyer intent',
        is_client_side_project: false,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // ----------------------------------------------------
    // GATE 7: Actionable Contactability Verification
    // Tier A: Explicit Email / Phone / Explicit Business Contact Page (/contact, /rfp, /hire)
    // Tier B: Public Profile Route (Reddit, GitHub, Twitter) if valid non-generic author exists
    // Tier C: None -> Reject NO_ACTIONABLE_CONTACT.
    // NOTE: Arbitrary sourceUrl or homepage URLs are NEVER allowed to satisfy contactability.
    // ----------------------------------------------------
    // 1. Email check
    const emailMatch = fullText.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i);
    let validEmail = null;
    if (emailMatch && !emailMatch[1].includes('leadspy.app') && !emailMatch[1].includes('test.com')) {
      validEmail = emailMatch[1];
    }

    // 2. Phone check
    const textWithoutUrls = fullText.replace(/https?:\/\/[^\s"'<>]+/gi, '');
    const phoneMatch = textWithoutUrls.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/) ||
                       textWithoutUrls.match(/(?:\+91[\-\s]?)?[6789]\d{9}\b/);
    const validPhone = phoneMatch ? phoneMatch[0].trim() : null;

    // 3. Public business contact URL (must explicitly contain /contact, /apply, /hire, /rfp)
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

    // 4. Public Profile Message (Reddit / GitHub / Twitter)
    let hasPublicProfileRoute = false;
    let authorProfileUrl = candidate.authorProfileUrl || null;
    const author = (candidate.author || '').trim();
    const isGenericAuthor = !author || ['anonymous', '[deleted]', 'automoderator', 'unknown', 'direct client', 'web client', 'hn client', 'reddit client'].includes(author.toLowerCase());

    // Sanitize: If authorProfileUrl accidentally contains a post/comment/issue path, discard it
    if (authorProfileUrl && (authorProfileUrl.includes('/comments/') || authorProfileUrl.includes('/issues/') || authorProfileUrl.includes('/pull/') || authorProfileUrl.includes('ycombinator.com/item'))) {
      authorProfileUrl = null;
    }

    if (!isGenericAuthor) {
      if (candidate.source === 'reddit') {
        hasPublicProfileRoute = true;
        if (!authorProfileUrl) authorProfileUrl = `https://www.reddit.com/user/${author}`;
      } else if (candidate.source === 'github') {
        hasPublicProfileRoute = true;
        if (!authorProfileUrl) authorProfileUrl = `https://github.com/${author}`;
      } else if (candidate.source === 'hackernews') {
        // HN user profiles are strictly profile view unless email is in about, but we don't treat HN as direct DM unless email exists
      } else if (candidate.source === 'twitter' || candidate.source === 'x') {
        hasPublicProfileRoute = true;
        if (!authorProfileUrl) authorProfileUrl = `https://x.com/${author.replace('@', '')}`;
      }
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
    } else if (hasPublicProfileRoute) {
      contactType = 'public_profile_message';
      contactValue = authorProfileUrl;
    }

    if (contactType === 'none') {
      if (this.strictContactRequirement) {
        return {
          qualification_status: 'rejected',
          rejection_reason: 'NO_ACTIONABLE_CONTACT',
          rejection_gate: 'GATE_7',
          evidence_summary: 'No valid email, phone, business contact page, or actionable native messaging profile found',
          is_client_side_project: true,
          has_actionable_contact: false,
          contact_type: 'none'
        };
      }
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
    const hasContact = contactType !== 'none' && Boolean(contactValue);
    const contactScore = contactType === 'email' ? 95 : (contactType === 'phone' ? 90 : (contactType === 'public_business_contact' ? 85 : (contactType === 'public_profile_message' ? 80 : 0)));

    return {
      qualification_status: 'qualified',
      rejection_reason: null,
      rejection_gate: null,
      evidence_summary: hasContact
        ? 'Qualified commercial IT development requirement with verified contact channel'
        : 'Qualified commercial IT development requirement without direct actionable contact',
      is_it_project: true,
      is_client_side_project: true,
      is_employment: false,
      is_internship: false,
      is_freelancer_seeking_work: false,
      source: candidate.source,
      priorityTier: candidate.priorityTier || 'P1',
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
      has_actionable_contact: hasContact,
      contact_type: contactType,
      contact_value: contactValue,
      relevanceScore: 88,
      contactabilityScore: contactScore,
      qualification_evidence: {
        it_deliverable_detected: true,
        buyer_intent_detected: true,
        contact_verified: hasContact,
        contact_channel: contactType
      },
      postedAt: candidate.postedAt || null,
      freshnessStatus: freshnessCheck.freshnessStatus || (candidate.postedAt ? 'fresh' : 'recent_discovery'),
      discoveredAt: new Date().toISOString()
    };
  }

  formatExtractedProject(candidate, llmResult, heuristicFallback) {
    // If LLM explicitly rejected the post as non-project, respect LLM rejection
    if (llmResult.qualification_status === 'rejected') {
      return {
        qualification_status: 'rejected',
        rejection_reason: llmResult.rejection_reason || 'UNQUALIFIED',
        rejection_gate: 'GATE_7',
        evidence_summary: 'Rejected by LLM: no requirement found',
        is_client_side_project: Boolean(llmResult.is_client_side_project),
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    // Ensure LLM does NOT hallucinate sourceUrl as contact
    const contactType = heuristicFallback.contact_type || (['email', 'phone', 'public_business_contact', 'public_profile_message'].includes(llmResult.contact_type) ? llmResult.contact_type : 'none');
    const contactValue = heuristicFallback.contact_value || llmResult.contact_value || null;
    const hasContact = contactType !== 'none' && Boolean(contactValue);

    if (!hasContact && this.strictContactRequirement) {
      return {
        qualification_status: 'rejected',
        rejection_reason: 'NO_ACTIONABLE_CONTACT',
        rejection_gate: 'GATE_7',
        evidence_summary: 'Deterministic verification rejected contact route',
        is_client_side_project: true,
        has_actionable_contact: false,
        contact_type: 'none'
      };
    }

    return {
      qualification_status: 'qualified',
      rejection_reason: null,
      rejection_gate: null,
      evidence_summary: hasContact
        ? 'Qualified commercial IT development requirement verified by hybrid engine'
        : 'Qualified commercial IT development requirement without direct actionable contact',
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
      category: llmResult.category || heuristicFallback.category || 'Web Development',
      skills: Array.isArray(llmResult.skills) && llmResult.skills.length > 0 ? llmResult.skills : heuristicFallback.skills,
      features: Array.isArray(llmResult.features) ? llmResult.features : ['Project Deliverable'],
      clientName: llmResult.client_name || heuristicFallback.clientName,
      clientUsername: candidate.author || null,
      clientEmail: heuristicFallback.clientEmail || llmResult.client_email || null,
      clientPhone: heuristicFallback.clientPhone || llmResult.client_phone || null,
      clientCompany: llmResult.client_company || heuristicFallback.clientCompany,
      clientCompanyUrl: heuristicFallback.clientCompanyUrl || llmResult.client_company_url || null,
      clientProfileUrl: heuristicFallback.clientProfileUrl || candidate.authorProfileUrl || null,
      clientLocation: llmResult.client_location || heuristicFallback.clientLocation,
      budget: llmResult.budget || heuristicFallback.budget,
      budgetMin: llmResult.budget_min || heuristicFallback.budgetMin,
      budgetMax: llmResult.budget_max || heuristicFallback.budgetMax,
      currency: llmResult.currency || heuristicFallback.currency,
      projectType: llmResult.project_type || heuristicFallback.projectType,
      projectIntent: llmResult.project_intent || heuristicFallback.projectIntent,
      has_actionable_contact: hasContact,
      contact_type: contactType,
      contact_value: contactValue,
      relevanceScore: llmResult.relevance_score || 85,
      contactabilityScore: hasContact ? (llmResult.contactability_score || 80) : 0,
      confidence: llmResult.confidence || 85,
      qualification_evidence: {
        it_deliverable_detected: true,
        buyer_intent_detected: true,
        contact_verified: hasContact,
        contact_channel: contactType
      },
      postedAt: candidate.postedAt || null,
      freshnessStatus: candidate.freshnessStatus || (candidate.postedAt ? 'fresh' : 'recent_discovery'),
      discoveredAt: new Date().toISOString()
    };
  }
}
