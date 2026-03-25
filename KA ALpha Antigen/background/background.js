// ============================================================
// KA Alpha Antigen — Background Service Worker
// "No Contact Left Behind" — Multi-Layered Extraction Engine
// ============================================================

// --------------- CONFIG ---------------
const CONFIG = {
  // API Keys — Replace with your actual keys
  APOLLO_API_KEY: '',
  HUNTER_API_KEY: '',
  ROCKETREACH_API_KEY: '',
  GOOGLE_CSE_API_KEY: '',
  GOOGLE_CSE_CX: '',
};

// Target social platforms for link hunting
const TARGET_SITES = [
  { name: 'LinkedIn', domain: 'linkedin.com/company/', icon: '💼' },
  { name: 'LinkedIn Personal', domain: 'linkedin.com/in/', icon: '👤' },
  { name: 'Facebook', domain: 'facebook.com/', icon: '📘' },
  { name: 'Instagram', domain: 'instagram.com/', icon: '📸' },
  { name: 'Twitter/X', domain: 'twitter.com/', icon: '🐦' },
  { name: 'X', domain: 'x.com/', icon: '✖️' },
  { name: 'YouTube', domain: 'youtube.com/', icon: '📺' },
  { name: 'TikTok', domain: 'tiktok.com/@', icon: '🎵' },
];

// Pages to crawl on company website
const CRAWL_PAGES = ['contact', 'about', 'team', 'privacy', 'terms', 'legal', 'imprint'];

// Email domain blocklist for filtering false positives
const EMAIL_BLOCKLIST = [
  'example.com', 'test.com', 'wixpress.com', 'sentry.io',
  'noreply@', 'no-reply@', 'donotreply@', 'notification@',
];

// --------------- MESSAGE HANDLER ---------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'huntContacts') {
    const companyName = String(request.companyName || '').trim();
    const websiteUrl = String(request.websiteUrl || '').trim();
    
    if (!companyName) {
      sendResponse({ success: false, error: 'Company name is required' });
      return true;
    }
    
    huntAllContacts(companyName, websiteUrl)
      .then(report => {
        // Store the report
        chrome.storage.local.set({ 
          [`report_${Date.now()}`]: report, 
          latestReport: report 
        });
        sendResponse({ success: true, report });
      })
      .catch(err => {
        console.error('Hunt error:', err);
        sendResponse({ success: false, error: String(err.message || 'Unknown error') });
      });
    return true; // async response
  }

  if (request.action === 'tabBlast') {
    if (Array.isArray(request.links)) {
      launchAllContacts(request.links);
    }
    sendResponse({ success: true });
  }

  if (request.action === 'getLatestReport') {
    chrome.storage.local.get('latestReport', (data) => {
      sendResponse({ report: data.latestReport || null });
    });
    return true;
  }

  if (request.action === 'openSidePanel') {
    if (sender.tab?.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }
    sendResponse({ success: true });
  }

  if (request.action === 'saveApiKeys') {
    const keysToSave = request.keys || {};
    Object.assign(CONFIG, keysToSave);
    chrome.storage.local.set({ apiKeys: keysToSave });
    sendResponse({ success: true });
  }

  if (request.action === 'getApiKeys') {
    chrome.storage.local.get('apiKeys', (data) => {
      sendResponse({ keys: data.apiKeys || {} });
    });
    return true;
  }

  if (request.action === 'getHistory') {
    chrome.storage.local.get(null, (data) => {
      const reports = Object.entries(data || {})
        .filter(([key]) => key.startsWith('report_'))
        .map(([key, value]) => {
          try {
            return { id: key, ...(value || {}) };
          } catch (e) {
            return { id: key, error: 'Invalid report' };
          }
        })
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      sendResponse({ reports });
    });
    return true;
  }

  if (request.action === 'deleteReport') {
    if (request.reportId) {
      chrome.storage.local.remove(request.reportId);
    }
    sendResponse({ success: true });
  }

  if (request.action === 'exportReport') {
    sendResponse({ success: true }); // export handled in UI
  }
});

// Load saved API keys on startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('apiKeys', (data) => {
    if (data?.apiKeys && typeof data.apiKeys === 'object') {
      Object.assign(CONFIG, data.apiKeys);
    }
  });
});

