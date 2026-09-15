import dotenv from 'dotenv';
dotenv.config();

// Popular Indian City Locality Hotspots Knowledge Base
const CITY_HOTSPOTS = {
  'Agra': ['Sanjay Place (Commercial Hub)', 'Tajganj & Fatehabad Road', 'Dayalbagh & Kamla Nagar', 'Shahganj & Bodla'],
  'Delhi': ['South Delhi (Saket / GK / Hauz Khas)', 'Connaught Place & Central Delhi', 'Rohini & Pitampura (North)', 'Dwarka & Janakpuri (West)', 'Laxmi Nagar & Preet Vihar (East)'],
  'Delhi NCR': ['South Delhi (Saket / GK / Hauz Khas)', 'Noida (Sector 18 / 62)', 'Gurugram (Cyber City / Golf Course Rd)', 'Connaught Place & Central Delhi'],
  'South Delhi': ['Saket & Malviya Nagar', 'Greater Kailash (GK 1 & 2)', 'Hauz Khas & Green Park', 'Lajpat Nagar & Defence Colony'],
  'Mumbai': ['Bandra & Khar (West)', 'Andheri (East & West Commercial)', 'Nariman Point & Fort (South)', 'Powai & BKC (Fintech Hub)'],
  'Bangalore': ['Indiranagar & Koramangala', 'Whitefield (Tech Hub)', 'HSR Layout & BTM', 'Jayanagar & JP Nagar'],
  'Pune': ['Koregaon Park & Kalyani Nagar', 'Baner & Balewadi', 'Viman Nagar & Kharadi', 'Shivajinagar & FC Road'],
  'Hyderabad': ['Hitec City & Gachibowli', 'Jubilee Hills & Banjara Hills', 'Madhapur & Kondapur', 'Secunderabad'],
  'Jaipur': ['C-Scheme & MI Road', 'Malviya Nagar & Vaishali Nagar', 'Mansarovar', 'Tonk Road'],
  'Lucknow': ['Hazratganj (Central)', 'Gomti Nagar & Gomti Nagar Extension', 'Aliganj & Mahanagar', 'Indira Nagar']
};

/**
 * OpenRouter AI Service
 * Multi-Step Conversational Discovery State Machine:
 * Step 1: Niche
 * Step 2: City
 * Step 3: Specific Locality / Commercial Hubs
 * Step 4: Qualification Angle
 * Step 5: Execute Google Maps Search
 */
