/**
 * POST /api/sheets/webhook
 * Receives Google Drive push notifications when the spreadsheet changes.
 * Reads updated rows from the sheet and syncs mutable fields back to Supabase.
 *
 * Registration: POST /api/sheets/register-watch
 * Watch expires ~7 days — auto-renewal triggered here when < 1 day left.
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readAllSheetRows, getSheetTabs, registerDriveWatch } from '@/lib/sheets';
import { randomUUID } from 'crypto';

// Fields we allow the sheet to write back into Supabase
const MUTABLE_FIELDS = ['status', 'outcome', 'offer_amount', 'purchase_amount', 'lost_reason', 'notes'];

export async function POST(req: NextRequest) {
  const state = req.headers.get('x-goog-resource-state');
  const expiry = req.headers.get('x-goog-channel-expiration');

  // Initial handshake — Google sends 'sync' on registration, just acknowledge
  if (state === 'sync') return NextResponse.json({ ok: true, state: 'sync' });

  // Only process file content changes
  const changed = req.headers.get('x-goog-changed') || '';
  if (state !== 'change' || !changed.includes('content')) {
    return NextResponse.json({ ok: true, skipped: true, state });
  }

  try {
    // Check for new tabs (new VAS reps) and register them in the DB
    await syncNewRepTabs();

    // Read all rows from all rep tabs
    const rows = await readAllSheetRows();

    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.id) continue;

      // Build update object — only mutable fields, skip empties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {};

      if (row.status)        update.status        = row.status;
      if (row.outcome)       update.outcome       = row.outcome;
      if (row.lost_reason)   update.lost_reason   = row.lost_reason;
      if (row.notes)         update.notes         = row.notes;
      if (row.offer_amount)  update.offer_amount  = parseFloat(row.offer_amount.replace(/[^0-9.]/g, '')) || null;
      if (row.purchase_amount) update.purchase_amount = parseFloat(row.purchase_amount.replace(/[^0-9.]/g, '')) || null;

      if (Object.keys(update).length === 0) continue;

      // Auto-complete status when outcome is set
      if (update.outcome && ['purchased', 'no_purchase', 'no_show'].includes(update.outcome)) {
        update.status = 'completed';
      }

      const { error } = await supabaseAdmin
        .from('acq_appointments')
        .update(update)
        .eq('id', row.id);

      if (error) errors.push(`${row.id}: ${error.message}`);
      else updated++;
    }

    // Auto-renew watch if expiring within 24h
    if (expiry) {
      const expiryMs = new Date(expiry).getTime();
      if (expiryMs - Date.now() < 24 * 60 * 60 * 1000) {
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://acquire.svgstrategies.com'}/api/sheets/webhook`;
        await registerDriveWatch(webhookUrl, randomUUID()).catch(console.error);
      }
    }

    return NextResponse.json({ ok: true, updated, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error('Sheets webhook error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * Detect sheet tabs that don't have a matching vas_rep in existing appointments.
 * Creates a placeholder appointment-level entry so the new rep shows in dropdowns/leaderboard.
 * Stores known tabs in a simple Supabase table (app_config) as JSON.
 */
async function syncNewRepTabs() {
  try {
    const tabs = await getSheetTabs(true);

    // Get previously known tabs from app_config
    const { data: cfg } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'known_vas_rep_tabs')
      .single();

    const knownTabs: string[] = cfg?.value ? JSON.parse(cfg.value) : [];
    const newTabs = tabs.filter(t => !knownTabs.includes(t));

    if (newTabs.length === 0) return;

    // Persist updated tab list
    await supabaseAdmin
      .from('app_config')
      .upsert({ key: 'known_vas_rep_tabs', value: JSON.stringify(tabs) }, { onConflict: 'key' });

    // Log new reps (they'll appear in analytics/leaderboard as soon as appointments are scheduled for them)
    console.log('New VAS rep tabs detected:', newTabs);
  } catch {
    // app_config table may not exist yet — fail silently, don't break the sync
  }
}

// GET — returns current known tabs (useful for form dropdowns)
export async function GET() {
  const { getSheetTabs: getTabs } = await import('@/lib/sheets');
  const tabs = await getTabs().catch(() => []);
  return NextResponse.json({ ok: true, tabs, ts: new Date().toISOString() });
}