// --------------- MAIN HUNT FUNCTION ---------------
async function huntAllContacts(companyName, websiteUrl) {
  try {
    const report = {
      companyName: String(companyName || '').trim(),
      websiteUrl: String(websiteUrl || '').trim(),
      timestamp: Date.now(),
      official: { website: websiteUrl || '', headquarters: '', yearFounded: '', industry: '' },
      people: [],
      directContact: { emails: [], phones: [] },
      socialLinks: {},
      activity: { lastPost: '', techStack: [] },
      allLinks: [],
      status: 'scanning',
      layers: { social: 'pending', website: 'pending', api: 'pending' },
    };

    // Broadcast scanning status
    broadcastUpdate(report);

    // --- LAYER 1: Social Media Ecosystem ---
    try {
      report.layers.social = 'scanning';
      broadcastUpdate(report);
      const socialLinks = await findSocialMediaLinks(report.companyName);
      report.socialLinks = socialLinks || {};
      report.layers.social = 'complete';
    } catch (e) {
      report.layers.social = 'error';
      console.error('Layer 1 Error:', e.message);
    }
    broadcastUpdate(report);

    // --- LAYER 2: Website Deep Crawler ---
    if (report.websiteUrl) {
      try {
        report.layers.website = 'scanning';
        broadcastUpdate(report);
        const websiteData = await crawlWebsite(report.websiteUrl);
        report.directContact.emails.push(...(websiteData.emails || []));
        report.directContact.phones.push(...(websiteData.phones || []));
        report.people.push(...(websiteData.people || []));
        if (websiteData.headquarters) report.official.headquarters = websiteData.headquarters;
        if (websiteData.yearFounded) report.official.yearFounded = websiteData.yearFounded;
        report.activity.techStack = websiteData.techStack || [];
        report.layers.website = 'complete';
      } catch (e) {
        report.layers.website = 'error';
        console.error('Layer 2 Error:', e.message);
      }
    } else {
      // Attempt to auto-discover official domain
      try {
        report.layers.website = 'scanning';
        broadcastUpdate(report);
        const discoveredUrl = await domainGuess(report.companyName);
        
        if (discoveredUrl) {
          report.websiteUrl = discoveredUrl;
          
          const websiteData = await crawlWebsite(discoveredUrl);
          report.directContact.emails.push(...(websiteData.emails || []));
          report.directContact.phones.push(...(websiteData.phones || []));
          report.people.push(...(websiteData.people || []));
          if (websiteData.headquarters) report.official.headquarters = websiteData.headquarters;
          if (websiteData.yearFounded) report.official.yearFounded = websiteData.yearFounded;
          report.activity.techStack = websiteData.techStack || [];
          report.layers.website = 'complete';
        } else {
          report.layers.website = 'error';
          report.layerNotes = { website: 'Website URL not provided and auto-discovery failed. Layer 3 APIs may still find contacts.' };
        }
      } catch (e) {
        report.layers.website = 'error';
        report.layerNotes = { website: `Website discovery error: ${e.message}` };
        console.error('Layer 2 Auto-Discovery Error:', e.message);
      }
    }
    broadcastUpdate(report);

    // --- LAYER 3: API Power (Apollo/Hunter/RocketReach) ---
    try {
      report.layers.api = 'scanning';
      broadcastUpdate(report);
      const apiData = await queryAPIs(report.companyName, report.websiteUrl);
      report.directContact.emails.push(...(apiData.emails || []));
      report.directContact.phones.push(...(apiData.phones || []));
      report.people.push(...(apiData.people || []));
      if (apiData.official && typeof apiData.official === 'object') {
        Object.assign(report.official, apiData.official);
      }
      report.layers.api = 'complete';
    } catch (e) {
      report.layers.api = 'error';
      console.error('Layer 3 Error:', e.message);
    }

    // Deduplicate
    report.directContact.emails = [...new Set((report.directContact.emails || []).filter(Boolean).map(e => String(e).toLowerCase())))];
    report.directContact.phones = [...new Set((report.directContact.phones || []).filter(Boolean))];
    report.people = deduplicatePeople(report.people || []);

    // Compile all links for Tab Blast
    report.allLinks = compileAllLinks(report);
    report.status = 'complete';

    broadcastUpdate(report);
    
    // Auto-upload to Google Sheets (non-blocking)
    uploadToSheet(report).catch(err => console.warn('Upload to Sheets failed:', err.message));
    
    return report;
  } catch (error) {
    console.error('Fatal error in huntAllContacts:', error);
    throw error;
  }
}

