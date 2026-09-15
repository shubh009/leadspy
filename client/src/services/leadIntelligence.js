/**
 * LeadSpy AI Lead Intelligence & Qualification Engine
 * Tailored specifically for Indian SMBs (Clinics, Real Estate, Coaching, Salons, Local B2B)
 */

// Premium / High commercial localities in Indian metros & tier-1/2 cities
const HIGH_VALUE_LOCALITIES = [
  'south delhi', 'greater kailash', 'gk', 'hauz khas', 'vasant vihar', 'defence colony', 'saket', 'connaught place', 'cp',
  'bandra', 'juhu', 'andheri', 'worli', 'powai', 'colaba', 'lower parel', 'nariman point',
  'indiranagar', 'koramangala', 'whitefield', 'hbt layout', 'jayanagar', 'mg road',
  'cyber city', 'golf course road', 'dlf', 'sector 29', 'sector 54',
  'sector 18', 'sector 62', 'noida expressway',
  'koregaon park', 'baner', 'kothrud', 'viman nagar', 'wakad',
  'civil lines', 'sanjay place', 'fatehabad road', 'raja ki mandi',
  'c-scheme', 'malviya nagar', 'vaishali nagar'
];

/**
 * Evaluates paying capacity based on location, reviews volume, and business type
 */
function assessPayingCapacity(lead) {
  const loc = (lead.location || lead.address || '').toLowerCase();
  const reviews = Number(lead.reviewsCount || 0);
  const rating = Number(lead.rating || 0);
  
  const isPrimeLocation = HIGH_VALUE_LOCALITIES.some(hl => loc.includes(hl));
  
  if (isPrimeLocation || reviews >= 60) {
    return {
      tier: 'High',
      budget: '₹35,000 - ₹75,000/mo',
      reason: isPrimeLocation 
        ? 'Prime commercial hub with high customer footfall & monthly operational cashflow.' 
        : 'High review velocity indicates established, recurring client base.'
    };
  }
  
  if (reviews >= 15 || rating >= 4.3) {
    return {
      tier: 'Medium',
      budget: '₹15,000 - ₹35,000/mo',
      reason: 'Steady local business with positive word-of-mouth seeking next-level expansion.'
    };
  }

  return {
    tier: 'Low',
    budget: '₹8,000 - ₹15,000/mo',
    reason: 'Early-stage or hyper-local listing with conservative digital spending history.'
  };
}

/**
 * Detects specific burning digital leaks for Indian businesses
 */
function detectDigitalLeaks(lead) {
  const leaks = [];
  const hasWebsite = Boolean(lead.website && lead.website.trim() !== '' && lead.website !== 'None');
  const rating = Number(lead.rating || 4.5);
  const reviews = Number(lead.reviewsCount || 0);
  const claimed = Boolean(lead.claimed);

  if (!hasWebsite) {
    leaks.push({
      id: 'no-website',
      severity: 'critical',
      title: 'No Verified Website on Maps',
      desc: 'Losing approx. 30-45 direct inquiries/month to competitors who offer instant booking.',
      impact: 'High Revenue Leak'
    });
  } else {
    // If website exists, check for common Indian SMB website leaks
    if (lead.website && lead.website.startsWith('http://') && !lead.website.startsWith('https://')) {
      leaks.push({
        id: 'ssl-broken',
        severity: 'high',
        title: 'Missing SSL (Not Secure Warning)',
        desc: 'Browser shows red warning, driving away 65% of mobile visitors immediately.',
        impact: 'Trust Barrier'
      });
    }
    leaks.push({
      id: 'missing-whatsapp-cta',
      severity: 'medium',
      title: 'No Direct WhatsApp Chat Widget',
      desc: 'Indian mobile searchers drop off without a 1-tap WhatsApp consultation button.',
      impact: 'Conversion Leak'
    });
  }

  if (rating < 4.2) {
    leaks.push({
      id: 'low-rating',
      severity: 'critical',
      title: `Sub-Par Google Rating (${rating}★)`,
      desc: 'Visible negative reviews without owner replies are pushing potential walk-ins to rivals.',
      impact: 'Reputation Risk'
    });
  }

  if (!claimed) {
    leaks.push({
      id: 'unclaimed-listing',
      severity: 'high',
      title: 'Unclaimed Google Business Profile',
      desc: 'Listing is vulnerable to competitor edits, phone number hijacking, or incorrect hours.',
      impact: 'Profile Security'
    });
  }

  if (reviews < 20 && hasWebsite) {
    leaks.push({
      id: 'low-review-proof',
      severity: 'medium',
      title: 'Weak Google Review Proof',
      desc: 'Falling behind local rivals who have 80+ positive reviews.',
      impact: 'Rankings Drop'
    });
  }

  return leaks;
}

