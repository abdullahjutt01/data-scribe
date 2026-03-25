// ============================================================
// KA Alpha Antigen — Popup Script
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    companyInput: document.getElementById('companyInput'),
    directorInput: document.getElementById('directorInput'),
    locationInput: document.getElementById('locationInput'),
    websiteInput: document.getElementById('websiteInput'),
    sheetUrlInput: document.getElementById('sheetUrlInput'),
    loadSheetBtn: document.getElementById('loadSheetBtn'),
    huntBtn: document.getElementById('huntBtn'),
    huntBtnText: document.querySelector('.hunt-btn-text'),
    huntBtnLoading: document.querySelector('.hunt-btn-loading'),
    layerStatus: document.getElementById('layerStatus'),
    layer1: document.getElementById('layer1'),
    layer2: document.getElementById('layer2'),
    layer3: document.getElementById('layer3'),
    quickResults: document.getElementById('quickResults'),
    emailCount: document.getElementById('emailCount'),
    phoneCount: document.getElementById('phoneCount'),
    socialCount: document.getElementById('socialCount'),
    peopleCount: document.getElementById('peopleCount'),
    tabBlastBtn: document.getElementById('tabBlastBtn'),
    openDashboardBtn: document.getElementById('openDashboardBtn'),
    exportBtn: document.getElementById('exportBtn'),
    recentScans: document.getElementById('recentScans'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    apolloKey: document.getElementById('apolloKey'),
    hunterKey: document.getElementById('hunterKey'),
    rocketreachKey: document.getElementById('rocketreachKey'),
    googleKey: document.getElementById('googleKey'),
    googleCx: document.getElementById('googleCx'),
    imgbbKey: document.getElementById('imgbbKey'),
    sheetScriptUrlInput: document.getElementById('sheetScriptUrlInput'),
    scanBarcodeBtn: document.getElementById('scanBarcodeBtn'),
    scanPictureBtn: document.getElementById('scanPictureBtn'),
    scannerModal: document.getElementById('scannerModal'),
    scannerTitle: document.getElementById('scannerTitle'),
    scannerNote: document.getElementById('scannerNote'),
    closeScanner: document.getElementById('closeScanner'),
    scannerVideo: document.getElementById('scannerVideo'),
    scannerImg: document.getElementById('scannerImg'),
    scannerPlaceholder: document.getElementById('scannerPlaceholder'),
    openCameraBtn: document.getElementById('openCameraBtn'),
    scannerUpload: document.getElementById('scannerUpload'),
    scannerResult: document.getElementById('scannerResult'),
    processScanBtn: document.getElementById('processScanBtn'),
  };

  let currentReport = null;
  let scannerMode = '';
  let videoStream = null;
  let animationFrameId = null;
  let scannedBarcodeText = '';
  let scannedImageFile = null;

  // safe listener utility to prevent TypeError when controls are missing
  const bind = (el, event, handler) => {
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(event, handler);
    }
  };

  // --- Event Listeners ---
  bind(elements.huntBtn, 'click', startHunt);
  bind(elements.tabBlastBtn, 'click', handleTabBlast);
  bind(elements.openDashboardBtn, 'click', openDashboard);
  bind(elements.exportBtn, 'click', exportReport);
  bind(elements.settingsBtn, 'click', () => { if (elements.settingsModal) elements.settingsModal.style.display = 'flex'; });
  bind(elements.closeSettings, 'click', () => { if (elements.settingsModal) elements.settingsModal.style.display = 'none'; });
  bind(elements.saveKeysBtn, 'click', saveApiKeys);
  bind(elements.scanBarcodeBtn, 'click', () => openScanner('barcode'));
  bind(elements.scanPictureBtn, 'click', () => openScanner('picture'));
  bind(elements.closeScanner, 'click', closeScanner);
  bind(elements.openCameraBtn, 'click', startCamera);
  bind(elements.scannerUpload, 'change', handleFileUpload);
  bind(elements.processScanBtn, 'click', processScan);
  bind(elements.loadSheetBtn, 'click', loadCompaniesFromSheet);

  // Enter key to trigger hunt
  bind(elements.companyInput, 'keydown', (e) => {
    if (e?.key === 'Enter') startHunt();
  });

  // Listen for report updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === 'reportUpdate') {
      updateUI(msg.report);
    }
  });

  // Load recent scans
  loadRecentScans();
  loadApiKeys();

  // --- Functions ---
  async function startHunt() {
    const companyName = String(elements.companyInput?.value || '').trim();
    const directorName = String(elements.directorInput?.value || '').trim();
    const location = String(elements.locationInput?.value || '').trim();

    if (!companyName) {
      showToast('Please enter a company name', 'error');
      if (elements.companyInput) elements.companyInput.focus();
      return;
    }

    const websiteUrl = String(elements.websiteInput?.value || '').trim();

    // UI: Show loading state
    if (elements.huntBtn) elements.huntBtn.disabled = true;
    if (elements.huntBtnText) elements.huntBtnText.style.display = 'none';
    if (elements.huntBtnLoading) elements.huntBtnLoading.style.display = 'inline';
    if (elements.layerStatus) elements.layerStatus.style.display = 'flex';
    if (elements.quickResults) elements.quickResults.style.display = 'none';

    // Reset layers
    updateLayerUI('pending', 'pending', 'pending');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'huntContacts',
        companyName,
        directorName,
        location,
        websiteUrl,
      });

      // Check for errors
      if (chrome.runtime.lastError) {
         showToast(`System Error: ${String(chrome.runtime.lastError.message || 'Unknown error')}`, 'error');
         resetHuntButton();
         return;
      }

      if (response?.success) {
        currentReport = response.report;
        updateUI(response.report);
        showToast('Scan complete! 🎯', 'success');
        loadRecentScans();
      } else {
        showToast(`Error: ${String(response?.error || 'Unknown issue')}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${String(err?.message || 'Unknown error')}`, 'error');
    }

    resetHuntButton();
  }

  async function loadCompaniesFromSheet() {
    const sheetUrl = String(elements.sheetUrlInput?.value || '').trim();
    if (!sheetUrl) {
      showToast('Please enter Google Sheet URL', 'error');
      return;
    }

    try {
      const parsedUrl = new URL(sheetUrl);
      const match = String(parsedUrl.pathname || '').match(/\/d\/(.+?)\//);
      if (!match) throw new Error('Invalid Google Sheet URL');
      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv`;

      showToast('Loading companies from sheet...', 'info');
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Unable to fetch sheet (publish to web required)');

      const text = await res.text();
      const rows = String(text || '').split('\n').map(r => String(r || '').trim()).filter(r => r.length > 0);
      if (!rows.length) throw new Error('No rows found in sheet');

      const companies = rows.map(row => String(row || '').split(',')[0].trim()).filter(v => v && v.length > 0);
      if (!companies.length) throw new Error('No company names found in sheet');

      showToast(`Found ${companies.length} companies. Starting hunts...`, 'success');
      for (const company of companies) {
        if (elements.companyInput) {
          elements.companyInput.value = String(company || '');
          await startHunt();
          await new Promise(resolve => setTimeout(resolve, 1200));
        }
      }
    } catch (error) {
      console.error('Sheet load failed:', error);
      showToast(`Sheet load failed: ${String(error?.message || 'Unknown error')}`, 'error');
    }
  }

  // Button reset helper function
  function resetHuntButton() {
    if (elements.huntBtn) elements.huntBtn.disabled = false;
    if (elements.huntBtnText) elements.huntBtnText.style.display = 'inline';
    if (elements.huntBtnLoading) elements.huntBtnLoading.style.display = 'none';
  }

  function updateUI(report) {
    if (!report || typeof report !== 'object') {
      console.warn('Invalid report received');
      return;
    }

    currentReport = report;

    // Update layer status
    updateLayerUI(
      String(report.layers?.social || 'pending'),
      String(report.layers?.website || 'pending'),
      String(report.layers?.api || 'pending')
    );

    // Update stats
    const emailCount = Array.isArray(report.directContact?.emails) ? report.directContact.emails.length : 0;
    const phoneCount = Array.isArray(report.directContact?.phones) ? report.directContact.phones.length : 0;
    const socialCount = report.socialLinks && typeof report.socialLinks === 'object' ? Object.keys(report.socialLinks).length : 0;
    const peopleCount = Array.isArray(report.people) ? report.people.length : 0;

    animateNumber(elements.emailCount, emailCount);
    animateNumber(elements.phoneCount, phoneCount);
    animateNumber(elements.socialCount, socialCount);
    animateNumber(elements.peopleCount, peopleCount);

    // Show results
    if (report.status === 'complete' || emailCount + phoneCount + socialCount + peopleCount > 0) {
      if (elements.quickResults) elements.quickResults.style.display = 'block';
    }
  }

  function updateLayerUI(social, website, api) {
    setLayerState(elements.layer1, String(social || 'pending'));
    setLayerState(elements.layer2, String(website || 'pending'));
    setLayerState(elements.layer3, String(api || 'pending'));
  }

  function setLayerState(el, state) {
    if (!el) return;
    el.className = `layer-item ${String(state || '')}`;
    const badge = el.querySelector('.layer-badge');
    if (!badge) return;
    const labels = {
      pending: 'Pending',
      scanning: 'Scanning...',
      complete: 'Complete ✓',
      error: 'Error ✗',
      skipped: 'Skipped',
    };
    badge.textContent = String(labels[state] || state || '');
  }

  function animateNumber(el, target) {
    if (!el) return;
    target = Math.max(0, parseInt(target) || 0);
    const current = Math.max(0, parseInt(el.textContent) || 0);
    if (current === target) return;

    const step = target > current ? 1 : -1;
    const duration = 400;
    const steps = Math.abs(target - current);
    const interval = duration / steps;

    let i = current;
    const timer = setInterval(() => {
      i += step;
      if (el) el.textContent = String(i);
      if (i === target) clearInterval(timer);
    }, Math.max(interval, 30));
  }

  function handleTabBlast() {
    if (!currentReport?.allLinks || !Array.isArray(currentReport.allLinks) || currentReport.allLinks.length === 0) {
      showToast('No links found to open', 'error');
      return;
    }

    const count = currentReport.allLinks.length;
    if (confirm(`🚀 This will open ${count} tabs. Continue?`)) {
      try {
        chrome.runtime.sendMessage({
          action: 'tabBlast',
          links: currentReport.allLinks,
        });
        showToast(`Launching ${count} tabs! 🚀`, 'success');
      } catch (e) {
        showToast(`Error launching tabs: ${String(e?.message || 'Unknown error')}`, 'error');
      }
    }
  }

  function openDashboard() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs?.[0]?.windowId) {
          chrome.sidePanel.open({ windowId: tabs[0].windowId }).catch(() => {
            // Fallback: open side panel page in a new tab
            chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html') });
          });
        }
      });
    } catch (e) {
      console.error('Error opening dashboard:', e);
      showToast('Error opening dashboard', 'error');
    }
  }

  function exportReport() {
    if (!currentReport || typeof currentReport !== 'object') {
      showToast('No report to export', 'error');
      return;
    }

    const report = currentReport;
    let text = `═══════════════════════════════════════════\n`;
    text += `       KA ALPHA ANTIGEN — CONTACT REPORT\n`;
    text += `═══════════════════════════════════════════\n\n`;
    text += `Company: ${String(report.companyName || 'N/A')}\n`;
    text += `Website: ${String(report.websiteUrl || 'N/A')}\n`;
    text += `Scanned: ${new Date(report.timestamp || 0).toLocaleString()}\n\n`;

    text += `───────── OFFICIAL INFO ─────────\n`;
    text += `Headquarters: ${String(report.official?.headquarters || 'N/A')}\n`;
    text += `Year Founded: ${String(report.official?.yearFounded || 'N/A')}\n`;
    text += `Industry: ${String(report.official?.industry || 'N/A')}\n\n`;

    text += `───────── EMAILS ─────────\n`;
    if (Array.isArray(report.directContact?.emails)) {
      report.directContact.emails.forEach(e => text += `  📧 ${String(e || '')}\n`);
    }
    if (!report.directContact?.emails?.length) text += `  No emails found\n`;
    text += `\n`;

    text += `───────── PHONES ─────────\n`;
    if (Array.isArray(report.directContact?.phones)) {
      report.directContact.phones.forEach(p => text += `  📱 ${String(p || '')}\n`);
    }
    if (!report.directContact?.phones?.length) text += `  No phones found\n`;
    text += `\n`;

    text += `───────── PEOPLE ─────────\n`;
    if (Array.isArray(report.people)) {
      report.people.forEach(p => {
        if (p && typeof p === 'object') {
          text += `  👤 ${String(p.name || 'Unknown')}`;
          if (p.title) text += ` — ${String(p.title || '')}`;
          text += `\n`;
          if (p.email) text += `     Email: ${String(p.email || '')}\n`;
          if (p.phone) text += `     Phone: ${String(p.phone || '')}\n`;
          if (p.linkedin) text += `     LinkedIn: ${String(p.linkedin || '')}\n`;
        }
      });
    }
    if (!report.people?.length) text += `  No people found\n`;
    text += `\n`;

    text += `───────── SOCIAL LINKS ─────────\n`;
    if (report.socialLinks && typeof report.socialLinks === 'object') {
      Object.entries(report.socialLinks).forEach(([platform, data]) => {
        text += `  ${data?.icon || '🔗'} ${String(platform || '')}: ${String(data?.url || 'N/A')}\n`;
      });
    }
    text += `\n`;

    text += `───────── TECH STACK ─────────\n`;
    text += `  ${Array.isArray(report.activity?.techStack) ? report.activity.techStack.map(t => String(t || '')).join(', ') : 'Not detected'}\n\n`;

    text += `═══════════════════════════════════════════\n`;
    text += `  Generated by KA Alpha Antigen v1.0 🧬\n`;
    text += `═══════════════════════════════════════════\n`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Report copied to clipboard! 📋', 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
  }

  async function loadRecentScans() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      const reports = Array.isArray(response?.reports) ? response.reports : [];

      if (reports.length === 0) {
        if (elements.recentScans) {
          elements.recentScans.innerHTML = '<div class="empty-state">No scans yet. Enter a company name above to start!</div>';
        }
        return;
      }

      if (!elements.recentScans) return;

      elements.recentScans.innerHTML = reports.slice(0, 5).map(report => {
        if (!report) return '';
        const safeReport = report === 'object' ? JSON.stringify(report).replace(/'/g, "&#39;") : '{}';
        return `
        <div class="recent-item" data-id="${String(report.id || '')}" data-report='${safeReport}'>
          <div class="recent-item-info">
            <span class="recent-item-name">${String(report.companyName || 'Unknown')}</span>
            <span class="recent-item-date">${new Date(report.timestamp || 0).toLocaleDateString()} ${new Date(report.timestamp || 0).toLocaleTimeString()}</span>
          </div>
          <div class="recent-item-stats">
            <span>📧 ${Array.isArray(report.directContact?.emails) ? report.directContact.emails.length : 0}</span>
            <span>📱 ${Array.isArray(report.directContact?.phones) ? report.directContact.phones.length : 0}</span>
            <span>🔗 ${report.socialLinks && typeof report.socialLinks === 'object' ? Object.keys(report.socialLinks).length : 0}</span>
          </div>
        </div>
      `}).join('');

      // Click handler for recent items
      elements.recentScans.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
          try {
            const reportJson = item.getAttribute('data-report');
            if (!reportJson) return;
            const report = JSON.parse(reportJson);
            if (!report || typeof report !== 'object') return;
            currentReport = report;
            if (elements.companyInput) elements.companyInput.value = String(report.companyName || '');
            if (elements.websiteInput) elements.websiteInput.value = String(report.websiteUrl || '');
            updateUI(report);
            if (elements.layerStatus) elements.layerStatus.style.display = 'flex';
            if (elements.quickResults) elements.quickResults.style.display = 'block';
          } catch (e) {
            console.error('Error loading recent scan:', e);
          }
        });
      });
    } catch (e) {
      console.error('Error loading recent scans:', e);
    }
  }

  async function loadApiKeys() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
      const keys = response?.keys && typeof response.keys === 'object' ? response.keys : {};
      if (keys.APOLLO_API_KEY && elements.apolloKey) elements.apolloKey.value = String(keys.APOLLO_API_KEY || '');
      if (keys.HUNTER_API_KEY && elements.hunterKey) elements.hunterKey.value = String(keys.HUNTER_API_KEY || '');
      if (keys.ROCKETREACH_API_KEY && elements.rocketreachKey) elements.rocketreachKey.value = String(keys.ROCKETREACH_API_KEY || '');
      if (keys.GOOGLE_CSE_API_KEY && elements.googleKey) elements.googleKey.value = String(keys.GOOGLE_CSE_API_KEY || '');
      if (keys.GOOGLE_CSE_CX && elements.googleCx) elements.googleCx.value = String(keys.GOOGLE_CSE_CX || '');
      if (keys.IMGBB_API_KEY && elements.imgbbKey) elements.imgbbKey.value = String(keys.IMGBB_API_KEY || '');
      
      // Load Google Apps Script URL from storage
      const storage = await chrome.storage.local.get('SHEET_SCRIPT_URL');
      if (storage?.SHEET_SCRIPT_URL && elements.sheetScriptUrlInput) {
        elements.sheetScriptUrlInput.value = String(storage.SHEET_SCRIPT_URL || '');
      }
    } catch (e) {
      console.error('Error loading API keys:', e);
    }
  }

  function saveApiKeys() {
    const sheetScriptUrl = String(elements.sheetScriptUrlInput?.value || '').trim();
    
    // Validate Google Apps Script URL if provided
    if (sheetScriptUrl && !isValidAppsScriptUrl(sheetScriptUrl)) {
      showToast('❌ Invalid Google Apps Script URL. Must start with https://script.google.com/', 'error');
      return;
    }
    
    const keys = {
      APOLLO_API_KEY: String(elements.apolloKey?.value || '').trim(),
      HUNTER_API_KEY: String(elements.hunterKey?.value || '').trim(),
      ROCKETREACH_API_KEY: String(elements.rocketreachKey?.value || '').trim(),
      GOOGLE_CSE_API_KEY: String(elements.googleKey?.value || '').trim(),
      GOOGLE_CSE_CX: String(elements.googleCx?.value || '').trim(),
      IMGBB_API_KEY: String(elements.imgbbKey?.value || '').trim(),
    };

    try {
      chrome.runtime.sendMessage({ action: 'saveApiKeys', keys }, () => {
        // Save Google Apps Script URL separately
        if (sheetScriptUrl) {
          chrome.storage.local.set({ SHEET_SCRIPT_URL: sheetScriptUrl }, () => {
            showToast('✅ Settings saved! Google Sheets integration active.', 'success');
            if (elements.settingsModal) elements.settingsModal.style.display = 'none';
          });
        } else {
          chrome.storage.local.remove('SHEET_SCRIPT_URL', () => {
            showToast('✅ API keys saved! (Google Sheets integration disabled)', 'success');
            if (elements.settingsModal) elements.settingsModal.style.display = 'none';
          });
        }
      });
    } catch (e) {
      showToast(`Error saving keys: ${String(e?.message || 'Unknown error')}`, 'error');
    }
  }
  
  function isValidAppsScriptUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/d\//.test(String(url || ''));
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${String(type || 'info')}`;
    toast.textContent = String(message || '');
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Scanner Functions ---
  function openScanner(mode) {
    scannerMode = String(mode || 'barcode');
    if (elements.scannerTitle) {
      elements.scannerTitle.textContent = scannerMode === 'barcode' ? '🏷️ Scan Barcode' : '📷 Visual Search';
    }
    if (elements.scannerNote) {
      elements.scannerNote.textContent = scannerMode === 'barcode' ? 'Scan a product barcode to extract details.' : 'Upload a product picture to find matches.';
    }
    if (elements.scannerResult) elements.scannerResult.style.display = 'none';
    if (elements.processScanBtn) elements.processScanBtn.style.display = 'none';
    if (elements.scannerImg) elements.scannerImg.style.display = 'none';
    if (elements.scannerVideo) elements.scannerVideo.style.display = 'none';
    if (elements.scannerPlaceholder) {
      elements.scannerPlaceholder.style.display = 'flex';
      elements.scannerPlaceholder.textContent = 'No image selected';
    }
    if (elements.scannerUpload) elements.scannerUpload.value = '';
    scannedBarcodeText = '';
    scannedImageFile = null;
    if (elements.scannerModal) elements.scannerModal.style.display = 'flex';
  }

  function closeScanner() {
    if (elements.scannerModal) elements.scannerModal.style.display = 'none';
    stopCamera();
  }

  async function startCamera() {
    if (elements.scannerImg) elements.scannerImg.style.display = 'none';
    if (elements.scannerPlaceholder) elements.scannerPlaceholder.style.display = 'none';
    if (elements.scannerVideo) elements.scannerVideo.style.display = 'block';
    
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (elements.scannerVideo) {
        elements.scannerVideo.srcObject = videoStream;
        elements.scannerVideo.play();
      }
      
      if (scannerMode === 'barcode' && 'BarcodeDetector' in window) {
        scanVideoFrame();
      } else if (scannerMode === 'picture') {
        if (elements.scannerPlaceholder) {
          elements.scannerPlaceholder.textContent = 'Please use upload for picture scanning functionality.';
          elements.scannerPlaceholder.style.display = 'block';
        }
        if (elements.scannerVideo) elements.scannerVideo.style.display = 'none';
        stopCamera();
      }
    } catch (e) {
      console.error("Camera Access Denied:", String(e?.message || e));
      showToast('📷 Camera blocked in popup. Click "📁 Upload" button to select an image instead.', 'warning');
      if (elements.scannerPlaceholder) {
        elements.scannerPlaceholder.textContent = '📷 Camera blocked by browser\n\nClick "📁 Upload" below to select an image file.';
        elements.scannerPlaceholder.style.display = 'block';
      }
      if (elements.scannerVideo) elements.scannerVideo.style.display = 'none';
      // Focus upload button
      if (elements.scannerUpload) {
        setTimeout(() => elements.scannerUpload.click?.(), 500);
      }
    }
  }

  function stopCamera() {
    if (videoStream && typeof videoStream.getTracks === 'function') {
      videoStream.getTracks().forEach(track => {
        if (typeof track.stop === 'function') track.stop();
      });
      videoStream = null;
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function scanVideoFrame() {
    if (!videoStream || scannerMode !== 'barcode') return;
    
    if (!('BarcodeDetector' in window)) {
      console.warn('BarcodeDetector not available');
      return;
    }

    try {
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'upc_a', 'code_128'] });
      barcodeDetector.detect(elements.scannerVideo || {})
        .then(barcodes => {
          if (barcodes && Array.isArray(barcodes) && barcodes.length > 0 && barcodes[0]?.rawValue) {
            scannedBarcodeText = String(barcodes[0].rawValue || '');
            stopCamera();
            if (elements.scannerVideo) elements.scannerVideo.style.display = 'none';
            if (elements.scannerPlaceholder) {
              elements.scannerPlaceholder.style.display = 'block';
              elements.scannerPlaceholder.textContent = `Scanned Barcode: ${scannedBarcodeText}`;
            }
            if (elements.scannerResult) {
              elements.scannerResult.textContent = `Found: ${scannedBarcodeText}`;
              elements.scannerResult.style.display = 'block';
            }
            if (elements.processScanBtn) elements.processScanBtn.style.display = 'block';
          } else {
            animationFrameId = requestAnimationFrame(scanVideoFrame);
          }
        }).catch(() => {
          animationFrameId = requestAnimationFrame(scanVideoFrame);
        });
    } catch (e) {
      console.error('Barcode detection error:', e);
      animationFrameId = requestAnimationFrame(scanVideoFrame);
    }
  }

  function handleFileUpload(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    stopCamera();
    
    scannedImageFile = file;
    const url = URL.createObjectURL(file);
    if (elements.scannerVideo) elements.scannerVideo.style.display = 'none';
    if (elements.scannerPlaceholder) elements.scannerPlaceholder.style.display = 'none';
    if (elements.scannerImg) {
      elements.scannerImg.style.display = 'block';
      elements.scannerImg.src = url;
    }

    if (scannerMode === 'barcode') {
      if ('BarcodeDetector' in window) {
        const img = new Image();
        img.onload = () => {
          try {
            const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'upc_a', 'code_128'] });
            barcodeDetector.detect(img).then(barcodes => {
              if (barcodes && Array.isArray(barcodes) && barcodes.length > 0 && barcodes[0]?.rawValue) {
                scannedBarcodeText = String(barcodes[0].rawValue || '');
                if (elements.scannerResult) {
                  elements.scannerResult.textContent = `Found Barcode: ${scannedBarcodeText}`;
                  elements.scannerResult.style.display = 'block';
                }
                if (elements.processScanBtn) elements.processScanBtn.style.display = 'block';
              } else {
                showToast('No barcode found in image', 'error');
              }
            }).catch(() => showToast('Error scanning barcode', 'error'));
          } catch (e) {
            console.error('Barcode detection error:', e);
            showToast('Error scanning barcode', 'error');
          }
        };
        img.onerror = () => showToast('Failed to load image', 'error');
        img.src = url;
      } else {
         showToast('Barcode API not supported in this browser.', 'error');
      }
    } else if (scannerMode === 'picture') {
      if (elements.scannerResult) {
        elements.scannerResult.textContent = `Image ready for visual search`;
        elements.scannerResult.style.display = 'block';
      }
      if (elements.processScanBtn) elements.processScanBtn.style.display = 'block';
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file || typeof file !== 'object') {
        reject(new Error('Invalid file object'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unable to read file as string'));
          return;
        }
        const base64 = String(result).startsWith('data:') ? String(result).split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      try {
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  async function uploadImageForVisualSearch(file) {
    if (!file || typeof file !== 'object') {
      throw new Error('Invalid file for upload');
    }

    const endpoints = [
      {
        name: 'catbox.moe',
        url: 'https://catbox.moe/user/api.php',
        type: 'catbox',
        parseLink: (response) => String(response || '').trim(),
      },
      {
        name: 'file.io',
        url: 'https://file.io',
        type: 'form',
        parseLink: (json) => json?.link ?? json?.data?.link,
      },
      {
        name: 'anonfiles',
        url: 'https://api.anonfiles.com/upload',
        type: 'form',
        parseLink: (json) => json?.data?.file?.url?.full || json?.data?.file?.url?.short,
      },
    ];

    const imgbbKey = String(elements.imgbbKey?.value || '').trim();
    if (imgbbKey) {
      endpoints.push({
        name: 'imgbb',
        url: `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`,
        type: 'imgbb',
        parseLink: (json) => json?.data?.url,
      });
    }

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        if (!endpoint || typeof endpoint !== 'object') continue;

        let res;

        if (endpoint.type === 'catbox') {
          // Catbox.moe upload
          const formData = new FormData();
          formData.append('reqtype', 'fileupload');
          formData.append('file', file);
          res = await fetch(endpoint.url, { method: 'POST', body: formData, signal: AbortSignal.timeout(15000) });
          
          if (!res.ok) {
            throw new Error(`Upload (${endpoint.name}) failed HTTP ${res.status}`);
          }
          
          const responseText = await res.text();
          if (String(responseText || '').includes('catbox.moe')) {
            return { provider: endpoint.name, link: responseText };
          } else {
            throw new Error(`Catbox upload response invalid: ${String(responseText || '').slice(0, 100)}`);
          }
        } else if (endpoint.type === 'imgbb') {
          const base64 = await readFileAsBase64(file);
          const formData = new FormData();
          formData.append('image', base64);
          res = await fetch(endpoint.url, { method: 'POST', body: formData, signal: AbortSignal.timeout(15000) });
        } else {
          const formData = new FormData();
          formData.append('file', file);
          res = await fetch(endpoint.url, { method: 'POST', body: formData, signal: AbortSignal.timeout(15000) });
        }

        if (!res.ok) {
          throw new Error(`Upload (${endpoint.name}) failed HTTP ${res.status} ${String(res.statusText || '')}`);
        }

        const contentType = String(res.headers.get('content-type') || '');
        if (!contentType.includes('application/json')) {
          const rawText = await res.text();
          throw new Error(`Upload (${endpoint.name}) returned non-JSON content-type: ${contentType}; body:${String(rawText || '').slice(0,200)}`);
        }

        const json = await res.json();
        const link = endpoint.parseLink(json);
        if (!link || typeof link !== 'string') {
          throw new Error(`Upload (${endpoint.name}) response has no public link: ${JSON.stringify(json)}`);
        }

        return { provider: endpoint.name, link: String(link) };
      } catch (err) {
        lastError = err;
        console.warn(`uploadImageForVisualSearch: ${String(endpoint.name || '')} failed`, err);
      }
    }

    throw lastError || new Error('No image upload provider available');
  }

  async function extractTextWithOCR(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Invalid image URL for OCR');
    }

    try {
      const params = new URLSearchParams({
        url: String(imageUrl),
        apikey: 'K87899142C0',  // Free OCR.Space API key
        language: 'eng',
        isOverlayRequired: 'false',
      });
      
      const response = await fetch(`https://api.ocr.space/parse?${params.toString()}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (KAAlphaAntigen/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      
      if (!response.ok) {
        throw new Error(`OCR.Space API returned HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data?.IsErroredOnProcessing) {
        throw new Error(String(data.ErrorMessage || 'OCR processing failed'));
      }
      
      const text = String(data.ParsedText || '').trim();
      if (!text) {
        throw new Error('No text extracted from image');
      }
      
      return text;
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error(`OCR extraction failed: ${String(error?.message || 'Unknown error')}`);
    }
  }

  async function processScan() {
    if (!elements.processScanBtn) return;

    const originalText = elements.processScanBtn.textContent;
    elements.processScanBtn.textContent = 'Processing...';
    elements.processScanBtn.disabled = true;

    try {
      if (scannerMode === 'barcode') {
        closeScanner();
        if (elements.companyInput) elements.companyInput.value = scannedBarcodeText;
        showToast('Searching product...', 'info');
        window.open(`https://www.google.com/search?q=${encodeURIComponent(String(scannedBarcodeText || '') + ' product')}`, '_blank');
      } else if (scannerMode === 'picture') {
        if (!scannedImageFile) {
          throw new Error('No image selected for visual search. Please upload an image first.');
        }

        // Upload image
        showToast('📤 Uploading image...', 'info');
        const uploadResult = await uploadImageForVisualSearch(scannedImageFile);
        console.log(`Image uploaded to ${String(uploadResult.provider || '')}: ${String(uploadResult.link || '')}`);

        // Extract text via OCR
        showToast('🔍 Extracting text with OCR...', 'info');
        const extractedText = await extractTextWithOCR(uploadResult.link);
        console.log(`OCR extracted: ${String(extractedText || '').slice(0, 100)}...`);

        // Close scanner and populate company input
        closeScanner();
        if (elements.companyInput) elements.companyInput.value = String(extractedText || '').trim();
        
        // Auto-trigger hunt
        showToast('🚀 Extracted text! Starting hunt...', 'success');
        await startHunt();
      } else {
        showToast('Unknown scan mode. Please select Camera or Upload.', 'error');
      }
    } catch (e) {
      console.error('Visual scan processing failed:', e);
      showToast(`Error: ${String(e?.message || 'visual search failed')}`, 'error');
      
      // Fallback: Offer Google Lens as alternative if we have the image URL
      if (scannerMode === 'picture' && scannedImageFile) {
        try {
          const uploadResult = await uploadImageForVisualSearch(scannedImageFile);
          showToast('Falling back to Google Lens...', 'info');
          window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(String(uploadResult.link || ''))}`, '_blank');
        } catch { 
          // Fallback failed, already showing error above
        }
      }
    } finally {
      elements.processScanBtn.textContent = originalText;
      elements.processScanBtn.disabled = false;
    }
  }
});
    companyInput: document.getElementById('companyInput'),
    directorInput: document.getElementById('directorInput'),
    locationInput: document.getElementById('locationInput'),
    websiteInput: document.getElementById('websiteInput'),
    sheetUrlInput: document.getElementById('sheetUrlInput'),
    loadSheetBtn: document.getElementById('loadSheetBtn'),
    huntBtn: document.getElementById('huntBtn'),
    huntBtnText: document.querySelector('.hunt-btn-text'),
    huntBtnLoading: document.querySelector('.hunt-btn-loading'),
    layerStatus: document.getElementById('layerStatus'),
    layer1: document.getElementById('layer1'),
    layer2: document.getElementById('layer2'),
    layer3: document.getElementById('layer3'),
    quickResults: document.getElementById('quickResults'),
    emailCount: document.getElementById('emailCount'),
    phoneCount: document.getElementById('phoneCount'),
    socialCount: document.getElementById('socialCount'),
    peopleCount: document.getElementById('peopleCount'),
    tabBlastBtn: document.getElementById('tabBlastBtn'),
    openDashboardBtn: document.getElementById('openDashboardBtn'),
    exportBtn: document.getElementById('exportBtn'),
    recentScans: document.getElementById('recentScans'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    apolloKey: document.getElementById('apolloKey'),
    hunterKey: document.getElementById('hunterKey'),
    rocketreachKey: document.getElementById('rocketreachKey'),
    googleKey: document.getElementById('googleKey'),
    googleCx: document.getElementById('googleCx'),
    imgbbKey: document.getElementById('imgbbKey'),
    sheetScriptUrlInput: document.getElementById('sheetScriptUrlInput'),
    scanBarcodeBtn: document.getElementById('scanBarcodeBtn'),
    scanPictureBtn: document.getElementById('scanPictureBtn'),
    scannerModal: document.getElementById('scannerModal'),
    scannerTitle: document.getElementById('scannerTitle'),
    scannerNote: document.getElementById('scannerNote'),
    closeScanner: document.getElementById('closeScanner'),
    scannerVideo: document.getElementById('scannerVideo'),
    scannerImg: document.getElementById('scannerImg'),
    scannerPlaceholder: document.getElementById('scannerPlaceholder'),
    openCameraBtn: document.getElementById('openCameraBtn'),
    scannerUpload: document.getElementById('scannerUpload'),
    scannerResult: document.getElementById('scannerResult'),
    processScanBtn: document.getElementById('processScanBtn'),
  };

  let currentReport = null;
  let scannerMode = '';
  let videoStream = null;
  let animationFrameId = null;
  let scannedBarcodeText = '';
  let scannedImageFile = null;

  // safe listener utility to prevent npx TypeError when controls are missing
  const bind = (el, event, handler) => {
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(event, handler);
    }
  };

  // --- Event Listeners ---
  bind(elements.huntBtn, 'click', startHunt);
  bind(elements.tabBlastBtn, 'click', handleTabBlast);
  bind(elements.openDashboardBtn, 'click', openDashboard);
  bind(elements.exportBtn, 'click', exportReport);
  bind(elements.settingsBtn, 'click', () => { if (elements.settingsModal) elements.settingsModal.style.display = 'flex'; });
  bind(elements.closeSettings, 'click', () => { if (elements.settingsModal) elements.settingsModal.style.display = 'none'; });
  bind(elements.saveKeysBtn, 'click', saveApiKeys);
  bind(elements.scanBarcodeBtn, 'click', () => openScanner('barcode'));
  bind(elements.scanPictureBtn, 'click', () => openScanner('picture'));
  bind(elements.closeScanner, 'click', closeScanner);
  bind(elements.openCameraBtn, 'click', startCamera);
  bind(elements.scannerUpload, 'change', handleFileUpload);
  bind(elements.processScanBtn, 'click', processScan);
  bind(elements.loadSheetBtn, 'click', loadCompaniesFromSheet);

  // Enter key to trigger hunt
  bind(elements.companyInput, 'keydown', (e) => {
    if (e.key === 'Enter') startHunt();
  });

  // Listen for report updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'reportUpdate') {
      updateUI(msg.report);
    }
  });

  // Load recent scans
  loadRecentScans();
  loadApiKeys();

  // --- Functions ---
  async function startHunt() {
    const companyName = elements.companyInput.value.trim();
    const directorName = elements.directorInput?.value.trim() || '';
    const location = elements.locationInput?.value.trim() || '';

    if (!companyName) {
      showToast('Please enter a company name', 'error');
      elements.companyInput.focus();
      return;
    }

    const websiteUrl = elements.websiteInput.value.trim();

    // UI: Show loading state
    elements.huntBtn.disabled = true;
    elements.huntBtnText.style.display = 'none';
    elements.huntBtnLoading.style.display = 'inline';
    elements.layerStatus.style.display = 'flex';
    elements.quickResults.style.display = 'none';

    // Reset layers
    updateLayerUI('pending', 'pending', 'pending');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'huntContacts',
        companyName,
        directorName,
        location,
        websiteUrl,
      });

      // ZAROORI CHECK: Agar background service worker crash ho jaye
      if (chrome.runtime.lastError) {
         showToast(`System Error: Background process stopped.`, 'error');
         resetHuntButton();
         return;
      }

      if (response && response.success) {
        currentReport = response.report;
        updateUI(response.report);
        showToast('Scan complete! 🎯', 'success');
        loadRecentScans();
      } else {
        showToast(`Error: ${response?.error || 'Unknown issue'}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }

    resetHuntButton();
  }

  async function loadCompaniesFromSheet() {
    const sheetUrl = elements.sheetUrlInput?.value.trim();
    if (!sheetUrl) {
      showToast('Please enter Google Sheet URL', 'error');
      return;
    }

    try {
      const parsedUrl = new URL(sheetUrl);
      const match = parsedUrl.pathname.match(/\/d\/(.+?)\//);
      if (!match) throw new Error('Invalid Google Sheet URL');
      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

      showToast('Loading companies from sheet...', 'info');
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Unable to fetch sheet (publish to web required)');

      const text = await res.text();
      const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0);
      if (!rows.length) throw new Error('No rows found in sheet');

      const companies = rows.map(row => row.split(',')[0].trim()).filter(v => v);
      if (!companies.length) throw new Error('No company name found in sheet');

      showToast(`Found ${companies.length} companies. Starting hunts...`, 'success');
      for (const company of companies) {
        elements.companyInput.value = company;
        await startHunt();
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } catch (error) {
      console.error('Sheet load failed:', error);
      showToast(`Sheet load failed: ${error.message}`, 'error');
    }
  }

  // Button reset karne ka helper function
  function resetHuntButton() {
    elements.huntBtn.disabled = false;
    elements.huntBtnText.style.display = 'inline';
    elements.huntBtnLoading.style.display = 'none';
  }

  function updateUI(report) {
    currentReport = report;

    // Update layer status
    updateLayerUI(
      report.layers?.social || 'pending',
      report.layers?.website || 'pending',
      report.layers?.api || 'pending'
    );

    // Update stats
    const emailCount = report.directContact?.emails?.length || 0;
    const phoneCount = report.directContact?.phones?.length || 0;
    const socialCount = Object.keys(report.socialLinks || {}).length;
    const peopleCount = report.people?.length || 0;

    animateNumber(elements.emailCount, emailCount);
    animateNumber(elements.phoneCount, phoneCount);
    animateNumber(elements.socialCount, socialCount);
    animateNumber(elements.peopleCount, peopleCount);

    // Show results
    if (report.status === 'complete' || emailCount + phoneCount + socialCount + peopleCount > 0) {
      elements.quickResults.style.display = 'block';
    }
  }

  function updateLayerUI(social, website, api) {
    setLayerState(elements.layer1, social);
    setLayerState(elements.layer2, website);
    setLayerState(elements.layer3, api);
  }

  function setLayerState(el, state) {
    el.className = `layer-item ${state}`;
    const badge = el.querySelector('.layer-badge');
    const labels = {
      pending: 'Pending',
      scanning: 'Scanning...',
      complete: 'Complete ✓',
      error: 'Error ✗',
      skipped: 'Skipped',
    };
    badge.textContent = labels[state] || state;
  }

  function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const step = target > current ? 1 : -1;
    const duration = 400;
    const steps = Math.abs(target - current);
    const interval = duration / steps;

    let i = current;
    const timer = setInterval(() => {
      i += step;
      el.textContent = i;
      if (i === target) clearInterval(timer);
    }, Math.max(interval, 30));
  }

  function handleTabBlast() {
    if (!currentReport?.allLinks?.length) {
      showToast('No links found to open', 'error');
      return;
    }

    const count = currentReport.allLinks.length;
    if (confirm(`🚀 This will open ${count} tabs. Continue?`)) {
      chrome.runtime.sendMessage({
        action: 'tabBlast',
        links: currentReport.allLinks,
      });
      showToast(`Launching ${count} tabs! 🚀`, 'success');
    }
  }

  function openDashboard() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId }).catch(() => {
          // Fallback: open side panel page in a new tab
          chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel/sidepanel.html') });
        });
      }
    });
  }

  function exportReport() {
    if (!currentReport) {
      showToast('No report to export', 'error');
      return;
    }

    const report = currentReport;
    let text = `═══════════════════════════════════════════\n`;
    text += `       KA ALPHA ANTIGEN — CONTACT REPORT\n`;
    text += `═══════════════════════════════════════════\n\n`;
    text += `Company: ${report.companyName}\n`;
    text += `Website: ${report.websiteUrl || 'N/A'}\n`;
    text += `Scanned: ${new Date(report.timestamp).toLocaleString()}\n\n`;

    text += `───────── OFFICIAL INFO ─────────\n`;
    text += `Headquarters: ${report.official?.headquarters || 'N/A'}\n`;
    text += `Year Founded: ${report.official?.yearFounded || 'N/A'}\n`;
    text += `Industry: ${report.official?.industry || 'N/A'}\n\n`;

    text += `───────── EMAILS ─────────\n`;
    (report.directContact?.emails || []).forEach(e => text += `  📧 ${e}\n`);
    if (!report.directContact?.emails?.length) text += `  No emails found\n`;
    text += `\n`;

    text += `───────── PHONES ─────────\n`;
    (report.directContact?.phones || []).forEach(p => text += `  📱 ${p}\n`);
    if (!report.directContact?.phones?.length) text += `  No phones found\n`;
    text += `\n`;

    text += `───────── PEOPLE ─────────\n`;
    (report.people || []).forEach(p => {
      text += `  👤 ${p.name}`;
      if (p.title) text += ` — ${p.title}`;
      text += `\n`;
      if (p.email) text += `     Email: ${p.email}\n`;
      if (p.phone) text += `     Phone: ${p.phone}\n`;
      if (p.linkedin) text += `     LinkedIn: ${p.linkedin}\n`;
    });
    if (!report.people?.length) text += `  No people found\n`;
    text += `\n`;

    text += `───────── SOCIAL LINKS ─────────\n`;
    Object.entries(report.socialLinks || {}).forEach(([platform, data]) => {
      text += `  ${data?.icon || '🔗'} ${platform}: ${data?.url || 'N/A'}\n`;
    });
    text += `\n`;

    text += `───────── TECH STACK ─────────\n`;
    text += `  ${(report.activity?.techStack || []).join(', ') || 'Not detected'}\n\n`;

    text += `═══════════════════════════════════════════\n`;
    text += `  Generated by KA Alpha Antigen v1.0 🧬\n`;
    text += `═══════════════════════════════════════════\n`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Report copied to clipboard! 📋', 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
  }

  async function loadRecentScans() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getHistory' });
      const reports = response?.reports || [];

      if (reports.length === 0) {
        elements.recentScans.innerHTML = '<div class="empty-state">No scans yet. Enter a company name above to start!</div>';
        return;
      }

      elements.recentScans.innerHTML = reports.slice(0, 5).map(report => `
        <div class="recent-item" data-id="${report.id}" data-report='${JSON.stringify(report).replace(/'/g, "&#39;")}'>
          <div class="recent-item-info">
            <span class="recent-item-name">${report.companyName || 'Unknown'}</span>
            <span class="recent-item-date">${new Date(report.timestamp).toLocaleDateString()} ${new Date(report.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="recent-item-stats">
            <span>📧 ${report.directContact?.emails?.length || 0}</span>
            <span>📱 ${report.directContact?.phones?.length || 0}</span>
            <span>🔗 ${Object.keys(report.socialLinks || {}).length}</span>
          </div>
        </div>
      `).join('');

      // Click handler for recent items
      elements.recentScans.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
          try {
            const report = JSON.parse(item.getAttribute('data-report'));
            currentReport = report;
            elements.companyInput.value = report.companyName || '';
            elements.websiteInput.value = report.websiteUrl || '';
            updateUI(report);
            elements.layerStatus.style.display = 'flex';
            elements.quickResults.style.display = 'block';
          } catch (e) { }
        });
      });
    } catch (e) { }
  }

  async function loadApiKeys() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
      const keys = response?.keys || {};
      if (keys.APOLLO_API_KEY) elements.apolloKey.value = keys.APOLLO_API_KEY;
      if (keys.HUNTER_API_KEY) elements.hunterKey.value = keys.HUNTER_API_KEY;
      if (keys.ROCKETREACH_API_KEY) elements.rocketreachKey.value = keys.ROCKETREACH_API_KEY;
      if (keys.GOOGLE_CSE_API_KEY) elements.googleKey.value = keys.GOOGLE_CSE_API_KEY;
      if (keys.GOOGLE_CSE_CX) elements.googleCx.value = keys.GOOGLE_CSE_CX;
      if (keys.IMGBB_API_KEY) elements.imgbbKey.value = keys.IMGBB_API_KEY;
      
      // Load Google Apps Script URL from storage
      const storage = await chrome.storage.local.get('SHEET_SCRIPT_URL');
      if (storage.SHEET_SCRIPT_URL) {
        elements.sheetScriptUrlInput.value = storage.SHEET_SCRIPT_URL;
      }
    } catch (e) { }
  }

  function saveApiKeys() {
    const sheetScriptUrl = elements.sheetScriptUrlInput?.value.trim() || '';
    
    // Validate Google Apps Script URL if provided
    if (sheetScriptUrl && !isValidAppsScriptUrl(sheetScriptUrl)) {
      showToast('❌ Invalid Google Apps Script URL. Must start with https://script.google.com/', 'error');
      return;
    }
    
    const keys = {
      APOLLO_API_KEY: elements.apolloKey.value.trim(),
      HUNTER_API_KEY: elements.hunterKey.value.trim(),
      ROCKETREACH_API_KEY: elements.rocketreachKey.value.trim(),
      GOOGLE_CSE_API_KEY: elements.googleKey.value.trim(),
      GOOGLE_CSE_CX: elements.googleCx.value.trim(),
      IMGBB_API_KEY: elements.imgbbKey.value.trim(),
    };

    chrome.runtime.sendMessage({ action: 'saveApiKeys', keys }, () => {
      // Save Google Apps Script URL separately
      if (sheetScriptUrl) {
        chrome.storage.local.set({ SHEET_SCRIPT_URL: sheetScriptUrl }, () => {
          showToast('✅ Settings saved! Google Sheets integration active.', 'success');
          elements.settingsModal.style.display = 'none';
        });
      } else {
        chrome.storage.local.remove('SHEET_SCRIPT_URL', () => {
          showToast('✅ API keys saved! (Google Sheets integration disabled)', 'success');
          elements.settingsModal.style.display = 'none';
        });
      }
    });
  }
  
  function isValidAppsScriptUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/d\//.test(url);
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // --- Scanner Functions ---
  function openScanner(mode) {
    scannerMode = mode;
    elements.scannerTitle.textContent = mode === 'barcode' ? '🏷️ Scan Barcode' : '📷 Visual Search';
    elements.scannerNote.textContent = mode === 'barcode' ? 'Scan a product barcode to extract details.' : 'Upload a product picture to find matches.';
    elements.scannerResult.style.display = 'none';
    elements.processScanBtn.style.display = 'none';
    elements.scannerImg.style.display = 'none';
    elements.scannerVideo.style.display = 'none';
    elements.scannerPlaceholder.style.display = 'flex';
    elements.scannerPlaceholder.textContent = 'No image selected';
    elements.scannerUpload.value = '';
    scannedBarcodeText = '';
    scannedImageFile = null;
    elements.scannerModal.style.display = 'flex';
  }

  function closeScanner() {
    elements.scannerModal.style.display = 'none';
    stopCamera();
  }

  async function startCamera() {
    elements.scannerImg.style.display = 'none';
    elements.scannerPlaceholder.style.display = 'none';
    elements.scannerVideo.style.display = 'block';
    
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      elements.scannerVideo.srcObject = videoStream;
      elements.scannerVideo.play();
      
      if (scannerMode === 'barcode' && 'BarcodeDetector' in window) {
        scanVideoFrame();
      } else if (scannerMode === 'picture') {
        elements.scannerPlaceholder.textContent = 'Please use upload for picture scanning functionality.';
        elements.scannerPlaceholder.style.display = 'block';
        elements.scannerVideo.style.display = 'none';
        stopCamera();
      }
    } catch (e) {
      // Chrome Popup blocks camera permission
      console.error("Camera Access Denied:", e);
      showToast('📷 Camera blocked in popup. Click "📁 Upload" button to select an image instead.', 'warning');
      elements.scannerPlaceholder.textContent = '📷 Camera blocked by browser\n\nClick "📁 Upload" below to select an image file.';
      elements.scannerPlaceholder.style.display = 'block';
      elements.scannerVideo.style.display = 'none';
      // Focus upload button
      if (elements.scannerUpload) {
        setTimeout(() => elements.scannerUpload.click(), 500);
      }
    }
  }

  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function scanVideoFrame() {
    if (!videoStream || scannerMode !== 'barcode') return;
    
    const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'upc_a', 'code_128'] });
    barcodeDetector.detect(elements.scannerVideo)
      .then(barcodes => {
        if (barcodes.length > 0) {
          scannedBarcodeText = barcodes[0].rawValue;
          stopCamera();
          elements.scannerVideo.style.display = 'none';
          elements.scannerPlaceholder.style.display = 'block';
          elements.scannerPlaceholder.textContent = `Scanned Barcode: ${scannedBarcodeText}`;
          elements.scannerResult.textContent = `Found: ${scannedBarcodeText}`;
          elements.scannerResult.style.display = 'block';
          elements.processScanBtn.style.display = 'block';
        } else {
          animationFrameId = requestAnimationFrame(scanVideoFrame);
        }
      }).catch(() => {
        animationFrameId = requestAnimationFrame(scanVideoFrame);
      });
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    stopCamera();
    
    scannedImageFile = file;
    const url = URL.createObjectURL(file);
    elements.scannerVideo.style.display = 'none';
    elements.scannerPlaceholder.style.display = 'none';
    elements.scannerImg.style.display = 'block';
    elements.scannerImg.src = url;

    if (scannerMode === 'barcode') {
      if ('BarcodeDetector' in window) {
        const img = new Image();
        img.onload = () => {
          const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'upc_a', 'code_128'] });
          barcodeDetector.detect(img).then(barcodes => {
            if (barcodes.length > 0) {
              scannedBarcodeText = barcodes[0].rawValue;
              elements.scannerResult.textContent = `Found Barcode: ${scannedBarcodeText}`;
              elements.scannerResult.style.display = 'block';
              elements.processScanBtn.style.display = 'block';
            } else {
              showToast('No barcode found in image', 'error');
            }
          }).catch(() => showToast('Error scanning barcode', 'error'));
        };
        img.src = url;
      } else {
         showToast('Barcode API not supported in this browser.', 'error');
      }
    } else if (scannerMode === 'picture') {
      elements.scannerResult.textContent = `Image ready for visual search`;
      elements.scannerResult.style.display = 'block';
      elements.processScanBtn.style.display = 'block';
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unable to read file as base64'));
          return;
        }
        const base64 = result.startsWith('data:') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageForVisualSearch(file) {
    const endpoints = [
      {
        name: 'catbox.moe',
        url: 'https://catbox.moe/user/api.php',
        type: 'catbox',
        parseLink: (response) => response.trim(),
      },
      {
        name: 'file.io',
        url: 'https://file.io',
        type: 'form',
        parseLink: (json) => json?.link ?? json?.data?.link,
      },
      {
        name: 'anonfiles',
        url: 'https://api.anonfiles.com/upload',
        type: 'form',
        parseLink: (json) => json?.data?.file?.url?.full || json?.data?.file?.url?.short,
      },
    ];

    const imgbbKey = elements.imgbbKey?.value.trim();
    if (imgbbKey) {
      endpoints.push({
        name: 'imgbb',
        url: `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`,
        type: 'imgbb',
        parseLink: (json) => json?.data?.url,
      });
    }

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        let res;

        if (endpoint.type === 'catbox') {
          // Catbox.moe upload
          const formData = new FormData();
          formData.append('reqtype', 'fileupload');
          formData.append('file', file);
          res = await fetch(endpoint.url, { method: 'POST', body: formData });
          
          if (!res.ok) {
            throw new Error(`Upload (${endpoint.name}) failed HTTP ${res.status}`);
          }
          
          const responseText = await res.text();
          if (responseText.includes('catbox.moe')) {
            return { provider: endpoint.name, link: responseText };
          } else {
            throw new Error(`Catbox upload response invalid: ${responseText.slice(0, 100)}`);
          }
        } else if (endpoint.type === 'imgbb') {
          const base64 = await readFileAsBase64(file);
          const formData = new FormData();
          formData.append('image', base64);
          res = await fetch(endpoint.url, { method: 'POST', body: formData });
        } else {
          const formData = new FormData();
          formData.append('file', file);
          res = await fetch(endpoint.url, { method: 'POST', body: formData });
        }

        if (!res.ok) {
          throw new Error(`Upload (${endpoint.name}) failed HTTP ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const rawText = await res.text();
          throw new Error(`Upload (${endpoint.name}) returned non-JSON content-type: ${contentType}; body:${rawText.slice(0,200)}`);
        }

        const json = await res.json();
        const link = endpoint.parseLink(json);
        if (!link) {
          throw new Error(`Upload (${endpoint.name}) response has no public link: ${JSON.stringify(json)}`);
        }

        return { provider: endpoint.name, link };
      } catch (err) {
        lastError = err;
        console.warn(`uploadImageForVisualSearch: ${endpoint.name} failed`, err);
      }
    }

    throw lastError || new Error('No image upload provider available');
  }
        if (!res.ok) {
          throw new Error(`Upload (${endpoint.name}) failed HTTP ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const rawText = await res.text();
          throw new Error(`Upload (${endpoint.name}) returned non-JSON content-type: ${contentType}; body:${rawText.slice(0,200)}`);
        }

        const json = await res.json();
        const link = endpoint.parseLink(json);
        if (!link) {
          throw new Error(`Upload (${endpoint.name}) response has no public link: ${JSON.stringify(json)}`);
        }

        return { provider: endpoint.name, link };
      } catch (err) {
        lastError = err;
        console.warn(`uploadImageForVisualSearch: ${endpoint.name} failed`, err);
      }
    }

    throw lastError || new Error('No image upload provider available');
  }

  async function extractTextWithOCR(imageUrl) {
    try {
      const params = new URLSearchParams({
        url: imageUrl,
        apikey: 'K87899142C0',  // Free OCR.Space API key
        language: 'eng',
        isOverlayRequired: 'false',
      });
      
      const response = await fetch(`https://api.ocr.space/parse?${params.toString()}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (KAAlphaAntigen/1.0)' },
      });
      
      if (!response.ok) {
        throw new Error(`OCR.Space API returned HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.IsErroredOnProcessing) {
        throw new Error(data.ErrorMessage || 'OCR processing failed');
      }
      
      const text = data.ParsedText?.trim() || '';
      if (!text) {
        throw new Error('No text extracted from image');
      }
      
      return text;
    } catch (error) {
      console.error('OCR extraction error:', error);
      throw new Error('OCR extraction failed: ' + error.message);
    }
  }

  async function processScan() {
    const originalText = elements.processScanBtn.textContent;
    elements.processScanBtn.textContent = 'Processing...';
    elements.processScanBtn.disabled = true;

    try {
      if (scannerMode === 'barcode') {
        closeScanner();
        elements.companyInput.value = scannedBarcodeText;
        showToast('Searching product...', 'info');
        window.open(`https://www.google.com/search?q=${encodeURIComponent(scannedBarcodeText + ' product')}`, '_blank');
      } else if (scannerMode === 'picture') {
        if (!scannedImageFile) {
          throw new Error('No image selected for visual search. Please upload an image first.');
        }

        // Upload image
        showToast('📤 Uploading image...', 'info');
        const uploadResult = await uploadImageForVisualSearch(scannedImageFile);
        console.log(`Image uploaded to ${uploadResult.provider}: ${uploadResult.link}`);

        // Extract text via OCR
        showToast('🔍 Extracting text with OCR...', 'info');
        const extractedText = await extractTextWithOCR(uploadResult.link);
        console.log(`OCR extracted: ${extractedText.slice(0, 100)}...`);

        // Close scanner and populate company input
        closeScanner();
        elements.companyInput.value = extractedText.trim();
        
        // Auto-trigger hunt
        showToast('🚀 Extracted text! Starting hunt...', 'success');
        await startHunt();
      } else {
        showToast('Unknown scan mode. Please select Camera or Upload.', 'error');
      }
    } catch (e) {
      console.error('Visual scan processing failed:', e);
      showToast(`Error: ${e?.message || 'visual search failed'}`, 'error');
      
      // Fallback: Offer Google Lens as alternative if we have the image URL
      if (scannerMode === 'picture' && scannedImageFile) {
        try {
          const uploadResult = await uploadImageForVisualSearch(scannedImageFile);
          showToast('Falling back to Google Lens...', 'info');
          window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(uploadResult.link)}`, '_blank');
        } catch { /* Fallback failed, already showing error above */ }
      }
    } finally {
      elements.processScanBtn.textContent = originalText;
      elements.processScanBtn.disabled = false;
    }
  }
});
