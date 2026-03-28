export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const vin = request.nextUrl.searchParams.get('vin')?.trim().toUpperCase();
  const rep = request.nextUrl.searchParams.get('rep');

  if (!vin || vin.length < 8) return NextResponse.json({ duplicate: false });

  // Find any vehicle with this VIN
  const { data: vehicles } = await supabaseAdmin
    .from('acq_vehicles')
    .select('id, year, make, model, vin')
    .ilike('vin', vin);

  if (!vehicles || vehicles.length === 0) return NextResponse.json({ duplicate: false });

  const vehicleIds = vehicles.map(v => v.id);

  // Find appointments for this vehicle with this rep
  const query = supabaseAdmin
    .from('acq_appointments')
    .select('id, scheduled_date, scheduled_time, status, vas_rep')
    .in('vehicle_id', vehicleIds)
    .neq('status', 'cancelled');

  if (rep) query.eq('vas_rep', rep);

  const { data: appts } = await query.order('scheduled_date', { ascending: false }).limit(3);

  if (!appts || appts.length === 0) return NextResponse.json({ duplicate: false });

  const veh = vehicles[0];
  const existing = appts[0];
  const message = `${rep || 'A rep'} already has an appointment for this VIN (${veh.year} ${veh.make} ${veh.model}) on ${existing.scheduled_date} at ${existing.scheduled_time?.slice(0, 5)} — status: ${existing.status}. Proceed only if rescheduling.`;

  return NextResponse.json({ duplicate: true, message, count: appts.length });
}
