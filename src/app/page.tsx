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
  if (outcome === 'purchased') return <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">✅ Acquired</span>;
  if (outcome === 'no_purchase') return <span className="text-xs font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">❌ No Purchase</span>;
  if (outcome === 'no_show') return <span className="text-xs font-bold text-muted bg-muted-bg px-2 py-0.5 rounded-full">👻 No Show</span>;
  if (status === 'cancelled') return <span className="text-xs font-bold text-muted bg-muted-bg px-2 py-0.5 rounded-full">🚫 Canceled</span>;
  if (status === 'arrived' || status === 'appraising') return <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">🔄 In Progress</span>;
  return <span className="text-xs font-bold text-muted bg-muted-bg px-2 py-0.5 rounded-full">Scheduled</span>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted">Loading…</div>;
  if (!data) return null;

  const { today, month, week, vasGoals, recentAppts, conflicts } = data;
  const monthRemaining = Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());
  const totalGoal = vasGoals.reduce((s) => s + 20, 0);
  const totalPurchased = vasGoals.reduce((s, v) => s + v.purchased, 0);
  const overallGoalPct = Math.min(100, Math.round((totalPurchased / totalGoal) * 100));

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-navy dark:text-white">{greeting} 👋</h1>
          <p className="text-muted text-sm mt-0.5">{dateStr} · SVG Acquisition Hub</p>
        </div>
        <Link href="/acquire/new" className="bg-orange text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange/90 transition-colors shadow-sm">
          + Schedule Acquisition
        </Link>
      </div>

      {/* Alerts */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="font-bold text-red-700 dark:text-red-400 text-sm">Schedule Conflicts Today</span>
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-red-600 dark:text-red-400 text-xs ml-6">• {c.msg}</div>
          ))}
          <Link href="/dispatch" className="text-xs text-red-500 dark:text-red-400 font-semibold ml-6 mt-1 inline-block hover:underline">View Dispatch Board →</Link>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: <Calendar size={16} className="text-orange" />,
            bg: 'bg-orange/10',
            label: 'Today',
            value: today.total,
            sub: today.active > 0
              ? <><span className="text-blue-500 dark:text-blue-400 font-semibold">{today.active} active · </span>{today.completed} done</>
              : today.total === 0 ? 'No appointments' : `${today.completed} done`,
            extra: today.purchased > 0 && <div className="text-xs font-bold text-green-600 dark:text-green-400 mt-1">🎯 {today.purchased} acquired</div>,
          },
          {
            icon: <Target size={16} className="text-green-600 dark:text-green-400" />,
            bg: 'bg-green-50 dark:bg-green-900/20',
            label: 'Monthly Goal',
            value: <>{totalPurchased}<span className="text-lg text-muted font-normal">/{totalGoal}</span></>,
            sub: `${monthRemaining} days left · ${Math.max(0, totalGoal - totalPurchased)} more needed`,
            extra: (
              <div className="h-1.5 bg-muted-bg rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${overallGoalPct}%` }} />
              </div>
            ),
          },
          {
            icon: <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />,
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            label: 'This Week',
            value: week.total,
            sub: 'appointments booked',
          },
          {
            icon: <Car size={16} className="text-purple-600 dark:text-purple-400" />,
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            label: 'Conv. Rate',
            value: `${month.convRate}%`,
            sub: `${month.purchased} of ${month.total} appts this month`,
          },
        ].map((card, i) => (
          <div key={i} className="bg-card border border-card-border rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>{card.icon}</div>
              <span className="text-xs font-bold text-muted uppercase tracking-wide">{card.label}</span>
            </div>
            <div className="text-3xl font-black text-navy dark:text-white">{card.value}</div>
            <div className="text-xs text-muted mt-1">{card.sub}</div>
            {card.extra}
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* VAS Goal Tracker */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy dark:text-white">VAS Goal Tracker</h2>
            <Link href="/leaderboard" className="text-xs text-orange font-semibold hover:underline">Full Board →</Link>
          </div>
          <div className="text-xs text-muted mb-4">Monthly target: 20 acquisitions each</div>
          {vasGoals.map(v => {
            const color = REP_COLORS[v.rep] || '#f97316';
            const hit = v.purchased >= 20;
            return (
              <div key={v.rep} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: color }}>{v.rep[0]}</div>
                    <span className="font-semibold text-sm text-foreground">{v.rep}</span>
                  </div>
                  <span className="font-black text-sm" style={{ color: hit ? '#10b981' : color }}>
                    {hit ? '🎯 DONE' : `${v.purchased}/20`}
                  </span>
                </div>
                <div className="h-3 bg-muted-bg rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${v.goalPct}%`, background: hit ? '#10b981' : color }} />
                </div>
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>{v.total} appts booked</span>
                  <span>{Math.max(0, 20 - v.purchased)} to go</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's Schedule */}
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy dark:text-white">Today&apos;s Schedule</h2>
            <Link href="/dispatch" className="text-xs text-orange font-semibold hover:underline">Dispatch Board →</Link>
          </div>
          {today.appts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock size={28} className="text-muted mb-2 opacity-30" />
              <div className="text-muted text-sm">No appointments today</div>
              <Link href="/acquire/new" className="text-xs text-orange font-semibold mt-2 hover:underline">+ Schedule one →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {today.appts.map(a => {
                const agentColor = Array.isArray(a.agent) ? (a.agent[0] as { color_hex: string } | null)?.color_hex : (a.agent as { name: string; color_hex: string } | null)?.color_hex;
                const agentName = Array.isArray(a.agent) ? (a.agent[0] as { name: string } | null)?.name : (a.agent as { name: string } | null)?.name;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted-bg hover:bg-muted-bg/80 transition-colors">
                    <div className="text-xs font-bold text-muted w-10 flex-shrink-0">{a.scheduled_time.slice(0,5)}</div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: agentColor || '#e5e7eb' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}
                      </div>
                      <div className="text-xs text-muted truncate">
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
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy dark:text-white">Recent Outcomes</h2>
            <Link href="/analytics" className="text-xs text-orange font-semibold hover:underline">Analytics →</Link>
          </div>
          {recentAppts.length === 0 ? (
            <div className="text-muted text-sm text-center py-8">No recent activity</div>
          ) : (
            <div className="space-y-2">
              {recentAppts.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-card-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}
                    </div>
                    <div className="text-xs text-muted">
                      {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make}` : ''}
                      {a.vas_rep && <span className="ml-1 opacity-50">· {a.vas_rep}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {outcomeTag(a.outcome, 'completed')}
                    {a.purchase_amount && (
                      <div className="text-xs font-bold text-green-600 dark:text-green-400 mt-0.5">${a.purchase_amount.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/dispatch',    label: 'Dispatch Board', desc: 'Driver workload & routes', emoji: '🗺️' },
          { href: '/leaderboard', label: 'Leaderboard',    desc: 'VAS rep performance',     emoji: '🏆' },
          { href: '/analytics',   label: 'Analytics',      desc: 'Funnel & lead sources',   emoji: '📊' },
          { href: '/schedule',    label: 'Schedule',       desc: 'Full calendar view',      emoji: '📅' },
        ].map(q => (
          <Link key={q.href} href={q.href}
            className="bg-card border border-card-border rounded-xl shadow-sm p-4 hover:border-orange/40 hover:shadow-md transition-all group">
            <div className="text-2xl mb-2">{q.emoji}</div>
            <div className="font-bold text-sm text-navy dark:text-white group-hover:text-orange transition-colors">{q.label}</div>
            <div className="text-xs text-muted mt-0.5">{q.desc}</div>
          </Link>
        ))}
      </div>

    </div>
  );
}
