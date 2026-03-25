import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const today = new Date().toISOString().split('T')[0];

  const { data: agents, error } = await supabaseAdmin
    .from('acq_agents')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get today's appointment counts per agent
  const { data: counts } = await supabaseAdmin
    .from('acq_appointments')
    .select('agent_id')
    .eq('scheduled_date', today);

  const countMap: Record<string, number> = {};
  (counts || []).forEach((row: { agent_id: string | null }) => {
    if (row.agent_id) {
      countMap[row.agent_id] = (countMap[row.agent_id] || 0) + 1;
    }
  });

  const result = (agents || []).map((a) => ({
    ...a,
    appointment_count: countMap[a.id] || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from('acq_agents')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