// --------------- RETRY WITH EXPONENTIAL BACKOFF ---------------
async function retryFetch(url, options, maxAttempts = 3, taskName = 'Fetch', expectedStatuses = [200]) {
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid URL for ${taskName}: ${url}`);
  }

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),  // 15 second timeout per attempt
      });
      
      if (expectedStatuses.includes(response.status)) {
        console.log(`✅ ${taskName} successful (attempt ${attempt}/${maxAttempts})`);
        return response;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      lastError = error;
      console.warn(`${taskName} attempt ${attempt}/${maxAttempts} failed:`, String(error.message || error));
      
      if (attempt < maxAttempts) {
        // Exponential backoff: 2s, 5s, 10s
        const delays = [2000, 5000, 10000];
        const delay = delays[attempt - 1] || 10000;
        console.log(`  Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ ${taskName} failed after ${maxAttempts} attempts:`, String(lastError?.message || lastError));
  throw lastError;
}

// --------------- UPLOAD TO GOOGLE SHEETS ---------------
async function uploadToSheet(report) {
  try {
    // Get stored Google Apps Script URL
    const storage = await chrome.storage.local.get('SHEET_SCRIPT_URL');
    const scriptUrl = storage?.SHEET_SCRIPT_URL;
    
    if (!scriptUrl) {
      console.log('ℹ️ No Google Apps Script URL configured. Skipping sheet upload.');
      return;
    }
    
    if (typeof scriptUrl !== 'string' || !scriptUrl.startsWith('http')) {
      console.warn('Invalid Google Apps Script URL');
      return;
    }
    
    // Format data for sheet upload
    const payload = {
      companyName: String(report.companyName || '').trim(),
      websiteUrl: String(report.websiteUrl || '').trim(),
      emails: Array.isArray(report.directContact?.emails) ? report.directContact.emails.join(', ') : '',
      phones: Array.isArray(report.directContact?.phones) ? report.directContact.phones.join(', ') : '',
      linkedin: String(report.socialLinks?.LinkedIn?.url || '').trim(),
      facebook: String(report.socialLinks?.Facebook?.url || '').trim(),
      instagram: String(report.socialLinks?.Instagram?.url || '').trim(),
      twitter: String(report.socialLinks?.['Twitter/X']?.url || '').trim(),
      youtube: String(report.socialLinks?.YouTube?.url || '').trim(),
      tiktok: String(report.socialLinks?.TikTok?.url || '').trim(),
      people: Array.isArray(report.people) ? report.people.map(p => `${p.name || ''}${p.title ? ' (' + p.title + ')' : ''}`).join(' | ') : '',
      industry: String(report.official?.industry || '').trim(),
      headquarters: String(report.official?.headquarters || '').trim(),
      yearFounded: String(report.official?.yearFounded || '').trim(),
      employeeCount: String(report.official?.employeeCount || '').trim(),
      revenue: String(report.official?.revenue || '').trim(),
      techStack: Array.isArray(report.activity?.techStack) ? report.activity.techStack.join(', ') : '',
    };
    
    // Upload with retry logic (3 attempts with exponential backoff)
    return await retryFetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }, 3, 'Google Sheets upload', [200, 201]);
    
  } catch (error) {
    console.error('Error in uploadToSheet:', String(error.message || error));
  }
}

// --------------- WEBSITE AUTO-DISCOVERY ---------------
async function domainGuess(companyName) {
  if (!companyName || typeof companyName !== 'string') {
    console.warn('Invalid company name for domain guess');
    return null;
  }

  const cleanName = String(companyName).toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
  const dashName = String(companyName).toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '');
  
  // Try common domain variations
  const candidates = [
    `${cleanName}.com`,
    `${dashName}.com`,
    `${cleanName}.co`,
    `${dashName}.co`,
    `${cleanName}.io`,
    `${dashName}.io`,
    `${cleanName}.net`,
    `${dashName}.net`,
    `${cleanName}.org`,
    `${dashName}.org`,
  ];
  
  // Test each candidate
  for (const domain of candidates) {
    try {
      const url = `https://${domain}`;
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (KAAlphaAntigen/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok || response.status === 301 || response.status === 302) {
        console.log(`✅ Domain guessed: ${domain}`);
        return url;
      }
    } catch (e) {
      // Domain doesn't resolve, continue to next
    }
  }
  
  console.log(`⚠️ Could not auto-discover domain for "${companyName}"`);
  return null;
}

