export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
  } else if (date) {
    query = query.eq('scheduled_date', date);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
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
  const apptPayload = {
    ...apptRest,
    scheduled_date: date,
    scheduled_time: time,
    customer_id: cust.id,
    vehicle_id: veh.id,
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

  return NextResponse.json(appt, { status: 201 });
}
