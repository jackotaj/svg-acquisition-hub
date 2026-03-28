/**
 * POST /api/sheets/resync
 * Full resync — pushes all Supabase appointments to Google Sheet
 * Call this manually or on a schedule to keep things in sync
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fullResync } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== (process.env.SHEETS_WEBHOOK_SECRET || 'svg-sheets-sync')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: appts, error } = await supabaseAdmin
    .from('acq_appointments')
    .select('*, customer:acq_customers(*), vehicle:acq_vehicles(*)')
    .order('scheduled_date', { ascending: false })
    .order('scheduled_time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = await fullResync(appts || []);
  return NextResponse.json(result);
}
