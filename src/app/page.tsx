'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp, Car, Calendar, Target, Clock } from 'lucide-react';

interface DashboardData {
  today: {
    total: number; scheduled: number; active: number; completed: number;
    cancelled: number; purchased: number;
    appts: Array<{ id: string; scheduled_time: string; status: string; outcome: string | null;
      customer: { first_name: string; last_name: string } | null;
      vehicle: { year: string; make: string; model: string } | null;
      agent: { name: string; color_hex: string } | null;
    }>;
  };
  month: { total: number; purchased: number; showed: number; convRate: number; goal: number };
  week: { total: number };
  vasGoals: Array<{ rep: string; total: number; purchased: number; goalPct: number }>;
  recentAppts: Array<{ id: string; scheduled_date: string; scheduled_time: string; outcome: string | null; purchase_amount: number | null; vas_rep: string | null; customer: { first_name: string; last_name: string } | null; vehicle: { year: string; make: string; model: string } | null }>;
  conflicts: Array<{ time: string; msg: string }>;
}

const REP_COLORS: Record<string, string> = { Bianka: '#f97316', David: '#6366f1' };

function outcomeTag(outcome: string | null, status: string) {
  if (outcome === 'purchased') return <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ Acquired</span>;
  if (outcome === 'no_purchase') return <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">❌ No Purchase</span>;
  if (outcome === 'no_show') return <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">👻 No Show</span>;
  if (status === 'cancelled') return <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">🚫 Canceled</span>;
  if (status === 'arrived' || status === 'appraising') return <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">🔄 In Progress</span>;
  return <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Scheduled</span>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!data) return null;

  const { today, month, week, vasGoals, recentAppts, conflicts } = data;
  const monthRemaining = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  const totalGoal = vasGoals.reduce((s, v) => s + 20, 0);
  const totalPurchased = vasGoals.reduce((s, v) => s + v.purchased, 0);
  const overallGoalPct = Math.min(100, Math.round((totalPurchased / totalGoal) * 100));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy">{greeting} 👋</h1>
          <p className="text-gray-400 text-sm mt-0.5">{dateStr} · SVG Acquisition Hub</p>
        </div>
        <Link href="/acquire/new" className="bg-orange text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors shadow-sm">
          + Schedule Acquisition
        </Link>
      </div>

      {/* ── Alerts ── */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="font-bold text-red-700 text-sm">Schedule Conflicts Today</span>
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-red-600 text-xs ml-6">• {c.msg}</div>
          ))}
          <Link href="/dispatch" className="text-xs text-red-500 font-semibold ml-6 mt-1 inline-block hover:underline">View Dispatch Board →</Link>
        </div>
      )}

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange/10 rounded-lg flex items-center justify-center">
              <Calendar size={16} className="text-orange" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Today</span>
          </div>
          <div className="text-3xl font-black text-navy">{today.total}</div>
          <div className="text-xs text-gray-400 mt-1">
            {today.active > 0 && <span className="text-blue-600 font-semibold">{today.active} active · </span>}
            {today.completed > 0 && <span>{today.completed} done</span>}
            {today.total === 0 && 'No appointments'}
          </div>
          {today.purchased > 0 && <div className="text-xs font-bold text-green-600 mt-1">🎯 {today.purchased} acquired today</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <Target size={16} className="text-green-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Monthly Goal</span>
          </div>
          <div className="text-3xl font-black text-navy">{totalPurchased}<span className="text-lg text-gray-300 font-normal">/{totalGoal}</span></div>
          <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${overallGoalPct}%` }} />
          </div>
          <div className="text-xs text-gray-400 mt-1">{monthRemaining} days left · {Math.max(0, totalGoal - totalPurchased)} more needed</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">This Week</span>
          </div>
          <div className="text-3xl font-black text-navy">{week.total}</div>
          <div className="text-xs text-gray-400 mt-1">appointments booked</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Car size={16} className="text-purple-600" />
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Conv. Rate</span>
          </div>
          <div className="text-3xl font-black text-navy">{month.convRate}%</div>
          <div className="text-xs text-gray-400 mt-1">{month.purchased} of {month.total} appts this month</div>
        </div>
      </div>

      {/* ── Middle row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* VAS Goal Tracker */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy">VAS Goal Tracker</h2>
            <Link href="/leaderboard" className="text-xs text-orange font-semibold hover:underline">Full Board →</Link>
          </div>
          <div className="text-xs text-gray-400 mb-4">Monthly target: 20 acquisitions each</div>
          {vasGoals.map(v => {
            const color = REP_COLORS[v.rep] || '#f97316';
            const hit = v.purchased >= 20;
            return (
              <div key={v.rep} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: color }}>{v.rep[0]}</div>
                    <span className="font-semibold text-sm text-gray-700">{v.rep}</span>
                  </div>
                  <span className="font-black text-sm" style={{ color: hit ? '#10b981' : color }}>
                    {hit ? '🎯 DONE' : `${v.purchased}/20`}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full relative" style={{ width: `${v.goalPct}%`, background: hit ? '#10b981' : color }}>
                    {v.goalPct > 20 && <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-black">{v.goalPct}%</span>}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-300 mt-1">
                  <span>{v.total} appts booked</span>
                  <span>{Math.max(0, 20 - v.purchased)} to go</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy">Today&apos;s Schedule</h2>
            <Link href="/dispatch" className="text-xs text-orange font-semibold hover:underline">Dispatch Board →</Link>
          </div>
          {today.appts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock size={28} className="text-gray-200 mb-2" />
              <div className="text-gray-400 text-sm">No appointments today</div>
              <Link href="/acquire/new" className="text-xs text-orange font-semibold mt-2 hover:underline">+ Schedule one →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {today.appts.map(a => {
                const agentColor = Array.isArray(a.agent) ? (a.agent[0] as { color_hex: string } | null)?.color_hex : (a.agent as { name: string; color_hex: string } | null)?.color_hex;
                const agentName = Array.isArray(a.agent) ? (a.agent[0] as { name: string } | null)?.name : (a.agent as { name: string } | null)?.name;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="text-xs font-bold text-gray-500 w-10 flex-shrink-0">{a.scheduled_time.slice(0,5)}</div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agentColor || '#e5e7eb' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-700 truncate">
                        {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make}` : ''}
                        {agentName && <span className="ml-1">· {agentName}</span>}
                      </div>
                    </div>
                    {outcomeTag(a.outcome, a.status)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Outcomes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy">Recent Outcomes</h2>
            <Link href="/analytics" className="text-xs text-orange font-semibold hover:underline">Analytics →</Link>
          </div>
          {recentAppts.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-8">No recent activity</div>
          ) : (
            <div className="space-y-2">
              {recentAppts.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-700 truncate">
                      {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make}` : ''}
                      {a.vas_rep && <span className="ml-1 text-gray-300">· {a.vas_rep}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {outcomeTag(a.outcome, 'completed')}
                    {a.purchase_amount && (
                      <div className="text-xs font-bold text-green-600 mt-0.5">${a.purchase_amount.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/dispatch', label: 'Dispatch Board', desc: 'Driver workload & routes', emoji: '🗺️' },
          { href: '/leaderboard', label: 'Leaderboard', desc: 'VAS rep performance', emoji: '🏆' },
          { href: '/analytics', label: 'Analytics', desc: 'Funnel & lead sources', emoji: '📊' },
          { href: '/schedule', label: 'Schedule', desc: 'Full calendar view', emoji: '📅' },
        ].map(q => (
          <Link key={q.href} href={q.href}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-orange/30 hover:shadow-md transition-all group">
            <div className="text-2xl mb-2">{q.emoji}</div>
            <div className="font-bold text-sm text-navy group-hover:text-orange transition-colors">{q.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{q.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
