/**
 * Google Sheets sync utility
 * Requires: GOOGLE_SERVICE_ACCOUNT_JSON env var (stringified JSON of service account key)
 * Spreadsheet ID: 1TOoTsmLHOEMsKHrfofS99-SU_7rh_i0EJbvDONpFRBI
 */

const SPREADSHEET_ID = '1TOoTsmLHOEMsKHrfofS99-SU_7rh_i0EJbvDONpFRBI';
// Sheet has per-rep tabs: "Bianka", "DAVID" — maps rep name → sheet tab name
const REP_SHEET_MAP: Record<string, string> = {
  'Bianka': 'Bianka',
  'David':  'DAVID',
  'Other':  'Bianka', // fallback
};
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

async function getAccessToken(scopes = [SHEETS_SCOPE]): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

export { DRIVE_SCOPE, SHEETS_SCOPE };

async function sheetsRequest(path: string, method = 'GET', body?: unknown) {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Column order for the sheet
const COLUMNS = [
  'id', 'scheduled_date', 'scheduled_time', 'vas_rep',
  'customer_first', 'customer_last', 'customer_phone',
  'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_vin',
  'address', 'lead_source', 'status', 'outcome',
  'offer_amount', 'purchase_amount', 'lost_reason', 'notes',
  'lat', 'lng', 'created_at',
];

const HEADER_ROW = [
  'ID', 'Date', 'Time', 'VAS Rep',
  'First Name', 'Last Name', 'Phone',
  'Year', 'Make', 'Model', 'VIN',
  'Address', 'Lead Source', 'Status', 'Outcome',
  'Offer $', 'Purchase $', 'Lost Reason', 'Notes',
  'Lat', 'Lng', 'Created At',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apptToRow(appt: Record<string, any>): string[] {
  const c = appt.customer || {};
  const v = appt.vehicle || {};
  return [
    appt.id || '',
    appt.scheduled_date || '',
    (appt.scheduled_time || '').slice(0, 5),
    appt.vas_rep || '',
    c.first_name || '',
    c.last_name || '',
    c.phone || '',
    v.year || '',
    v.make || '',
    v.model || '',
    v.vin || '',
    appt.address || '',
    appt.lead_source || '',
    appt.status || '',
    appt.outcome || '',
    appt.offer_amount != null ? String(appt.offer_amount) : '',
    appt.purchase_amount != null ? String(appt.purchase_amount) : '',
    appt.lost_reason || '',
    appt.notes || '',
    appt.lat != null ? String(appt.lat) : '',
    appt.lng != null ? String(appt.lng) : '',
    appt.created_at || '',
  ];
}

/** Ensure header row exists in a given tab */
async function ensureHeader(token: string, sheetTab: string) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTab)}!A1:Z1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const existing = data.values?.[0];
  if (!existing || existing[0] !== 'ID') {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTab)}!A1:Z1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [HEADER_ROW] }),
      }
    );
  }
}

/** Write a single appointment to the correct rep's sheet tab */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncApptToSheet(appt: Record<string, any>) {
  try {
    const token = await getAccessToken();
    const sheetTab = REP_SHEET_MAP[appt.vas_rep] || 'Bianka';
    await ensureHeader(token, sheetTab);

    // Read all IDs in this tab
    const existing = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetTab}!A:A`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());

    const ids: string[] = (existing.values || []).map((r: string[]) => r[0]);
    const rowIdx = ids.indexOf(appt.id);
    const row = apptToRow(appt);

    if (rowIdx > 0) {
      const sheetRow = rowIdx + 1;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTab)}!A${sheetRow}:Z${sheetRow}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
    } else {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTab)}!A:Z:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
    }
    return { ok: true };
  } catch (err) {
    console.error('Sheets sync error:', err);
    return { ok: false, error: String(err) };
  }
}

/** Full resync — write all appointments to per-rep sheet tabs */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fullResync(appts: Record<string, any>[]) {
  try {
    const token = await getAccessToken();

    // Group by rep
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byRep: Record<string, Record<string, any>[]> = {};
    for (const appt of appts) {
      const tab = REP_SHEET_MAP[appt.vas_rep] || 'Bianka';
      if (!byRep[tab]) byRep[tab] = [];
      byRep[tab].push(appt);
    }

    for (const [tab, repAppts] of Object.entries(byRep)) {
      const rows = [HEADER_ROW, ...repAppts.map(apptToRow)];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tab)}!A1:Z${rows.length}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: rows }),
        }
      );
    }
    return { ok: true, count: appts.length };
  } catch (err) {
    console.error('Full resync error:', err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Read all rows from Bianka + DAVID tabs, map by COLUMNS positions.
 * Returns objects keyed by field name (id, status, outcome, notes, etc.)
 */
export async function readAllSheetRows(): Promise<Record<string, string>[]> {
  const token = await getAccessToken();
  const tabs = ['Bianka', 'DAVID'];
  const allRows: Record<string, string>[] = [];

  for (const tab of tabs) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(tab)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const rows: string[][] = data.values || [];
    if (rows.length < 2) continue;

    for (let i = 1; i < rows.length; i++) {
      const row: Record<string, string> = {};
      for (let j = 0; j < COLUMNS.length; j++) {
        row[COLUMNS[j]] = rows[i]?.[j] || '';
      }
      if (row.id) allRows.push(row);
    }
  }
  return allRows;
}

/**
 * Register a Google Drive push-notification watch on the spreadsheet.
 * Google will POST to `webhookUrl` whenever the sheet changes.
 * Watch expires after ~7 days — call this again to renew.
 */
export async function registerDriveWatch(webhookUrl: string, channelId: string) {
  const token = await getAccessToken([DRIVE_SCOPE]);
  const expiry = Date.now() + 6 * 24 * 60 * 60 * 1000; // 6 days

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}/watch`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        expiration: expiry,
      }),
    }
  );
  return res.json();
}

/**
 * Stop a Drive watch channel (cleanup / before re-registering)
 */
export async function stopDriveWatch(channelId: string, resourceId: string) {
  const token = await getAccessToken([DRIVE_SCOPE]);
  await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: channelId, resourceId }),
  });
}

export { COLUMNS, apptToRow };
