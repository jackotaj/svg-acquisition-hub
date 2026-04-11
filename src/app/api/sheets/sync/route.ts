/**
 * POST /api/sheets/sync
 * Triggered by Google Apps Script when sheet is edited
 * Updates the corresponding Supabase record in Curb Direct
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

const WEBHOOK_SECRET = process.env.SHEETS_WEBHOOK_SECRET || 'svg-sheets-sync';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const curb = getCurbSupabase();
    const body = await req.json();
    const { id, field, value } = body;

    if (!id || !field) return NextResponse.json({ error: 'Missing id or field' }, { status: 400 });

    const ALLOWED_FIELDS = ['outcome', 'purchase_price', 'offer_amount', 'lost_reason', 'notes', 'status'];
    // Map legacy field names
    const fieldMap: Record<string, string> = {
      purchase_amount: 'purchase_price',
    };
    const mappedField = fieldMap[field] || field;

    if (!ALLOWED_FIELDS.includes(mappedField)) {
      return NextResponse.json({ error: `Field '${field}' not editable from sheet` }, { status: 400 });
    }

    const update: Record<string, string | number | null> = {};
    if (mappedField === 'purchase_price' || mappedField === 'offer_amount') {
      update[mappedField] = value ? parseFloat(String(value).replace(/[^0-9.]/g, '')) : null;
    } else {
      update[mappedField] = value || null;
    }

    if (mappedField === 'outcome' && value) {
      if (['purchased', 'no_purchase', 'no_show'].includes(value)) {
        update.status = 'completed';
      }
    }

    // Try by ID first, then by external_id (for migrated records)
    let result = await curb
      .from('curb_appointments')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', SVG_TENANT_ID);

    if (result.error) {
      result = await curb
        .from('curb_appointments')
        .update(update)
        .eq('external_id', id)
        .eq('tenant_id', SVG_TENANT_ID);
    }

    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated: { id, field: mappedField, value } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
