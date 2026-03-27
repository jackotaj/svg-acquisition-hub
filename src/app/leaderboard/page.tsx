'use client';

import { useEffect, useState } from 'react';

interface RepStats {
  name: string;
  total: number;
  showed: number;
  purchased: number;
  canceled: number;
  noShow: number;
  noPurchase: number;
  pending: number;
  showRate: number;
  closeRate: number; // purchased / showed
  contactCloseRate: number; // purchased / total
  totalRevenue: number;
  avgDeal: number;
  points: number;
  level: { label: string; emoji: string; next: number | null; current: number; color: string };
  onFire: boolean;
  recentAppts: RecentAppt[];
  leadSources: Record<string, number>;
}

interface RecentAppt {
  id: string;
  vas_rep: string;
  lead_source: string | null;
  status: string;
  outcome: string | null;
  purchase_amount: number | null;
  scheduled_date: string;
  customer: { first_name: string; last_name: string } | null;
  vehicle: { year: string; make: string; model: string } | null;
}

const LEVEL_CONFIG = [
  { label: 'Bronze',   emoji: '🥉', color: '#cd7f32', min: 0,   max: 199 },
  { label: 'Silver',   emoji: '🥈', color: '#a8a9ad', min: 200, max: 399 },
  { label: 'Gold',     emoji: '🥇', color: '#ffd700', min: 400, max: 699 },
  { label: 'Platinum', emoji: '💎', color: '#b9f2ff', min: 700, max: Infinity },
];

function getLevel(pts: number) {
  const level = LEVEL_CONFIG.find(l => pts >= l.min && pts <= l.max) || LEVEL_CONFIG[0];
  const nextLevel = LEVEL_CONFIG[LEVEL_CONFIG.indexOf(level) + 1];
  return { label: level.label, emoji: level.emoji, color: level.color, current: level.min, next: nextLevel?.min || null };
}

const REP_COLORS: Record<string, { primary: string; glow: string }> = {
  Bianka: { primary: '#f97316', glow: 'rgba(249,115,22,0.3)' },
  David:  { primary: '#6366f1', glow: 'rgba(99,102,241,0.3)' },
};
function repColor(name: string) {
  return REP_COLORS[name] || { primary: '#10b981', glow: 'rgba(16,185,129,0.3)' };
}

function OutcomePill({ outcome, status }: { outcome: string | null; status: string }) {
  if (outcome === 'purchased')    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ PURCHASED</span>;
  if (outcome === 'no_purchase')  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20">❌ NO PURCHASE</span>;
  if (outcome === 'no_show')      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/20">👻 NO SHOW</span>;
  if (outcome === 'pending')      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/20">⏳ PENDING</span>;
  if (status === 'cancelled')     return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600/20 text-gray-500 border border-gray-600/20">🚫 CANCELED</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20">{status}</span>;
}