// --------------- LAYER 1: Social Media Link Discovery ---------------
async function findSocialMediaLinks(companyName) {
  const results = {};

  if (!companyName || typeof companyName !== 'string') {
    console.warn('Invalid company name for social media search');
    return results;
  }

  // Method A: Google Custom Search API
  if (CONFIG.GOOGLE_CSE_API_KEY && CONFIG.GOOGLE_CSE_CX) {
    for (const site of TARGET_SITES) {
      try {
        const query = encodeURIComponent(`"${String(companyName)}" site:${site.domain}`);
        const url = `https://www.googleapis.com/customsearch/v1?key=${CONFIG.GOOGLE_CSE_API_KEY}&cx=${CONFIG.GOOGLE_CSE_CX}&q=${query}&num=3`;
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const data = await response.json();

        if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
          const firstItem = data.items[0];
          results[site.name] = {
            url: String(firstItem.link || ''),
            title: String(firstItem.title || ''),
            snippet: String(firstItem.snippet || ''),
            icon: site.icon,
          };
        }
      } catch (e) {
        console.warn(`CSE search failed for ${site.name}:`, String(e.message || e));
      }
    }
  }

  // Method B: Construct likely URLs as fallback
  const cleanName = String(companyName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const dashName = String(companyName).toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (!results['LinkedIn']) {
    results['LinkedIn'] = {
      url: `https://www.linkedin.com/company/${cleanName}`,
      title: `${companyName} on LinkedIn`,
      icon: '💼',
      guessed: true,
    };
  }
  if (!results['Facebook']) {
    results['Facebook'] = {
      url: `https://www.facebook.com/${cleanName}`,
      title: `${companyName} on Facebook`,
      icon: '📘',
      guessed: true,
    };
  }
  if (!results['Instagram']) {
    results['Instagram'] = {
      url: `https://www.instagram.com/${cleanName}`,
      title: `${companyName} on Instagram`,
      icon: '📸',
      guessed: true,
    };
  }
  if (!results['Twitter/X']) {
    results['Twitter/X'] = {
      url: `https://twitter.com/${cleanName}`,
      title: `${companyName} on X`,
      icon: '🐦',
      guessed: true,
    };
  }
  if (!results['YouTube']) {
    results['YouTube'] = {
      url: `https://www.youtube.com/@${cleanName}`,
      title: `${companyName} on YouTube`,
      icon: '📺',
      guessed: true,
    };
  }
  if (!results['TikTok']) {
    results['TikTok'] = {
      url: `https://www.tiktok.com/@${cleanName}`,
      title: `${companyName} on TikTok`,
      icon: '🎵',
      guessed: true,
    };
  }

  return results;
}

