export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

/**
 * One-time migration: reads all acq_* data from SVG Acquire's Supabase
 * and writes it into Curb Direct's Supabase under the SVG Motors tenant.
 *
 * POST /api/migrate-to-curb
 */
export async function POST() {
  const curb = getCurbSupabase();
  const log: string[] = [];

  try {
    // ── 1. Migrate agents → curb_users ──────────────────────────────
    const { data: agents } = await supabaseAdmin
      .from('acq_agents')
      .select('*');

    const agentMap: Record<string, string> = {}; // old agent ID → new curb_users ID

    for (const agent of agents || []) {
      // Check if user already exists by name + tenant
      const { data: existing } = await curb
        .from('curb_users')
        .select('id')
        .eq('tenant_id', SVG_TENANT_ID)
        .ilike('first_name', agent.name.split(' ')[0])
        .ilike('last_name', agent.name.split(' ').slice(1).join(' ') || '')
        .maybeSingle();

      if (existing) {
        agentMap[agent.id] = existing.id;
        log.push(`Agent "${agent.name}" already exists as curb_user ${existing.id}`);
        continue;
      }

      const nameParts = agent.name.split(' ');
      const { data: newUser, error } = await curb
        .from('curb_users')
        .insert({
          tenant_id: SVG_TENANT_ID,
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(' ') || '',
          email: agent.email || `${agent.name.toLowerCase().replace(/\s+/g, '.')}@svgmotors.com`,
          phone: agent.phone,
          role: 'agent',
          color_hex: agent.color_hex || '#7C3AED',
          active: agent.is_active,
        })
        .select('id')
        .single();

      if (error) {
        log.push(`ERROR migrating agent "${agent.name}": ${error.message}`);
        continue;
      }
      agentMap[agent.id] = newUser.id;
      log.push(`Migrated agent "${agent.name}" → curb_user ${newUser.id}`);
    }

    // ── 2. Migrate customers → curb_sellers ─────────────────────────
    const { data: customers } = await supabaseAdmin
      .from('acq_customers')
      .select('*');

    const sellerMap: Record<string, string> = {}; // old customer ID → new curb_sellers ID

    for (const cust of customers || []) {
      // Check for existing seller by phone or name
      let existing = null;
      if (cust.phone) {
        const { data } = await curb
          .from('curb_sellers')
          .select('id')
          .eq('tenant_id', SVG_TENANT_ID)
          .eq('phone', cust.phone)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        sellerMap[cust.id] = existing.id;
        log.push(`Customer "${cust.first_name} ${cust.last_name}" matched existing seller ${existing.id}`);
        continue;
      }

      const { data: newSeller, error } = await curb
        .from('curb_sellers')
        .insert({
          tenant_id: SVG_TENANT_ID,
          first_name: cust.first_name,
          last_name: cust.last_name,
          phone: cust.phone,
          email: cust.email,
          address: cust.address,
          city: cust.city,
          state: cust.state,
          zip: cust.zip,
          lat: cust.lat,
          lng: cust.lng,
        })
        .select('id')
        .single();

      if (error) {
        log.push(`ERROR migrating customer "${cust.first_name} ${cust.last_name}": ${error.message}`);
        continue;
      }
      sellerMap[cust.id] = newSeller.id;
      log.push(`Migrated customer "${cust.first_name} ${cust.last_name}" → curb_seller ${newSeller.id}`);
    }

    // ── 3. Migrate appointments (with vehicles) → curb_leads + curb_appointments ──
    const { data: appointments } = await supabaseAdmin
      .from('acq_appointments')
      .select('*, customer:acq_customers(*), vehicle:acq_vehicles(*)');

    let apptCount = 0;
    let apptErrors = 0;

    for (const appt of appointments || []) {
      const customer = Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
      const vehicle = Array.isArray(appt.vehicle) ? appt.vehicle[0] : appt.vehicle;
      const sellerId = appt.customer_id ? sellerMap[appt.customer_id] : null;
      const agentId = appt.agent_id ? agentMap[appt.agent_id] : null;

      // Map acq status/outcome → curb lead stage
      let stage = 'sourced';
      if (appt.outcome === 'purchased') stage = 'purchased';
      else if (appt.outcome === 'no_purchase' || appt.outcome === 'lost') stage = 'lost';
      else if (appt.status === 'completed') stage = 'inspected';
      else if (appt.status === 'scheduled' || appt.status === 'confirmed') stage = 'scheduled';
      else if (appt.status === 'arrived' || appt.status === 'en_route') stage = 'scheduled';
      else if (appt.status === 'cancelled') stage = 'lost';

      // Combine date + time into timestamptz
      const scheduledAt = appt.scheduled_date && appt.scheduled_time
        ? `${appt.scheduled_date}T${appt.scheduled_time}`
        : null;

      // Create curb_lead with vehicle info
      const { data: lead, error: leadErr } = await curb
        .from('curb_leads')
        .insert({
          tenant_id: SVG_TENANT_ID,
          seller_id: sellerId,
          assigned_agent_id: agentId,
          stage,
          year: vehicle?.year,
          make: vehicle?.make,
          model: vehicle?.model,
          trim: vehicle?.trim,
          mileage: vehicle?.mileage,
          vin: vehicle?.vin,
          color: vehicle?.color,
          source: 'manual',
          seller_first_name: customer?.first_name,
          seller_last_name: customer?.last_name,
          seller_phone: customer?.phone,
          seller_email: customer?.email,
          seller_address: appt.address || customer?.address,
          seller_city: appt.city || customer?.city,
          seller_state: appt.state || customer?.state,
          seller_zip: appt.zip || customer?.zip,
          scheduled_at: scheduledAt,
          notes: appt.notes,
          asking_price: appt.offer_amount,
        })
        .select('id')
        .single();

      if (leadErr) {
        log.push(`ERROR creating lead for appt ${appt.id}: ${leadErr.message}`);
        apptErrors++;
        continue;
      }

      // Create curb_appointment
      const { error: apptErr } = await curb
        .from('curb_appointments')
        .insert({
          tenant_id: SVG_TENANT_ID,
          lead_id: lead.id,
          seller_id: sellerId,
          agent_id: agentId,
          scheduled_at: scheduledAt || new Date().toISOString(),
          scheduled_date: appt.scheduled_date,
          scheduled_time: appt.scheduled_time,
          duration_minutes: appt.duration_mins || 60,
          address: appt.address,
          city: appt.city || '',
          state: appt.state || '',
          zip: appt.zip || '',
          lat: appt.lat,
          lng: appt.lng,
          status: mapStatus(appt.status),
          result: mapResult(appt.outcome),
          offer_amount: appt.offer_amount,
          purchase_price: appt.purchase_amount,
          no_purchase_reason: appt.lost_reason,
          notes: appt.notes,
          vas_rep: appt.vas_rep,
          lead_source: appt.lead_source,
          outcome: appt.outcome,
          lost_reason: appt.lost_reason,
          external_id: appt.id,
        });

      if (apptErr) {
        log.push(`ERROR creating curb_appointment for appt ${appt.id}: ${apptErr.message}`);
        apptErrors++;
        continue;
      }

      apptCount++;
    }

    log.push(`\nMigrated ${apptCount} appointments (${apptErrors} errors)`);
    log.push(`Migrated ${Object.keys(agentMap).length} agents`);
    log.push(`Migrated ${Object.keys(sellerMap).length} sellers`);

    return NextResponse.json({
      success: true,
      summary: {
        agents: Object.keys(agentMap).length,
        sellers: Object.keys(sellerMap).length,
        appointments: apptCount,
        errors: apptErrors,
      },
      log,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err), log }, { status: 500 });
  }
}

function mapStatus(acqStatus: string | null): string {
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
  return map[acqStatus || ''] || 'scheduled';
}

function mapResult(outcome: string | null): string | null {
  const map: Record<string, string> = {
    purchased: 'purchased',
    no_purchase: 'no_purchase',
    no_show: 'no_show',
    lost: 'no_purchase',
  };
  return outcome ? map[outcome] || null : null;
}
