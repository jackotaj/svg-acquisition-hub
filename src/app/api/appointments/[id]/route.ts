import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from('acq_appointments')
    .select(
      '*, customer:acq_customers(*), vehicle:acq_vehicles(*), agent:acq_agents(*), appraisal:acq_appraisals(*)'
    )
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  // If appraisal data is provided, upsert it separately
  if (body.appraisal) {
    const appraisalData = { ...body.appraisal, appointment_id: id };
    // Check if appraisal exists
    const { data: existing } = await supabaseAdmin
      .from('acq_appraisals')
      .select('id')
      .eq('appointment_id', id)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('acq_appraisals')
        .update(appraisalData)
        .eq('id', existing.id);
    } else {
      await supabaseAdmin.from('acq_appraisals').insert(appraisalData);
    }
    delete body.appraisal;
  }

  // Update appointment fields if any remain
  if (Object.keys(body).length > 0) {
    body.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('acq_appointments')
      .update(body)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return updated appointment
  const { data, error: fetchErr } = await supabaseAdmin
    .from('acq_appointments')
    .select(
      '*, customer:acq_customers(*), vehicle:acq_vehicles(*), agent:acq_agents(*), appraisal:acq_appraisals(*)'
    )
    .eq('id', id)
    .single();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  return NextResponse.json(data);
}
