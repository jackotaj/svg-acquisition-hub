export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function POST(request: NextRequest) {
  const curb = getCurbSupabase();
  const body = await request.json();

  // In Curb, vehicles are tracked as leads
  const { data, error } = await curb
    .from('curb_leads')
    .insert({
      tenant_id: SVG_TENANT_ID,
      seller_id: body.customer_id || null,
      stage: 'sourced',
      year: body.year || null,
      make: body.make || null,
      model: body.model || null,
      mileage: body.mileage || null,
      source: 'manual',
      condition: body.condition || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return in acq_vehicles shape
  return NextResponse.json({
    id: data.id,
    customer_id: body.customer_id,
    year: data.year,
    make: data.make,
    model: data.model,
    trim: data.trim,
    mileage: data.mileage,
    vin: data.vin,
    color: data.color,
    condition_notes: null,
    created_at: data.created_at,
  });
}
