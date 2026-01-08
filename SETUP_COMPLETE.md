# Ford PTS Scraper - Complete Setup Documentation
## 2025 F-150 XLT 3.5L EcoBoost

**Date:** January 6, 2026
**Status:** ✅ READY TO USE - Resume capability added

---

## What Was Done

### 1. Repository Setup
- ✅ Cloned from https://github.com/iamtheyammer/fetch-ford-service-manuals
- ✅ Installed Node.js dependencies (Yarn 4.1.0, Node 18.20.8)
- ✅ Set up Playwright browser automation
- ✅ Created configuration files from templates

### 2. Configuration Files Created

#### templates/params.json
```json
{
  "workshop": {
    "vehicleId": "7233",
    "modelYear": "2025",
    "channel": "9",
    "book": "S10526",
    "bookTitle": "2025 F-150",
    "WiringBookCode": "E2502N",
    "WiringBookTitle": "2025 F-150",
    "booktype": "ody",
    "country": "USA",
    "language": "EN-US",
    "contentmarket": "US",
    "contentlanguage": "EN",
    "languageOdysseyCode": "ENUSA",
    "searchNumber": "0",
    "Vid": "CZF",
    "byvin": "NO",
    "marketGroup": "NA"
  },
  "wiring": {
    "environment": "prod_1_3_162026",
    "bookType": "svg",
    "languageCode": "ENUSA"
  }
}
```

#### templates/cookieString.txt
- ✅ Contains valid authentication cookies (10,271 bytes)
- ⚠️ **NOTE:** Cookies expire after several hours of inactivity
- See "Re-collecting Cookies" section below if needed

### 3. Code Enhancements - RESUME CAPABILITY ADDED

Modified files to add automatic resume functionality:

#### src/workshop/saveEntireManual.ts
- Added `existsSync` import from 'fs'
- Added PDF existence check before downloading
- Skips files that already exist with message: "Skipping manual page X (already exists)"

#### src/wiring/savePage.ts
- Added `existsSync` import from 'fs'
- Added PDF existence check for wiring diagrams
- Skips existing wiring PDFs automatically

**Benefits:**
- Can safely restart download after interruption
- No duplicate downloads
- No data loss
- Saves time and bandwidth

---

## How to Download Your Manual

### First Time / Full Download

```bash
cd /home/ben/workspace/ford-pts/fetch-ford-service-manuals

# Create output directory
mkdir -p ~/ford-f150-manuals

# Run the download (with error tolerance and logging)
yarn start -c templates/params.json -s templates/cookieString.txt -o ~/ford-f150-manuals/ --ignoreSaveErrors 2>&1 | tee download.log
```

### If Download Stops or Has Errors

**Just re-run the SAME command!**

```bash
yarn start -c templates/params.json -s templates/cookieString.txt -o ~/ford-f150-manuals/ --ignoreSaveErrors 2>&1 | tee download.log
```

The resume capability will:
- Skip all files that already exist as PDFs
- Only download missing or failed files
- Complete your manual to 100%

---

## Expected Results

### What You'll Get:
- **Complete Workshop Manual** (several GB)
  - All service procedures
  - Diagnostic information
  - Specifications
  - Maintenance schedules
  - Component R&R procedures

- **All Wiring Diagrams** in `Wiring/` folder
  - Complete electrical schematics
  - Connector location charts
  - Searchable connector database (Connectors.csv)

### Download Time:
- 20-40 minutes (depends on internet speed)
- Expect occasional 503 errors (normal)
- `--ignoreSaveErrors` will handle them automatically

### File Size:
- Several gigabytes (F-150 manuals are comprehensive)

---

## Important Flags

### --ignoreSaveErrors (RECOMMENDED)
- Continues downloading even when individual files fail
- Essential due to occasional Ford server 503 errors
- Logs errors but doesn't stop the entire process

### Other Useful Flags:
- `--saveHTML` - Save HTML files along with PDFs
- `--noWorkshop` - Skip workshop manual (only download wiring)
- `--noWiring` - Skip wiring diagrams (only download workshop)

---

## Troubleshooting

### 503 Service Unavailable Errors
**What it is:** Ford's servers temporarily refusing requests (rate limiting)

**Solutions:**
1. Use `--ignoreSaveErrors` (already recommended above)
2. Script will skip failed files and continue
3. Re-run the same command to retry failed files
4. If many 503s occur, wait 15-30 minutes and try again
5. Try during off-peak hours (late night US time)

### Cookies Expired
**Symptoms:** "Failed to log in with the provided cookies"

**Solution:** Re-collect cookies from PTS