/**
 * Computes AI Propensity / Fit Score (0 to 100)
 */
function computeFitScore(lead, payingCapacity, leaks) {
  let score = 50;

  // Paying capacity factor (+15 to +30)
  if (payingCapacity.tier === 'High') score += 28;
  else if (payingCapacity.tier === 'Medium') score += 16;
  else score += 5;

  // Burning pain severity factor (+10 to +30)
  const criticalLeaks = leaks.filter(l => l.severity === 'critical').length;
  const highLeaks = leaks.filter(l => l.severity === 'high').length;

  if (criticalLeaks >= 1) score += 20;
  if (highLeaks >= 1) score += 10;

  // Responsive signals (phone available, good reviews)
  if (lead.phone && lead.phone.trim() !== '') score += 5;
  if (Number(lead.reviewsCount || 0) > 40) score += 5;

  // Normalize to 0-98 range
  score = Math.min(98, Math.max(25, score));
  return score;
}

/**
 * Formulates tailored Hinglish & English Pitches + Telecall Script
 */
function generateOutreachPitches(lead, payingCapacity, leaks, primaryPain) {
  const businessName = lead.name || lead.company || 'Business';
  const category = lead.category || 'business';
  const location = lead.location || lead.address || 'your city';
  const cleanLoc = location.split(',')[0].trim();
  const phone = (lead.phone || '').replace(/[^0-9]/g, '');

  const hasNoWeb = leaks.some(l => l.id === 'no-website');
  const hasLowRating = leaks.some(l => l.id === 'low-rating');
  const hasUnclaimed = leaks.some(l => l.id === 'unclaimed-listing');

  // 1. Natural Conversational Hinglish WhatsApp Pitch
  let whatsappHinglish = '';
  if (hasNoWeb) {
    whatsappHinglish = `Namaste ${businessName} team! 🙏 Maine Google Maps par aapka profile dekha ${cleanLoc} me. Aapka customer response kaafi solid hai, par notice kiya ki aapki koi official website listed nahi hai jaha se clients direct packages ya booking dekh sakein.\n\nHumne aapke business ke liye ek quick sample mobile layout design banaya hai jisse roz ke 20-30 direct customer calls miss na hon. Kya main WhatsApp par 30-second preview share karu?`;
  } else if (hasLowRating) {
    whatsappHinglish = `Namaste Sir/Ma'am! Maine Google par ${businessName} (${cleanLoc}) dekha. Aapka setup kaafi accha hai, par profile par 1-2 negative reviews upar show ho rahe hain jisse naye clients divert ho rahe hain.\n\nHum local ${category} businesses ki Google rating 7 dino me 4.7★+ boost karne me help karte hain verified customer workflows se. Kya main ek quick case study share kar sakta hoon?`;
  } else if (hasUnclaimed) {
    whatsappHinglish = `Namaste Sir! Maine notice kiya ki Google Maps par ${businessName} ka official profile abhi 'Unclaimed' hai. Is wajah se koi bhi listing me timings ya contact number edit kar sakta hai.\n\nHum ise 24 hours me verify & fully optimize kar dete hain WhatsApp direct booking link ke saath. Kya aapke paas 2 min honge ispar baat karne ke liye?`;
  } else {
    whatsappHinglish = `Namaste ${businessName} team! ${cleanLoc} me aapke reviews aur authority kaafi acchi hai. Par Google search me nearby competitors Google Ads aur local SEO se top customer inquiries divert kar rahe hain.\n\nHumne aapke area ka ek quick competitor audit report taiyar kiya hai. Kya main WhatsApp par PDF share kar sakta hoon?`;
  }

  // 2. Formal English B2B Pitch
  let whatsappEnglish = '';
  if (hasNoWeb) {
    whatsappEnglish = `Hi ${businessName} team, came across your business listing in ${cleanLoc}. You have great customer feedback, but noticed there's no official website linked to capture mobile searchers.\n\nWe built a quick interactive sample layout for ${businessName} to turn Google traffic into direct bookings. Open to a 60-second preview?`;
  } else {
    whatsappEnglish = `Hello, noticed ${businessName} has strong local traction in ${cleanLoc}. We analyzed the top search terms for ${category} in your area and spotted a few quick optimizations to outrank local rivals on Google Maps.\n\nWould you be open to reviewing a 1-page complimentary digital audit?`;
  }

  // 3. 30-Second Telecaller Battlecard (Cold Call companion)
  const callScript = {
    icebreaker: `Namaste Sir, main ${cleanLoc} local business growth team se bol raha hoon. Maine abhi Google Maps par aapka ${businessName} dekha...`,
    hook: hasNoWeb 
      ? `Aapka customer response accha hai par aapki koi verified website nahi hai, jisse log competitor ke paas ja rahe hain.`
      : hasLowRating 
        ? `Aapki profile par rating thodi down hai jo naye clients ko rokk rahi hai.`
        : `Aapke area me 2 competitors Google Ads se roz ke 20-30 patients/customers capture kar rahe hain.`,
    cta: `Main aapke is number par ek 1-minute ka demo WhatsApp kar raha hoon. Aap dekh kar batayein agar suitable lage.`
  };

  return {
    whatsappHinglish,
    whatsappEnglish,
    callScript,
    whatsappUrl: phone ? `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(whatsappHinglish)}` : null
  };
}

