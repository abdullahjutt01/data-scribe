# KA Alpha Antigen — Deployment & Setup Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Load Extension in Chrome

1. Open Chrome and navigate to **chrome://extensions/**
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `KA ALpha Antigen` folder
5. The extension should now appear in your extensions list

> ✅ **Your extension is now installed locally!**

---

### Step 2: Deploy Google Apps Script (Optional but Recommended)

To enable **automatic upload of hunt results to Google Sheets**, follow these steps:

#### 2a. Create a Google Sheet for Results

1. Go to **[Google Sheets](https://sheets.google.com/)**
2. Create a new spreadsheet (name it "KA Alpha Antigen Results")
3. Note the **Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/`

#### 2b. Deploy Google Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. In the Apps Script editor, **delete all default code**
3. Copy the entire code from **`google_apps_script.gs`** (in this project folder)
4. Paste it into the Apps Script editor
5. Save the project (Ctrl+S)
6. Click **"Deploy"** (top right) → **"New deployment"**
7. Select **Type**: `Web app`
8. Set **Execute as**: Your Google Account
9. Set **Who has access**: `Anyone`
10. Click **"Deploy"**
11. **Copy the deployment URL** from the dialog (looks like: `https://script.google.com/macros/d/{ID}/usercontent`)

> 💾 Keep this URL safe — you'll need it in Step 3!

#### 2c. Configure Extension with Sheet URL

1. Open the extension by clicking the **🧬 KA Alpha Antigen** icon in Chrome
2. Click **⚙️ Settings** (gear icon, top-right)
3. Scroll down to **"📊 Google Sheets Integration"**
4. Paste your Apps Script URL into the text field
5. Click **"💾 Save Settings"**

> ✅ **Google Sheets integration is now active!** Hunt results will auto-upload.

---

## 🔧 Configuration

### Add API Keys (Optional but Powerful)

For maximum contact extraction, add your API keys:

1. Click **⚙️ Settings** in the extension popup
2. Enter your API credentials:
   - **Apollo.io API Key** — Get from [apollo.io/developers](https://apollo.io/developers)
   - **Hunter.io API Key** — Get from [hunter.io](https://hunter.io)
   - **RocketReach API Key** — Get from [rocketreach.com](https://rocketreach.com)
   - **Google Custom Search API Key & CX** — Get from [Google Cloud Console](https://console.cloud.google.com/)
   - **imgbb API Key** (optional) — Get from [imgbb.com/account/api](https://imgbb.com/account/api)

3. Click **"💾 Save Settings"**

> 💡 **Tip**: Even without API keys, Layer 1 (Social) and Layer 2 (Website Crawling) work perfectly!

---

## 📋 How It Works

### Three-Layer Contact Extraction

**Layer 1: Social Media Ecosystem** 🔍
- Finds LinkedIn, Facebook, Instagram, Twitter, YouTube, TikTok profiles
- Works with: Google Custom Search API (optional)
- Status: ✅ Always active

**Layer 2: Website Deep Crawler** 🕷️
- Extracts emails, phone numbers, team members from company website
- Auto-discovers missing domains from company name
- Extracts JSON-LD structured data (team, founders, org details)
- Detects tech stack (WordPress, Shopify, Next.js, etc.)
- Status: ✅ Always active (auto-discovery included)

**Layer 3: API Power Fusion** 🔑
- Apollo.io: Org enrichment, CEO/founder data, employee lists
- Hunter.io: Domain-based email finder
- RocketReach: Executive contact database
- Status: ⚡ Available with API keys

---

## 🎯 Usage Examples

### Hunt Single Company
1. Enter company name (e.g., "Acme Corp")
2. Optionally add: Director name, location, or website URL
3. Click **"🔍 Hunt All Contacts"**
4. Watch the 3 layers scan in real-time
5. Results appear in the popup and auto-upload to Google Sheets

### Batch Hunt from Google Sheet
1. Create a Google Sheet with company names in Column A
2. **Important**: Publish the sheet to web (`File > Share > Publish to web`)
3. Copy the sheet URL
4. In extension popup, paste URL in **"📄 Google Sheet URL"** field
5. Click **"📥 Load companies from Sheet"**
6. Enter number of companies to hunt (or empty for all)
7. Extension will hunt each company sequentially with results auto-uploading

### Visual Search (OCR)
1. Click **"📷 Scan Picture"** in the popup
2. Upload an image with a company name or logo
3. Click **"🔍 Search Product"**
4. OCR extracts company name and auto-triggers hunt
5. Results appear with full contact information

---

## 🛠️ Troubleshooting

### Extension Not Loading?
- Check `chrome://extensions/` for error messages
- Reload the extension using the refresh icon
- Make sure you're using Chrome v88+ (MV3 compatible)

### Google Sheets Upload Not Working?
- ✅ Verify Apps Script URL is correct (starts with `https://script.google.com/`)
- ✅ Make sure Google Sheet is **published to web** (if using batch load)
- ✅ Check extension console for upload errors (F12 → DevTools → Background)

### Email/Phone Extraction Weak?
- **Tip 1**: Provide website URL directly (Layer 2 is more thorough with known domain)
- **Tip 2**: Add API keys (Layer 3 is very powerful for executive data)
- **Tip 3**: Check company's contact/team/about pages manually as backup

### Camera Not Working?
- **Known Issue**: Chrome popup has camera permission restrictions
- **Workaround**: Use **"📁 Upload"** button instead to select image files
- OCR text extraction and auto-hunt still work perfectly with uploaded images!

---

## 📊 Google Sheets Structure

Once data is uploaded, your Google Sheet will have these columns:

| Column | Data |
|--------|------|
| A | Timestamp |
| B | Company Name |
| C | Website URL |
| D | All Emails (comma-separated) |
| E | All Phones (comma-separated) |
| F | LinkedIn Profile |
| G | Facebook Profile |
| H | Instagram Profile |
| I | Twitter/X Profile |
| J | YouTube Channel |
| K | TikTok Profile |
| L | Key People (names, titles) |
| M | Industry |
| N | Headquarters |
| O | Year Founded |
| P | Employee Count |
| Q | Revenue |
| R | Tech Stack |

---

## 🔐 Security & Privacy

- **API keys** are stored locally in `chrome.storage.local` (encrypted by Chrome)
- **No data is sent anywhere except**:
  - Your configured Google Apps Script (for sheet upload)
  - Third-party APIs (if you configure them)
  - Public web pages (for crawling)
- **No tracking, no analytics, no external calls** by default
- All extraction happens in-browser on your machine

---

## ⚡ Performance Tips

1. **Sequential hunting**: When batch loading from Sheets, companies hunt one at a time (1.2s delay) to avoid rate-limiting
2. **Timeout handling**: Each page crawl times out after 8 seconds, individual API requests timeout after 15 seconds
3. **Retry logic**: Network failures automatically retry 3x with exponential backoff (2s, 5s, 10s)
4. **Deduplication**: Emails, phones, and people are automatically deduplicated

---

## 📞 Support & Feedback

- **Issues?** Check DevTools: Press F12, go to "Application" tab to inspect `chrome.storage.local`
- **Need help?** Review the code comments in `popup.js` and `background.js`
- **Feature requests?** The codebase is fully modular and extensible

---

## 🎓 What's Included in This Release

✅ **Phase 1**: Critical bug fixes (async/await, Layer 2 logic)
✅ **Phase 2**: Google Sheets auto-upload with retry logic
✅ **Phase 3**: Website auto-discovery (domain guessing)
✅ **Phase 4**: OCR.Space + catbox.moe integration for visual search
✅ **Phase 5**: Enhanced Layer 2 crawler (international phone formats, schema extraction)
✅ **Phase 6**: Comprehensive error handling & exponential backoff retries
✅ **Phase 7**: Manifest V3 compliance, deployment guide

---

**Version**: 1.0.0  
**Last Updated**: March 2026  
**Status**: Production Ready 🚀
