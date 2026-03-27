export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function calcPoints(appts: {
  status: string;
  outcome: string | null;
  purchase_amount: number | null;
}[]) {
  let pts = 0;
  for (const a of appts) {
    pts += 10; // scheduled
    if (['arrived', 'appraising', 'completed'].includes(a.status)) pts += 20; // showed
    if (a.outcome === 'purchased') {
      pts += 100;
      pts += Math.floor((a.purchase_amount || 0) / 1000);
    }
  }
  return pts;
}

function getLevel(pts: number) {
  if (pts >= 700) return { label: 'Platinum', emoji: '💎', next: null, current: 700 };
  if (pts >= 400) return { label: 'Gold', emoji: '🥇', next: 700, current: 400 };
  if (pts >= 200) return { label: 'Silver', emoji: '🥈', next: 400, current: 200 };
  return { label: 'Bronze', emoji: '🥉', next: 200, current: 0 };
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get('month'); // YYYY-MM
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = targetMonth.split('-').map(Number);
  const start = `${year}-${String(mon).padStart(2, '0')}-01`;
  const end = new Date(year, mon, 0).toISOString().split('T')[0]; // last day

  const { data, error } = await supabaseAdmin
    .from('acq_appointments')
    .select('id, vas_rep, lead_source, status, outcome, purchase_amount, scheduled_date, created_at, customer:acq_customers(first_name, last_name), vehicle:acq_vehicles(year, make, model)')
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .not('vas_rep', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by vas_rep
  const repMap: Record<string, typeof data> = {};
  for (const appt of (data || [])) {
    const rep = appt.vas_rep!;
    if (!repMap[rep]) repMap[rep] = [];
    repMap[rep].push(appt);
  }

  const reps = Object.entries(repMap).map(([name, appts]) => {
    const total = appts.length;
    const showed = appts.filter(a => ['arrived', 'appraising', 'completed'].includes(a.status)).length;
    const purchased = appts.filter(a => a.outcome === 'purchased').length;
    const noShow = appts.filter(a => a.outcome === 'no_show' || a.status === 'cancelled').length;
    const totalRevenue = appts.filter(a => a.outcome === 'purchased')
      .reduce((s, a) => s + (a.purchase_amount || 0), 0);
    const pts = calcPoints(appts);
    const level = getLevel(pts);
    const recentPurchase = appts
      .filter(a => a.outcome === 'purchased')
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const onFire = recentPurchase && recentPurchase.scheduled_date >= sevenDaysAgo;

    return {
      name,
      total, showed, purchased, noShow,
      showRate: total > 0 ? Math.round(showed / total * 100) : 0,
      closeRate: total > 0 ? Math.round(purchased / total * 100) : 0,
      totalRevenue,
      points: pts,
      level,
      onFire,
      recentAppts: [...appts].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)).slice(0, 5),
    };
  });

  // Sort by points desc
  reps.sort((a, b) => b.points - a.points);

  // Recent activity (all reps, last 8)
  const allRecent = [...(data || [])]
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
    .slice(0, 8);

  return NextResponse.json({ reps, month: targetMonth, allRecent });
}
