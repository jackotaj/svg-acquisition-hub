export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';
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

/** Shape a curb row into the legacy Acquire response format */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAcquireShape(row: any) {
  return {
    id: row.id,
    customer_id: row.seller_id,
    vehicle_id: row.lead_id,
    agent_id: row.agent_id,
    scheduled_date: row.scheduled_date,
    scheduled_time: row.scheduled_time,
    duration_mins: row.duration_minutes || 60,
    travel_mins_from_prev: null,
    status: mapStatusBack(row.status),
    address: row.address,
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || '',
    lat: row.lat,
    lng: row.lng,
    notes: row.notes,
    vas_rep: row.vas_rep,
    lead_source: row.lead_source,
    outcome: row.outcome,
    offer_amount: row.offer_amount,
    purchase_amount: row.purchase_price,
    lost_reason: row.lost_reason || row.no_purchase_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: row.seller ? {
      id: row.seller.id,
      first_name: row.seller.first_name,
      last_name: row.seller.last_name,
      phone: row.seller.phone,
      email: row.seller.email,
      address: row.seller.address,
      city: row.seller.city,
      state: row.seller.state,
      zip: row.seller.zip,
      lat: row.seller.lat,
      lng: row.seller.lng,
      notes: null,
      created_at: row.seller.created_at,
    } : null,
    vehicle: row.lead ? {
      id: row.lead.id,
      customer_id: row.seller_id,
      year: row.lead.year,
      make: row.lead.make,
      model: row.lead.model,
      trim: row.lead.trim,
      mileage: row.lead.mileage,
      vin: row.lead.vin,
      color: row.lead.color,
      condition_notes: null,
      created_at: row.lead.created_at,
    } : null,
    agent: row.agent ? {
      id: row.agent.id,
      name: `${row.agent.first_name} ${row.agent.last_name}`.trim(),
      phone: row.agent.phone,
      email: row.agent.email,
      color_hex: row.agent.color_hex,
      is_active: row.agent.active,
      store: 'BCK',
      created_at: row.agent.created_at,
    } : null,
  };
}

function mapStatusBack(curbStatus: string | null): string {
  const map: Record<string, string> = {
    scheduled: 'scheduled',
    en_route: 'en_route',
    on_site: 'arrived',
    completed: 'completed',
    canceled: 'cancelled',
    no_show: 'no_show',
    purchased: 'completed',
    no_purchase: 'completed',
  };
  return map[curbStatus || ''] || 'scheduled';
}

const APPT_SELECT = `
  *,
  seller:curb_sellers(*),
  lead:curb_leads(id, year, make, model, trim, mileage, vin, color, created_at),
  agent:curb_users(id, first_name, last_name, phone, email, color_hex, active, created_at)
`;

export async function GET(request: NextRequest) {
  const curb = getCurbSupabase();
  const date = request.nextUrl.searchParams.get('date');

  let query = curb
    .from('curb_appointments')
    .select(APPT_SELECT)
    .eq('tenant_id', SVG_TENANT_ID)
    .order('scheduled_time', { ascending: true });

  if (date === 'today') {
    const today = new Date().toISOString().split('T')[0];
    query = query.eq('scheduled_date', today);
  } else if (date === 'upcoming') {
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('scheduled_date', today).not('status', 'in', '("canceled","completed")');
  } else if (date === 'past') {
    const today = new Date().toISOString().split('T')[0];
    query = query.lt('scheduled_date', today).order('scheduled_date', { ascending: false });
  } else if (date) {
    query = query.eq('scheduled_date', date);
  }

  const includeCancelled = request.nextUrl.searchParams.get('include_cancelled') === 'true';
  if (!includeCancelled && date !== 'past') {
    query = query.not('status', 'in', '("canceled")').not('outcome', 'in', '("lost")');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data || []).map(toAcquireShape));
}

