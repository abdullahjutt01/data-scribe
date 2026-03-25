// ============================================================
// KA Alpha Antigen — Google Apps Script (Full Production)
// Deploy: Extensions > Apps Script > Deploy > New Deployment
//   Type: Web App | Execute As: Me | Who has access: Anyone
// ============================================================

// Column mapping — matches exactly what the extension sends
const COLUMNS = [
  'Timestamp',       // A
  'Company Name',    // B
  'Website',         // C
  'Emails',          // D
  'Phones',          // E
  'LinkedIn',        // F
  'Facebook',        // G
  'Instagram',       // H
  'Twitter/X',       // I
  'YouTube',         // J
  'TikTok',          // K
  'Key People',      // L
  'Industry',        // M
  'Headquarters',    // N
  'Year Founded',    // O
  'Employees',       // P
  'Revenue',         // Q
  'Tech Stack',      // R
];

// ── POST handler: receives data from extension export button ──
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Auto-create styled headers on first row if sheet is empty
    ensureHeaders(sheet);

    const data = JSON.parse(e.postData.contents);

    // Build row in exact column order
    const row = [
      new Date(),                    // A: Timestamp (server-side for accuracy)
      data.companyName   || '',      // B: Company Name
      data.websiteUrl    || '',      // C: Website
      data.emails        || '',      // D: All Emails
      data.phones        || '',      // E: All Phones
      data.linkedin      || '',      // F: LinkedIn
      data.facebook      || '',      // G: Facebook
      data.instagram     || '',      // H: Instagram
      data.twitter       || '',      // I: Twitter/X
      data.youtube       || '',      // J: YouTube
      data.tiktok        || '',      // K: TikTok
      data.people        || '',      // L: Key People (Name, Title, Email, Phone)
      data.industry      || '',      // M: Industry
      data.headquarters  || '',      // N: Headquarters
      data.yearFounded   || '',      // O: Year Founded
      data.employeeCount || '',      // P: Employee Count
      data.revenue       || '',      // Q: Revenue
      data.techStack     || '',      // R: Tech Stack
    ];

    sheet.appendRow(row);

    // Auto-resize columns for readability
    sheet.autoResizeColumns(1, COLUMNS.length);

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        row: sheet.getLastRow(),
        company: data.companyName
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET handler: extension "Load from Sheet" button reads companies ──
function doGet(e) {
  try {
    const action = (e.parameter.action || '').toLowerCase();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (action === 'read') {
      const rows = sheet.getDataRange().getValues();
      if (rows.length < 2) {
        return jsonResponse({ status: 'ok', companies: [] });
      }

      // Col B = Company Name, Col C = Website
      const companies = rows.slice(1).map(row => ({
        name:    String(row[1] || '').trim(),
        website: String(row[2] || '').trim(),
      })).filter(c => c.name.length > 1);

      return jsonResponse({ status: 'ok', total: companies.length, companies });
    }

    // Default: health check
    return jsonResponse({
      status: 'ok',
      message: 'KA Alpha Antigen Script Active ✅',
      columns: COLUMNS,
      rows: sheet.getLastRow()
    });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ── Helper: Ensure header row exists with styling ──
function ensureHeaders(sheet) {
  if (sheet.getLastRow() > 0) return; // Headers already exist

  sheet.appendRow(COLUMNS);

  const headerRange = sheet.getRange(1, 1, 1, COLUMNS.length);
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);
  headerRange.setBackground('#1e0a3c');   // Deep purple
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  headerRange.setBorder(true, true, true, true, true, true);

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 140);  // Timestamp
  sheet.setColumnWidth(2, 180);  // Company
  sheet.setColumnWidth(3, 200);  // Website
  sheet.setColumnWidth(4, 250);  // Emails
  sheet.setColumnWidth(5, 160);  // Phones
  sheet.setColumnWidth(6, 220);  // LinkedIn
  sheet.setColumnWidth(7, 200);  // Facebook
  sheet.setColumnWidth(8, 200);  // Instagram
  sheet.setColumnWidth(9, 180);  // Twitter
  sheet.setColumnWidth(10, 180); // YouTube
  sheet.setColumnWidth(11, 160); // TikTok
  sheet.setColumnWidth(12, 300); // Key People
  sheet.setColumnWidth(13, 160); // Industry
  sheet.setColumnWidth(14, 200); // HQ
  sheet.setColumnWidth(15, 100); // Year Founded
  sheet.setColumnWidth(16, 100); // Employees
  sheet.setColumnWidth(17, 120); // Revenue
  sheet.setColumnWidth(18, 180); // Tech Stack
}

// ── Helper: Return JSON response ──
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
