// ============================================================
// KA Alpha Antigen — Side Panel Dashboard Script
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  let currentReport = null;

  // Tab navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Action buttons
  document.getElementById('refreshBtn').addEventListener('click', loadLatestReport);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
  document.getElementById('exportSheetsBtn').addEventListener('click', exportGoogleSheets);
  document.getElementById('dashTabBlastBtn').addEventListener('click', handleTabBlast);

  // Listen for real-time updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'reportUpdate') {
      renderReport(msg.report);
    }
  });

  // Load latest report on open
  loadLatestReport();

  // --- Functions ---
  function loadLatestReport() {
    chrome.runtime.sendMessage({ action: 'getLatestReport' }, (response) => {
      if (response?.report) {
        renderReport(response.report);
      }
    });
  }

  function renderReport(report) {
    currentReport = report;

    // Company Banner
    document.getElementById('companyNameDisplay').textContent = report.companyName || 'Unknown Company';
    const websiteEl = document.getElementById('companyWebsite');
    if (report.websiteUrl) {
      websiteEl.textContent = report.websiteUrl;
      websiteEl.href = report.websiteUrl.startsWith('http') ? report.websiteUrl : `https://${report.websiteUrl}`;
    } else {
      websiteEl.textContent = 'No website provided';
      websiteEl.href = '#';
    }

    // Avatar with first letter
    const firstLetter = (report.companyName || '?')[0].toUpperCase();
    document.getElementById('companyAvatar').textContent = firstLetter;

    // Banner meta chips
    const metaContainer = document.getElementById('bannerMeta');
    const metaItems = [];
    if (report.official?.headquarters) metaItems.push(`📍 ${report.official.headquarters}`);
    if (report.official?.yearFounded) metaItems.push(`📅 Founded ${report.official.yearFounded}`);
    if (report.official?.industry) metaItems.push(`🏭 ${report.official.industry}`);
    if (report.official?.employeeCount) metaItems.push(`👥 ~${report.official.employeeCount} employees`);
    if (report.official?.revenue) metaItems.push(`💰 ${report.official.revenue}`);
    metaContainer.innerHTML = metaItems.map(m => `<span class="meta-chip">${m}</span>`).join('');

    // Overview stats
    const emails = report.directContact?.emails || [];
    const phones = report.directContact?.phones || [];
    const socials = Object.keys(report.socialLinks || {});
    const people = report.people || [];

    document.getElementById('ovEmails').textContent = emails.length;
    document.getElementById('ovPhones').textContent = phones.length;
    document.getElementById('ovSocials').textContent = socials.length;
    document.getElementById('ovPeople').textContent = people.length;

    // Data Matrix Table
    renderDataMatrix(report);

    // Tab Blast count
    const allLinks = report.allLinks || [];
    document.getElementById('blastCount').textContent = `${allLinks.length} tabs ready`;

    // People tab
    renderPeople(people);

    // Contact tab
    renderContacts(emails, phones);

    // Social tab
    renderSocials(report.socialLinks || {});

    // Activity tab
    renderActivity(report);
  }

  function renderDataMatrix(report) {
    const tbody = document.getElementById('dataMatrixBody');
    const rows = [
      {
        category: '🌐 Official',
        info: [report.websiteUrl, report.official?.headquarters, report.official?.yearFounded ? `Founded ${report.official.yearFounded}` : ''].filter(Boolean).join(' • ') || 'N/A',
        found: !!(report.websiteUrl || report.official?.headquarters),
      },
      {
        category: '👥 People',
        info: (report.people || []).map(p => p.name).filter(Boolean).join(', ') || 'N/A',
        found: (report.people || []).length > 0,
      },
      {
        category: '📧 Emails',
        info: (report.directContact?.emails || []).slice(0, 4).join(', ') || 'N/A',
        found: (report.directContact?.emails || []).length > 0,
      },
      {
        category: '📱 Phones',
        info: (report.directContact?.phones || []).slice(0, 3).join(', ') || 'N/A',
        found: (report.directContact?.phones || []).length > 0,
      },
      {
        category: '🔗 Social Links',
        info: Object.keys(report.socialLinks || {}).join(', ') || 'N/A',
        found: Object.keys(report.socialLinks || {}).length > 0,
      },
      {
        category: '⚡ Activity',
        info: (report.activity?.techStack || []).join(', ') || 'Not detected',
        found: (report.activity?.techStack || []).length > 0,
      },
    ];

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td><strong>${row.category}</strong></td>
        <td>${row.info}</td>
        <td><span class="status-badge ${row.found ? 'status-found' : 'status-missing'}">${row.found ? '✅ Found' : '❌ Missing'}</span></td>
      </tr>
    `).join('');
  }

  function renderPeople(people) {
    const container = document.getElementById('peopleList');
    if (!people.length) {
      container.innerHTML = '<div class="empty-state-dash">No people found yet. Run a scan first.</div>';
      return;
    }

    container.innerHTML = people.map(person => {
      const initials = (person.name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      return `
        <div class="person-card">
          <div class="person-header">
            <div class="person-avatar">${initials}</div>
            <div>
              <div class="person-name">${person.name || 'Unknown'}</div>
              <div class="person-title">${person.title || 'No title'}</div>
            </div>
          </div>
          <div class="person-details">
            ${person.email ? `<div class="person-detail">📧 <a href="mailto:${person.email}">${person.email}</a></div>` : ''}
            ${person.phone ? `<div class="person-detail">📱 ${person.phone}</div>` : ''}
            ${person.linkedin ? `<div class="person-detail">💼 <a href="${person.linkedin}" target="_blank">LinkedIn Profile</a></div>` : ''}
            ${person.confidence ? `<div class="person-detail">🎯 Confidence: ${person.confidence}%</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderContacts(emails, phones) {
    const emailContainer = document.getElementById('emailList');
    const phoneContainer = document.getElementById('phoneList');

    if (emails.length) {
      emailContainer.innerHTML = emails.map(email => `
        <div class="contact-item" style="flex-wrap:wrap;">
          <div>
            <span class="contact-value" style="display:block;">${email}</span>
            <span style="font-size:9px; color:var(--success);">✅ Proper Original</span>
          </div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <a href="mailto:${email}" class="copy-btn" style="text-decoration:none; display:inline-flex; align-items:center;">✉️ Mail</a>
            <button class="copy-btn" onclick="copyToClipboard('${email}')">📋 Copy</button>
          </div>
        </div>
      `).join('');
    } else {
      emailContainer.innerHTML = '<div class="empty-state-dash">No emails found</div>';
    }

    if (phones.length) {
      phoneContainer.innerHTML = phones.map(phone => {
        const cleanPhone = phone.replace(/\D/g, ''); // Extract digits for WA link
        // A rough guess: if length >= 10, it's likely a mobile that could have WA, otherwise landline
        const typeLabel = cleanPhone.length >= 10 ? '📱 Mobile' : '☎️ Landline';
        
        return `
        <div class="contact-item" style="flex-wrap:wrap;">
          <div>
            <span class="contact-value" style="display:block;">${phone}</span>
            <span style="font-size:9px; color:var(--text-muted);">${typeLabel}</span>
          </div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <a href="https://wa.me/${cleanPhone}" target="_blank" class="wa-check-btn">💬 WA Check</a>
            <button class="copy-btn" onclick="copyToClipboard('${phone}')">📋 Copy</button>
          </div>
        </div>
        `;
      }).join('');
    } else {
      phoneContainer.innerHTML = '<div class="empty-state-dash">No phones found</div>';
    }
  }

  function renderSocials(socialLinks) {
    const container = document.getElementById('socialGrid');
    const entries = Object.entries(socialLinks);

    if (!entries.length) {
      container.innerHTML = '<div class="empty-state-dash">No social links found</div>';
      return;
    }

    container.innerHTML = entries.map(([platform, data]) => `
      <a class="social-card" href="${data.url}" target="_blank" rel="noopener">
        <span class="social-icon">${data.icon || '🔗'}</span>
        <div class="social-info">
          <div class="social-platform">${platform}</div>
          <div class="social-url">${data.url}</div>
        </div>
        <span class="social-badge ${data.guessed ? 'badge-guessed' : 'badge-verified'}">
          ${data.guessed ? '⚠️ Guessed' : '✓ Found'}
        </span>
      </a>
    `).join('');
  }

  function renderActivity(report) {
    const techContainer = document.getElementById('techStack');
    const tech = report.activity?.techStack || [];

    if (tech.length) {
      techContainer.innerHTML = tech.map(t => `<span class="tech-chip">🛠️ ${t}</span>`).join('');
    } else {
      techContainer.innerHTML = '<div class="empty-state-dash">No tech stack detected</div>';
    }

    const summaryContainer = document.getElementById('scanSummary');
    const scanDate = report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A';
    summaryContainer.innerHTML = `
      <div>📅 <strong>Scan Date:</strong> ${scanDate}</div>
      <div>🏢 <strong>Company:</strong> ${report.companyName || 'N/A'}</div>
      <div>🌐 <strong>Website:</strong> ${report.websiteUrl || 'N/A'}</div>
      <div>📧 <strong>Emails Found:</strong> ${(report.directContact?.emails || []).length}</div>
      <div>📱 <strong>Phones Found:</strong> ${(report.directContact?.phones || []).length}</div>
      <div>🔗 <strong>Social Profiles:</strong> ${Object.keys(report.socialLinks || {}).length}</div>
      <div>👥 <strong>Key People:</strong> ${(report.people || []).length}</div>
      <div>🔍 <strong>Layer 1 (Social):</strong> ${report.layers?.social || 'N/A'}${report.layerNotes?.social ? ' — ' + report.layerNotes.social : ''}</div>
      <div>🕷️ <strong>Layer 2 (Website):</strong> ${report.layers?.website || 'N/A'}${report.layerNotes?.website ? ' — ' + report.layerNotes.website : ''}</div>
      <div>🔑 <strong>Layer 3 (API):</strong> ${report.layers?.api || 'N/A'}${report.layerNotes?.api ? ' — ' + report.layerNotes.api : ''}</div>
    `;
  }

  function handleTabBlast() {
    if (!currentReport?.allLinks?.length) {
      showDashToast('No links found to open');
      return;
    }

    const count = currentReport.allLinks.length;
    if (confirm(`🚀 Launch All Contacts?\n\nThis will open ${count} tabs:\n${currentReport.allLinks.map(l => l.label).join('\n')}\n\nContinue?`)) {
      chrome.runtime.sendMessage({ action: 'tabBlast', links: currentReport.allLinks });
      showDashToast(`Launching ${count} tabs! 🚀`);
    }
  }

  function exportGoogleSheets() {
    if (!currentReport) { showDashToast('No report to export'); return; }

    let tsv = 'Section\tAttribute\tValue\tAdditional Details\n';
    
    // --- 1. Company Details ---
    tsv += `1. Company Details\tCompany Name\t${currentReport.companyName || 'N/A'}\t\n`;
    tsv += `1. Company Details\tOfficial Website\t${currentReport.websiteUrl || 'N/A'}\t\n`;
    tsv += `1. Company Details\tIndustry\t${currentReport.official?.industry || 'N/A'}\t\n`;
    
    const hq = currentReport.official?.headquarters || '';
    const mapLink = hq ? `https://maps.google.com/?q=$${encodeURIComponent(hq)}` : 'N/A';
    tsv += `1. Company Details\tMap / Location\t${hq || 'N/A'}\tMap Link: ${mapLink}\n`;
    
    const affiliated = currentReport.official?.affiliated && currentReport.official.affiliated.length > 0 
      ? currentReport.official.affiliated.join(', ') : 'None extracted automatically';
    tsv += `1. Company Details\tLinked/Affiliated Companies\t${affiliated}\t(LinkedIn Network pages)\n`;

    // --- 2. Official Pages ---
    const socials = Object.entries(currentReport.socialLinks || {});
    if (socials.length === 0) {
      tsv += `2. Official Pages\tSocial Pages\tN/A\t\n`;
    } else {
      socials.forEach(([platform, data]) => {
        tsv += `2. Official Pages\t${platform} Official Page\t${data.url}\t\n`;
      });
    }

    // --- 3. Direct Contacts ---
    const emails = currentReport.directContact?.emails || [];
    if (emails.length === 0) tsv += `3. Direct Contacts\tDirect Email\tN/A\t\n`;
    emails.forEach(e => {
      tsv += `3. Direct Contacts\tDirect Email\t${e}\tProper / Original Valid Format\n`;
    });

    const phones = currentReport.directContact?.phones || [];
    if (phones.length === 0) tsv += `3. Direct Contacts\tDirect Phone\tN/A\t\n`;
    phones.forEach(p => {
      const isMobile = p.replace(/\D/g, '').length >= 10 ? '📱 Mobile / WhatsApp Check Link' : '☎️ Landline';
      const cleanPhone = p.replace(/\D/g, '');
      const waLink = cleanPhone.length >= 10 ? `https://wa.me/${cleanPhone}` : 'N/A';
      tsv += `3. Direct Contacts\tDirect Phone\t="${p}"\t${isMobile} (WA: ${waLink})\n`;
    });

    // --- 4. Key People & Staff ---
    const people = currentReport.people || [];
    if (people.length === 0) tsv += `4. Key People\tStaff Member\tN/A\t\n`;
    people.forEach(p => {
      let details = [];
      if (p.title) details.push(`Title: ${p.title}`);
      if (p.email) details.push(`Email: ${p.email}`);
      if (p.phone) details.push(`Phone: ${p.phone}`);
      tsv += `4. Key People\tStaff Member\t${p.name || 'Unknown'}\t${details.join(' | ')}\n`;
    });

    // Copy & Open
    navigator.clipboard.writeText(tsv).then(() => {
      showDashToast('Data Copied! Opening Google Sheets...');
      setTimeout(() => {
        window.open('https://sheets.new/', '_blank');
      }, 1500);
    }).catch(() => showDashToast('Failed to copy data'));
  }

  function exportCSV() {
    if (!currentReport) { showDashToast('No report to export'); return; }

    let csv = 'Category,Type,Value\n';
    (currentReport.directContact?.emails || []).forEach(e => csv += `Contact,Email,"${e}"\n`);
    (currentReport.directContact?.phones || []).forEach(p => csv += `Contact,Phone,"${p}"\n`);
    (currentReport.people || []).forEach(p => {
      csv += `Person,Name,"${p.name || ''}"\n`;
      if (p.title) csv += `Person,Title,"${p.title}"\n`;
      if (p.email) csv += `Person,Email,"${p.email}"\n`;
      if (p.phone) csv += `Person,Phone,"${p.phone}"\n`;
    });
    Object.entries(currentReport.socialLinks || {}).forEach(([platform, data]) => {
      csv += `Social,${platform},"${data.url}"\n`;
    });

    downloadFile(csv, `ka_antigen_${currentReport.companyName || 'report'}.csv`, 'text/csv');
    showDashToast('CSV exported! 📥');
  }

  function exportJSON() {
    if (!currentReport) { showDashToast('No report to export'); return; }
    const json = JSON.stringify(currentReport, null, 2);
    downloadFile(json, `ka_antigen_${currentReport.companyName || 'report'}.json`, 'application/json');
    showDashToast('JSON exported! 📦');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[^a-z0-9_.\-]/gi, '_');
    a.click();
    URL.revokeObjectURL(url);
  }

  function showDashToast(message) {
    const existing = document.querySelector('.dash-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'dash-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
});

// Global copy function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toasts = document.querySelectorAll('.dash-toast');
    toasts.forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'dash-toast show';
    toast.textContent = 'Copied! 📋';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  });
}
