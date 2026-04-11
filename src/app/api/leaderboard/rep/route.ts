export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const curb = getCurbSupabase();
  const { data, error } = await curb
    .from('curb_appointments')
    .select(`id, scheduled_date, scheduled_time, address, lead_source, status, outcome, purchase_price, notes,
      seller:curb_sellers(first_name, last_name, phone),
      lead:curb_leads(year, make, model)`)
    .eq('tenant_id', SVG_TENANT_ID)
    .eq('vas_rep', name)
    .order('scheduled_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shape for frontend compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shaped = (data || []).map((a: any) => ({
    ...a,
    purchase_amount: a.purchase_price,
    customer: a.seller ? { first_name: a.seller.first_name, last_name: a.seller.last_name, phone: a.seller.phone } : null,
    vehicle: a.lead ? { year: a.lead.year, make: a.lead.make, model: a.lead.model } : null,
  }));

  return NextResponse.json(shaped);
}
