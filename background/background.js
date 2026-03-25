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
  SCRIPT_URL: '',
  SHEET_URL: '',
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

// --------------- MESSAGE HANDLER ---------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  if (request.action === 'huntContacts') {
    huntAllContacts(request.companyName, request.websiteUrl)
      .then(report => {
        console.log('Hunt completed successfully');
        // Store the report
        chrome.storage.local.set({ [`report_${Date.now()}`]: report, latestReport: report });
        sendResponse({ success: true, report });
      })
      .catch(err => {
        console.error('Hunt failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // async response
  }

  if (request.action === 'tabBlast') {
    launchAllContacts(request.links);
    sendResponse({ success: true });
  }

  if (request.action === 'getLatestReport') {
    chrome.storage.local.get('latestReport', (data) => {
      sendResponse({ report: data.latestReport || null });
    });
    return true;
  }

  if (request.action === 'openSidePanel') {
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
    sendResponse({ success: true });
  }

  if (request.action === 'saveApiKeys') {
    Object.assign(CONFIG, request.keys);
    chrome.storage.local.set({ apiKeys: request.keys });
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
      const reports = Object.entries(data)
        .filter(([key]) => key.startsWith('report_'))
        .map(([key, value]) => ({ id: key, ...value }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      sendResponse({ reports });
    });
    return true;
  }

  if (request.action === 'bulkHunt') {
    handleBulkHunt(request.companies || [])
      .then(results => sendResponse({ success: true, results }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'deleteReport') {
    chrome.storage.local.remove(request.reportId);
    sendResponse({ success: true });
  }

  if (request.action === 'proxyFetch') {
    fetch(request.url)
      .then(async res => {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await res.json();
            sendResponse({ success: true, data });
        } else {
            const text = await res.text();
            if (text.includes('Google Accounts') || text.includes('Sign in')) {
               sendResponse({ success: false, error: 'Authorization Required. Deploy as "Anyone" or open URL in browser to authorize.' });
            } else {
               sendResponse({ success: false, error: 'Web App returned HTML/Text. Check deployment settings.' });
            }
        }
      })
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'testScriptUrl') {
    fetch(request.url)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'uploadReport') {
    uploadToGoogleSheet(request.report)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Load saved API keys on startup AND install
function loadApiKeysFromStorage() {
  chrome.storage.local.get('apiKeys', (data) => {
    if (data.apiKeys) {
      Object.assign(CONFIG, data.apiKeys);
      console.log('✅ API Keys loaded from storage:', Object.keys(data.apiKeys).filter(k => data.apiKeys[k]));
    }
  });
}

chrome.runtime.onInstalled.addListener(loadApiKeysFromStorage);
chrome.runtime.onStartup.addListener(loadApiKeysFromStorage);
// Also load immediately when service worker activates
loadApiKeysFromStorage();

// --------------- MAIN HUNT FUNCTION ---------------
async function huntAllContacts(companyName, websiteUrl) {
  console.log('Starting hunt for:', companyName, websiteUrl);

  const report = {
    companyName,
    websiteUrl: websiteUrl || '',
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
  if (CONFIG.enableGoogleSearch !== false) {
    try {
      report.layers.social = 'scanning';
      broadcastUpdate(report);
      const socialLinks = await findSocialMediaLinks(companyName);
      report.socialLinks = socialLinks;
      report.layers.social = 'complete';
    } catch (e) {
      report.layers.social = 'error';
      console.error('Layer 1 Error:', e);
    }
  } else {
    report.socialLinks = getGuessedSocialLinks(companyName);
    report.layers.social = 'skipped';
  }
  broadcastUpdate(report);

  // --- LAYER 2: Website Deep Crawler ---
  if (CONFIG.enableLayer2 !== false) {
    if (!websiteUrl) {
      console.log('Website missing, attempting to find official domain...');
      websiteUrl = await findOfficialWebsite(companyName);
      if (websiteUrl) {
        report.websiteUrl = websiteUrl;
        report.official.website = websiteUrl;
      }
    }

    if (websiteUrl) {
      try {
        report.layers.website = 'scanning';
        broadcastUpdate(report);
        const websiteData = await crawlWebsite(websiteUrl);
        report.directContact.emails.push(...websiteData.emails);
        report.directContact.phones.push(...websiteData.phones);
        report.people.push(...websiteData.people);
        if (websiteData.headquarters) report.official.headquarters = websiteData.headquarters;
        if (websiteData.yearFounded) report.official.yearFounded = websiteData.yearFounded;
        report.activity.techStack = websiteData.techStack || [];
      
        // Merge social links found on website
        if (websiteData.socialLinks) {
          Object.entries(websiteData.socialLinks).forEach(([platform, url]) => {
            if (!report.socialLinks[platform] || report.socialLinks[platform].guessed) {
              report.socialLinks[platform] = {
                url: url,
                title: `${platform} found on website`,
                icon: report.socialLinks[platform]?.icon || '🔗',
                verified: true
              };
            }
          });
        }
      
        report.layers.website = 'complete';
      } catch (e) {
        report.layers.website = 'error';
        console.error('Layer 2 Error:', e);
      }
    } else {
      report.layers.website = 'skipped';
    }
  } else {
    report.layers.website = 'skipped';
  }
  broadcastUpdate(report);

  // --- LAYER 3: API Power (Apollo/Hunter/RocketReach) ---
  const apisAvailable = (CONFIG.enableApollo !== false && CONFIG.APOLLO_API_KEY) || 
                       (CONFIG.enableHunter !== false && CONFIG.HUNTER_API_KEY) || 
                       (CONFIG.enableRocketReach !== false && CONFIG.ROCKETREACH_API_KEY);

  if (apisAvailable) {
    try {
      report.layers.api = 'scanning';
      broadcastUpdate(report);
      const apiData = await queryAPIs(companyName, websiteUrl);
      report.directContact.emails.push(...apiData.emails);
      report.directContact.phones.push(...apiData.phones);
      report.people.push(...apiData.people);
      if (apiData.official) {
        Object.assign(report.official, apiData.official);
      }
      report.layers.api = 'complete';
    } catch (e) {
      report.layers.api = 'error';
      console.error('Layer 3 Error:', e);
    }
  } else {
    report.layers.api = 'skipped';
  }


  // Deduplicate
  report.directContact.emails = [...new Set(report.directContact.emails.filter(Boolean))];
  report.directContact.phones = [...new Set(report.directContact.phones.filter(Boolean))];
  report.people = deduplicatePeople(report.people);

  // Compile all links for Tab Blast
  report.allLinks = compileAllLinks(report);
  report.status = 'complete';

  // AUTOMATIC UPLOAD: Send to Google Sheets if URL is configured and enabled
  if (CONFIG.SCRIPT_URL && CONFIG.enableAutoSheets !== false) {
    uploadToGoogleSheet(report);
  }

  broadcastUpdate(report);
  return report;
}

// --------------- LAYER 1: Social Media Link Discovery ---------------
function getGuessedSocialLinks(companyName) {
  const results = {};
  const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');

  results['LinkedIn'] = {
    url: `https://www.linkedin.com/company/${cleanName}`,
    title: `${companyName} on LinkedIn`,
    icon: '💼',
    guessed: true,
  };
  results['Facebook'] = {
    url: `https://www.facebook.com/${cleanName}`,
    title: `${companyName} on Facebook`,
    icon: '📘',
    guessed: true,
  };
  results['Instagram'] = {
    url: `https://www.instagram.com/${cleanName}`,
    title: `${companyName} on Instagram`,
    icon: '📸',
    guessed: true,
  };
  results['Twitter/X'] = {
    url: `https://twitter.com/${cleanName}`,
    title: `${companyName} on X`,
    icon: '🐦',
    guessed: true,
  };
  results['YouTube'] = {
    url: `https://youtube.com/@${cleanName}`,
    title: `${companyName} on YouTube`,
    icon: '📺',
    guessed: true,
  };
  results['TikTok'] = {
    url: `https://www.tiktok.com/@${cleanName}`,
    title: `${companyName} on TikTok`,
    icon: '🎵',
    guessed: true,
  };

  return results;
}

async function findSocialMediaLinks(companyName) {
  if (!companyName || !companyName.trim()) {
    return {};
  }

  const results = {};
  const guessedLinks = getGuessedSocialLinks(companyName);

  // If no API key, return guessed patterns but marked appropriately
  if (!CONFIG.GOOGLE_CSE_API_KEY || !CONFIG.GOOGLE_CSE_CX) {
    return guessedLinks;
  }

  // Method A: Google Custom Search API - This is much more reliable
  for (const site of TARGET_SITES) {
    try {
      const query = encodeURIComponent(`"${companyName}" site:${site.domain}`);
      const url = `https://www.googleapis.com/customsearch/v1?key=${CONFIG.GOOGLE_CSE_API_KEY}&cx=${CONFIG.GOOGLE_CSE_CX}&q=${query}&num=1`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        results[site.name] = {
          url: data.items[0].link,
          title: data.items[0].title,
          snippet: data.items[0].snippet,
          icon: site.icon,
          verified: true
        };
      }
    } catch (e) {
      console.warn(`CSE search failed for ${site.name}:`, e);
    }
  }

  // Merge: Prioritize verified results over guesses
  const finalLinks = { ...guessedLinks };
  for (const [platform, data] of Object.entries(results)) {
    finalLinks[platform] = data;
  }

  return finalLinks;
}

// Zero-Skip: Official website finder — multi-pattern domain guessing + optional CSE
async function findOfficialWebsite(companyName) {
  if (!companyName || !companyName.trim()) return '';

  // Always try the smart domain guesses first (no API needed)
  const clean = companyName.toLowerCase()
    .replace(/\b(ltd|limited|inc|corp|co|llc|plc|pvt|group|the)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const guesses = [
    `https://www.${clean}.com`,
    `https://${clean}.com`,
    `https://www.${clean}.co`,
    `https://www.${clean}.io`,
    `https://www.${clean}.net`,
    `https://www.${clean}.org`,
  ];

  // Verify each guess with a HEAD request
  for (const url of guesses) {
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status === 301 || res.status === 302 || res.status === 200) {
        console.log(`[Zero-Skip] Verified domain: ${url}`);
        return url;
      }
    } catch (e) { /* not reachable, try next */ }
  }

  // Fallback: Google CSE if available
  if (CONFIG.GOOGLE_CSE_API_KEY && CONFIG.GOOGLE_CSE_CX) {
    try {
      const query = encodeURIComponent(`${companyName} official site`);
      const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${CONFIG.GOOGLE_CSE_API_KEY}&cx=${CONFIG.GOOGLE_CSE_CX}&q=${query}&num=3`;
      const res = await fetch(apiUrl);
      const json = await res.json();
      if (json.items?.length) {
        const candidate = json.items[0].link;
        if (candidate?.startsWith('http')) {
          const parsed = new URL(candidate);
          console.log(`[Zero-Skip] CSE found: ${parsed.origin}`);
          return parsed.origin;
        }
      }
    } catch (err) {
      console.warn('[Zero-Skip] CSE lookup failed:', err);
    }
  }

  // Last resort: return best guess without verification
  console.log(`[Zero-Skip] Unverified fallback: https://www.${clean}.com`);
  return `https://www.${clean}.com`;
}

// NEW: Bulk Hunt Function
// --- Consolidated Bulk Engine with mandatory 2s delay ---
async function handleBulkHunt(companies) {
  const results = [];
  console.log(`Starting Bulk Engine: ${companies.length} targets.`);

  for (let i = 0; i < companies.length; i++) {
    const entry = companies[i];
    const name = (entry.name || entry.companyName || (typeof entry === 'string' ? entry : '')).trim();
    let site = (entry.website || entry.websiteUrl || '').trim();

    if (!name) continue;

    console.log(`[Bulk ${i+1}/${companies.length}] Hunting: ${name}`);
    
    try {
      // Zero-Skip Domain Discovery
      if (!site) {
        site = await findOfficialWebsite(name);
      }

      const report = await huntAllContacts(name, site);
      results.push(report);
      
      // Save progress
      const id = `report_${Date.now()}`;
      chrome.storage.local.set({ [id]: report, latestReport: report });
    } catch (err) {
      console.error(`Bulk failure for ${name}:`, err);
    }

    // Production Rule: 2-second throttle
    if (i < companies.length - 1) {
      console.log('Engine cooling down (2s delay)...');
      await new Promise(r => setTimeout(r, 2000));
    }
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
    socialLinks: {}, // New: captured from <a> tags
  };

  // Normalize URL
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
  const urlObj = new URL(baseUrl);
  const baseDomain = urlObj.origin;

  // Pages to scan
  const pagesToScan = [
    baseUrl,
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

      // Extract emails
      const emailMatches = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
      if (emailMatches) {
        result.emails.push(...emailMatches.filter(e =>
          !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.gif') &&
          !e.includes('example.com') && !e.includes('test.com') &&
          !e.includes('wixpress') && !e.includes('sentry')
        ));
      }

      // Extract phone numbers
      const phoneMatches = html.match(/(?:\+?\d{1,4}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}/g);
      if (phoneMatches) {
        result.phones.push(...phoneMatches.filter(p => p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15));
      }

      // Extract people/team names from structured data
      const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          try {
            const content = match.replace(/<\/?script[^>]*>/gi, '');
            const jsonData = JSON.parse(content);
            extractPeopleFromSchema(jsonData, result.people);
            if (jsonData.foundingDate) result.yearFounded = jsonData.foundingDate;
            if (jsonData.address) {
              const addr = typeof jsonData.address === 'string' ? jsonData.address : 
                [jsonData.address.streetAddress, jsonData.address.addressLocality, jsonData.address.addressCountry].filter(Boolean).join(', ');
              result.headquarters = addr;
            }
          } catch (e) { /* JSON parse error */ }
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

      // Extract social links from anchor tags
      const anchorMatches = html.match(/<a[^>]+href="([^"]+)"[^>]*>/gi);
      if (anchorMatches) {
        TARGET_SITES.forEach(site => {
          for (const match of anchorMatches) {
            const hrefMatch = match.match(/href="([^"]+)"/i);
            if (hrefMatch && hrefMatch[1].includes(site.domain)) {
              let url = hrefMatch[1];
              if (url.startsWith('//')) url = 'https:' + url;
              if (url.startsWith('/')) url = baseDomain + url;
              result.socialLinks[site.name] = url;
            }
          }
        });
      }

    } catch (e) {
      // Page not accessible, skip
    }
  }

  result.techStack = [...new Set(result.techStack)];
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
        name: data.name || '',
        title: data.jobTitle || data.roleName || '',
        email: data.email || '',
        phone: data.telephone || '',
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

  // Apollo.io API
  if (CONFIG.APOLLO_API_KEY && CONFIG.enableApollo !== false) {
    try {
      const domain = websiteUrl ? new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname : '';
      
      // Search organization
      const orgRes = await fetch('https://api.apollo.io/v1/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ api_key: CONFIG.APOLLO_API_KEY, domain }),
      });
      const orgData = await orgRes.json();

      if (orgData.organization) {
        const org = orgData.organization;
        result.official = {
          website: org.website_url || '',
          headquarters: [org.city, org.state, org.country].filter(Boolean).join(', '),
          yearFounded: org.founded_year?.toString() || '',
          industry: org.industry || '',
          employeeCount: org.estimated_num_employees || '',
          revenue: org.annual_revenue_printed || '',
        };
        if (org.phone) result.phones.push(org.phone);
      }

      // Search people at company
      const peopleRes = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: CONFIG.APOLLO_API_KEY,
          q_organization_name: companyName,
          page: 1,
          per_page: 10,
          person_titles: ['CEO', 'Director', 'Founder', 'Owner', 'Managing Director', 'CTO', 'CFO'],
        }),
      });
      const peopleData = await peopleRes.json();

      if (peopleData.people) {
        for (const person of peopleData.people) {
          result.people.push({
            name: person.name || '',
            title: person.title || '',
            email: person.email || '',
            phone: person.phone_numbers?.[0]?.sanitized_number || '',
            linkedin: person.linkedin_url || '',
          });
          if (person.email) result.emails.push(person.email);
          if (person.phone_numbers) {
            result.phones.push(...person.phone_numbers.map(p => p.sanitized_number));
          }
        }
      }
    } catch (e) {
      console.warn('Apollo API error:', e);
    }
  }

  // Hunter.io API
  if (CONFIG.HUNTER_API_KEY && websiteUrl && CONFIG.enableHunter !== false) {
    try {
      const domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname;
      const hunterRes = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${CONFIG.HUNTER_API_KEY}&limit=10`);
      const hunterData = await hunterRes.json();

      if (hunterData.data?.emails) {
        for (const emailObj of hunterData.data.emails) {
          result.emails.push(emailObj.value);
          if (emailObj.first_name || emailObj.last_name) {
            result.people.push({
              name: `${emailObj.first_name || ''} ${emailObj.last_name || ''}`.trim(),
              title: emailObj.position || '',
              email: emailObj.value,
              phone: emailObj.phone_number || '',
              confidence: emailObj.confidence,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Hunter API error:', e);
    }
  }

  // RocketReach API
  if (CONFIG.ROCKETREACH_API_KEY && CONFIG.enableRocketReach !== false) {
    try {
      const rrRes = await fetch(`https://api.rocketreach.co/api/v2/company/lookup?name=${encodeURIComponent(companyName)}`, {
        headers: { 'Api-Key': CONFIG.ROCKETREACH_API_KEY },
      });
      const rrData = await rrRes.json();

      if (rrData.id) {
        if (rrData.phone_numbers) result.phones.push(...rrData.phone_numbers);
        if (rrData.email_addresses) result.emails.push(...rrData.email_addresses);
      }
    } catch (e) {
      console.warn('RocketReach API error:', e);
    }
  }

  return result;
}

