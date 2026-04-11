export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const curb = getCurbSupabase();
  const body = await request.json();

  // Map acq_agents fields → curb_users fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name) {
    const parts = body.name.split(' ');
    updates.first_name = parts[0];
    updates.last_name = parts.slice(1).join(' ') || '';
  }
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.email !== undefined) updates.email = body.email;
  if (body.color_hex !== undefined) updates.color_hex = body.color_hex;
  if (body.is_active !== undefined) updates.active = body.is_active;

  const { data, error } = await curb
    .from('curb_users')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', SVG_TENANT_ID)
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
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const curb = getCurbSupabase();
  const { error } = await curb
    .from('curb_users')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', SVG_TENANT_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