// --------------- LAYER 2: Website Deep Crawler ---------------
async function crawlWebsite(baseUrl) {
  const result = {
    emails: [],
    phones: [],
    people: [],
    headquarters: '',
    yearFounded: '',
    techStack: [],
  };

  if (!baseUrl || typeof baseUrl !== 'string') {
    console.warn('Invalid base URL for website crawling');
    return result;
  }

  // Normalize URL
  let normalizedUrl = String(baseUrl).trim();
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  let urlObj;
  try {
    urlObj = new URL(normalizedUrl);
  } catch (e) {
    console.error('Invalid URL:', normalizedUrl, String(e.message || e));
    return result;
  }

  const baseDomain = urlObj.origin;

  // Pages to scan
  const pagesToScan = [
    normalizedUrl,
    ...CRAWL_PAGES.map(p => `${baseDomain}/${p}`),
    `${baseDomain}/contact-us`,
    `${baseDomain}/about-us`,
    `${baseDomain}/our-team`,
    `${baseDomain}/privacy-policy`,
    `${baseDomain}/terms-of-service`,
  ];

  for (const pageUrl of pagesToScan) {
    try {
      const response = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KAAlphaAntigen/1.0)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) continue;

      const html = await response.text();
      if (!html || typeof html !== 'string') continue;

      // Enhanced email extraction with better filtering
      const emailMatches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
      if (emailMatches && Array.isArray(emailMatches)) {
        const validEmails = emailMatches.filter(e => {
          // Filter out generic/no-reply addresses
          const lowerEmail = String(e || '').toLowerCase();
          
          // Check if ends with image extension (false positive)
          if (lowerEmail.endsWith('.png') || lowerEmail.endsWith('.jpg') || lowerEmail.endsWith('.gif')) return false;
          
          // Check blocklist
          if (EMAIL_BLOCKLIST.some(b => lowerEmail.includes(b))) return false;
          
          return true;
        });
        result.emails.push(...validEmails);
      }

      // Enhanced phone number extraction with international formats
      const phonePatterns = [
        /(?:\+\d{1,3}[\s\-]?)?\(?(\d{2,4})\)?[\s\-\.]?(\d{3,4})[\s\-\.]?(\d{3,4})/g,  // International format
        /\+1[\s\-]?\(?(\d{3})\)?[\s\-]?(\d{3})[\s\-]?(\d{4})/g,  // US/Canada +1
        /\+44[\s\-]?(\d{1,4})[\s\-]?(\d{3,4})[\s\-]?(\d{3,4})/g,  // UK +44
      ];
      
      for (const pattern of phonePatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const fullNumber = String(match[0] || '');
          const digitCount = fullNumber.replace(/\D/g, '').length;
          // Accept phone numbers with 7-15 digits
          if (digitCount >= 7 && digitCount <= 15) {
            result.phones.push(fullNumber);
          }
        }
      }

      // Extract people/team names from structured data (JSON-LD)
      const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches && Array.isArray(jsonLdMatches)) {
        for (const match of jsonLdMatches) {
          try {
            const content = String(match || '').replace(/<\/?script[^>]*>/gi, '');
            const jsonData = JSON.parse(content);
            
            // Extract people from various schema types
            extractPeopleFromSchema(jsonData, result.people);
            
            // Extract headquarters/location info
            if (jsonData?.foundingDate) result.yearFounded = String(jsonData.foundingDate);
            if (jsonData?.address) {
              const addr = typeof jsonData.address === 'string' ? String(jsonData.address) : 
                [jsonData.address?.streetAddress, jsonData.address?.addressLocality, jsonData.address?.addressCountry].filter(Boolean).join(', ');
              if (!result.headquarters && addr) result.headquarters = addr;
            }
            
            // Extract founder/CEO information
            if (jsonData?.founder) {
              const founders = Array.isArray(jsonData.founder) ? jsonData.founder : [jsonData.founder];
              for (const founder of founders) {
                if (founder && typeof founder === 'object') {
                  result.people.push({
                    name: String(founder.name || ''),
                    title: 'Founder',
                    email: String(founder.email || ''),
                    phone: String(founder.telephone || ''),
                  });
                }
              }
            }
          } catch (e) { 
            console.debug('JSON-LD parse error:', String(e.message || e));
          }
        }
      }

      // Detect tech stack
      if (html.includes('Shopify.theme')) result.techStack.push('Shopify');
      if (html.includes('woocommerce')) result.techStack.push('WooCommerce');
      if (html.includes('wp-content')) result.techStack.push('WordPress');
      if (html.includes('amazon.com/dp') || html.includes('amzn.to')) result.techStack.push('Amazon');
      if (html.includes('squarespace')) result.techStack.push('Squarespace');
      if (html.includes('wix.com')) result.techStack.push('Wix');
      if (html.includes('bigcommerce')) result.techStack.push('BigCommerce');
      if (html.includes('magento')) result.techStack.push('Magento');
      if (html.includes('_next/')) result.techStack.push('Next.js');
      if (html.includes('__nuxt')) result.techStack.push('Nuxt.js');
      if (html.includes('gatsby')) result.techStack.push('Gatsby');
      if (html.includes('react')) result.techStack.push('React');
      if (html.includes('vue')) result.techStack.push('Vue.js');
      if (html.includes('angular')) result.techStack.push('Angular');

    } catch (e) {
      // Page not accessible, skip
      console.debug(`Failed to crawl ${pageUrl}:`, String(e.message || e));
    }
  }

  // Deduplicate and clean results
  result.emails = [...new Set(result.emails.filter(Boolean).map(e => String(e).toLowerCase()))];
  result.phones = [...new Set(result.phones.filter(Boolean))];
  result.techStack = [...new Set(result.techStack.filter(Boolean))];
  
  return result;
}

