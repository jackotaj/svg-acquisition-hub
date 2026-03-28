/**
 * POST /api/sheets/sync
 * Triggered by Google Apps Script when sheet is edited
 * Updates the corresponding Supabase record
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const WEBHOOK_SECRET = process.env.SHEETS_WEBHOOK_SECRET || 'svg-sheets-sync';

export async function POST(req: NextRequest) {
  // Verify secret header
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, field, value } = body;

    if (!id || !field) return NextResponse.json({ error: 'Missing id or field' }, { status: 400 });

    // Only allow updating safe outcome fields from the sheet
    const ALLOWED_FIELDS = ['outcome', 'purchase_amount', 'offer_amount', 'lost_reason', 'notes', 'status'];
    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: `Field '${field}' not editable from sheet` }, { status: 400 });
    }

    const update: Record<string, string | number | null> = {};
    if (field === 'purchase_amount' || field === 'offer_amount') {
      update[field] = value ? parseFloat(String(value).replace(/[^0-9.]/g, '')) : null;
    } else {
      update[field] = value || null;
    }

    // If outcome is set, update status too
    if (field === 'outcome' && value) {
      update.status = ['purchased', 'no_purchase', 'no_show'].includes(value) ? 'completed' : 'scheduled';
    }

    const { error } = await supabaseAdmin
      .from('acq_appointments')
      .update(update)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated: { id, field, value } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
