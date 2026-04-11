export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function GET(request: NextRequest) {
  const vin = request.nextUrl.searchParams.get('vin')?.trim().toUpperCase();
  const rep = request.nextUrl.searchParams.get('rep');

  if (!vin || vin.length < 8) return NextResponse.json({ duplicate: false });

  const curb = getCurbSupabase();

  // Find leads with this VIN
  const { data: leads } = await curb
    .from('curb_leads')
    .select('id, year, make, model, vin')
    .eq('tenant_id', SVG_TENANT_ID)
    .ilike('vin', vin);

  if (!leads || leads.length === 0) return NextResponse.json({ duplicate: false });

  const leadIds = leads.map(l => l.id);

  // Find appointments for these leads
  let query = curb
    .from('curb_appointments')
    .select('id, scheduled_date, scheduled_time, status, vas_rep')
    .eq('tenant_id', SVG_TENANT_ID)
    .in('lead_id', leadIds)
    .neq('status', 'canceled');

  if (rep) query = query.eq('vas_rep', rep);

  const { data: appts } = await query.order('scheduled_date', { ascending: false }).limit(3);

  if (!appts || appts.length === 0) return NextResponse.json({ duplicate: false });

  const veh = leads[0];
  const existing = appts[0];
  const message = `${rep || 'A rep'} already has an appointment for this VIN (${veh.year} ${veh.make} ${veh.model}) on ${existing.scheduled_date} at ${existing.scheduled_time?.slice(0, 5)} — status: ${existing.status}. Proceed only if rescheduling.`;

  return NextResponse.json({ duplicate: true, message, count: appts.length });
}