function extractPeopleFromSchema(data, people) {
  if (Array.isArray(data)) {
    data.forEach(item => extractPeopleFromSchema(item, people));
    return;
  }
  if (data && typeof data === 'object') {
    if (data['@type'] === 'Person' || data['@type'] === 'Employee') {
      people.push({
        name: String(data.name || ''),
        title: String(data.jobTitle || data.roleName || ''),
        email: String(data.email || ''),
        phone: String(data.telephone || ''),
      });
    }
    if (data.founder) extractPeopleFromSchema(data.founder, people);
    if (data.employee) extractPeopleFromSchema(data.employee, people);
    if (data.member) extractPeopleFromSchema(data.member, people);
  }
}

// --------------- LAYER 3: API Power ---------------
async function queryAPIs(companyName, websiteUrl) {
  const result = { emails: [], phones: [], people: [], official: {} };

  if (!companyName || typeof companyName !== 'string') {
    console.warn('Invalid company name for API queries');
    return result;
  }

  // Apollo.io API
  if (CONFIG.APOLLO_API_KEY && typeof CONFIG.APOLLO_API_KEY === 'string') {
    try {
      let domain = '';
      if (websiteUrl && typeof websiteUrl === 'string') {
        try {
          const url = String(websiteUrl).startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
          domain = new URL(url).hostname;
        } catch (e) {
          console.debug('Failed to parse website URL for Apollo:', String(e.message || e));
        }
      }
      
      // Search organization
      const orgRes = await fetch('https://api.apollo.io/v1/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ api_key: CONFIG.APOLLO_API_KEY, domain }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!orgRes.ok) throw new Error(`HTTP ${orgRes.status}`);
      
      const orgData = await orgRes.json();

      if (orgData?.organization && typeof orgData.organization === 'object') {
        const org = orgData.organization;
        result.official = {
          website: String(org.website_url || ''),
          headquarters: [org.city, org.state, org.country].filter(Boolean).join(', '),
          yearFounded: org.founded_year ? String(org.founded_year) : '',
          industry: String(org.industry || ''),
          employeeCount: String(org.estimated_num_employees || ''),
          revenue: String(org.annual_revenue_printed || ''),
        };
        if (org.phone) result.phones.push(String(org.phone));
      }

      // Search people at company
      const peopleRes = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: CONFIG.APOLLO_API_KEY,
          q_organization_name: String(companyName),
          page: 1,
          per_page: 10,
          person_titles: ['CEO', 'Director', 'Founder', 'Owner', 'Managing Director', 'CTO', 'CFO'],
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!peopleRes.ok) throw new Error(`HTTP ${peopleRes.status}`);
      
      const peopleData = await peopleRes.json();

      if (peopleData?.people && Array.isArray(peopleData.people)) {
        for (const person of peopleData.people) {
          if (person && typeof person === 'object') {
            result.people.push({
              name: String(person.name || ''),
              title: String(person.title || ''),
              email: String(person.email || ''),
              phone: person.phone_numbers?.[0]?.sanitized_number ? String(person.phone_numbers[0].sanitized_number) : '',
              linkedin: String(person.linkedin_url || ''),
            });
            if (person.email) result.emails.push(String(person.email));
            if (person.phone_numbers && Array.isArray(person.phone_numbers)) {
              result.phones.push(...person.phone_numbers.map(p => String(p.sanitized_number || '')).filter(Boolean));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Apollo API error:', String(e.message || e));
    }
  }

  // Hunter.io API
  if (CONFIG.HUNTER_API_KEY && websiteUrl && typeof CONFIG.HUNTER_API_KEY === 'string') {
    try {
      let domain = '';
      try {
        const url = String(websiteUrl).startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
        domain = new URL(url).hostname;
      } catch (e) {
        console.debug('Failed to parse website URL for Hunter:', String(e.message || e));
        return result;
      }

      const hunterRes = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${CONFIG.HUNTER_API_KEY}&limit=10`, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (!hunterRes.ok) throw new Error(`HTTP ${hunterRes.status}`);
      
      const hunterData = await hunterRes.json();

      if (hunterData?.data?.emails && Array.isArray(hunterData.data.emails)) {
        for (const emailObj of hunterData.data.emails) {
          if (emailObj && typeof emailObj === 'object') {
            result.emails.push(String(emailObj.value || ''));
            if (emailObj.first_name || emailObj.last_name) {
              result.people.push({
                name: `${String(emailObj.first_name || '')} ${String(emailObj.last_name || '')}`.trim(),
                title: String(emailObj.position || ''),
                email: String(emailObj.value || ''),
                phone: String(emailObj.phone_number || ''),
                confidence: emailObj.confidence,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Hunter API error:', String(e.message || e));
    }
  }

  // RocketReach API
  if (CONFIG.ROCKETREACH_API_KEY && typeof CONFIG.ROCKETREACH_API_KEY === 'string') {
    try {
      const rrRes = await fetch(`https://api.rocketreach.co/api/v2/company/lookup?name=${encodeURIComponent(String(companyName))}`, {
        headers: { 'Api-Key': CONFIG.ROCKETREACH_API_KEY },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!rrRes.ok) throw new Error(`HTTP ${rrRes.status}`);
      
      const rrData = await rrRes.json();

      if (rrData?.id) {
        if (rrData.phone_numbers && Array.isArray(rrData.phone_numbers)) {
          result.phones.push(...rrData.phone_numbers.map(p => String(p || '')).filter(Boolean));
        }
        if (rrData.email_addresses && Array.isArray(rrData.email_addresses)) {
          result.emails.push(...rrData.email_addresses.map(e => String(e || '')).filter(Boolean));
        }
      }
    } catch (e) {
      console.warn('RocketReach API error:', String(e.message || e));
    }
  }

  return result;
}

// --------------- UTILITIES ---------------
function deduplicatePeople(people) {
  const seen = new Map();
  
  if (!Array.isArray(people)) {
    return [];
  }

  for (const person of people) {
    if (!person || typeof person !== 'object') continue;
    
    const key = (person.name || person.email || Math.random().toString()).toString().toLowerCase();
    if (seen.has(key)) {
      // Merge
      const existing = seen.get(key);
      existing.title = existing.title || person.title;
      existing.email = existing.email || person.email;
      existing.phone = existing.phone || person.phone;
      existing.linkedin = existing.linkedin || person.linkedin;
    } else {
      seen.set(key, { ...person });
    }
  }
  return Array.from(seen.values());
}

function compileAllLinks(report) {
  const links = [];

  if (report?.websiteUrl) {
    const baseUrl = String(report.websiteUrl).replace(/\/$/, '');
    links.push({ label: '🌐 Website', url: baseUrl });
    links.push({ label: '📞 Contact Page', url: `${baseUrl}/contact` });
    links.push({ label: 'ℹ️ About Page', url: `${baseUrl}/about` });
  }

  if (report?.socialLinks && typeof report.socialLinks === 'object') {
    for (const [platform, data] of Object.entries(report.socialLinks)) {
      if (data?.url && typeof data.url === 'string') {
        links.push({ label: `${data.icon || '🔗'} ${platform}`, url: String(data.url) });
      }
    }
  }

  if (Array.isArray(report?.people)) {
    for (const person of report.people) {
      if (person?.linkedin && typeof person.linkedin === 'string') {
        links.push({ label: `👤 ${String(person.name || 'Unknown')} (LinkedIn)`, url: String(person.linkedin) });
      }
    }
  }

  return links;
}

function broadcastUpdate(report) {
  try {
    chrome.runtime.sendMessage({ action: 'reportUpdate', report }).catch(() => {
      // Message port may not be open, ignore
    });
  } catch (e) {
    // Silently fail if unable to send message
  }
}

// --------------- TAB BLAST ---------------
function launchAllContacts(links) {
  if (!Array.isArray(links) || !links.length) return;

  // Open tabs with a slight delay between each to avoid overwhelming browser
  links.forEach((link, index) => {
    if (link?.url && typeof link.url === 'string') {
      setTimeout(() => {
        try {
          chrome.tabs.create({ url: link.url, active: index === 0 });
        } catch (e) {
          console.warn('Failed to create tab:', String(e.message || e));
        }
      }, index * 300);
    }
  });
}

// Configure side panel behavior
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
} catch (e) {
  console.debug('Side panel API not available:', String(e.message || e));
}

console.log('🧬 KA Alpha Antigen — Background Service Worker loaded');
