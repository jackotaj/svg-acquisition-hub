export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function GET() {
  const curb = getCurbSupabase();
  const today = new Date().toISOString().split('T')[0];

  const { data: users, error } = await curb
    .from('curb_users')
    .select('*')
    .eq('tenant_id', SVG_TENANT_ID)
    .eq('role', 'agent')
    .eq('active', true)
    .order('first_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get today's appointment counts per agent
  const { data: counts } = await curb
    .from('curb_appointments')
    .select('agent_id')
    .eq('tenant_id', SVG_TENANT_ID)
    .eq('scheduled_date', today);

  const countMap: Record<string, number> = {};
  (counts || []).forEach((row: { agent_id: string | null }) => {
    if (row.agent_id) {
      countMap[row.agent_id] = (countMap[row.agent_id] || 0) + 1;
    }
  });

  // Shape as legacy acq_agents format
  const result = (users || []).map((u) => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name}`.trim(),
    phone: u.phone,
    email: u.email,
    color_hex: u.color_hex || '#7C3AED',
    is_active: u.active,
    store: 'BCK',
    created_at: u.created_at,
    appointment_count: countMap[u.id] || 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const curb = getCurbSupabase();
  const body = await request.json();

  const nameParts = (body.name || '').split(' ');
  const { data, error } = await curb
    .from('curb_users')
    .insert({
      tenant_id: SVG_TENANT_ID,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      email: body.email || `${(body.name || 'agent').toLowerCase().replace(/\s+/g, '.')}@svgmotors.com`,
      phone: body.phone || null,
      role: 'agent',
      color_hex: body.color_hex || '#7C3AED',
      active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: data.id,
    name: `${data.first_name} ${data.last_name}`.trim(),
    phone: data.phone,
    email: data.email,
    color_hex: data.color_hex,
    is_active: data.active,
    store: 'BCK',
    created_at: data.created_at,
    appointment_count: 0,
  }, { status: 201 });
}
