export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from('acq_vehicles')
    .insert({ customer_id: body.customer_id, year: body.year || null, make: body.make, model: body.model || null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