export async function POST(request: NextRequest) {
  const curb = getCurbSupabase();
  const body = await request.json();

  // Simple direct insert (existing seller + lead)
  if (body.customer_id && body.vehicle_id) {
    // Combine date+time into scheduled_at
    const scheduledAt = body.scheduled_date && body.scheduled_time
      ? `${body.scheduled_date}T${body.scheduled_time}`
      : new Date().toISOString();

    const { data, error } = await curb
      .from('curb_appointments')
      .insert({
        tenant_id: SVG_TENANT_ID,
        lead_id: body.vehicle_id,
        seller_id: body.customer_id,
        agent_id: body.agent_id || null,
        scheduled_at: scheduledAt,
        scheduled_date: body.scheduled_date,
        scheduled_time: body.scheduled_time,
        address: body.address || null,
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
        vas_rep: body.vas_rep || null,
        lead_source: body.lead_source || null,
        outcome: body.outcome || null,
        purchase_price: body.purchase_amount || null,
        offer_amount: body.offer_amount || null,
        lost_reason: body.lost_reason || null,
        notes: body.notes || null,
        status: body.status || 'scheduled',
      })
      .select(APPT_SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const shaped = toAcquireShape(data);
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) syncApptToSheet(shaped).catch(console.error);
    return NextResponse.json(shaped, { status: 201 });
  }

  // Full create: customer + vehicle + appointment
  const { customer, vehicle, appointment } = body;

  // Create seller
  const { data: seller, error: sellerErr } = await curb
    .from('curb_sellers')
    .insert({
      tenant_id: SVG_TENANT_ID,
      first_name: customer.first_name,
      last_name: customer.last_name || '',
      phone: customer.phone || null,
      email: customer.email || null,
      address: customer.address || null,
      city: customer.city || null,
      state: customer.state || null,
      zip: customer.zip || null,
    })
    .select()
    .single();

  if (sellerErr) return NextResponse.json({ error: sellerErr.message }, { status: 500 });

  // Geocode
  const coords = await geocodeAddress(
    appointment.address || '',
    appointment.city || '',
    appointment.state || '',
    appointment.zip || ''
  );

  const scheduledAt = appointment.date && appointment.time
    ? `${appointment.date}T${appointment.time}`
    : new Date().toISOString();

  // Create lead (holds vehicle info)
  const mileage = vehicle.mileage ? parseInt(String(vehicle.mileage).replace(/\D/g, ''), 10) || null : null;
  const { data: lead, error: leadErr } = await curb
    .from('curb_leads')
    .insert({
      tenant_id: SVG_TENANT_ID,
      seller_id: seller.id,
      stage: 'scheduled',
      year: vehicle.year || null,
      make: vehicle.make || null,
      model: vehicle.model || null,
      trim: vehicle.trim || null,
      mileage,
      vin: vehicle.vin || null,
      color: vehicle.color || null,
      source: 'manual',
      seller_first_name: customer.first_name,
      seller_last_name: customer.last_name || '',
      seller_phone: customer.phone || null,
      seller_address: appointment.address || null,
      seller_city: appointment.city || null,
      seller_state: appointment.state || null,
      seller_zip: appointment.zip || null,
      scheduled_at: scheduledAt,
      notes: appointment.notes || null,
    })
    .select()
    .single();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });

  // Create appointment
  const { date, time, ...apptRest } = appointment;
  const { data: appt, error: apptErr } = await curb
    .from('curb_appointments')
    .insert({
      tenant_id: SVG_TENANT_ID,
      lead_id: lead.id,
      seller_id: seller.id,
      agent_id: apptRest.agent_id || null,
      scheduled_at: scheduledAt,
      scheduled_date: date,
      scheduled_time: time,
      address: apptRest.address || null,
      city: apptRest.city || '',
      state: apptRest.state || '',
      zip: apptRest.zip || '',
      vas_rep: apptRest.vas_rep || null,
      lead_source: apptRest.lead_source || null,
      notes: apptRest.notes || null,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    })
    .select(APPT_SELECT)
    .single();

  if (apptErr) return NextResponse.json({ error: apptErr.message }, { status: 500 });

  const shaped = toAcquireShape(appt);
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) syncApptToSheet(shaped).catch(console.error);
  return NextResponse.json(shaped, { status: 201 });
}
