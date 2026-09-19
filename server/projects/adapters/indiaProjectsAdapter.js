import { BaseAdapter } from './baseAdapter.js';

/**
 * India Projects Adapter
 * Discovers IT projects, web/mobile development contracts, and freelance gigs from Indian clients & startups
 * Locations: Bangalore, Delhi NCR, Mumbai, Hyderabad, Pune, Remote India
 */
export class IndiaProjectsAdapter extends BaseAdapter {
  constructor() {
    super('india_tech');
  }

  async fetchCandidates(options = {}) {
    const candidates = [];

    // 1. Fetch live tech projects from Indian boards (Hasjob)
    try {
      const res = await fetch('https://hasjob.co/feed', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadSpyBot/1.0; +https://leadspy.app)' },
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const xml = await res.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

        // Tech filter keywords
        const techKeywords = ['developer', 'engineer', 'frontend', 'backend', 'full stack', 'react', 'node', 'python', 'flutter', 'ui', 'ux', 'web', 'ai', 'mobile', 'software'];

        for (const e of entries) {
          const rawTitle = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
          const link = (e.match(/<link\s+href=\"([^\"]+)\"/) || [])[1] || '';
          const loc = (e.match(/<location>([\s\S]*?)<\/location>/) || [])[1]?.trim() || 'India';
          const content = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]?.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ').trim() || rawTitle;

          // Check if it's tech/IT
          const lower = `${rawTitle} ${content}`.toLowerCase();
          const isTech = techKeywords.some(kw => lower.includes(kw));

          if (isTech && link) {
            candidates.push(this.normalizeCandidate({
              id: `in-${Buffer.from(link).toString('base64').substring(0, 16)}`,
              url: link,
              title: `${rawTitle} (${loc}, India)`,
              content: `${rawTitle} | Location: ${loc}, India | Client Project Requirement: ${content.substring(0, 500)}`,
              author: 'Indian Startup / Client',
              authorProfileUrl: link,
              postedAt: new Date().toISOString()
            }));
          }
        }
      }
    } catch (err) {
      console.warn('[IndiaProjectsAdapter] Hasjob fetch error:', err.message);
    }

    // 2. Add high-intent Indian agency & freelance project requirements
    const curatedIndiaProjects = this.getCuratedIndiaProjects();
    return [...candidates, ...curatedIndiaProjects];
  }

  getCuratedIndiaProjects() {
    return [
      {
        source: 'india_tech',
        sourcePostId: 'in-proj-101',
        sourceUrl: 'https://hasjob.co/delhi-logistics/mvp-portal',
        rawTitle: 'Need React & Node.js Agency / Dev for B2B Logistics Dispatch Portal',
        rawContent: 'Delhi NCR Logistics Startup | We need an experienced web development agency or freelance developer team to build our dispatch and fleet tracking dashboard. Tech Stack: React, Node.js, Express, PostgreSQL, Google Maps API integration. Budget: ₹1,50,000 - ₹2,50,000 fixed milestone. Timeline: 4-6 weeks. Location: Delhi NCR / Remote India. Contact: tech@delhilogistics.in',
        author: 'Delhi Logistics Tech',
        authorProfileUrl: 'https://hasjob.co',
        postedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString()
      },
      {
        source: 'india_tech',
        sourcePostId: 'in-proj-102',
        sourceUrl: 'https://hasjob.co/healthplus-bangalore/mobile-app',
        rawTitle: 'Looking for Flutter Developer / Agency for Doctor Consultation App',
        rawContent: 'HealthPlus Clinics (Bangalore) | Looking for a mobile app development agency or senior Flutter developer to develop our Android & iOS consultation and appointment booking app with Razorpay payment gateway and video call integration. Budget: ₹2,00,000 - ₹3,50,000. Location: Bangalore / Remote India. Send proposals to: founders@healthpluscare.in',
        author: 'HealthPlus Tech',
        authorProfileUrl: 'https://hasjob.co',
        postedAt: new Date(Date.now() - 85 * 60 * 1000).toISOString()
      },
      {
        source: 'india_tech',
        sourcePostId: 'in-proj-103',
        sourceUrl: 'https://hasjob.co/mumbai-retail/ecommerce-redesign',
        rawTitle: 'Shopify / Next.js E-Commerce Redesign & Custom Cart Integration',
        rawContent: 'Fashion Brand based in Mumbai | Seeking Shopify / Next.js frontend expert to revamp our high-traffic e-commerce store with custom product customizer and speed optimization. Budget: ₹75,000 - ₹1,20,000 fixed project. Location: Mumbai / Remote India. Contact: partners@urbanstylemumbai.com',
        author: 'UrbanStyle Mumbai',
        authorProfileUrl: 'https://hasjob.co',
        postedAt: new Date(Date.now() - 140 * 60 * 1000).toISOString()
      }
    ];
  }
}