/**
 * Generates local competitor gap insight
 */
function generateCompetitorGap(lead, leaks) {
  const category = lead.category || 'Competitor';
  const cleanLoc = (lead.location || lead.address || 'the area').split(',')[0].trim();
  const hasNoWeb = leaks.some(l => l.id === 'no-website');

  if (hasNoWeb) {
    return {
      topRival: `Top-Ranked ${category} in ${cleanLoc}`,
      advantage: 'Active mobile booking portal & instant WhatsApp consultation link',
      estimatedLoss: '~35 to 50 prospective inquiries missed every month'
    };
  }

  return {
    topRival: `Leading ${category} on Google Maps in ${cleanLoc}`,
    advantage: '150+ verified 5★ reviews and Google Ads presence',
    estimatedLoss: 'Dominating top 3 spots for high-intent search keywords'
  };
}

/**
 * Main Qualification Entry Point
 * Enriches a lead with full AI intelligence, fit score, tier, and outreach pitches
 */
export function qualifyLead(rawLead, index = 0) {
  if (!rawLead) return null;

  const payingCapacity = assessPayingCapacity(rawLead);
  const digitalLeaks = detectDigitalLeaks(rawLead);
  const fitScore = computeFitScore(rawLead, payingCapacity, digitalLeaks);

  let tier = 'COLD';
  if (fitScore >= 80) tier = 'HOT';
  else if (fitScore >= 55) tier = 'WARM';

  const primaryLeak = digitalLeaks[0] || {
    id: 'general-optimization',
    title: 'Local SEO & Ads Expansion',
    desc: 'Ready to scale local customer acquisition.'
  };

  const competitorGap = generateCompetitorGap(rawLead, digitalLeaks);
  const pitches = generateOutreachPitches(rawLead, payingCapacity, digitalLeaks, primaryLeak);

  return {
    ...rawLead,
    aiAudit: {
      fitScore,
      tier, // 'HOT' | 'WARM' | 'COLD'
      payingCapacity: payingCapacity.tier,
      estimatedBudget: payingCapacity.budget,
      capacityReason: payingCapacity.reason,
      primaryPain: primaryLeak.title,
      burningPainDesc: primaryLeak.desc,
      digitalLeaks,
      competitorGap,
      pitches
    }
  };
}

/**
 * Batch qualifies an array of leads
 */
export function batchQualifyLeads(leads = []) {
  return leads.map((lead, idx) => qualifyLead(lead, idx));
}
