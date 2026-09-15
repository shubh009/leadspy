import { qualifyLead, batchQualifyLeads } from '../services/leadIntelligence';

export const INITIAL_CAMPAIGNS = [
  {
    id: 'camp-1',
    title: 'Agra Real Estate Specialists',
    query: 'Real Estate in Sanjay Place Agra',
    leadsCount: 24,
    active: true,
    category: 'Real Estate',
    location: 'Sanjay Place, Agra'
  },
  {
    id: 'camp-2',
    title: 'South Delhi Dermatologists',
    query: 'Dermatologists in Saket South Delhi',
    leadsCount: 18,
    active: false,
    category: 'Healthcare',
    location: 'Saket, South Delhi'
  },
  {
    id: 'camp-3',
    title: 'Kota IIT-JEE Coaching Hubs',
    query: 'IIT Coaching Centers in Kota',
    leadsCount: 32,
    active: false,
    category: 'Education',
    location: 'Vigyan Nagar, Kota'
  }
];

const RAW_MOCK_LEADS = [
  {
    id: 'lead-1',
    name: 'Sarah Chen',
    title: 'Growth Manager',
    company: 'NovaTech',
    status: 'New',
    score: 92,
    scoreTrend: 'up',
    intent: 'High',
    source: 'LinkedIn Ads',
    opportunity: 48000,
    assigned: {
      name: 'Michael Torres',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Schedule Pricing Call',
    aiRecommendation: 'High conversion probability',
    email: 'sarah.chen@novatech.io',
    phone: '+1 415 890 2314',
    location: 'Austin, Texas',
    tags: ['High Intent', 'Tech Scaler', 'Decision Maker'],
    aiSummary: 'Sarah has demonstrated strong product interest, having reviewed the pricing tier three times this week.',
    keySignals: [
      'Reviewed pricing tiers 3 times in 48 hours',
      'Clicked case study link from outbound sequence',
      'Matches ICP company size (150-300 employees)'
    ],
    conversionPrediction: 'AI predicts a high likelihood of conversion within the next 10 days.',
    recommendedAction: 'Schedule a tailored pricing walkthrough focusing on annual enterprise savings.',
    intelligence: {
      score: 92,
      conversionProb: '84%',
      engagementLevel: 'High',
      sentiment: 'Positive · 94% confidence',
      buyingStage: 'Solution Comparison',
      churnRisk: 'Low Risk · 8%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 10:15 AM', text: 'Opened pricing email & clicked demo scheduler link.' },
      { id: 'a-2', time: 'Yesterday · 02:30 PM', text: 'Downloaded B2B Growth Strategy Case Study.' }
    ]
  },
  {
    id: 'lead-2',
    name: 'David Kim',
    title: 'Head of Sales',
    company: 'Vertex Labs',
    status: 'Demo Scheduled',
    score: 85,
    scoreTrend: 'up',
    intent: 'High',
    source: 'Google Ads',
    opportunity: 72000,
    assigned: {
      name: 'Amanda Lee',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Send Case Study',
    aiRecommendation: 'Enterprise interest detected',
    email: 'david@vertexlabs.ai',
    phone: '+1 415 555 0191',
    location: 'San Francisco, California',
    tags: ['Enterprise', 'High Intent', 'Decision Maker', 'Priority Account'],
    aiSummary: 'David is showing strong enterprise buying intent based on recent engagement activity.',
    keySignals: [
      'Requested enterprise demo',
      'Visited pricing page multiple times',
      'Downloaded security documentation',
      'Invited technical stakeholders to upcoming meeting'
    ],
    conversionPrediction: 'AI predicts a high likelihood of conversion within the next 14 days.',
    recommendedAction: 'Send enterprise security overview and prepare technical implementation walkthrough before the next demo session.',
    intelligence: {
      score: 85,
      conversionProb: '78%',
      engagementLevel: 'High',
      sentiment: 'Positive · 91% confidence',
      buyingStage: 'Evaluation Phase',
      churnRisk: 'Low Risk · 12%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 09:42 AM', text: 'Visited enterprise pricing page for 14 minutes.' },
      { id: 'a-2', time: 'Yesterday · 03:15 PM', text: 'Downloaded SOC-2 Compliance & Security Whitepaper.' },
      { id: 'a-3', time: '3 days ago · 11:20 AM', text: 'Submitted enterprise contact form requesting 50+ seat rollout.' }
    ]
  },
  {
    id: 'lead-3',
    name: 'Jonathan Miller',
    title: 'Founder',
    company: 'BrightScale',
    status: 'Negotiation',
    score: 77,
    scoreTrend: 'down',
    intent: 'Medium',
    source: 'Referral',
    opportunity: 125000,
    assigned: {
      name: 'Kevin Wu',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Follow-up Proposal',
    aiRecommendation: 'Pricing objection detected',
    email: 'jonathan@brightscale.co',
    phone: '+1 212 555 0144',
    location: 'New York, NY',
    tags: ['Founder', 'High Value', 'Negotiation Stage'],
    aiSummary: 'Jonathan is evaluating our tier against custom in-house tooling; recent calls hint at contract length sensitivity.',
    keySignals: [
      'Requested custom SLA clauses',
      'Discussed quarterly vs annual billing options',
      'Referred by existing tier-1 enterprise customer'
    ],
    conversionPrediction: 'AI predicts a moderate conversion probability within 21 days if flexible billing is offered.',
    recommendedAction: 'Offer 10% prepayment discount on 2-year agreement with quarterly review milestone.',
    intelligence: {
      score: 77,
      conversionProb: '65%',
      engagementLevel: 'Medium',
      sentiment: 'Neutral · 82% confidence',
      buyingStage: 'Contract Negotiation',
      churnRisk: 'Medium Risk · 28%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 08:30 AM', text: 'Re-reviewed MSA redlines on page 4 & 7.' },
      { id: 'a-2', time: '2 days ago · 04:00 PM', text: 'Attended commercial sync call with Kevin Wu.' }
    ]
  },
  {
    id: 'lead-4',
    name: 'Emily Rodriguez',
    title: 'Marketing Director',
    company: 'Orbit AI',
    status: 'New',
    score: 68,
    scoreTrend: 'up',
    intent: 'Medium',
    source: 'TikTok Ads',
    opportunity: 18000,
    assigned: {
      name: 'Amanda Lee',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Schedule Pricing Call',
    aiRecommendation: 'High conversion probability',
    email: 'emily@orbitai.net',
    phone: '+1 312 555 0188',
    location: 'Chicago, Illinois',
    tags: ['Growth Stage', 'Self-Serve Ready', 'Inbound'],
    aiSummary: 'Emily converted from an educational TikTok growth video and initiated an exploratory account.',
    keySignals: [
      'Completed interactive product tour',
      'Integrated Google Analytics tracking',
      'Invited 2 team colleagues to workspace'
    ],
    conversionPrediction: 'AI predicts 72% likelihood of self-serve upgrade within 7 days.',
    recommendedAction: 'Send automated quick-start tutorial with custom prompt playbook.',
    intelligence: {
      score: 68,
      conversionProb: '72%',
      engagementLevel: 'Medium',
      sentiment: 'Positive · 88% confidence',
      buyingStage: 'Product Exploration',
      churnRisk: 'Low Risk · 14%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 11:10 AM', text: 'Invited 2 team members to workspace.' },
      { id: 'a-2', time: 'Yesterday · 06:15 PM', text: 'Tested sample lead scraper search for local clinics.' }
    ]
  },
  {
    id: 'lead-5',
    name: 'Rachel Adams',
    title: 'VP Marketing',
    company: 'Lumina Cloud',
    status: 'Proposal Sent',
    score: 89,
    scoreTrend: 'up',
    intent: 'High',
    source: 'Organic Search',
    opportunity: 96000,
    assigned: {
      name: 'Michael Torres',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Final ROI Discussion',
    aiRecommendation: 'Likely to close this week',
    email: 'rachel.adams@luminacloud.com',
    phone: '+1 206 555 0179',
    location: 'Seattle, Washington',
    tags: ['Enterprise', 'Proposal Stage', 'High Intent'],
    aiSummary: 'Rachel forwarded the proposal to the VP of Finance; executive alignment looks very favorable.',
    keySignals: [
      'Proposal PDF viewed 6 times by 3 unique IP addresses',
      'Requested ROI calculator template',
      'Targeting Q3 budget close'
    ],
    conversionPrediction: 'AI predicts a 90% probability of closing within 5 days.',
    recommendedAction: 'Send personalized executive ROI deck highlighting 3.8x pipeline acceleration.',
    intelligence: {
      score: 89,
      conversionProb: '90%',
      engagementLevel: 'High',
      sentiment: 'Very Positive · 96% confidence',
      buyingStage: 'Final Decision',
      churnRisk: 'Low Risk · 5%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 07:50 AM', text: 'Finance team reviewed enterprise proposal document.' },
      { id: 'a-2', time: 'Yesterday · 01:20 PM', text: 'Scheduled final ROI review call with VP of Finance.' }
    ]
  },
  {
    id: 'lead-6',
    name: 'Ethan Walker',
    title: 'Revenue Ops',
    company: 'ApexScale',
    status: 'Contacted',
    score: 58,
    scoreTrend: 'down',
    intent: 'Low',
    source: 'Meta Ads',
    opportunity: 12000,
    assigned: {
      name: 'Kevin Wu',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Re-engagement Email',
    aiRecommendation: 'Engagement dropping',
    email: 'ethan@apexscale.co',
    phone: '+1 305 555 0192',
    location: 'Miami, Florida',
    tags: ['At Risk', 'Low Engagement', 'RevOps'],
    aiSummary: 'Ethan opened initial outreach emails but has not scheduled a follow-up in the past 12 days.',
    keySignals: [
      'No email clicks in past 10 days',
      'Visited pricing page once 2 weeks ago',
      'Subscribed to monthly newsletter'
    ],
    conversionPrediction: 'AI predicts low conversion (<25%) without a fresh hook or pain-point prompt.',
    recommendedAction: 'Trigger multi-channel re-engagement sequence with competitive benchmark data.',
    intelligence: {
      score: 58,
      conversionProb: '22%',
      engagementLevel: 'Low',
      sentiment: 'Passive · 70% confidence',
      buyingStage: 'Dormant',
      churnRisk: 'High Risk · 64%'
    },
    activities: [
      { id: 'a-1', time: '4 days ago', text: 'Delivered follow-up email #3 (Unopened).' },
      { id: 'a-2', time: '12 days ago', text: 'Downloaded competitor comparison sheet.' }
    ]
  },
  {
    id: 'lead-7',
    name: 'Sophia Bennett',
    title: 'COO',
    company: 'Zenify',
    status: 'Qualified',
    score: 81,
    scoreTrend: 'up',
    intent: 'High',
    source: 'Webinar',
    opportunity: 54000,
    assigned: {
      name: 'Kevin Wu',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Schedule Demo',
    aiRecommendation: 'Strong buying signals',
    email: 'sophia@zenify.app',
    phone: '+1 617 555 0163',
    location: 'Boston, Massachusetts',
    tags: ['C-Level', 'Qualified Lead', 'Webinar Inbound'],
    aiSummary: 'Sophia attended our live automated lead generation webinar and asked 2 questions on multi-seat CRM sync.',
    keySignals: [
      'Attended 45 mins of live product webinar',
      'Asked question regarding automated webhook export',
      'Pre-qualified budget over $50k/year'
    ],
    conversionPrediction: 'AI predicts 81% conversion probability once live demo is held.',
    recommendedAction: 'Reach out via phone/WhatsApp with VIP demo invitation tailored for operations leaders.',
    intelligence: {
      score: 81,
      conversionProb: '81%',
      engagementLevel: 'High',
      sentiment: 'Positive · 89% confidence',
      buyingStage: 'Demo Prep',
      churnRisk: 'Low Risk · 10%'
    },
    activities: [
      { id: 'a-1', time: 'Yesterday · 04:30 PM', text: 'Webinar poll response: Needs automated lead workflow ASAP.' },
      { id: 'a-2', time: '2 days ago', text: 'Registered for Maps Lead Automation Masterclass.' }
    ]
  },
  {
    id: 'lead-8',
    name: 'Daniel Park',
    title: 'Sales Lead',
    company: 'Flowbyte',
    status: 'New',
    score: 64,
    scoreTrend: 'up',
    intent: 'Medium',
    source: 'LinkedIn Organic',
    opportunity: 22000,
    assigned: {
      name: 'Amanda Lee',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Intro Outreach',
    aiRecommendation: 'Similar to converted leads',
    email: 'daniel@flowbyte.dev',
    phone: '+1 503 555 0147',
    location: 'Portland, Oregon',
    tags: ['Sales Tech', 'Inbound Lead'],
    aiSummary: 'Daniel engaged with founder LinkedIn posts about AI scrapers and visited our homepage.',
    keySignals: [
      'Liked and shared post on automated B2B outreach',
      'Visited LeadSpy pricing and integration page',
      'Matches tier 2 tech firm demographic'
    ],
    conversionPrediction: 'AI predicts 64% likelihood of booking introductory call.',
    recommendedAction: 'Send friendly personalized LinkedIn note referencing the mutual discussion on outreach automation.',
    intelligence: {
      score: 64,
      conversionProb: '64%',
      engagementLevel: 'Medium',
      sentiment: 'Positive · 85% confidence',
      buyingStage: 'Awareness',
      churnRisk: 'Low Risk · 15%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 09:12 AM', text: 'Engaged with LeadSpy product launch demo video.' }
    ]
  },
  {
    id: 'lead-9',
    name: 'Olivia Carter',
    title: 'Founder',
    company: 'MetricLoop',
    status: 'Negotiation',
    score: 91,
    scoreTrend: 'up',
    intent: 'High',
    source: 'Referral Partner',
    opportunity: 210000,
    assigned: {
      name: 'Michael Torres',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Contract Review',
    aiRecommendation: 'Strategic account potential',
    email: 'olivia@metricloop.com',
    phone: '+1 408 555 0133',
    location: 'San Jose, California',
    tags: ['Strategic Deal', 'Founder', 'Enterprise Partner'],
    aiSummary: 'Olivia is securing an agency-wide unlimited license for 120 SDRs across their 4 regional offices.',
    keySignals: [
      'Legal counsel completed master terms review',
      'Security questionnaire submitted and approved',
      'Executive sponsor committed to end-of-month signature'
    ],
    conversionPrediction: 'AI predicts 95% likelihood of contract execution within 7 days.',
    recommendedAction: 'Coordinate countersign call with executive team and prepare dedicated onboarding engineer.',
    intelligence: {
      score: 91,
      conversionProb: '95%',
      engagementLevel: 'High',
      sentiment: 'Strongly Positive · 98% confidence',
      buyingStage: 'Final Legal Review',
      churnRisk: 'Low Risk · 3%'
    },
    activities: [
      { id: 'a-1', time: 'Today · 08:15 AM', text: 'Legal approved final commercial terms.' },
      { id: 'a-2', time: 'Yesterday · 05:00 PM', text: 'Executive briefing with Michael Torres concluded.' }
    ]
  },
  {
    id: 'lead-10',
    name: 'Marcus Rivera',
    title: 'Demand Gen Manager',
    company: 'Skylab',
    status: 'Proposal Sent',
    score: 74,
    scoreTrend: 'up',
    intent: 'Medium',
    source: 'Google Ads',
    opportunity: 38000,
    assigned: {
      name: 'Amanda Lee',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'
    },
    nextAction: 'Follow-up Call',
    aiRecommendation: 'Decision maker inactive',
    email: 'marcus@skylabagency.com',
    phone: '+1 303 555 0122',
    location: 'Denver, Colorado',
    tags: ['Agency', 'Proposal Sent', 'Medium Intent'],
    aiSummary: 'Marcus reviewed the proposal deck but the primary VP has been out of office this week.',
    keySignals: [
      'Proposal opened twice last Friday',
      'Follow-up ping sent via email',
      'VP expected back in office next Monday'
    ],
    conversionPrediction: 'AI predicts decision timeline shifting to early next week.',
    recommendedAction: 'Send calendar invite for brief 15-min sync once the executive VP returns.',
    intelligence: {
      score: 74,
      conversionProb: '68%',
      engagementLevel: 'Medium',
      sentiment: 'Neutral · 79% confidence',
      buyingStage: 'Stakeholder Review',
      churnRisk: 'Medium Risk · 22%'
    },
    activities: [
      { id: 'a-1', time: '2 days ago', text: 'Proposal viewed on desktop for 8 minutes.' }
    ]
  }
];

export const INITIAL_CHAT_MESSAGES = [
  {
    id: 'm-welcome',
    sender: 'ai',
    text: "Namaste! I'm LeadSpy AI. Tell me what kind of business clients you want to target, what service you offer them, and in which Indian city or area (e.g., Delhi NCR, Mumbai, Agra, Bangalore, Pune).",
    chips: [
      "🎯 Step-by-Step Lead Finder",
      "I sell Web Design to Real Estate in Agra",
      "I sell SEO to Clinics in South Delhi",
      "I sell Google Ads to Coaching Centers in Kota",
      "I sell Social Media to Restaurants in Bangalore"
    ]
  }
];

export const MOCK_LEADS = batchQualifyLeads(RAW_MOCK_LEADS);

/**
 * Enriches any scraped Google Maps lead or manually created lead
 * with the full CRM fields required for the table and Lead Overview drawer.
 */
export function enrichLead(rawLead, index = 0) {
  if (!rawLead) return null;

  // If already enriched with CRM fields and AI audit
  if (rawLead.intelligence && rawLead.keySignals && rawLead.aiAudit) {
    return rawLead;
  }

  const assignedList = [
    { name: 'Michael Torres', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face' },
    { name: 'Amanda Lee', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
    { name: 'Kevin Wu', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' }
  ];

  const assigned = rawLead.assigned || assignedList[index % assignedList.length];
  const rating = rawLead.rating || 4.5;
  const reviewsCount = rawLead.reviewsCount || 10;
  const hasWebsite = Boolean(rawLead.website && rawLead.website.trim() !== '' && rawLead.website !== 'None');

  let status = 'New';
  let score = 75;
  let intent = 'Medium';
  let opportunity = 25000;
  let nextAction = 'Schedule Intro Call';
  let aiRecommendation = 'High conversion probability';
  let tags = ['Local Business'];

  if (!hasWebsite) {
    status = 'Qualified';
    score = 88;
    intent = 'High';
    opportunity = 45000;
    nextAction = 'Pitch Website & Domain';
    aiRecommendation = 'Immediate pain point: No Website';
    tags.push('High Intent', 'No Website', 'Priority Outreach');
  } else if (rating < 4.2) {
    status = 'New';
    score = 80;
    intent = 'High';
    opportunity = 35000;
    nextAction = 'Pitch Review Booster';
    aiRecommendation = 'Low Rating: Reputation recovery hook';
    tags.push('Urgent Pain Point', 'Reputation Fix');
  } else if (reviewsCount > 50) {
    status = 'Contacted';
    score = 84;
    intent = 'High';
    opportunity = 60000;
    nextAction = 'Pitch Ads Domination';
    aiRecommendation = 'High Authority account: Pitch Google Ads';
    tags.push('High Reviews', 'Scale Target');
  }

  const signals = [
    `Found via Google Maps search for "${rawLead.category || 'Local Business'}"`,
    hasWebsite ? `Active website: ${rawLead.website}` : 'No verified company website detected on Maps listing',
    `Maintains ${rating}★ rating across ${reviewsCount} public Google reviews`,
    rawLead.claimed ? 'Verified business listing profile' : 'Unclaimed Google Business listing detected'
  ];

  const enriched = {
    id: rawLead.id || `lead-${Date.now()}-${index}`,
    name: rawLead.name || 'Prospect Company',
    title: rawLead.title || 'Managing Director / Owner',
    company: rawLead.company || rawLead.name || 'Commercial Enterprise',
    status: rawLead.status || status,
    score: rawLead.score || score,
    scoreTrend: score >= 75 ? 'up' : 'down',
    intent: rawLead.intent || intent,
    source: rawLead.source || 'Google Maps Scraper',
    opportunity: rawLead.opportunity || opportunity,
    assigned,
    nextAction: rawLead.nextAction || nextAction,
    aiRecommendation: rawLead.aiRecommendation || rawLead.opportunityTag || aiRecommendation,
    email: rawLead.email || `${rawLead.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'contact'}@gmail.com`,
    phone: rawLead.phone || '+91 98' + Math.floor(10000000 + Math.random() * 90000000),
    location: rawLead.address || rawLead.location || 'India',
    website: rawLead.website || '',
    instagram: rawLead.instagram || null,
    facebook: rawLead.facebook || null,
    linkedin: rawLead.linkedin || null,
    category: rawLead.category || 'Business Services',
    rating: rawLead.rating || 4.5,
    reviewsCount: rawLead.reviewsCount || 10,
    tags: rawLead.tags || tags,
    aiSummary: rawLead.aiSummary || (rawLead.aiPitch ? `${rawLead.name}: ${rawLead.aiPitch}` : `${rawLead.name} operates in ${rawLead.address || 'the target area'} with strong local traction. Opportunity to upgrade digital visibility and lead conversion.`),
    keySignals: rawLead.keySignals || signals,
    conversionPrediction: rawLead.conversionPrediction || `AI projects a ${score}% likelihood of positive outreach engagement.`,
    recommendedAction: rawLead.recommendedAction || rawLead.aiPitch || `Contact via Phone or WhatsApp with customized ${rawLead.category || 'business'} value proposition.`,
    intelligence: rawLead.intelligence || {
      score,
      conversionProb: `${score - 5}%`,
      engagementLevel: intent,
      sentiment: 'Positive · 86% confidence',
      buyingStage: 'Initial Discovery',
      churnRisk: score > 80 ? 'Low Risk · 10%' : 'Medium Risk · 25%'
    },
    activities: rawLead.activities || [
      { id: `act-${Date.now()}-1`, time: 'Today · 10:00 AM', text: `Extracted listing from Google Maps: ${rawLead.name}` },
      { id: `act-${Date.now()}-2`, time: 'Today · 10:01 AM', text: `AI generated tailored outreach pitch: "${rawLead.aiPitch || 'Pitch generated'}"` }
    ]
  };

  return qualifyLead(enriched, index);
}
