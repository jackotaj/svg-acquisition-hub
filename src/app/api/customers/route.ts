export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function POST(request: NextRequest) {
  const curb = getCurbSupabase();
  const body = await request.json();

  const { data, error } = await curb
    .from('curb_sellers')
    .insert({
      tenant_id: SVG_TENANT_ID,
      first_name: body.first_name,
      last_name: body.last_name || '',
      phone: body.phone || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return in acq_customers shape
  return NextResponse.json({
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip,
    lat: data.lat,
    lng: data.lng,
    notes: null,
    created_at: data.created_at,
  });
}