function StatRow({ label, a, b, format = (n: number) => String(n), higher = true }:
  { label: string; a: number; b: number; format?: (n: number) => string; higher?: boolean }) {
  const aWins = higher ? a > b : a < b;
  const bWins = higher ? b > a : b < a;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className={`w-20 text-right text-sm font-bold ${aWins ? 'text-white' : 'text-white/40'}`}>{format(a)}</div>
      <div className="flex-1 text-center text-xs text-white/40 font-medium uppercase tracking-wider">{label}</div>
      <div className={`w-20 text-sm font-bold ${bWins ? 'text-white' : 'text-white/40'}`}>{format(b)}</div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<{ reps: RepStats[]; allRecent: RecentAppt[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month]);

  const reps = data?.reps || [];
  const allRecent = data?.allRecent || [];
  const leader = reps[0];
  const challenger = reps[1];
  const monthLabel = new Date(month + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen -m-4 lg:-m-6" style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #0f0f1e 50%, #0a0a14 100%)' }}>
      {/* Top Bar */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-white font-bold text-lg tracking-tight">VAS Leaderboard</div>
            <div className="text-white/40 text-xs">Vehicle Acquisition Specialists · {monthLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button onClick={() => setActiveTab('overview')}
              className={`px-4 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'overview' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}>
              Overview
            </button>
            <button onClick={() => setActiveTab('activity')}
              className={`px-4 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'activity' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}>
              Activity Log
            </button>
          </div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none" />
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center text-white/30 py-32 text-lg">Loading…</div>
        ) : reps.length === 0 ? (
          <div className="text-center py-32">
            <div className="text-5xl mb-4">🏆</div>
            <div className="text-white/40 text-lg">No data for {monthLabel}</div>
            <div className="text-white/20 text-sm mt-2">Book appointments and assign a VAS rep to start competing.</div>
          </div>
        ) : activeTab === 'activity' ? (
          /* ── ACTIVITY LOG TAB ── */
          <div className="space-y-2">
            <div className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-4">All Appointments · {monthLabel}</div>
            {allRecent.map(appt => {
              const rc = repColor(appt.vas_rep);
              return (
                <div key={appt.id} className="flex items-center gap-4 bg-white/3 border border-white/6 rounded-xl px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: rc.primary }}>
                    {appt.vas_rep?.charAt(0)}
                  </div>
                  <div className="w-16 text-xs font-semibold" style={{ color: rc.primary }}>{appt.vas_rep}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white/90 truncate">
                      {appt.customer ? `${appt.customer.first_name} ${appt.customer.last_name}` : '—'}
                    </div>
                    <div className="text-xs text-white/30 truncate">
                      {appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : '—'}
                      {appt.lead_source && <span className="ml-2 text-white/20">· {appt.lead_source}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-white/30 flex-shrink-0">{appt.scheduled_date}</div>
                  <OutcomePill outcome={appt.outcome} status={appt.status} />
                  {appt.purchase_amount ? (
                    <div className="text-sm font-bold text-emerald-400 flex-shrink-0 w-20 text-right">${appt.purchase_amount.toLocaleString()}</div>
                  ) : <div className="w-20" />}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── OVERVIEW TAB ── */
          <>
            {/* VS Hero Banner (only when 2 reps) */}
            {leader && challenger && (
              <div className="relative mb-8 rounded-2xl overflow-hidden border border-white/8"
                style={{ background: 'linear-gradient(90deg, rgba(249,115,22,0.08) 0%, rgba(15,15,30,1) 50%, rgba(99,102,241,0.08) 100%)' }}>
                <div className="flex items-center">
                  {/* Leader side */}
                  <div className="flex-1 p-6 text-center">
                    <div className="text-4xl font-black text-white/90 mb-1">{leader.purchased}</div>
                    <div className="text-xs text-white/40 uppercase tracking-widest">Purchases</div>
                    <div className="text-2xl font-bold mt-3" style={{ color: repColor(leader.name).primary }}>{leader.name}</div>
                    <div className="text-white/30 text-sm">{leader.level.emoji} {leader.level.label}</div>
                    {leader.onFire && <div className="text-lg mt-1">🔥</div>}
                  </div>

                  {/* VS center */}
                  <div className="px-6 text-center flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 font-black text-sm">VS</div>
                    <div className="text-xs text-white/20 mt-2 font-medium uppercase tracking-widest">March 2026</div>
                  </div>

                  {/* Challenger side */}
                  <div className="flex-1 p-6 text-center">
                    <div className="text-4xl font-black text-white/90 mb-1">{challenger.purchased}</div>
                    <div className="text-xs text-white/40 uppercase tracking-widest">Purchases</div>
                    <div className="text-2xl font-bold mt-3" style={{ color: repColor(challenger.name).primary }}>{challenger.name}</div>
                    <div className="text-white/30 text-sm">{challenger.level.emoji} {challenger.level.label}</div>
                    {challenger.onFire && <div className="text-lg mt-1">🔥</div>}
                  </div>
                </div>

                {/* Revenue comparison bar */}
                <div className="px-6 pb-5">
                  <div className="text-xs text-white/30 text-center mb-2 uppercase tracking-widest">Revenue Generated</div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-white/5">
                    {(leader.totalRevenue + challenger.totalRevenue) > 0 ? (
                      <>
                        <div className="rounded-l-full transition-all" style={{
                          width: `${(leader.totalRevenue / (leader.totalRevenue + challenger.totalRevenue)) * 100}%`,
                          background: repColor(leader.name).primary
                        }} />
                        <div className="flex-1 rounded-r-full" style={{ background: repColor(challenger.name).primary }} />
                      </>
                    ) : <div className="flex-1 bg-white/10 rounded-full" />}
                  </div>
                  <div className="flex justify-between text-xs mt-1.5">
                    <span className="font-bold" style={{ color: repColor(leader.name).primary }}>${leader.totalRevenue.toLocaleString()}</span>
                    <span className="font-bold" style={{ color: repColor(challenger.name).primary }}>${challenger.totalRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Player Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
              {reps.map((rep, idx) => {
                const rc = repColor(rep.name);
                const lvl = rep.level;
                const progressPct = lvl.next
                  ? Math.min(100, ((rep.points - lvl.current) / (lvl.next - lvl.current)) * 100)
                  : 100;

                return (
                  <div key={rep.name} className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: `${rc.primary}25`, background: `linear-gradient(145deg, ${rc.primary}0e 0%, #0f0f1e 60%)` }}>

                    {/* Card Header */}
                    <div className="p-5 pb-4">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl font-black text-xl text-white flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${rc.primary} 0%, ${rc.primary}99 100%)`, boxShadow: `0 8px 24px ${rc.glow}` }}>
                            {rep.name.charAt(0)}
                          </div>
                          {idx === 0 && reps.length > 1 && (
                            <div className="absolute -top-2 -right-2 text-sm">👑</div>
                          )}
                          {rep.onFire && (
                            <div className="absolute -bottom-1 -right-1 text-sm">🔥</div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-xl">{rep.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold border"
                              style={{ color: lvl.color, borderColor: `${lvl.color}40`, background: `${lvl.color}15` }}>
                              {lvl.emoji} {lvl.label}
                            </span>
                          </div>
                          <div className="text-white/40 text-xs mt-0.5">{rep.total} appointments booked</div>
                          {/* Level progress */}
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-white/30 mb-1">
                              <span style={{ color: rc.primary }} className="font-bold">{rep.points} pts</span>
                              {lvl.next && <span>{lvl.next - rep.points} to {LEVEL_CONFIG.find(l=>l.min===lvl.next)?.label}</span>}
                            </div>
                            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${rc.primary}, ${lvl.color})` }} />
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-3xl font-black" style={{ color: rc.primary }}>{rep.points}</div>
                          <div className="text-xs text-white/30 uppercase tracking-wide">pts</div>
                        </div>
                      </div>
                    </div>

                    {/* Stat Grid */}
                    <div className="grid grid-cols-4 divide-x divide-white/6 border-t border-white/6">
                      {[
                        { label: 'Appts', value: rep.total, sub: 'booked' },
                        { label: 'Showed', value: rep.showed, sub: `${rep.showRate}% rate` },
                        { label: 'Bought', value: rep.purchased, sub: rep.purchased > 0 ? `${rep.closeRate}% close` : '—' },
                        { label: 'Revenue', value: `$${(rep.totalRevenue/1000).toFixed(rep.totalRevenue >= 1000 ? 0 : 1)}${rep.totalRevenue >= 1000 ? 'k' : ''}`, sub: rep.avgDeal > 0 ? `$${rep.avgDeal.toLocaleString()} avg` : '—', raw: true },
                      ].map(stat => (
                        <div key={stat.label} className="p-3 text-center">
                          <div className={`font-black text-xl ${stat.raw ? 'text-emerald-400' : 'text-white'}`}>
                            {stat.value}
                          </div>
                          <div className="text-white/30 text-xs font-semibold uppercase tracking-wide leading-tight">{stat.label}</div>
                          <div className="text-white/20 text-xs mt-0.5">{stat.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Outcome breakdown */}
                    <div className="px-5 py-3 border-t border-white/6">
                      <div className="text-xs text-white/30 uppercase tracking-widest mb-2 font-semibold">Outcome Breakdown</div>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { label: 'Purchased', count: rep.purchased, color: '#10b981' },
                          { label: 'No Purchase', count: rep.noPurchase, color: '#ef4444' },
                          { label: 'No Show', count: rep.noShow, color: '#6b7280' },
                          { label: 'Canceled', count: rep.canceled, color: '#374151' },
                          { label: 'Pending', count: rep.pending, color: '#f59e0b' },
                        ].filter(o => o.count > 0).map(o => (
                          <div key={o.label} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
                            <span className="text-white/50">{o.label}</span>
                            <span className="font-bold" style={{ color: o.color }}>{o.count}</span>
                          </div>
                        ))}
                      </div>

                      {/* Visual bar */}
                      <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
                        {rep.total > 0 && [
                          { count: rep.purchased,  color: '#10b981' },
                          { count: rep.noPurchase, color: '#ef4444' },
                          { count: rep.noShow,     color: '#6b7280' },
                          { count: rep.canceled,   color: '#374151' },
                          { count: rep.pending,    color: '#f59e0b' },
                        ].filter(o => o.count > 0).map((o, i) => (
                          <div key={i} className="h-full rounded-sm" style={{
                            width: `${(o.count / rep.total) * 100}%`,
                            backgroundColor: o.color,
                          }} />
                        ))}
                      </div>
                    </div>

                    {/* Points breakdown */}
                    <div className="px-5 py-3 border-t border-white/6 bg-white/2">
                      <div className="text-xs text-white/20">
                        <span className="text-white/40 font-semibold">Points: </span>
                        {rep.total * 10} scheduled
                        {rep.showed > 0 && ` + ${rep.showed * 20} showed`}
                        {rep.purchased > 0 && ` + ${rep.purchased * 100}+ purchased`}
                        {rep.totalRevenue > 0 && ` + ${Math.floor(rep.totalRevenue/1000)} revenue bonus`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Head-to-head comparison */}
            {leader && challenger && (
              <div className="bg-white/3 border border-white/8 rounded-2xl p-5 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs uppercase tracking-widest text-white/30 font-semibold">Head to Head</span>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span style={{ color: repColor(leader.name).primary }}>● {leader.name}</span>
                    <span style={{ color: repColor(challenger.name).primary }}>● {challenger.name}</span>
                  </div>
                </div>
                <StatRow label="Appointments Booked" a={leader.total} b={challenger.total} />
                <StatRow label="Customers Showed" a={leader.showed} b={challenger.showed} />
                <StatRow label="Vehicles Purchased" a={leader.purchased} b={challenger.purchased} />
                <StatRow label="Show Rate" a={leader.showRate} b={challenger.showRate} format={n => `${n}%`} />
                <StatRow label="Close Rate" a={leader.closeRate} b={challenger.closeRate} format={n => `${n}%`} />
                <StatRow label="Revenue Generated" a={leader.totalRevenue} b={challenger.totalRevenue} format={n => `$${n.toLocaleString()}`} />
                <StatRow label="Points" a={leader.points} b={challenger.points} />
              </div>
            )}

            {/* Recent Activity Preview */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-widest text-white/30 font-semibold">Recent Results</span>
                <button onClick={() => setActiveTab('activity')} className="text-xs text-white/30 hover:text-white/60 transition-colors">View all →</button>
              </div>
              <div className="space-y-2">
                {allRecent.slice(0, 6).map(appt => {
                  const rc = repColor(appt.vas_rep);
                  return (
                    <div key={appt.id} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rc.primary }} />
                      <div className="text-xs text-white/50 w-14 flex-shrink-0" style={{ color: rc.primary }}>{appt.vas_rep}</div>
                      <div className="flex-1 text-xs text-white/70 truncate">
                        {appt.customer ? `${appt.customer.first_name} ${appt.customer.last_name}` : '—'}
                        {appt.vehicle && <span className="text-white/30 ml-1">· {appt.vehicle.year} {appt.vehicle.make}</span>}
                      </div>
                      <OutcomePill outcome={appt.outcome} status={appt.status} />
                      {appt.purchase_amount ? <span className="text-xs font-bold text-emerald-400">${appt.purchase_amount.toLocaleString()}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
