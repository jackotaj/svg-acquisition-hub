/**
 * POST /api/sheets/resync
 * Full resync — pushes all Curb appointments (SVG tenant) to Google Sheet
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';
import { fullResync } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== (process.env.SHEETS_WEBHOOK_SECRET || 'svg-sheets-sync')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const curb = getCurbSupabase();
  const { data: appts, error } = await curb
    .from('curb_appointments')
    .select(`*,
      seller:curb_sellers(first_name, last_name, phone),
      lead:curb_leads(year, make, model, vin)`)
    .eq('tenant_id', SVG_TENANT_ID)
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shape into the format sheets expects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shaped = (appts || []).map((a: any) => ({
    id: a.id,
    scheduled_date: a.scheduled_date,
    scheduled_time: a.scheduled_time,
    vas_rep: a.vas_rep,
    customer: a.seller ? { first_name: a.seller.first_name, last_name: a.seller.last_name, phone: a.seller.phone } : {},
    vehicle: a.lead ? { year: a.lead.year, make: a.lead.make, model: a.lead.model, vin: a.lead.vin } : {},
    address: a.address,
    lead_source: a.lead_source,
    status: a.status,
    outcome: a.outcome,
    offer_amount: a.offer_amount,
    purchase_amount: a.purchase_price,
    lost_reason: a.lost_reason,
    notes: a.notes,
    lat: a.lat,
    lng: a.lng,
    created_at: a.created_at,
  }));

  const result = await fullResync(shaped);
  return NextResponse.json(result);
}
