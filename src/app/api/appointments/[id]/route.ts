export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

const APPT_SELECT = `
  *,
  seller:curb_sellers(*),
  lead:curb_leads(id, year, make, model, trim, mileage, vin, color, created_at),
  agent:curb_users(id, first_name, last_name, phone, email, color_hex, active, created_at)
`;

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
  };
  return map[curbStatus || ''] || 'scheduled';
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const curb = getCurbSupabase();
  const { data, error } = await curb
    .from('curb_appointments')
    .select(APPT_SELECT)
    .eq('id', id)
    .eq('tenant_id', SVG_TENANT_ID)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(toAcquireShape(data));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const curb = getCurbSupabase();
  const body = await request.json();

  // Map Acquire field names → Curb field names
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) updates.status = mapStatusForward(body.status);
  if (body.outcome !== undefined) updates.outcome = body.outcome;
  if (body.offer_amount !== undefined) updates.offer_amount = body.offer_amount;
  if (body.purchase_amount !== undefined) updates.purchase_price = body.purchase_amount;
  if (body.lost_reason !== undefined) {
    updates.lost_reason = body.lost_reason;
    updates.no_purchase_reason = body.lost_reason;
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.scheduled_date !== undefined) updates.scheduled_date = body.scheduled_date;
  if (body.scheduled_time !== undefined) updates.scheduled_time = body.scheduled_time;
  if (body.agent_id !== undefined) updates.agent_id = body.agent_id;
  if (body.vas_rep !== undefined) updates.vas_rep = body.vas_rep;
  if (body.lead_source !== undefined) updates.lead_source = body.lead_source;
  if (body.address !== undefined) updates.address = body.address;
  if (body.city !== undefined) updates.city = body.city;
  if (body.state !== undefined) updates.state = body.state;
  if (body.zip !== undefined) updates.zip = body.zip;
  if (body.lat !== undefined) updates.lat = body.lat;
  if (body.lng !== undefined) updates.lng = body.lng;

  // Update scheduled_at if date/time changed
  if (body.scheduled_date || body.scheduled_time) {
    // Fetch current values to combine
    const { data: current } = await curb.from('curb_appointments').select('scheduled_date, scheduled_time').eq('id', id).single();
    const d = body.scheduled_date || current?.scheduled_date;
    const t = body.scheduled_time || current?.scheduled_time;
    if (d && t) updates.scheduled_at = `${d}T${t}`;
  }

  const { data, error } = await curb
    .from('curb_appointments')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', SVG_TENANT_ID)
    .select(APPT_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also update the linked lead's stage based on outcome
  if (data.lead_id && (body.outcome || body.status)) {
    const leadUpdates: Record<string, unknown> = {};
    if (body.outcome === 'purchased') leadUpdates.stage = 'purchased';
    else if (body.outcome === 'no_purchase' || body.outcome === 'lost') leadUpdates.stage = 'lost';
    else if (body.status === 'cancelled') leadUpdates.stage = 'lost';
    else if (body.status === 'completed') leadUpdates.stage = 'inspected';
    if (Object.keys(leadUpdates).length > 0) {
      await curb.from('curb_leads').update(leadUpdates).eq('id', data.lead_id);
    }
  }

  return NextResponse.json(toAcquireShape(data));
}

function mapStatusForward(acqStatus: string): string {
  const map: Record<string, string> = {
    scheduled: 'scheduled',
    confirmed: 'scheduled',
    en_route: 'en_route',
    arrived: 'on_site',
    appraising: 'on_site',
    completed: 'completed',
    cancelled: 'canceled',
    no_show: 'no_show',
  };
  return map[acqStatus] || acqStatus;
}