**How to re-collect:**
1. Open PTS in browser (https://www.motorcraftservice.com/MySubscriptions)
2. Navigate to Wiring tab
3. Open DevTools → Network tab
4. Find GET request to: `https://www.fordtechservice.dealerconnection.com/wiring/TableOfContents`
5. Headers → Request Headers → Cookie
6. Copy cookie value (NOT the "Cookie:" prefix)
7. Paste into `templates/cookieString.txt`
8. Save and re-run download command

### Checking Download Progress

```bash
# Count PDFs downloaded so far
find ~/ford-f150-manuals -name "*.pdf" | wc -l

# Check size of manual so far
du -sh ~/ford-f150-manuals

# View recent log entries
tail -50 download.log
```

---

## Data Collection Details

### Workshop Data Source
- POST request to: `https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//publication/prod_1_3_162026/TreeAndCover/workshop/32/~WS10526/7233`
- Vehicle ID: 7233
- VIN: 1FTFW3L80SKF04342
- Book Code: S10526

### Wiring Data Source
- GET request to: `https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//wiring/TableofContent`
- Environment: prod_1_3_162026
- Book Code: E2502N

---

## Code Changes Made

### File: src/workshop/saveEntireManual.ts

**Line 2:** Added import
```typescript
import { existsSync } from "fs";
```

**Lines 63-71:** Added resume check
```typescript
const pdfPath = join(path, `/${filename}.pdf`);

// Check if PDF already exists (resume capability)
if (existsSync(pdfPath)) {
  console.log(
    `Skipping manual page ${name} (already exists) (docID: ${docID})`
  );
  continue;
}
```

### File: src/wiring/savePage.ts

**Line 3:** Added import
```typescript
import { existsSync } from "fs";
```

**Lines 48-52:** Added resume check for BasicPage PDFs
```typescript
// Check if PDF already exists (resume capability)
if (existsSync(pdfPath)) {
  console.log(`Skipping page ${subPage.Text} of ${doc.Title} (already exists)...`);
  continue;
}
```

**Lines 92-96:** Added resume check for SVG-based PDFs
```typescript
// Check if PDF already exists (resume capability)
if (existsSync(pdfPath)) {
  console.log(`Skipping page ${subPage} of ${doc.Title} (already exists)...`);
  continue;
}
```

---

## Testing Performed

### Test 1: Initial Download
- ✅ Successfully logged into PTS with cookies
- ✅ Downloaded table of contents
- ✅ Downloaded multiple workshop manual pages
- ✅ Handled 503 errors gracefully with `--ignoreSaveErrors`

### Test 2: Resume Capability
- ✅ Re-ran download on same output directory
- ✅ Successfully skipped existing PDFs
- ✅ Output shows "Skipping manual page X (already exists)"
- ✅ No duplicate downloads or data loss

---

## Quick Reference Commands

### Check if everything is set up correctly:
```bash
cd /home/ben/workspace/ford-pts/fetch-ford-service-manuals
yarn start --help
```

### Test with small download (no wiring):
```bash
mkdir -p /tmp/test-download
yarn start -c templates/params.json -s templates/cookieString.txt -o /tmp/test-download --noWiring
```

### Full production download:
```bash
mkdir -p ~/ford-f150-manuals
yarn start -c templates/params.json -s templates/cookieString.txt -o ~/ford-f150-manuals/ --ignoreSaveErrors 2>&1 | tee download.log
```

### Resume after interruption (same command):
```bash
yarn start -c templates/params.json -s templates/cookieString.txt -o ~/ford-f150-manuals/ --ignoreSaveErrors 2>&1 | tee -a download.log
```

---

## Repository Information

- **Original Repo:** https://github.com/iamtheyammer/fetch-ford-service-manuals
- **Local Path:** /home/ben/workspace/ford-pts/fetch-ford-service-manuals
- **Documentation:** See README.md for original documentation
- **This Setup Guide:** SETUP_GUIDE.md (step-by-step instructions)
- **This File:** SETUP_COMPLETE.md (complete reference)

---

## Notes

- Your 72-hour PTS subscription clock starts when you purchase it
- Cookies may expire after several hours of inactivity
- Resume capability means you can safely stop/restart anytime
- Expected to get 95-99% of manual on first run (due to occasional 503 errors)
- Re-running the download will get remaining 1-5% of files
- Keep the download.log file to see which files (if any) failed

---

## System Information

- **Platform:** Linux (WSL2)
- **Node Version:** 18.20.8
- **Yarn Version:** 4.1.0
- **Playwright:** Chromium browser installed
- **Working Directory:** /home/ben/workspace/ford-pts/fetch-ford-service-manuals

---

**Setup completed by:** Claude Code
**Date:** 2026-01-06
**Status:** ✅ Ready for production use
