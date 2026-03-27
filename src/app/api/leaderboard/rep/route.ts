export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('acq_appointments')
    .select('id, scheduled_date, scheduled_time, address, lead_source, status, outcome, purchase_amount, notes, customer:acq_customers(first_name, last_name, phone), vehicle:acq_vehicles(year, make, model)')
    .eq('vas_rep', name)
    .order('scheduled_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
