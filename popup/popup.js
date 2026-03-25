// ============================================================
// KA Alpha Antigen — Popup Script (Production Ready)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    companyInput: document.getElementById('companyInput'),
    directorInput: document.getElementById('directorInput'),
    locationInput: document.getElementById('locationInput'),
    websiteInput: document.getElementById('websiteInput'),
    sheetUrlInput: document.getElementById('sheetUrlInput'),
    loadSheetBtn: document.getElementById('loadSheetBtn'),
    bulkInput: document.getElementById('bulkInput'),
    bulkHuntBtn: document.getElementById('bulkHuntBtn'),
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
    exportAllBtn: document.getElementById('exportAllBtn'),
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
    scriptUrl: document.getElementById('scriptUrl'),
    testScriptBtn: document.getElementById('testScriptBtn'),
    enableLayer2: document.getElementById('enableLayer2'),
    enableApollo: document.getElementById('enableApollo'),
    enableHunter: document.getElementById('enableHunter'),
    enableRocketReach: document.getElementById('enableRocketReach'),
    enableGoogleSearch: document.getElementById('enableGoogleSearch'),
    enableAutoSheets: document.getElementById('enableAutoSheets'),
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
  let scannedBarcodeText = '';
  let scannedImageFile = null;

  // --- Initialization ---
  loadApiKeys();
  loadRecentScans();
  setupEventListeners();

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'reportUpdate') {
      updateUI(msg.report);
    }
  });

  // --- Event Listeners Binding ---
  function setupEventListeners() {
    elements.settingsBtn?.addEventListener('click', () => elements.settingsModal.style.display = 'flex');
    elements.closeSettings?.addEventListener('click', () => elements.settingsModal.style.display = 'none');
    elements.saveKeysBtn?.addEventListener('click', saveApiKeys);
    elements.huntBtn?.addEventListener('click', startHunt);
    elements.bulkHuntBtn?.addEventListener('click', startBulkHunt);
    elements.loadSheetBtn?.addEventListener('click', loadCompaniesFromSheet);
    elements.testScriptBtn?.addEventListener('click', testScriptConnection);
    elements.openDashboardBtn?.addEventListener('click', openDashboard);
    elements.exportBtn?.addEventListener('click', exportReport);
    elements.exportAllBtn?.addEventListener('click', exportAllResults);
    elements.tabBlastBtn?.addEventListener('click', handleTabBlast);
    elements.scanBarcodeBtn?.addEventListener('click', () => openScanner('barcode'));
    elements.scanPictureBtn?.addEventListener('click', () => openScanner('picture'));
    elements.closeScanner?.addEventListener('click', closeScanner);
    elements.openCameraBtn?.addEventListener('click', startCamera);
    elements.scannerUpload?.addEventListener('change', handleFileUpload);
    elements.processScanBtn?.addEventListener('click', processScan);
    
    // Enter key support
    elements.companyInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startHunt();
    });
  }

  // --- Core Functions ---

  async function startHunt() {
    const companyName = elements.companyInput.value.trim();
    if (!companyName) {
      showToast('Please enter a company name', 'error');
      elements.companyInput.focus();
      return;
    }

    const directorName = elements.directorInput?.value.trim() || '';
    const location = elements.locationInput?.value.trim() || '';
    const websiteUrl = elements.websiteInput.value.trim();

    // UI Feedback
    elements.huntBtn.disabled = true;
    elements.huntBtnText.style.display = 'none';
    elements.huntBtnLoading.style.display = 'inline-flex';
    elements.layerStatus.style.display = 'block';
    elements.quickResults.style.display = 'none';
    updateLayerUI('pending', 'pending', 'pending');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'huntContacts',
        companyName,
        directorName,
        location,
        websiteUrl,
      });

      if (response?.success) {
        currentReport = response.report;
        updateUI(response.report);
        showToast('Target intelligence acquired! 🎯', 'success');
        loadRecentScans();
      } else {
        showToast(`Error: ${response?.error || 'Unknown issue'}`, 'error');
      }
    } catch (err) {
      showToast('Hunt failed. Check internet connection.', 'error');
    } finally {
      elements.huntBtn.disabled = false;
      elements.huntBtnText.style.display = 'inline';
      elements.huntBtnLoading.style.display = 'none';
    }
  }

  async function startBulkHunt() {
    const text = elements.bulkInput?.value.trim();
    if (!text) {
      showToast('Please paste company name list', 'error');
      return;
    }

    const companies = text.split('\n').map(line => ({ name: line.trim() })).filter(c => c.name);
    if (!companies.length) return;

    elements.bulkHuntBtn.disabled = true;
    elements.bulkHuntBtn.textContent = '⏳ Engine Warming Up...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'bulkHunt', companies });
      if (response?.success) {
        showToast(`Bulk Hunt Complete — ${response.results?.length || 0} targets! 🚀`, 'success');
        loadRecentScans();
      } else {
        showToast(`Error: ${response?.error}`, 'error');
      }
    } catch (err) {
      showToast('Bulk hunt failed. Check background console.', 'error');
    } finally {
      elements.bulkHuntBtn.disabled = false;
      elements.bulkHuntBtn.innerHTML = '🚀 START BULK HUNT<span class="bulk-estimate">Estimate: 12 mins</span><span class="bulk-diamond">✦</span>';
    }
  }

  async function loadCompaniesFromSheet() {
    const url = elements.sheetUrlInput?.value.trim();
    if (!url || !url.includes('docs.google.com')) {
      showToast('Invalid Google Sheet URL', 'error');
      return;
    }

    const apiKeysStore = await chrome.storage.local.get('apiKeys');
    const scriptUrl = apiKeysStore.apiKeys?.SCRIPT_URL;

    // --- Case A: Secure Proxy (Recommended) ---
    if (scriptUrl && scriptUrl.startsWith('https://script.google.com')) {
      elements.loadSheetBtn.disabled = true;
      elements.loadSheetBtn.textContent = '📥 Fetching (Secure)...';
      try {
          const fetchUrl = `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}action=read&sheetUrl=${encodeURIComponent(url)}`;
          const response = await chrome.runtime.sendMessage({ action: 'proxyFetch', url: fetchUrl });
          if (!response?.success) throw new Error(response?.error || 'Connection failed');
          const companies = response.data.companies || [];
          if (!companies.length) throw new Error('No data found');
          showToast(`Loaded ${companies.length} rows (Secure) 🧬`, 'success');
          chrome.runtime.sendMessage({ action: 'bulkHunt', companies });
          return;
      } catch (e) {
          console.warn('Secure fetch failed, checking CSV fallback...', e);
      } finally {
          elements.loadSheetBtn.disabled = false;
          elements.loadSheetBtn.textContent = '📥 Load companies from Sheet';
      }
    }

    // --- Case B: CSV Fallback (Zero-API Mode) ---
    // Works with: File > Share > Publish to Web > CSV
    showToast('Using CSV Fallback...', 'info');
    elements.loadSheetBtn.disabled = true;
    elements.loadSheetBtn.textContent = '📥 Loading CSV...';
    try {
      // Build correct CSV export URL
      let csvUrl = url;
      if (url.includes('/edit') || url.includes('/view')) {
        // Standard sheet URL → extract sheet ID and build CSV link
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const gidMatch = url.match(/gid=(\d+)/);
        if (idMatch) {
          csvUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidMatch ? '&gid=' + gidMatch[1] : ''}`;
        }
      }

      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Sheet fetch failed. Is it 'Published to Web' as CSV?");
      const text = await res.text();

      // CSV Parse — handles quoted fields
      function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        result.push(current.trim());
        return result;
      }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) throw new Error('Sheet is empty or missing data rows');

      // Col A = Company Name (index 0), Col D = Website (index 3)
      const companies = lines.slice(1).map(line => {
        const parts = parseCSVLine(line);
        const name = (parts[0] || '').replace(/^"|"$/g, '').trim();
        const website = (parts[3] || '').replace(/^"|"$/g, '').trim(); // Column D
        return { name, website };
      }).filter(c => c.name && c.name.length > 1);

      if (!companies.length) throw new Error('No valid company names found in Column A');

      showToast(`Loaded ${companies.length} companies from Sheet ✅`, 'success');
      chrome.runtime.sendMessage({ action: 'bulkHunt', companies });
    } catch (e) {
      showToast(`CSV Error: ${e.message}`, 'error');
    } finally {
      elements.loadSheetBtn.disabled = false;
      elements.loadSheetBtn.textContent = '⬇️ LOAD COMPANIES FROM SHEET';
    }
  }

  async function processScan() {
    if (scannerMode === 'barcode') {
       if (!scannedBarcodeText) return;
       elements.companyInput.value = scannedBarcodeText;
       closeScanner();
       startHunt();
    } else {
       if (!scannedImageFile) return;
       elements.processScanBtn.disabled = true;
       elements.processScanBtn.textContent = '⏳ Uploading...';

       try {
          // 1. Catbox Upload
          const formData = new FormData();
          formData.append('reqtype', 'fileupload');
          formData.append('fileToUpload', scannedImageFile);

          const upRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
          const imageUrl = await upRes.text();
          if (!imageUrl.startsWith('http')) throw new Error("Upload failed.");

          elements.processScanBtn.textContent = '🔍 Reading Text...';

          // 2. OCR.space
          const ocrRes = await fetch(`https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(imageUrl)}&isTable=true&OCREngine=2`);
          const ocrData = await ocrRes.json();

          if (ocrData.ParsedResults?.length > 0) {
             const text = ocrData.ParsedResults[0].ParsedText.trim();
             const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
             // Find first line that isn't a header keyword
             const filters = ['company', 'naam', 'ceo', 'report', 'antigen', 'contact'];
             let targetName = "";
             for(let l of lines) {
                if (!filters.some(f => l.toLowerCase().includes(f))) {
                    targetName = l; break;
                }
             }
             if (targetName) {
                elements.companyInput.value = targetName;
                showToast(`Target Found: ${targetName}`, 'success');
                closeScanner();
                startHunt();
             } else {
                throw new Error("Could not find company name.");
             }
          } else {
             throw new Error("No text detected.");
          }
       } catch (err) {
          showToast(`OCR Error: ${err.message}`, 'error');
       } finally {
          elements.processScanBtn.disabled = false;
          elements.processScanBtn.textContent = '🔍 Search Product';
       }
    }
  }

  // --- UI Helpers ---

  function updateUI(report) {
    currentReport = report;
    updateLayerUI(report.layers?.social || 'pending', report.layers?.website || 'pending', report.layers?.api || 'pending');
    
    animateNumber(elements.emailCount, report.directContact?.emails?.length || 0);
    animateNumber(elements.phoneCount, report.directContact?.phones?.length || 0);
    animateNumber(elements.socialCount, Object.keys(report.socialLinks || {}).length);
    animateNumber(elements.peopleCount, report.people?.length || 0);

    if (report.status === 'complete' || report.people?.length > 0) {
      elements.quickResults.style.display = 'block';
    }
  }

  function updateLayerUI(social, website, api) {
    const states = { pending:'Pending', scanning:'Scanning...', complete:'Complete ✓', error:'Error ✗', skipped:'Skipped' };
    [ [elements.layer1, social], [elements.layer2, website], [elements.layer3, api] ].forEach(([el, st]) => {
       el.className = `layer-item ${st}`;
       el.querySelector('.layer-badge').textContent = states[st] || st;
    });
  }

  function animateNumber(el, target) {
    let curr = parseInt(el.textContent) || 0;
    if (curr === target) return;
    const interval = setInterval(() => {
       if (curr < target) curr++; else curr--;
       el.textContent = curr;
       if (curr === target) clearInterval(interval);
    }, 50);
  }

  async function loadRecentScans() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getHistory' });
      const reports = res?.reports || [];
      if (!reports.length) {
        elements.recentScans.innerHTML = '<div class="empty-state">No hunting history yet.</div>';
        return;
      }
      elements.recentScans.innerHTML = reports.slice(0, 5).map(r => `
        <div class="recent-item" data-id="${r.id}" data-report='${JSON.stringify(r).replace(/'/g, "&#39;")}'>
          <div class="recent-item-info">
            <span class="recent-item-name">${r.companyName}</span>
            <span class="recent-item-date">${new Date(r.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="recent-item-stats">
            <span>📧 ${r.directContact?.emails?.length || 0}</span>
            <button class="delete-recent-btn" data-id="${r.id}">×</button>
          </div>
        </div>
      `).join('');

      elements.recentScans.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-recent-btn')) return;
          const report = JSON.parse(item.getAttribute('data-report'));
          elements.companyInput.value = report.companyName;
          updateUI(report);
          elements.layerStatus.style.display = 'flex';
          elements.quickResults.style.display = 'block';
        });
      });

      elements.recentScans.querySelectorAll('.delete-recent-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Delete scan?')) {
            await chrome.runtime.sendMessage({ action: 'deleteReport', reportId: btn.dataset.id });
            loadRecentScans();
          }
        });
      });
    } catch (e) {}
  }

  async function loadApiKeys() {
    const res = await chrome.runtime.sendMessage({ action: 'getApiKeys' });
    const keys = res?.keys || {};
    elements.apolloKey.value = keys.APOLLO_API_KEY || '';
    elements.hunterKey.value = keys.HUNTER_API_KEY || '';
    elements.rocketreachKey.value = keys.ROCKETREACH_API_KEY || '';
    elements.googleKey.value = keys.GOOGLE_CSE_API_KEY || '';
    elements.googleCx.value = keys.GOOGLE_CSE_CX || '';
    elements.imgbbKey.value = keys.IMGBB_API_KEY || '';
    elements.scriptUrl.value = keys.SCRIPT_URL || '';
    if (keys.SHEET_URL) elements.sheetUrlInput.value = keys.SHEET_URL;
    
    // Toggles (default to true if undefined)
    elements.enableLayer2.checked = keys.enableLayer2 !== false;
    elements.enableApollo.checked = keys.enableApollo !== false;
    elements.enableHunter.checked = keys.enableHunter !== false;
    elements.enableRocketReach.checked = keys.enableRocketReach !== false;
    elements.enableGoogleSearch.checked = keys.enableGoogleSearch !== false;
    elements.enableAutoSheets.checked = keys.enableAutoSheets !== false;
  }

  function saveApiKeys() {
    const scriptUrlValue = elements.scriptUrl.value.trim();
    
    // Check if user accidentally pasted a spreadsheet URL
    if (scriptUrlValue.includes('docs.google.com/spreadsheets')) {
      showToast('❌ Wait! You pasted a Sheet URL. You need an Apps Script URL (starts with script.google.com).', 'error');
      elements.scriptUrl.focus();
      return;
    }

    const keys = {
      APOLLO_API_KEY: elements.apolloKey.value.trim(),
      HUNTER_API_KEY: elements.hunterKey.value.trim(),
      ROCKETREACH_API_KEY: elements.rocketreachKey.value.trim(),
      GOOGLE_CSE_API_KEY: elements.googleKey.value.trim(),
      GOOGLE_CSE_CX: elements.googleCx.value.trim(),
      IMGBB_API_KEY: elements.imgbbKey.value.trim(),
      SCRIPT_URL: scriptUrlValue,
      SHEET_URL: elements.sheetUrlInput.value.trim(),
      // Toggles
      enableLayer2: elements.enableLayer2.checked,
      enableApollo: elements.enableApollo.checked,
      enableHunter: elements.enableHunter.checked,
      enableRocketReach: elements.enableRocketReach.checked,
      enableGoogleSearch: elements.enableGoogleSearch.checked,
      enableAutoSheets: elements.enableAutoSheets.checked,
    };
    chrome.runtime.sendMessage({ action: 'saveApiKeys', keys }, () => {
      showToast('Master Vault Updated! 🔑', 'success');
      elements.settingsModal.style.display = 'none';
      loadApiKeys();
    });
  }

  async function testScriptConnection() {
    const url = elements.scriptUrl.value.trim();
    if (url.includes('docs.google.com/spreadsheets')) {
        showToast('❌ Wrong URL! Paste the Script URL from "Deploy", not the Sheet URL.', 'error');
        return;
    }
    if (!url.startsWith('https://script.google.com/')) {
        showToast('Invalid Script URL. Format: https://script.google.com/macros/s/.../exec', 'error');
        return;
    }
    elements.testScriptBtn.textContent = '⏳';
    const res = await chrome.runtime.sendMessage({ action: 'testScriptUrl', url });
    if (res.success) showToast('Secure Link active! 🧬', 'success');
    else showToast(`Link ERROR: Check if you selected "Anyone" in Deployment`, 'error');
    elements.testScriptBtn.textContent = '🧬';
  }

  function openDashboard() {
    chrome.tabs.create({ url: 'sidepanel/sidepanel.html' });
  }

  function exportReport() {
    if (!currentReport) return;
    const r = currentReport;
    const tsv = `${r.companyName}\t${r.websiteUrl || ''}\t${(r.directContact?.emails || []).join(', ')}\t${(r.directContact?.phones || []).join(', ')}`;
    navigator.clipboard.writeText(tsv).then(() => showToast('CRM Row Copied! 🛡️', 'success'));
  }

  function exportAllResults() {
    showToast('Dashboard contains full CSV export', 'info');
    openDashboard();
  }

  function handleTabBlast() {
    if (currentReport) chrome.runtime.sendMessage({ action: 'tabBlast', report: currentReport });
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // --- Scanner Logic ---
  function openScanner(mode) {
    scannerMode = mode;
    elements.scannerTitle.textContent = mode === 'barcode' ? '🏷️ Scan Barcode' : '📷 Visual Search';
    elements.scannerModal.style.display = 'flex';
  }

  function closeScanner() {
    elements.scannerModal.style.display = 'none';
    stopCamera();
  }

  async function startCamera() {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      elements.scannerVideo.srcObject = videoStream;
      elements.scannerVideo.style.display = 'block';
      elements.scannerPlaceholder.style.display = 'none';
      if (scannerMode === 'barcode' && 'BarcodeDetector' in window) scanBarcodeLoop();
    } catch (e) { showToast('Camera access blocked', 'error'); }
  }

  function stopCamera() {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
  }

  function scanBarcodeLoop() {
    const detector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'code_128'] });
    detector.detect(elements.scannerVideo).then(bc => {
      if (bc.length > 0) {
        scannedBarcodeText = bc[0].rawValue;
        elements.scannerResult.textContent = `Found: ${scannedBarcodeText}`;
        elements.scannerResult.style.display = 'block';
        elements.processScanBtn.style.display = 'block';
        stopCamera();
      } else requestAnimationFrame(scanBarcodeLoop);
    }).catch(() => requestAnimationFrame(scanBarcodeLoop));
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
      scannedImageFile = file;
      elements.scannerImg.src = URL.createObjectURL(file);
      elements.scannerImg.style.display = 'block';
      elements.scannerPlaceholder.style.display = 'none';
      elements.processScanBtn.style.display = 'block';
    }
  }

  // --- Background Event Listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'sheetUploadSuccess') {
      showToast(`📝 Synced to Sheets: ${msg.company}`, 'success');
    } else if (msg.action === 'sheetUploadError') {
      showToast(`🚫 Sheets Sync Error: ${msg.error}`, 'error');
    }
  });

});
