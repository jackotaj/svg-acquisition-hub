export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncApptToSheet } from '@/lib/sheets';

async function geocodeAddress(address: string, city: string, state: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const full = `${address}, ${city}, ${state} ${zip}`.trim();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(full)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch { /* geocode failure is non-fatal */ }
  return null;
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');

  let query = supabaseAdmin
    .from('acq_appointments')
    .select(
      '*, customer:acq_customers(*), vehicle:acq_vehicles(*), agent:acq_agents(*)'
    )
    .order('scheduled_time', { ascending: true });

  if (date === 'today') {
    const today = new Date().toISOString().split('T')[0];
    query = query.eq('scheduled_date', today);
  } else if (date === 'upcoming') {
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('scheduled_date', today).not('status', 'in', '("cancelled","completed")');
  } else if (date === 'past') {
    const today = new Date().toISOString().split('T')[0];
    query = query.lt('scheduled_date', today).order('scheduled_date', { ascending: false });
  } else if (date) {
    query = query.eq('scheduled_date', date);
  }

  // Filter out cancelled/lost unless explicitly requested
  const includeCancelled = request.nextUrl.searchParams.get('include_cancelled') === 'true';
  if (!includeCancelled && date !== 'past') {
    query = query.not('status', 'in', '("cancelled")').not('outcome', 'in', '("lost")');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Simple direct insert (from /vas/new form — customer_id and vehicle_id already exist)
  if (body.customer_id && body.vehicle_id) {
    const { data, error } = await supabaseAdmin
      .from('acq_appointments')
      .insert({
        customer_id: body.customer_id,
        vehicle_id: body.vehicle_id,
        agent_id: body.agent_id || null,
        scheduled_date: body.scheduled_date,
        scheduled_time: body.scheduled_time,
        address: body.address || null,
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
        vas_rep: body.vas_rep || null,
        lead_source: body.lead_source || null,
        outcome: body.outcome || null,
        purchase_amount: body.purchase_amount || null,
        offer_amount: body.offer_amount || null,
        lost_reason: body.lost_reason || null,
        notes: body.notes || null,
        status: body.status || 'scheduled',
      })
      .select('*, customer:acq_customers(*), vehicle:acq_vehicles(*)')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Fire-and-forget sheet sync
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) syncApptToSheet(data).catch(console.error);
    return NextResponse.json(data, { status: 201 });
  }

  const { customer, vehicle, appointment } = body;

  // Create customer
  const { data: cust, error: custErr } = await supabaseAdmin
    .from('acq_customers')
    .insert(customer)
    .select()
    .single();

  if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 });

  // Coerce numeric fields before insert
  const vehiclePayload = {
    ...vehicle,
    customer_id: cust.id,
    mileage: vehicle.mileage ? parseInt(String(vehicle.mileage).replace(/\D/g, ''), 10) || null : null,
    estimated_value: vehicle.estimated_value ? parseInt(String(vehicle.estimated_value).replace(/\D/g, ''), 10) || null : null,
    offer_amount: vehicle.offer_amount ? parseInt(String(vehicle.offer_amount).replace(/\D/g, ''), 10) || null : null,
  };

  // Create vehicle
  const { data: veh, error: vehErr } = await supabaseAdmin
    .from('acq_vehicles')
    .insert(vehiclePayload)
    .select()
    .single();

  if (vehErr) return NextResponse.json({ error: vehErr.message }, { status: 500 });

  // Remap form field names → DB column names
  const { date, time, ...apptRest } = appointment;

  // Geocode the appointment address
  const coords = await geocodeAddress(
    appointment.address || '',
    appointment.city || '',
    appointment.state || '',
    appointment.zip || ''
  );

  const apptPayload = {
    ...apptRest,
    scheduled_date: date,
    scheduled_time: time,
    customer_id: cust.id,
    vehicle_id: veh.id,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
  };

  // Create appointment
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from('acq_appointments')
    .insert(apptPayload)
    .select(
      '*, customer:acq_customers(*), vehicle:acq_vehicles(*), agent:acq_agents(*)'
    )
    .single();

  if (apptErr) return NextResponse.json({ error: apptErr.message }, { status: 500 });

  // Fire-and-forget sheet sync
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) syncApptToSheet(appt).catch(console.error);

  return NextResponse.json(appt, { status: 201 });
}
