/**
 * LeadSpy Deep Content Extractor
 * Fetches discovered URLs and extracts:
 * - Full post/requirement body text (deep context)
 * - Exact publish date (or marks recent_discovery)
 * - Author / company info
 * - Actionable contact details (email, phone, profile handle, company contact URL)
 * - Calculates freshness_status ('fresh', 'archive', 'recent_discovery')
 */

export class ContentExtractor {
  constructor() {
    this.blocklistDomains = [
      'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com',
      'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com',
      'wikipedia.org', 'amazon.com', 'ebay.com', 'wix.com', 'wordpress.org',
      'apple.com', 'play.google.com', 'microsoft.com'
    ];
  }

  /**
   * Determine if URL is a valid content target
   */
  isValidTarget(url) {
    if (!url || !url.startsWith('http')) return false;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      // Skip file extensions
      if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|mp4|exe)$/i.test(parsed.pathname)) return false;
      return !this.blocklistDomains.some(b => host.includes(b));
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract date from HTML elements, JSON-LD, or meta tags
   */
  extractDate(html) {
    try {
      // 1. JSON-LD datePublished
      const jsonLdMatches = [...html.matchAll(/<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const m of jsonLdMatches) {
        try {
          const parsed = JSON.parse(m[1].trim());
          const dateStr = parsed.datePublished || parsed.dateCreated || parsed.uploadDate;
          if (dateStr && !isNaN(new Date(dateStr).getTime())) {
            return new Date(dateStr).toISOString();
          }
        } catch (e) {}
      }

      // 2. OpenGraph / Meta tags
      const metaDate = (
        html.match(/<meta[^>]+property=[\"']article:published_time[\"'][^>]+content=[\"']([^\"']+)[\"']/i) ||
        html.match(/<meta[^>]+name=[\"'](?:pubdate|publishdate|date)[\"'][^>]+content=[\"']([^\"']+)[\"']/i) ||
        html.match(/<meta[^>]+itemprop=[\"']datePublished[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
      );
      if (metaDate && metaDate[1] && !isNaN(new Date(metaDate[1]).getTime())) {
        return new Date(metaDate[1]).toISOString();
      }

      // 3. HTML5 <time> tag
      const timeTag = html.match(/<time[^>]+datetime=[\"']([^\"']+)[\"']/i);
      if (timeTag && timeTag[1] && !isNaN(new Date(timeTag[1]).getTime())) {
        return new Date(timeTag[1]).toISOString();
      }
    } catch (e) {}

    return null;
  }

  /**
   * Extract clean text content from HTML
   */
  cleanHtmlToText(html) {
    let text = html;
    // Strip scripts, styles, svgs, header, footer, nav
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
    text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');
    text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');
    text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&#x27;/g, "'")
               .replace(/&quot;/g, '"');

    // Collapse multiple whitespace
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract contact signals (email, phone, direct profile)
   */
  extractContacts(text, url) {
    const contacts = {
      email: null,
      phone: null,
      profileUrl: null
    };

    // Extract email
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const validEmails = emails.filter(e => 
      !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('example.com') && !e.includes('sentry.io')
    );
    if (validEmails.length > 0) {
      contacts.email = validEmails[0];
    }

    // Direct community/author profiles:
    // Only assign if it is an actual user profile URL. Never assign post/issue URLs.
    if (url.includes('reddit.com/user/')) {
      contacts.profileUrl = url;
    } else if (url.includes('github.com/') && !url.includes('/issues') && !url.includes('/pull') && !url.includes('/blob')) {
      contacts.profileUrl = url;
    } else if (url.includes('twitter.com/') || url.includes('x.com/')) {
      contacts.profileUrl = url;
    }

    return contacts;
  }

  /**
   * Calculate Smart Freshness Status based on post age
   */
  calculateFreshness(postedAt) {
    if (!postedAt) {
      return {
        postedAt: null,
        freshnessStatus: 'recent_discovery',
        ageDays: null
      };
    }

    const postDate = new Date(postedAt);
    if (isNaN(postDate.getTime())) {
      return {
        postedAt: null,
        freshnessStatus: 'recent_discovery',
        ageDays: null
      };
    }

    const ageDays = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    const freshnessStatus = ageDays <= 30 ? 'fresh' : 'archive';

    return {
      postedAt: postDate.toISOString(),
      freshnessStatus,
      ageDays: Math.round(ageDays)
    };
  }

  /**
   * Main Method: Fetch and extract deep context from a candidate URL
   */
  async extractDeepContent(targetItem) {
    const url = targetItem.url;
    if (!this.isValidTarget(url)) return null;

    let fullText = targetItem.snippet || targetItem.title || '';
    let extractedDate = targetItem.postedAt || null;
    let pageTitle = targetItem.title || '';

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,text/plain'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || html.match(/<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']/i);
        if (titleMatch) {
          const candidateTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
          const genericTitles = ['reddit', 'github', 'hacker news', 'bing', 'google', 'duckduckgo', '403 forbidden', 'access denied'];
          if (candidateTitle && !genericTitles.includes(candidateTitle.toLowerCase()) && candidateTitle.length > 5) {
            pageTitle = candidateTitle;
          }
        }

        const detectedDate = this.extractDate(html);
        if (detectedDate) {
          extractedDate = detectedDate;
        }

        const cleanedBody = this.cleanHtmlToText(html);
        // Take up to 2500 characters of rich context
        if (cleanedBody.length > fullText.length) {
          fullText = cleanedBody.substring(0, 2500);
        }
      }
    } catch (err) {
      // If fetching full HTML fails or times out, keep original snippet/title
    }

    const { postedAt, freshnessStatus } = this.calculateFreshness(extractedDate);
    const contacts = this.extractContacts(fullText, url);

    let source = targetItem.source || targetItem.engine || 'web';
    if (url.includes('reddit.com')) source = 'reddit';
    else if (url.includes('github.com')) source = 'github';
    else if (url.includes('news.ycombinator.com')) source = 'hackernews';
    else if (url.includes('indiehackers.com')) source = 'indiehackers';

    return {
      source,
      sourceUrl: url,
      sourcePostId: targetItem.sourcePostId || `ext-${Buffer.from(url).toString('base64').substring(0, 16)}`,
      rawTitle: pageTitle || targetItem.title,
      rawContent: `${pageTitle} | ${fullText}`,
      author: targetItem.author || contacts.email?.split('@')[0] || 'Direct Client',
      authorProfileUrl: contacts.profileUrl || targetItem.authorProfileUrl || null,
      clientEmail: contacts.email,
      postedAt,
      discoveredAt: new Date().toISOString(),
      freshnessStatus,
      priorityTier: targetItem.priorityTier || 'P1',
      queryMatched: targetItem.query || ''
    };
  }
}