// --------------- UTILITIES ---------------
function deduplicatePeople(people) {
  const seen = new Map();
  for (const person of people) {
    if (!person || !person.name) continue;
    const key = person.name.toLowerCase().trim();
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (!existing.title && person.title) existing.title = person.title;
      if (!existing.email && person.email) existing.email = person.email;
      if (!existing.phone && person.phone) existing.phone = person.phone;
      if (!existing.linkedin && person.linkedin) existing.linkedin = person.linkedin;
    } else {
      seen.set(key, { ...person });
    }
  }
  return Array.from(seen.values());
}

function compileAllLinks(report) {
  const links = [];

  if (report.websiteUrl) {
    links.push({ label: '🌐 Website', url: report.websiteUrl });
    links.push({ label: '📞 Contact Page', url: `${report.websiteUrl.replace(/\/$/, '')}/contact` });
    links.push({ label: 'ℹ️ About Page', url: `${report.websiteUrl.replace(/\/$/, '')}/about` });
  }

  for (const [platform, data] of Object.entries(report.socialLinks)) {
    if (data?.url) {
      links.push({ label: `${data.icon || '🔗'} ${platform}`, url: data.url });
    }
  }

  for (const person of report.people) {
    if (person.linkedin) {
      links.push({ label: `👤 ${person.name} (LinkedIn)`, url: person.linkedin });
    }
  }

  return links;
}

