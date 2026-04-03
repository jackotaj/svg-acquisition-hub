export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const [todayRes, monthRes, weekRes, recentRes] = await Promise.all([
    // Show today + upcoming 7 days so the dashboard is never empty
    supabaseAdmin.from('acq_appointments').select('id, status, outcome, scheduled_time, scheduled_date, vas_rep, customer:acq_customers(first_name, last_name), vehicle:acq_vehicles(year, make, model), agent:acq_agents(name, color_hex)').gte('scheduled_date', today).lte('scheduled_date', nextWeekStr).not('status','eq','cancelled').order('scheduled_date').order('scheduled_time'),
    supabaseAdmin.from('acq_appointments').select('id, outcome, purchase_amount, vas_rep').gte('scheduled_date', monthStart),
    supabaseAdmin.from('acq_appointments').select('id').gte('scheduled_date', weekStartStr),
    supabaseAdmin.from('acq_appointments').select('id, scheduled_date, scheduled_time, outcome, purchase_amount, vas_rep, customer:acq_customers(first_name, last_name), vehicle:acq_vehicles(year, make, model)').order('scheduled_date', { ascending: false }).order('scheduled_time', { ascending: false }).limit(8),
  ]);

  const todayAppts = todayRes.data || [];
  const monthAppts = monthRes.data || [];
  const weekAppts = weekRes.data || [];
  const recentAppts = recentRes.data || [];

  // Today breakdown
  const todayScheduled = todayAppts.filter(a => a.status === 'scheduled').length;
  const todayActive = todayAppts.filter(a => ['arrived', 'appraising'].includes(a.status)).length;
  const todayCompleted = todayAppts.filter(a => a.status === 'completed').length;
  const todayCancelled = todayAppts.filter(a => a.status === 'cancelled').length;
  const todayPurchased = todayAppts.filter(a => a.outcome === 'purchased').length;

  // Month stats
  const monthPurchased = monthAppts.filter(a => a.outcome === 'purchased').length;
  const monthShowed = monthAppts.filter(a => a.outcome && a.outcome !== 'no_show').length;
  const monthConvRate = monthAppts.length > 0 ? Math.round((monthPurchased / monthAppts.length) * 100) : 0;

  // VAS rep goals
  const vasReps = ['Bianka', 'David'];
  const vasGoals = vasReps.map(rep => {
    // Case-insensitive match to handle DAVID vs David
    const repAppts = monthAppts.filter(a => a.vas_rep?.toLowerCase() === rep.toLowerCase());
    const purchased = repAppts.filter(a => a.outcome === 'purchased').length;
    return { rep, total: repAppts.length, purchased, goalPct: Math.min(100, Math.round((purchased / 20) * 100)) };
  });

  // Conflict detection: appointments within 30 min of each other for same agent
  const conflicts: Array<{ time: string; msg: string }> = [];
  const agentGroups: Record<string, typeof todayAppts> = {};
  todayAppts.forEach(a => {
    const agentName = Array.isArray(a.agent) ? a.agent[0]?.name : (a.agent as { name: string; color_hex: string } | null)?.name;
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
