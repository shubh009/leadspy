/**
 * Free In-House Automated Contact & Social Media Finder Service
 * Extracts public business contacts:
 * 1. Email (mailto & regex parsing)
 * 2. Instagram profile link
 * 3. Facebook page link
 * 4. LinkedIn profile/company link
 * Using deep website crawling (homepage, /contact, /about) and search engine snippet dorking.
 */

const JUNK_DOMAINS = [
  'example.com',
  'domain.com',
  'yourdomain.com',
  'sentry.io',
  'wixpress.com',
  'bootstrap.com',
  'schema.org',
  'cloudflare.com',
  'googleapis.com',
  'google.com',
  'w3.org',
  'duckduckgo.com',
  'gravatar.com'
];

const JUNK_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.css', '.js', '.woff', '.ttf'];

const AGGREGATOR_DOMAINS = [
  'wikipedia.org',
  'justdial.com',
  'indiamart.com',
  'tradeindia.com',
  'magicbricks.com',
  '99acres.com',
  'housing.com',
  'quikr.com',
  'olx.in',
  'yellowpages.in',
  'sulekha.com',
  'twitter.com',
  'youtube.com'
];

/**
 * Validates and cleans raw extracted email
 */
export function cleanEmail(rawEmail) {
  if (!rawEmail) return null;
  let email = rawEmail.trim().toLowerCase();

  // Remove mailto: prefix if present
  if (email.startsWith('mailto:')) {
    email = email.replace(/^mailto:/, '').split('?')[0];
  }

  // Strip leading & trailing symbols like quotes, brackets, dots, commas
  email = email.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');

  // Must match standard email format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return null;

  // Check invalid file extensions masquerading as domain (e.g. logo@2x.png)
  if (JUNK_EXTENSIONS.some(ext => email.endsWith(ext))) return null;

  // Check known dummy/CDN domains
  const domain = email.split('@')[1];
  if (JUNK_DOMAINS.some(jd => domain === jd || domain.endsWith('.' + jd))) return null;

  return email;
}

/**
 * Extracts unique valid emails from an HTML string
 */
export function extractEmailsFromHtml(html) {
  if (!html || typeof html !== 'string') return [];
  const found = new Set();

  // 1. Check mailto: links first (highest confidence)
  const mailtoRegex = /href=["']mailto:([^"'?#\s]+)/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const cleaned = cleanEmail(match[1]);
    if (cleaned) found.add(cleaned);
  }

  // 2. Scan entire HTML with general email regex
  const generalRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const generalMatches = html.match(generalRegex) || [];
  for (const m of generalMatches) {
    const cleaned = cleanEmail(m);
    if (cleaned) found.add(cleaned);
  }

  return Array.from(found);
}

/**
 * Extracts social media links (Instagram, Facebook, LinkedIn) from HTML
 */
export function extractSocialsFromHtml(html) {
  if (!html || typeof html !== 'string') {
    return { instagram: null, facebook: null, linkedin: null };
  }

  let instagram = null;
  let facebook = null;
  let linkedin = null;

  // 1. Instagram extraction
  const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]{2,40})/i);
  if (igMatch && !['p', 'reel', 'reels', 'explore', 'stories', 'share', 'about', 'developer'].includes(igMatch[1].toLowerCase())) {
    instagram = `https://instagram.com/${igMatch[1]}`;
  }

  // 2. Facebook extraction
  const fbMatch = html.match(/https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/([a-zA-Z0-9._-]{2,50})/i);
  if (fbMatch && !['sharer', 'share', 'tr', 'dialog', 'plugins', 'watch', 'pages'].includes(fbMatch[1].toLowerCase())) {
    facebook = `https://facebook.com/${fbMatch[1]}`;
  }

  // 3. LinkedIn extraction
  const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9._-]{2,50})/i);
  if (liMatch) {
    linkedin = `https://linkedin.com/${liMatch[0].includes('/company/') ? 'company' : 'in'}/${liMatch[1]}`;
  }

  return { instagram, facebook, linkedin };
}

/**
 * Crawls a website (homepage and contact page) to locate emails & social links
 */