export async function processUserPrompt({ message, history = [], currentCriteria = {} }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

  const systemPrompt = `
You are LeadSpy AI, an expert conversational lead generation assistant for Indian & global businesses.

LANGUAGE & TONE INSTRUCTIONS:
1. ADAPTIVE LANGUAGE MIRRORING:
   - If user speaks in Hindi/Hinglish (e.g. "muje agra mai real estate walo ka leads chaiye", "agra me doctors chahiye", "delhi me gym dhundho"):
     Respond in natural, friendly, professional conversational Hinglish (Roman Hindi)!
     Example: "Bilkul! Agra mein doctors aur medical clinics ki leads nikalte hain. 🩺"
   - If user speaks in English: Respond in fluent, polite English.

DYNAMIC CONVERSATION ORDER (STRICT):
Step 1: Niche (Business type)
Step 2: City (Target city/metro in India)
Step 3: ADAPTIVE SUB-CATEGORY QUALIFICATION (Self-decided by LLM):
   - Evaluate: Is this business niche BROAD with distinct high-paying specializations?
     (e.g., Doctors -> Cardiologists, Gynecologists, Dermatologists, Orthopedic, Dentists;
            Lawyers -> Corporate, Criminal, Property, Divorce;
            Real Estate -> Commercial, Residential, Luxury plots;
            Coaching -> IIT-JEE/NEET, UPSC, IELTS, School)
   - IF BROAD and user hasn't specified sub-category:
     Ask the user for their target specialization with 4-5 dynamic chips + 1 "🌐 All / Mix (General)" chip!
     Set stage: "subcategory", isReadyToScrape: false.
   - IF ALREADY SPECIFIC (e.g., "Cardiologist", "Dentist", "Commercial real estate") OR NARROW (e.g., Car wash, Petrol pump, Dry cleaner):
     SKIP sub-category step immediately and proceed to Locality!
Step 4: Prime Locality / Commercial Hub of that city (e.g. Sanjay Place, Saket, etc.)
Step 5: Qualification Angle (No Website / Broken Links, Low Rating <4.0, Unclaimed GMB, or All)
Step 6: Ready to scrape (Only when all criteria are locked!)

Respond ONLY with valid JSON with NO backticks:
{
  "replyText": "Natural conversational reply in user's language (Hinglish or English)",
  "followUpQuestion": "Next smart question in user's language",
  "chips": ["Option 1", "Option 2"],
  "isReadyToScrape": false,
  "stage": "niche|city|subcategory|locality|filter|ready",
  "searchQuery": null,
  "targetNiche": "Doctors & Medical Clinics",
  "targetSubCategory": "Dermatologists (Skin)",
  "targetCity": "Agra",
  "targetLocality": "Sanjay Place",
  "userService": "Web Design / Outreach"
}
`;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'LeadSpy AI'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-6).map(h => ({
              role: h.sender === 'user' ? 'user' : 'assistant',
              content: h.text
            })),
            { role: 'user', content: message }
          ],
          temperature: 0.6
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed.targetNiche && parsed.targetCity && (parsed.targetLocality || parsed.isReadyToScrape)) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('[AI] OpenRouter fallback engaged:', err.message);
    }
  }

  return runRuleBasedDiscoveryFlow(message, history);
}

function extractCityFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  const cities = [
    'south delhi', 'north delhi', 'west delhi', 'east delhi', 'delhi ncr', 'new delhi', 'delhi',
    'bandra', 'andheri', 'mumbai', 'navi mumbai', 'thane',
    'indiranagar', 'koramangala', 'whitefield', 'bangalore', 'bengaluru',
    'pune', 'hyderabad', 'chennai', 'kolkata', 'jaipur', 'agra',
    'ahmedabad', 'surat', 'lucknow', 'kanpur', 'nagpur', 'indore',
    'bhopal', 'visakhapatnam', 'patna', 'vadodara', 'ghaziabad',
    'ludhiana', 'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi',
    'srinagar', 'aurangabad', 'amritsar', 'allahabad', 'prayagraj',
    'ranchi', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada',
    'jodhpur', 'madurai', 'raipur', 'kota', 'chandigarh', 'guwahati',
    'noida', 'gurgaon', 'gurugram'
  ];

  for (const city of cities) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(lower)) {
      return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  const match = text.match(/\b(?:in|at|around|near)\s+([a-zA-Z\s]+?)(?:\s+(?:with|without|having|needing|<|>|\d|broken|unclaimed|rating)|$)/i);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length > 2 && !candidate.toLowerCase().includes('website') && !candidate.toLowerCase().includes('rating')) {
      return candidate.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}

function extractNicheFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  if (lower.includes('dent')) return "Dental Clinics";
  if (lower.includes('physio')) return "Physiotherapy Clinics";
  if (lower.includes('gym') || lower.includes('fitness')) return "Fitness Gyms";
  if (lower.includes('realt') || lower.includes('real estate') || lower.includes('property')) return "Real Estate Agencies";
  if (lower.includes('law') || lower.includes('advocate') || lower.includes('legal')) return "Law Firms";
  if (lower.includes('cafe') || lower.includes('restaurant') || lower.includes('food')) return "Restaurants & Cafes";
  if (lower.includes('salon') || lower.includes('spa') || lower.includes('beauty')) return "Beauty Salons & Spas";
  if (lower.includes('coach') || lower.includes('institute') || lower.includes('school') || lower.includes('tutor')) return "Coaching Institutes";
  if (lower.includes('doctor') || lower.includes('clinic') || lower.includes('hospital')) return "Medical Clinics";
  if (lower.includes('hotel') || lower.includes('resort')) return "Hotels & Resorts";
  if (lower.includes('petrol pump') || lower.includes('fuel station')) return "Petrol Pumps";
  if (lower.includes('car wash') || lower.includes('car detailing')) return "Car Wash & Detailing";
  if (lower.includes('photographer') || lower.includes('photography')) return "Photographers";
  if (lower.includes('interior') || lower.includes('decorator')) return "Interior Designers";
  if (lower.includes('jewel') || lower.includes('jewellery')) return "Jewellery Stores";

  // Dynamic regex fallback: e.g. "<city> me <niche> ki lead" or "<niche> in <city>"
  const matchHinglish = text.match(/\b(?:me|mai|in|ke|ki)\s+([a-zA-Z\s]{3,25}?)\s+(?:ki|ke|ka|walo|wale|leads?|data)\b/i);
  if (matchHinglish && matchHinglish[1]) {
    const cand = matchHinglish[1].trim();
    if (!cand.toLowerCase().includes('agra') && !cand.toLowerCase().includes('delhi') && cand.length > 3) {
      return cand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}

function extractLocalityFromText(text, city) {
  if (!text) return null;
  const lower = text.toLowerCase();

  if (lower.includes('entire') || lower.includes('all areas') || lower.includes('whole')) {
    return 'Entire City';
  }

  // Check known hotspots for this city
  if (city && CITY_HOTSPOTS[city]) {
    for (const spot of CITY_HOTSPOTS[city]) {
      const cleanSpot = spot.split('(')[0].trim().toLowerCase();
      if (lower.includes(cleanSpot)) {
        return cleanSpot.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
  }

  // Generic locality match after "in" or comma if city is already mentioned
  const locMatch = text.match(/📍\s*([a-zA-Z\s]+)/i);
  if (locMatch && locMatch[1]) {
    return locMatch[1].split('(')[0].trim();
  }

  return null;
}

function runRuleBasedDiscoveryFlow(msg, history = []) {
  const latestText = msg.trim();
  const lowerLatest = latestText.toLowerCase();

  // Detect if user is speaking Hinglish / Hindi
  const isHinglish = /\b(muje|mujhe|chahiye|chaiye|walo|wale|ka|ki|ke|mai|mein|dhundho|nikalo|bhai|karo|batao|kaisa|kaunsa|hoga|karein|bhi)\b/i.test(latestText) || history.some(h => /\b(muje|mujhe|chahiye|chaiye|walo|wale|ka|ki|ke|mai|mein)\b/i.test(h.text || ''));

  // 1. Detect City: PRIORITIZE LATEST USER MESSAGE FIRST!
  let city = extractCityFromText(latestText);
  if (!city) {
    // Only look at previous USER messages in reverse order (ignore welcome system message)
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'user') {
        const c = extractCityFromText(history[i].text || '');
        if (c) {
          city = c;
          break;
        }
      }
    }
  }

  // 2. Detect Niche: PRIORITIZE LATEST USER MESSAGE FIRST!
  let niche = extractNicheFromText(latestText);
  if (!niche) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'user') {
        const n = extractNicheFromText(history[i].text || '');
        if (n) {
          niche = n;
          break;
        }
      }
    }
  }

  // 3. Detect Locality
  let locality = extractLocalityFromText(latestText, city);
  if (!locality) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].sender === 'user') {
        const l = extractLocalityFromText(history[i].text || '', city);
        if (l) {
          locality = l;
          break;
        }
      }
    }
  }

  // 4. Detect Filter
  const hasFilter = lowerLatest.includes('no website') || lowerLatest.includes('broken') || lowerLatest.includes('low rating') || lowerLatest.includes('unclaimed') || lowerLatest.includes('all listings') || lowerLatest.includes('top ranked') || lowerLatest.includes('website nahi') || lowerLatest.includes('kharab rating');

  // STAGE 1: Niche Missing -> Ask Niche
  if (!niche) {
    if (isHinglish) {
      return {
        replyText: "Namaste! LeadSpy mein aapka swagat hai. Aap kis business category ya industry ke clients ko target karna chahte hain?",
        followUpQuestion: "Apna target business chuniye ya type kijiye:",
        chips: [
          "Real Estate & Property Dealers",
          "Dental Clinics & Doctors",
          "Gyms & Fitness Centers",
          "Coaching Institutes",
          "Restaurants & Cafes"
        ],
        isReadyToScrape: false,
        stage: "niche",
        searchQuery: null,
        targetNiche: null,
        targetCity: null,
        targetLocality: null
      };
    }
    return {
      replyText: "Namaste! Welcome to LeadSpy. What business category or industry do you want to target?",
      followUpQuestion: "Select or type your ideal client industry:",
      chips: [
        "Real Estate Agencies",
        "Dental & Medical Clinics",
        "Gyms & Fitness Centers",
        "Coaching Institutes",
        "Restaurants & Cafes"
      ],
      isReadyToScrape: false,
      stage: "niche",
      searchQuery: null,
      targetNiche: null,
      targetCity: null,
      targetLocality: null
    };
  }

  // STAGE 2: City Missing -> Ask City
  if (!city) {
    if (isHinglish) {
      return {
        replyText: `Bilkul! **${niche}** ko target karte hain. Aap kis Indian city ya metro area mein leads search karna chahte hain?`,
        followUpQuestion: `${niche} ke liye city chuniye:`,
        chips: [
          `${niche} in Delhi NCR`,
          `${niche} in Mumbai`,
          `${niche} in Bangalore`,
          `${niche} in Pune`,
          `${niche} in Agra`
        ],
        isReadyToScrape: false,
        stage: "city",
        searchQuery: null,
        targetNiche: niche,
        targetCity: null,
        targetLocality: null
      };
    }
    return {
      replyText: `Got it! Targeting **${niche}**. Which city or metro area in India do you want to search?`,
      followUpQuestion: `Select your target city for ${niche}:`,
      chips: [
        `${niche} in Delhi NCR`,
        `${niche} in Mumbai`,
        `${niche} in Bangalore`,
        `${niche} in Pune`,
        `${niche} in Agra`
      ],
      isReadyToScrape: false,
      stage: "city",
      searchQuery: null,
      targetNiche: niche,
      targetCity: null,
      targetLocality: null
    };
  }

  // Helper: Detect broad industry and return dynamically generated specializations
  function getSubCategoryOptions(nicheName, cityCurrent) {
    const n = nicheName.toLowerCase();
    if (n.includes('doctor') || n.includes('clinic') || n.includes('medical') || n.includes('hospital')) {
      return {
        isBroad: true,
        chips: [
          '🫀 Cardiologists (Heart Specialists)',
          '👶 Gynecologists (Women Care)',
          '✨ Dermatologists (Skin & Hair)',
          '🦴 Orthopedic (Bone & Joint)',
          '🦷 Dentists & Dental Clinics',
          `🌐 All Doctors in ${cityCurrent}`
        ]
      };
    }
    if (n.includes('real estate') || n.includes('property') || n.includes('realt')) {
      return {
        isBroad: true,
        chips: [
          '🏢 Commercial Property Dealers',
          '🏠 Residential & Flats Agents',
          '🌴 Luxury Villas & Plots Dealers',
          `🌐 All Real Estate in ${cityCurrent}`
        ]
      };
    }
    if (n.includes('law') || n.includes('advocate') || n.includes('legal')) {
      return {
        isBroad: true,
        chips: [
          '⚖️ Corporate & Tax Lawyers',
          '🏛️ Criminal & Court Advocates',
          '📑 Property & Real Estate Lawyers',
          `🌐 All Lawyers in ${cityCurrent}`
        ]
      };
    }
    if (n.includes('coach') || n.includes('institute') || n.includes('tuition')) {
      return {
        isBroad: true,
        chips: [
          '📚 IIT-JEE & NEET Coaching',
          '🎯 UPSC & Govt Exam Coaching',
          '✈️ IELTS & Spoken English',
          `🌐 All Coaching Centers in ${cityCurrent}`
        ]
      };
    }
    if (n.includes('gym') || n.includes('fitness')) {
      return {
        isBroad: true,
        chips: [
          '🏋️ CrossFit & Weight Gyms',
          '🧘 Yoga & Pilates Studios',
          '🥊 MMA & Boxing Centers',
          `🌐 All Fitness Centers in ${cityCurrent}`
        ]
      };
    }
    return { isBroad: false, chips: [] };
  }

  // Check if user already picked or specified a subcategory in history or current message
  let subCategory = null;
  const subCategoryCheck = getSubCategoryOptions(niche, city);

  if (subCategoryCheck.isBroad) {
    // Check if user text already has a specific sub-category term
    const specificTerms = [
      'cardio', 'gyne', 'derma', 'skin', 'ortho', 'dent', 'pediatric', 'neuro',
      'commercial', 'residential', 'flat', 'villa', 'plot',
      'corporate', 'criminal', 'tax',
      'iit', 'jee', 'neet', 'upsc', 'ielts',
      'crossfit', 'yoga', 'pilates', 'mma', 'boxing', 'all'
    ];
    for (const term of specificTerms) {
      if (lowerLatest.includes(term)) {
        subCategory = latestText;
        break;
      }
    }
    if (!subCategory) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].sender === 'user') {
          const ht = (history[i].text || '').toLowerCase();
          for (const term of specificTerms) {
            if (ht.includes(term)) {
              subCategory = history[i].text;
              break;
            }
          }
        }
      }
    }
  } else {
    // If not a broad industry, subCategory is not needed
    subCategory = 'NOT_APPLICABLE';
  }

  // STAGE 2.5: If Niche is Broad AND Sub-Category is not yet chosen -> Ask Sub-Category!
  if (subCategoryCheck.isBroad && !subCategory) {
    if (isHinglish) {
      return {
        replyText: `City locked: **${city}** for **${niche}**! 🎯 Lekin ${niche} mein kaafi alag-alag specializations hoti hain. Aapko kis specific type ke clients target karne hain?`,
        followUpQuestion: `${niche} ki category chuniye:`,
        chips: subCategoryCheck.chips,
        isReadyToScrape: false,
        stage: "subcategory",
        searchQuery: null,
        targetNiche: niche,
        targetCity: city,
        targetLocality: null
      };
    }
    return {
      replyText: `City locked: **${city}** for **${niche}**! ${niche} has multiple distinct specializations. Which specific type would you like to target?`,
      followUpQuestion: `Select specialization for ${niche}:`,
      chips: subCategoryCheck.chips,
      isReadyToScrape: false,
      stage: "subcategory",
      searchQuery: null,
      targetNiche: niche,
      targetCity: city,
      targetLocality: null
    };
  }

  // STAGE 3: Locality Missing -> Ask Prime Locality / Commercial Hubs
  if (!locality) {
    const activeTarget = (subCategory && subCategory !== 'NOT_APPLICABLE' && !subCategory.toLowerCase().includes('all')) 
      ? subCategory.replace(/^[^\w\s]+/, '').split('(')[0].trim() 
      : niche;

    const knownSpots = CITY_HOTSPOTS[city] || [
      `Central Commercial Hub of ${city}`,
      `Prime Market Area in ${city}`,
      `Tech & Business Park in ${city}`
    ];

    const localityChips = [
      ...knownSpots.map(s => `📍 ${s}`),
      isHinglish ? `🌐 Pura ${city} (All Areas)` : `🌐 Entire ${city} (All Areas)`
    ];

    if (isHinglish) {
      return {
        replyText: `Great! Target: **${activeTarget} in ${city}**! High-value clients nikalne ke liye kis prime locality ya commercial area ko target karna hai?`,
        followUpQuestion: `${city} ke prime areas me se chuniye:`,
        chips: localityChips,
        isReadyToScrape: false,
        stage: "locality",
        searchQuery: null,
        targetNiche: activeTarget,
        targetCity: city,
        targetLocality: null
      };
    }

    return {
      replyText: `Great! Target: **${activeTarget} in ${city}**! To get the highest-converting local leads, which commercial hub or prime locality should we focus on?`,
      followUpQuestion: `Select prime business zone in ${city}:`,
      chips: localityChips,
      isReadyToScrape: false,
      stage: "locality",
      searchQuery: null,
      targetNiche: activeTarget,
      targetCity: city,
      targetLocality: null
    };
  }

  // STAGE 4: Qualification Filter Missing -> Ask Filter
  if (!hasFilter) {
    const areaLabel = locality === 'Entire City' ? city : `${locality}, ${city}`;
    if (isHinglish) {
      return {
        replyText: `Target Area Confirmed: **${niche} in ${areaLabel}**! 👍 LeadSpy ko batayein ki aapko kis tarah ke businesses filter out karke chahiye?`,
        followUpQuestion: "Qualification angle chuniye:",
        chips: [
          `🔥 Jinki Website nahi hai (Website bechne ke liye)`,
          `⭐ Low Rating wale (<4.0) (Review booster ke liye)`,
          `📍 Unclaimed GMB Profiles (Easy conversion)`,
          `🚀 Saari active listings nikal lo`
        ],
        isReadyToScrape: false,
        stage: "filter",
        searchQuery: null,
        targetNiche: niche,
        targetCity: city,
        targetLocality: locality
      };
    }

    return {
      replyText: `Target Area Confirmed: **${niche} in ${areaLabel}**! How should LeadSpy qualify and filter these businesses for your pitch?`,
      followUpQuestion: "Select qualification angle:",
      chips: [
        `🔥 Only ${niche} with No Website in ${city}`,
        `⭐ Low Rating (<4.0) Needing Reputation Boost`,
        `📍 Unclaimed Google Maps Profiles`,
        `🚀 Scrape All Active Listings in ${city}`
      ],
      isReadyToScrape: false,
      stage: "filter",
      searchQuery: null,
      targetNiche: niche,
      targetCity: city,
      targetLocality: locality
    };
  }

  // STAGE 5: All 4 Confirmed -> READY TO SCRAPE!
  const finalQueryArea = locality === 'Entire City' ? city : `${locality} ${city}`;
  const finalQuery = `${niche} in ${finalQueryArea}`.replace(/\s+/g, ' ').trim();

  if (isHinglish) {
    return {
      replyText: `Sab criteria confirm ho gaya! Google Maps se "${finalQuery}" ki live leads scan kar rahe hain. Bas kuch seconds rukiye... ⚡`,
      followUpQuestion: null,
      chips: [],
      isReadyToScrape: true,
      stage: "ready",
      searchQuery: finalQuery,
      targetNiche: niche,
      targetCity: city,
      targetLocality: locality
    };
  }

  return {
    replyText: `All criteria verified! Launching Google Maps live extraction for "${finalQuery}". Extracting verified business listings now...`,
    followUpQuestion: null,
    chips: [],
    isReadyToScrape: true,
    stage: "ready",
    searchQuery: finalQuery,
    targetNiche: niche,
    targetCity: city,
    targetLocality: locality
  };
}
