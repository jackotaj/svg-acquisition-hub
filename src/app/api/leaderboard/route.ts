export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calcPoints(appts: any[]) {
  let pts = 0;
  for (const a of appts) {
    pts += 10;
    if (['on_site', 'completed'].includes(a.status) && a.outcome !== 'no_show') pts += 20;
    if (a.outcome === 'purchased') {
      pts += 100;
      pts += Math.floor((a.purchase_price || 0) / 1000);
    }
  }
  return pts;
}

function getLevel(pts: number) {
  if (pts >= 700) return { label: 'Platinum', emoji: '💎', color: '#b9f2ff', next: null, current: 700 };
  if (pts >= 400) return { label: 'Gold',     emoji: '🥇', color: '#ffd700', next: 700, current: 400 };
  if (pts >= 200) return { label: 'Silver',   emoji: '🥈', color: '#a8a9ad', next: 400, current: 200 };
  return           { label: 'Bronze',  emoji: '🥉', color: '#cd7f32', next: 200, current: 0 };
}

export async function GET(request: NextRequest) {
  const curb = getCurbSupabase();
  const month = request.nextUrl.searchParams.get('month');
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = targetMonth.split('-').map(Number);
  const start = `${year}-${String(mon).padStart(2, '0')}-01`;
  const end = new Date(year, mon, 0).toISOString().split('T')[0];

  const { data, error } = await curb
    .from('curb_appointments')
    .select(`id, vas_rep, lead_source, status, outcome, purchase_price, scheduled_date,
      seller:curb_sellers(first_name, last_name),
      lead:curb_leads(year, make, model)`)
    .eq('tenant_id', SVG_TENANT_ID)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .not('vas_rep', 'is', null)
    .order('scheduled_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shape for frontend compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appts = (data || []).map((a: any) => ({
    ...a,
    purchase_amount: a.purchase_price,
    customer: a.seller ? { first_name: a.seller.first_name, last_name: a.seller.last_name } : null,
    vehicle: a.lead ? { year: a.lead.year, make: a.lead.make, model: a.lead.model } : null,
  }));

  function normalizeName(s: string | null | undefined): string {
    if (!s || !s.trim()) return '';
    const t = s.trim();
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repMap: Record<string, any[]> = {};
  for (const a of appts) {
    const key = normalizeName(a.vas_rep);
    if (!key) continue;
    if (!repMap[key]) repMap[key] = [];
    repMap[key].push(a);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const reps = Object.entries(repMap).map(([name, list]) => {
    const total = list.length;
    const showed   = list.filter(a => ['on_site', 'completed'].includes(a.status) && a.outcome !== 'no_show').length;
    const purchased = list.filter(a => a.outcome === 'purchased').length;
    const noPurchase = list.filter(a => a.outcome === 'no_purchase').length;
    const noShow   = list.filter(a => a.outcome === 'no_show').length;
    const canceled  = list.filter(a => a.status === 'canceled').length;
    const pending   = list.filter(a => a.outcome === 'pending').length;

    const totalRevenue = list.filter(a => a.outcome === 'purchased').reduce((s, a) => s + (a.purchase_price || 0), 0);
    const avgDeal = purchased > 0 ? Math.round(totalRevenue / purchased) : 0;
    const pts = calcPoints(list);
    const level = getLevel(pts);

    const recentPurchase = list.filter(a => a.outcome === 'purchased').sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
    const onFire = !!(recentPurchase && recentPurchase.scheduled_date >= sevenDaysAgo);

    const leadSources: Record<string, number> = {};
    list.forEach(a => {
      const s = a.lead_source || 'Unknown';
      leadSources[s] = (leadSources[s] || 0) + 1;
    });

    return {
      name, total, showed, purchased, noPurchase, noShow, canceled, pending,
      showRate: total > 0 ? Math.round((showed + noShow + noPurchase) / total * 100) : 0,
      closeRate: (showed + noPurchase) > 0 ? Math.round(purchased / (showed + noPurchase) * 100) : 0,
      contactCloseRate: total > 0 ? Math.round(purchased / total * 100) : 0,
      totalRevenue, avgDeal, points: pts, level, onFire,
      recentAppts: list.slice(0, 5),
      leadSources,
    };
  });

  reps.sort((a, b) => b.points - a.points);

  return NextResponse.json({ reps, month: targetMonth, allRecent: appts });
}
