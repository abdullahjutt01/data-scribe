// ============================================================
// KA Alpha Antigen — Content Script
// Runs on all pages to extract contact data from current page
// ============================================================

(function () {
  'use strict';

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractPageData') {
      const data = extractCurrentPageData();
      sendResponse({ success: true, data });
    }
    if (request.action === 'highlightContacts') {
      highlightContactInfo();
      sendResponse({ success: true });
    }
  });

  // Extract emails, phones, and social links from the current page
  function extractCurrentPageData() {
    const result = {
      url: window.location.href,
      title: document.title,
      emails: [],
      phones: [],
      socialLinks: [],
      people: [],
      meta: {},
    };

    const bodyText = document.body?.innerText || '';
    const bodyHTML = document.body?.innerHTML || '';

    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = bodyText.match(emailRegex) || [];
    result.emails = [...new Set(emailMatches.filter(e =>
      !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.gif') &&
      !e.includes('example.com') && !e.includes('wixpress') && !e.includes('sentry')
    ))];

    // Extract phone numbers from tel: links and text
    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    telLinks.forEach(link => {
      const phone = link.href.replace('tel:', '').trim();
      if (phone) result.phones.push(phone);
    });

    const phoneRegex = /(?:\+?\d{1,4}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}/g;
    const phoneMatches = bodyText.match(phoneRegex) || [];
    result.phones.push(...phoneMatches.filter(p => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    }));
    result.phones = [...new Set(result.phones)];

    // Extract social media links
    const allLinks = document.querySelectorAll('a[href]');
    const socialDomains = ['linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com'];
    allLinks.forEach(link => {
      const href = link.href;
      for (const domain of socialDomains) {
        if (href.includes(domain)) {
          result.socialLinks.push({ platform: domain.split('.')[0], url: href });
          break;
        }
      }
    });

    // Extract meta info
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) result.meta.description = metaDesc.content;

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) result.meta.ogTitle = ogTitle.content;

    // Extract structured data (JSON-LD)
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Organization' || data['@type'] === 'LocalBusiness') {
          if (data.telephone) result.phones.push(data.telephone);
          if (data.email) result.emails.push(data.email);
        }
      } catch (e) { /* skip */ }
    });

    // Deduplicate
    result.emails = [...new Set(result.emails)];
    result.phones = [...new Set(result.phones)];

    return result;
  }

  // Highlight contact info on the page (visual helper)
  function highlightContactInfo() {
    const style = document.createElement('style');
    style.textContent = `
      .ka-highlight {
        background: rgba(99, 102, 241, 0.2) !important;
        border: 1px solid rgba(99, 102, 241, 0.5) !important;
        border-radius: 3px !important;
        padding: 1px 3px !important;
        transition: all 0.3s ease !important;
      }
      .ka-highlight:hover {
        background: rgba(99, 102, 241, 0.4) !important;
      }
    `;
    document.head.appendChild(style);

    // Highlight email links
    document.querySelectorAll('a[href^="mailto:"]').forEach(el => el.classList.add('ka-highlight'));
    
    // Highlight phone links
    document.querySelectorAll('a[href^="tel:"]').forEach(el => el.classList.add('ka-highlight'));
  }

})();
