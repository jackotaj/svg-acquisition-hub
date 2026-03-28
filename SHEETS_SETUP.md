# Google Sheets ↔ Acquisition Hub Sync Setup

## Step 1: Enable Sheets API + Create Service Account

1. Go to https://console.cloud.google.com (same project as Maps key)
2. **APIs & Services → Library** → search "Google Sheets API" → Enable
3. **IAM & Admin → Service Accounts** → Create Service Account
   - Name: `svg-acquisition-hub`
   - Role: Editor
4. Click the service account → **Keys → Add Key → JSON** → Download
5. Share the Google Sheet with the service account email (looks like `svg-acquisition-hub@your-project.iam.gserviceaccount.com`) as **Editor**

## Step 2: Add env vars to Vercel

```bash
# Paste the entire JSON file contents as one line
npx vercel env add GOOGLE_SERVICE_ACCOUNT_JSON production

# Secret for webhook auth
npx vercel env add SHEETS_WEBHOOK_SECRET production
# value: svg-sheets-sync-2026   (pick something, use same in Apps Script)
```

## Step 3: Add Apps Script to the Google Sheet

1. In the Sheet: **Extensions → Apps Script**
2. Paste this code:

```javascript
const WEBHOOK_URL = 'https://acquire.svgstrategies.com/api/sheets/sync';
const WEBHOOK_SECRET = 'svg-sheets-sync-2026'; // match your env var

// Column index map (0-based, matches our HEADER_ROW order)
const COL = {
  ID: 0, DATE: 1, TIME: 2, VAS_REP: 3,
  FIRST: 4, LAST: 5, PHONE: 6,
  YEAR: 7, MAKE: 8, MODEL: 9, VIN: 10,
  ADDRESS: 11, LEAD_SOURCE: 12, STATUS: 13, OUTCOME: 14,
  OFFER: 15, PURCHASE: 16, LOST_REASON: 17, NOTES: 18
};

// Editable columns and their DB field names
const EDITABLE = {
  [COL.OUTCOME]:     'outcome',
  [COL.PURCHASE]:    'purchase_amount',
  [COL.OFFER]:       'offer_amount',
  [COL.LOST_REASON]: 'lost_reason',
  [COL.NOTES]:       'notes',
  [COL.STATUS]:      'status',
};

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Appointments') return;

  const row = e.range.getRow();
  const col = e.range.getColumn() - 1; // convert to 0-based

  if (row <= 1) return; // skip header
  if (!(col in EDITABLE)) return; // skip non-editable columns

  const id = sheet.getRange(row, 1).getValue();
  if (!id) return;

  const field = EDITABLE[col];
  const value = e.range.getValue();

  const payload = JSON.stringify({ id, field, value });

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': WEBHOOK_SECRET },
    payload: payload,
    muteHttpExceptions: true,
  });
}
```

3. Save → Run `onEdit` once to authorize → **Triggers → Add Trigger**:
   - Function: `onEdit`
   - Event source: From spreadsheet
   - Event type: On edit

## Step 4: Initial full sync

After credentials are set, run this to populate the sheet with all existing appointments:

```bash
curl -X POST https://acquire.svgstrategies.com/api/sheets/resync \
  -H "x-webhook-secret: svg-sheets-sync-2026"
```

## What syncs:

| Direction | Trigger | Fields |
|-----------|---------|--------|
| App → Sheet | New/updated appointment | All fields (ID, customer, vehicle, date, time, address, outcome, etc.) |
| Sheet → App | Edit any highlighted column | Outcome, Purchase $, Offer $, Lost Reason, Notes, Status |

**Read-only in sheet** (changes ignored): Customer name, phone, vehicle, date, time, address, VAS rep — edit those in the app.
