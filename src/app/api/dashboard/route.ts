export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function GET() {
  const curb = getCurbSupabase();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const [todayRes, monthRes, weekRes, recentRes] = await Promise.all([
    curb.from('curb_appointments')
      .select(`id, status, outcome, scheduled_time, scheduled_date, vas_rep,
        seller:curb_sellers(first_name, last_name),
        lead:curb_leads(year, make, model),
        agent:curb_users(first_name, last_name, color_hex)`)
      .eq('tenant_id', SVG_TENANT_ID)
      .gte('scheduled_date', today)
      .lte('scheduled_date', nextWeekStr)
      .neq('status', 'canceled')
      .order('scheduled_date').order('scheduled_time'),
    curb.from('curb_appointments')
      .select('id, outcome, purchase_price, vas_rep')
      .eq('tenant_id', SVG_TENANT_ID)
      .gte('scheduled_date', monthStart),
    curb.from('curb_appointments')
      .select('id')
      .eq('tenant_id', SVG_TENANT_ID)
      .gte('scheduled_date', weekStartStr),
    curb.from('curb_appointments')
      .select(`id, scheduled_date, scheduled_time, outcome, purchase_price, vas_rep,
        seller:curb_sellers(first_name, last_name),
        lead:curb_leads(year, make, model)`)
      .eq('tenant_id', SVG_TENANT_ID)
      .order('scheduled_date', { ascending: false })
      .order('scheduled_time', { ascending: false })
      .limit(8),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function shapeAppt(a: any) {
    const agent = a.agent;
    const seller = a.seller;
    const lead = a.lead;
    return {
      ...a,
      purchase_amount: a.purchase_price,
      customer: seller ? { first_name: seller.first_name, last_name: seller.last_name } : null,
      vehicle: lead ? { year: lead.year, make: lead.make, model: lead.model } : null,
      agent: agent ? { name: `${agent.first_name} ${agent.last_name}`.trim(), color_hex: agent.color_hex } : null,
    };
  }

  const todayAppts = (todayRes.data || []).map(shapeAppt);
  const monthAppts = (monthRes.data || []).map((a) => ({ ...a, purchase_amount: a.purchase_price }));
  const weekAppts = weekRes.data || [];
  const recentAppts = (recentRes.data || []).map(shapeAppt);

  const todayScheduled = todayAppts.filter(a => a.status === 'scheduled').length;
  const todayActive = todayAppts.filter(a => ['on_site'].includes(a.status)).length;
  const todayCompleted = todayAppts.filter(a => a.status === 'completed').length;
  const todayCancelled = todayAppts.filter(a => a.status === 'canceled').length;
  const todayPurchased = todayAppts.filter(a => a.outcome === 'purchased').length;

  const monthPurchased = monthAppts.filter(a => a.outcome === 'purchased').length;
  const monthShowed = monthAppts.filter(a => a.outcome && a.outcome !== 'no_show').length;
  const monthConvRate = monthAppts.length > 0 ? Math.round((monthPurchased / monthAppts.length) * 100) : 0;

  const vasReps = ['Bianka', 'David'];
  const vasGoals = vasReps.map(rep => {
    const repAppts = monthAppts.filter(a => a.vas_rep?.toLowerCase() === rep.toLowerCase());
    const purchased = repAppts.filter(a => a.outcome === 'purchased').length;
    return { rep, total: repAppts.length, purchased, goalPct: Math.min(100, Math.round((purchased / 20) * 100)) };
  });

  // Conflict detection
  const conflicts: Array<{ time: string; msg: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentGroups: Record<string, any[]> = {};
  todayAppts.forEach(a => {
    const agentName = a.agent?.name;
    if (!agentName) return;
    if (!agentGroups[agentName]) agentGroups[agentName] = [];
    agentGroups[agentName].push(a);
  });
  Object.entries(agentGroups).forEach(([agentName, appts]) => {
    appts.forEach((a, i) => {
      if (i === 0) return;
      const prev = appts[i - 1];
      const prevMins = parseInt(prev.scheduled_time.split(':')[0]) * 60 + parseInt(prev.scheduled_time.split(':')[1]);
      const currMins = parseInt(a.scheduled_time.split(':')[0]) * 60 + parseInt(a.scheduled_time.split(':')[1]);
      const gap = currMins - prevMins;
      if (gap < 60) conflicts.push({ time: a.scheduled_time, msg: `${agentName}: only ${gap}min between stops (need 60+ for appraisal + drive)` });
    });
  });

  return NextResponse.json({
    today: { total: todayAppts.length, scheduled: todayScheduled, active: todayActive, completed: todayCompleted, cancelled: todayCancelled, purchased: todayPurchased, appts: todayAppts },
    month: { total: monthAppts.length, purchased: monthPurchased, showed: monthShowed, convRate: monthConvRate, goal: 20 },
    week: { total: weekAppts.length },
    vasGoals,
    recentAppts,
    conflicts,
  });
}
