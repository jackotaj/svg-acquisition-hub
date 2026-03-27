'use client';

import { useEffect, useState } from 'react';
import { Trophy, Flame, TrendingUp, Calendar, Car, Users } from 'lucide-react';

interface RepStats {
  name: string;
  total: number;
  showed: number;
  purchased: number;
  noShow: number;
  showRate: number;
  closeRate: number;
  totalRevenue: number;
  points: number;
  level: { label: string; emoji: string; next: number | null; current: number };
  onFire: boolean;
  recentAppts: RecentAppt[];
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

interface LeaderboardData {
  reps: RepStats[];
  month: string;
  allRecent: RecentAppt[];
}

const LEVEL_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#b9f2ff',
};

const REP_COLORS: Record<string, string> = {
  Bianka: '#f97316',
  David: '#6366f1',
  Other: '#10b981',
};

function outcomeLabel(appt: RecentAppt) {
  if (appt.outcome === 'purchased') return { text: '✅ Purchased', bg: 'bg-green-500/20 text-green-300' };
  if (appt.outcome === 'no_show') return { text: '👻 No Show', bg: 'bg-gray-500/20 text-gray-400' };
  if (appt.outcome === 'no_purchase') return { text: '❌ No Purchase', bg: 'bg-red-500/20 text-red-400' };
  if (appt.outcome === 'pending') return { text: '⏳ Pending', bg: 'bg-yellow-500/20 text-yellow-300' };
  if (appt.status === 'cancelled') return { text: '🚫 Cancelled', bg: 'bg-gray-600/20 text-gray-500' };
  if (appt.status === 'completed') return { text: '✔ Done', bg: 'bg-blue-500/20 text-blue-300' };
  return { text: appt.status, bg: 'bg-gray-500/20 text-gray-400' };
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function StatBar({ label, a, b, repA, repB }: { label: string; a: number; b: number; repA: RepStats; repB: RepStats }) {
  const total = a + b;
  const pctA = total > 0 ? Math.round(a / total * 100) : 50;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-white/50 mb-1">
        <span>{a}</span>
        <span className="text-white/70 font-medium">{label}</span>
        <span>{b}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        <div className="rounded-l-full transition-all" style={{ width: `${pctA}%`, backgroundColor: REP_COLORS[repA.name] || '#f97316' }} />
        <div className="rounded-r-full flex-1 transition-all" style={{ backgroundColor: REP_COLORS[repB.name] || '#6366f1' }} />
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month]);

  const reps = data?.reps || [];
  const allRecent = data?.allRecent || [];

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white -m-4 lg:-m-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Trophy className="text-yellow-400" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">VAS Leaderboard</h1>
            <p className="text-sm text-white/40">Vehicle Acquisition Specialists</p>
          </div>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
        />
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-20 text-lg">Loading leaderboard…</div>
      ) : reps.length === 0 ? (
        <div className="text-center text-white/40 py-20">
          <Trophy size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">No data yet for this month</p>
          <p className="text-sm">Book appointments and assign a VAS rep to see the leaderboard.</p>
        </div>
      ) : (
        <>
          {/* Player Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            {reps.map((rep, idx) => {
              const color = REP_COLORS[rep.name] || '#f97316';
              const levelColor = LEVEL_COLORS[rep.level.label];
              const progressToNext = rep.level.next
                ? ((rep.points - rep.level.current) / (rep.level.next - rep.level.current)) * 100
                : 100;

              return (
                <div key={rep.name}
                  className="relative rounded-2xl border overflow-hidden"
                  style={{ borderColor: `${color}30`, background: `linear-gradient(135deg, ${color}10 0%, #1a1a2e 60%)` }}
                >
                  {/* Rank badge */}
                  <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-sm font-bold">
                    #{idx + 1}
                  </div>

                  <div className="p-6">
                    {/* Rep header */}
                    <div className="flex items-center gap-4 mb-5">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
                          style={{ backgroundColor: color }}>
                          {rep.name.charAt(0)}
                        </div>
                        {rep.onFire && (
                          <div className="absolute -top-1 -right-1 text-lg" title="🔥 Purchase in last 7 days">🔥</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xl font-bold">{rep.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-semibold" style={{ color: levelColor }}>
                            {rep.level.emoji} {rep.level.label}
                          </span>
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-3xl font-black" style={{ color }}>{rep.points.toLocaleString()}</div>
                        <div className="text-xs text-white/40 uppercase tracking-wider">points</div>
                      </div>
                    </div>

                    {/* Points progress bar */}
                    {rep.level.next && (
                      <div className="mb-5">
                        <div className="flex justify-between text-xs text-white/40 mb-1.5">
                          <span>{rep.points} pts</span>
                          <span>Next: {rep.level.next} pts ({rep.level.next - rep.points} to go)</span>
                        </div>
                        <ProgressBar value={progressToNext} max={100} color={levelColor} />
                      </div>
                    )}

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs text-white/40 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Calendar size={10} /> Appointments
                        </div>
                        <div className="text-2xl font-bold">{rep.total}</div>
                        <div className="text-xs text-white/30 mt-0.5">{rep.showed} showed</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs text-white/40 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Car size={10} /> Purchased
                        </div>
                        <div className="text-2xl font-bold text-green-400">{rep.purchased}</div>
                        <div className="text-xs text-white/30 mt-0.5">${rep.totalRevenue.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs text-white/40 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Users size={10} /> Show Rate
                        </div>
                        <div className="text-2xl font-bold">{rep.showRate}%</div>
                        <div className="text-xs text-white/30 mt-0.5">{rep.noShow} no-shows</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs text-white/40 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <TrendingUp size={10} /> Close Rate
                        </div>
                        <div className="text-2xl font-bold">{rep.closeRate}%</div>
                        <div className="text-xs text-white/30 mt-0.5">of all appts</div>
                      </div>
                    </div>

                    {/* Points breakdown */}
                    <div className="bg-white/5 rounded-xl p-3 text-xs text-white/40">
                      <span className="font-medium text-white/60 mr-2">Points breakdown:</span>
                      {rep.total * 10} scheduled
                      {rep.showed > 0 && ` + ${rep.showed * 20} shows`}
                      {rep.purchased > 0 && ` + ${rep.purchased * 100}+ purchased`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Head-to-head (only if 2+ reps) */}
          {reps.length >= 2 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Head to Head</h2>
              <div className="flex justify-between text-xs text-white/50 mb-3">
                <span className="font-semibold" style={{ color: REP_COLORS[reps[0].name] }}>{reps[0].name}</span>
                <span className="font-semibold" style={{ color: REP_COLORS[reps[1].name] }}>{reps[1].name}</span>
              </div>
              <StatBar label="Appointments" a={reps[0].total} b={reps[1].total} repA={reps[0]} repB={reps[1]} />
              <StatBar label="Showed" a={reps[0].showed} b={reps[1].showed} repA={reps[0]} repB={reps[1]} />
              <StatBar label="Purchased" a={reps[0].purchased} b={reps[1].purchased} repA={reps[0]} repB={reps[1]} />
              <StatBar label="$ Revenue" a={reps[0].totalRevenue} b={reps[1].totalRevenue} repA={reps[0]} repB={reps[1]} />
              <StatBar label="Points" a={reps[0].points} b={reps[1].points} repA={reps[0]} repB={reps[1]} />
            </div>
          )}

          {/* Recent Activity */}
          {allRecent.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Flame size={16} className="text-orange-400" />
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Recent Activity</h2>
              </div>
              <div className="space-y-2">
                {allRecent.map(appt => {
                  const badge = outcomeLabel(appt);
                  const repColor = REP_COLORS[appt.vas_rep] || '#f97316';
                  return (
                    <div key={appt.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: repColor }}>
                        {appt.vas_rep?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {appt.customer ? `${appt.customer.first_name} ${appt.customer.last_name}` : 'Unknown'}
                        </div>
                        <div className="text-xs text-white/30">
                          {appt.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : '—'}
                          {appt.lead_source && ` · ${appt.lead_source}`}
                        </div>
                      </div>
                      <div className="text-xs text-white/30 flex-shrink-0">{appt.scheduled_date}</div>
                      <div className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badge.bg}`}>{badge.text}</div>
                      {appt.purchase_amount && (
                        <div className="text-xs text-green-400 font-semibold flex-shrink-0">
                          ${appt.purchase_amount.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