function broadcastUpdate(report) {
  chrome.runtime.sendMessage({ action: 'reportUpdate', report }).catch(() => {});
}

// --------------- TAB BLAST ---------------
function launchAllContacts(links) {
  if (!links || !links.length) return;

  // Open tabs with a slight delay between each to avoid overwhelming browser
  links.forEach((link, index) => {
    setTimeout(() => {
      chrome.tabs.create({ url: link.url, active: index === 0 });
    }, index * 300);
  });
}

// --------------- GOOGLE SHEETS AUTO-UPLOAD ---------------
async function uploadToGoogleSheet(report) {
  // Always fetch the latest saved SCRIPT_URL from storage
  const stored = await new Promise(res => chrome.storage.local.get('apiKeys', res));
  const scriptUrl = stored?.apiKeys?.SCRIPT_URL || CONFIG.SCRIPT_URL;
  if (!scriptUrl) {
    console.warn('⚠️ uploadToGoogleSheet: No SCRIPT_URL configured.');
    return;
  }

  const payload = {
    companyName:  report.companyName || '',
    websiteUrl:   report.websiteUrl  || '',
    emails:       (report.directContact?.emails || []).join(', '),
    phones:       (report.directContact?.phones || []).join(', '),
    linkedin:     report.socialLinks?.LinkedIn?.url || '',
    facebook:     report.socialLinks?.Facebook?.url || '',
    instagram:    report.socialLinks?.Instagram?.url || '',
    people:       (report.people || []).map(p => `${p.name}${p.title ? ' (' + p.title + ')' : ''}`).join(' | '),
    industry:     report.official?.industry || '',
    timestamp:    new Date(report.timestamp || Date.now()).toISOString(),
  };

  console.log('📤 Sending report to Google Sheets...', payload.companyName);
  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log('✅ Report uploaded to Google Sheets successfully');
    
    // Broadcast success to UI
    chrome.runtime.sendMessage({ 
      action: 'sheetUploadSuccess', 
      company: payload.companyName || 'Company'
    }).catch(() => {});
    
  } catch (err) {
    console.error('❌ Google Sheets upload failed:', err.message);
    chrome.runtime.sendMessage({ 
      action: 'sheetUploadError', 
      error: err.message 
    }).catch(() => {});
  }
}

// Open side panel when extension icon clicked (Safe check for cross-browser support)
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

console.log('🧬 KA Alpha Antigen — Background Service Worker loaded');