export async function crawlWebsiteForContacts(rawUrl) {
  const result = {
    email: null,
    instagram: null,
    facebook: null,
    linkedin: null
  };

  if (!rawUrl || typeof rawUrl !== 'string') return result;

  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  try {
    // 1. Fetch Homepage (4s timeout)
    const homeRes = await fetch(targetUrl, {
      headers: browserHeaders,
      signal: AbortSignal.timeout(4000),
      redirect: 'follow'
    });

    if (!homeRes.ok) return result;
    const homeHtml = await homeRes.text();

    // Extract emails from homepage
    const homeEmails = extractEmailsFromHtml(homeHtml);
    if (homeEmails.length > 0) {
      const prioritized = homeEmails.find(e => /^(info|contact|support|sales|hello|enquiry|admin|office|help)@/i.test(e));
      result.email = prioritized || homeEmails[0];
    }

    // Extract socials from homepage
    const homeSocials = extractSocialsFromHtml(homeHtml);
    result.instagram = homeSocials.instagram;
    result.facebook = homeSocials.facebook;
    result.linkedin = homeSocials.linkedin;

    // If both email and instagram are already found, skip contact page crawl
    if (result.email && result.instagram) {
      return result;
    }

    // 2. Discover contact/about page for missing items
    let origin = '';
    try {
      origin = new URL(targetUrl).origin;
    } catch (e) {
      return result;
    }

    const candidateUrls = [
      `${origin}/contact`,
      `${origin}/contact-us`,
      `${origin}/reach-us`,
      `${origin}/about-us`
    ];

    const linkMatches = [...homeHtml.matchAll(/href=["']([^"']*(?:contact|reach-us|about)[^"']*)["']/gi)];
    for (const lm of linkMatches) {
      try {
        const resolved = new URL(lm[1], origin).href;
        if (resolved.startsWith('http') && !candidateUrls.includes(resolved)) {
          candidateUrls.unshift(resolved);
        }
      } catch (e) {}
    }

    // Crawl top 2 candidate contact URLs
    for (const cUrl of candidateUrls.slice(0, 2)) {
      try {
        const cRes = await fetch(cUrl, {
          headers: browserHeaders,
          signal: AbortSignal.timeout(3000),
          redirect: 'follow'
        });
        if (cRes.ok) {
          const cHtml = await cRes.text();
          if (!result.email) {
            const cEmails = extractEmailsFromHtml(cHtml);
            if (cEmails.length > 0) {
              const prioritized = cEmails.find(e => /^(info|contact|support|sales|hello|enquiry|admin|office|help)@/i.test(e));
              result.email = prioritized || cEmails[0];
            }
          }
          const cSocials = extractSocialsFromHtml(cHtml);
          if (!result.instagram && cSocials.instagram) result.instagram = cSocials.instagram;
          if (!result.facebook && cSocials.facebook) result.facebook = cSocials.facebook;
          if (!result.linkedin && cSocials.linkedin) result.linkedin = cSocials.linkedin;

          if (result.email && result.instagram) break;
        }
      } catch (err) {}
    }
  } catch (err) {}

  return result;
}

/**
 * Free search snippet dorking via DuckDuckGo Lite for leads without website
 */
export async function searchContactsViaDorking(businessName, location = '') {
  const result = {
    email: null,
    instagram: null,
    facebook: null,
    linkedin: null
  };

  if (!businessName) return result;

  try {
    const cleanName = businessName.replace(/[^\w\s]/gi, ' ').trim();
    const cleanLoc = (location || '').replace(/[^\w\s]/gi, ' ').trim();
    const query = `${cleanName} ${cleanLoc} instagram facebook contact email`;

    const res = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      body: new URLSearchParams({ q: query }),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return result;
    const html = await res.text();

    // 1. Check for email in search results
    const emails = extractEmailsFromHtml(html);
    if (emails.length > 0) {
      const filtered = emails.filter(e => !e.includes('duckduckgo') && !e.includes('google'));
      if (filtered.length > 0) result.email = filtered[0];
    }

    // 2. Check for socials in search results links
    const socials = extractSocialsFromHtml(html);
    result.instagram = socials.instagram;
    result.facebook = socials.facebook;
    result.linkedin = socials.linkedin;

    // 3. If website is discovered from links, crawl it
    const linkMatches = [...html.matchAll(/href=["'](https?:\/\/[^"'\s]+)["']/gi)];
    const discoveredUrls = linkMatches
      .map(m => m[1])
      .filter(u => u && !u.includes('duckduckgo.com') && !u.includes('bing.com'));

    for (const dUrl of discoveredUrls.slice(0, 2)) {
      try {
        const parsedUrl = new URL(dUrl);
        const isAggregator = AGGREGATOR_DOMAINS.some(ag => parsedUrl.hostname.includes(ag));
        if (!isAggregator) {
          const siteContacts = await crawlWebsiteForContacts(parsedUrl.origin);
          if (!result.email && siteContacts.email) result.email = siteContacts.email;
          if (!result.instagram && siteContacts.instagram) result.instagram = siteContacts.instagram;
          if (!result.facebook && siteContacts.facebook) result.facebook = siteContacts.facebook;
          if (!result.linkedin && siteContacts.linkedin) result.linkedin = siteContacts.linkedin;
          if (result.email || result.instagram) break;
        }
      } catch (e) {}
    }
  } catch (err) {}

  return result;
}

/**
 * Main enrichment method: extracts Email, Instagram, Facebook, and LinkedIn
 */
export async function findLeadContacts(lead) {
  let contacts = {
    email: null,
    instagram: null,
    facebook: null,
    linkedin: null
  };

  // 1. Try website crawling first if website is provided
  if (lead.website && lead.website.trim() !== '' && lead.website !== 'None') {
    contacts = await crawlWebsiteForContacts(lead.website);
  }

  // 2. Fallback to search dorking if email or instagram is still missing
  if ((!contacts.email || !contacts.instagram) && lead.name) {
    const dorked = await searchContactsViaDorking(lead.name, lead.address || '');
    if (!contacts.email && dorked.email) contacts.email = dorked.email;
    if (!contacts.instagram && dorked.instagram) contacts.instagram = dorked.instagram;
    if (!contacts.facebook && dorked.facebook) contacts.facebook = dorked.facebook;
    if (!contacts.linkedin && dorked.linkedin) contacts.linkedin = dorked.linkedin;
  }

  return contacts;
}

/**
 * Backward-compatible helper returning just email
 */
export async function findLeadEmail(lead) {
  const contacts = await findLeadContacts(lead);
  return contacts.email || null;
}
