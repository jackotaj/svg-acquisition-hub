/**
 * POST /api/sheets/webhook
 * Receives Google Drive push notifications when the spreadsheet changes.
 * Reads updated rows from the sheet and syncs mutable fields back to Curb Direct.
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';
import { readAllSheetRows, registerDriveWatch } from '@/lib/sheets';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const state = req.headers.get('x-goog-resource-state');
  const expiry = req.headers.get('x-goog-channel-expiration');

  if (state === 'sync') return NextResponse.json({ ok: true, state: 'sync' });

  const changed = req.headers.get('x-goog-changed') || '';
  if (state !== 'change' || !changed.includes('content')) {
    return NextResponse.json({ ok: true, skipped: true, state });
  }

  try {
    const curb = getCurbSupabase();
    const rows = await readAllSheetRows();

    let updated = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.id) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update: Record<string, any> = {};

      if (row.status)          update.status          = row.status === 'cancelled' ? 'canceled' : row.status;
      if (row.outcome)         update.outcome         = row.outcome;
      if (row.lost_reason)     update.lost_reason     = row.lost_reason;
      if (row.notes)           update.notes           = row.notes;
      if (row.offer_amount)    update.offer_amount    = parseFloat(row.offer_amount.replace(/[^0-9.]/g, '')) || null;
      if (row.purchase_amount) update.purchase_price   = parseFloat(row.purchase_amount.replace(/[^0-9.]/g, '')) || null;

      if (Object.keys(update).length === 0) continue;

      if (update.outcome && ['purchased', 'no_purchase', 'no_show'].includes(update.outcome)) {
        update.status = 'completed';
      }

      // Try by ID, then by external_id
      let result = await curb
        .from('curb_appointments')
        .update(update)
        .eq('id', row.id)
        .eq('tenant_id', SVG_TENANT_ID);

      if (result.error) {
        result = await curb
          .from('curb_appointments')
          .update(update)
          .eq('external_id', row.id)
          .eq('tenant_id', SVG_TENANT_ID);
      }

      if (result.error) errors.push(`${row.id}: ${result.error.message}`);
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

export async function GET() {
  const { getSheetTabs: getTabs } = await import('@/lib/sheets');
  const tabs = await getTabs().catch(() => []);
  return NextResponse.json({ ok: true, tabs, ts: new Date().toISOString() });
}
