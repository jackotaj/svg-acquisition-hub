'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Tab = 'funnel' | 'sources' | 'vehicles' | 'timing' | 'lost' | 'offers';

interface AnalyticsData {
  funnel: { total: number; showed: number; offered: number; purchased: number; noShows: number; cancelled: number };
  leadSources: Array<{ source: string; total: number; showed: number; purchased: number; conversionRate: number; closeRate: number; showRate: number; avgDeal: number; revenue: number }>;
  vehicles: { topMakes: Array<{ make: string; count: number; purchased: number; convRate: number }>; conditionMap: Record<string, number>; mileageBuckets: Record<string, number>; avgMileage: number };
  timing: { dayStats: Array<{ day: string; total: number; purchased: number; noShow: number }>; hourStats: Array<{ hour: string; total: number; purchased: number; rate: number }> };
  lostDeals: { total: number; reasons: Array<{ reason: string; count: number; pct: number }> };
  offers: { total: number; accepted: number; rejected: number; acceptanceRate: number; avgOffer: number; avgPurchase: number };
}

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'funnel',   label: 'Funnel',          emoji: '📉' },
  { id: 'sources',  label: 'Lead Sources',    emoji: '🎯' },
  { id: 'vehicles', label: 'Vehicle Intel',   emoji: '🚗' },
  { id: 'timing',   label: 'Timing',          emoji: '⏰' },
  { id: 'lost',     label: 'Lost Deals',      emoji: '❌' },
  { id: 'offers',   label: 'Offer Intel',     emoji: '💰' },
];

const SOURCE_COLORS: Record<string, string> = {
  Facebook: '#1877f2', Craigslist: '#7c3aed', Instagram: '#e1306c',
  CarGurus: '#ff6d00', 'Walk-In': '#10b981', Referral: '#f59e0b', Other: '#6b7280', Unknown: '#374151',
};

function StatCard({ label, value, sub, color = '#f97316' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-300 mt-0.5">{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, count, total, color, pctOfPrev }: { label: string; count: number; total: number; color: string; pctOfPrev?: number }) {
  const w = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <div className="flex items-center gap-3">
          {pctOfPrev !== undefined && (
            <span className="text-xs text-gray-400">{pctOfPrev}% of prev step</span>
          )}
          <span className="font-black text-navy text-lg">{count}</span>
        </div>
      </div>
      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
        <div className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
          style={{ width: `${Math.max(w, 4)}%`, background: color }}>
          {w > 15 && <span className="text-white text-xs font-bold">{Math.round(w)}%</span>}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [tab, setTab] = useState<Tab>('funnel');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTime, setAllTime] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = allTime ? '/api/analytics' : `/api/analytics?month=${month}`;
    fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, [month, allTime]);

  const f = data?.funnel;
  const monthLabel = new Date(month + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy dark:text-white">Acquisition Analytics</h1>
          <p className="text-sm text-gray-400">{allTime ? 'All time' : monthLabel} · Deep dive into what&apos;s working</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setAllTime(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${allTime ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
            {allTime ? '✓ All Time' : 'All Time'}
          </button>
          {!allTime && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-card-border rounded-lg bg-card text-foreground px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-orange" />
          )}
          <Link href="/vas/new" className="bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
            + Log Appointment
          </Link>
        </div>
      </div>

      {/* Top summary cards */}
      {f && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          <StatCard label="Booked" value={f.total} color="#6366f1" />
          <StatCard label="Showed" value={f.showed} sub={f.total > 0 ? `${Math.round(f.showed/f.total*100)}%` : '—'} color="#0891b2" />
          <StatCard label="Offered" value={f.offered} sub={f.showed > 0 ? `${Math.round(f.offered/f.showed*100)}% of showed` : '—'} color="#f97316" />
          <StatCard label="Acquired" value={f.purchased} sub={f.total > 0 ? `${Math.round(f.purchased/f.total*100)}% conv` : '—'} color="#10b981" />
          <StatCard label="No Shows" value={f.noShows} sub={f.total > 0 ? `${Math.round(f.noShows/f.total*100)}%` : '—'} color="#ef4444" />
          <StatCard label="Canceled" value={f.cancelled} color="#9ca3af" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading analytics…</div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400">No data available.</div>
      ) : (
        <div>
          {/* ── FUNNEL ── */}
          {tab === 'funnel' && f && (
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
              <h2 className="font-bold text-navy mb-1">Conversion Funnel</h2>
              <p className="text-xs text-gray-400 mb-6">Where are we losing people?</p>
              <FunnelBar label="Appointments Booked" count={f.total} total={f.total} color="#6366f1" />
              <FunnelBar label="Customers Showed Up" count={f.showed} total={f.total} color="#0891b2"
                pctOfPrev={f.total > 0 ? Math.round(f.showed/f.total*100) : 0} />
              <FunnelBar label="Offer Made" count={f.offered} total={f.total} color="#f97316"
                pctOfPrev={f.showed > 0 ? Math.round(f.offered/f.showed*100) : 0} />
              <FunnelBar label="Vehicle Acquired" count={f.purchased} total={f.total} color="#10b981"
                pctOfPrev={f.offered > 0 ? Math.round(f.purchased/f.offered*100) : 0} />
              <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-50 pt-5">
                <div className="text-center">
                  <div className="text-2xl font-black text-red-400">{f.noShows}</div>
                  <div className="text-xs text-gray-400">No Shows <span className="text-gray-300">({f.total > 0 ? Math.round(f.noShows/f.total*100) : 0}%)</span></div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-gray-300">{f.cancelled}</div>
                  <div className="text-xs text-gray-400">Canceled</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-green-500">
                    {f.total > 0 ? `${Math.round(f.purchased/f.total*100)}%` : '—'}
                  </div>
                  <div className="text-xs text-gray-400">Overall Conv. Rate</div>
                </div>
              </div>
            </div>
          )}

          {/* ── LEAD SOURCES ── */}
          {tab === 'sources' && (
            <div className="space-y-4">
              {data.leadSources.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No lead source data yet.</div>
              ) : data.leadSources.map(src => {
                const color = SOURCE_COLORS[src.source] || '#6b7280';
                return (
                  <div key={src.source} className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <h3 className="font-bold text-navy text-lg">{src.source}</h3>
                      <span className="ml-auto text-xs text-gray-400">{src.total} appointments</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[
                        { label: 'Show Rate',        value: `${src.showRate}%`,    color: '#0891b2' },
                        { label: 'Acquired',         value: src.purchased,          color: '#10b981' },
                        { label: 'Conversion Rate',  value: `${src.conversionRate}%`, color: '#f97316' },
                        { label: 'Close Rate',       value: `${src.closeRate}%`,   color: '#6366f1' },
                      ].map(s => (
                        <div key={s.label} className="text-center p-3 bg-muted-bg rounded-lg">
                          <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-xs text-gray-400 font-medium">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1 flex justify-between">
                          <span>Show rate</span><span className="font-bold text-gray-600">{src.showRate}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${src.showRate}%`, backgroundColor: '#0891b2' }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1 flex justify-between">
                          <span>Conversion</span><span className="font-bold text-gray-600">{src.conversionRate}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${src.conversionRate}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── VEHICLE INTEL ── */}
          {tab === 'vehicles' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-navy mb-1">Top Makes We Acquire</h3>
                <p className="text-xs text-gray-400 mb-4">Conversion rate shows offer-to-buy</p>
                {data.vehicles.topMakes.length === 0 ? (
                  <div className="text-gray-300 text-sm">No vehicle data yet — add mileage/make when logging.</div>
                ) : data.vehicles.topMakes.map((m, i) => (
                  <div key={m.make} className="flex items-center gap-3 mb-3">
                    <div className="w-6 text-xs font-black text-gray-300">#{i+1}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold text-gray-700">{m.make}</span>
                        <span className="text-gray-400">{m.count} appts · <span className="text-green-600 font-bold">{m.purchased} acquired</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange rounded-full" style={{ width: `${(m.count / data.vehicles.topMakes[0].count) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-green-600 w-10 text-right">{m.convRate}%</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                  <h3 className="font-bold text-navy mb-1">Mileage Distribution</h3>
                  {data.vehicles.avgMileage > 0 && (
                    <p className="text-xs text-gray-400 mb-3">Avg mileage: <strong>{data.vehicles.avgMileage.toLocaleString()} mi</strong></p>
                  )}
                  {Object.entries(data.vehicles.mileageBuckets).map(([bucket, count]) => {
                    const max = Math.max(...Object.values(data.vehicles.mileageBuckets));
                    return (
                      <div key={bucket} className="flex items-center gap-3 mb-2">
                        <div className="w-20 text-xs text-gray-500">{bucket}</div>
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                          <div className="h-full bg-blue-400 rounded flex items-center px-2"
                            style={{ width: max > 0 ? `${(count/max)*100}%` : '0%' }}>
                            {(count/max)*100 > 20 && <span className="text-white text-xs font-bold">{count}</span>}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-gray-600 w-6">{count}</div>
                      </div>
                    );
                  })}
                  {data.vehicles.avgMileage === 0 && (
                    <div className="text-gray-300 text-sm">No mileage data yet — add when logging appointments.</div>
                  )}
                </div>

                <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                  <h3 className="font-bold text-navy mb-3">Condition</h3>
                  {Object.keys(data.vehicles.conditionMap).length === 0 ? (
                    <div className="text-gray-300 text-sm">No condition data yet.</div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(data.vehicles.conditionMap).map(([cond, cnt]) => (
                        <div key={cond} className="px-3 py-2 rounded-lg bg-gray-50 text-center">
                          <div className="font-black text-navy text-lg">{cnt}</div>
                          <div className="text-xs text-gray-400 capitalize">{cond}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TIMING ── */}
          {tab === 'timing' && (
            <div className="space-y-5">
              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-navy mb-1">Day of Week Performance</h3>
                <p className="text-xs text-gray-400 mb-5">Which days produce the most appointments and purchases?</p>
                <div className="grid grid-cols-7 gap-2">
                  {data.timing.dayStats.map(d => {
                    const maxTotal = Math.max(...data.timing.dayStats.map(x => x.total), 1);
                    const height = Math.max((d.total / maxTotal) * 100, 4);
                    return (
                      <div key={d.day} className="text-center">
                        <div className="text-xs font-black text-green-600 mb-1">{d.purchased > 0 ? d.purchased : ''}</div>
                        <div className="relative bg-gray-100 rounded-lg overflow-hidden h-24 flex items-end">
                          <div className="w-full rounded-lg transition-all"
                            style={{ height: `${height}%`, background: d.purchased > 0 ? '#10b981' : '#e5e7eb' }} />
                          {d.total > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-gray-600">{d.total}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-gray-500 mt-1">{d.day}</div>
                        {d.noShow > 0 && <div className="text-xs text-red-300">{d.noShow} ns</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-navy mb-1">Best Time Slots</h3>
                <p className="text-xs text-gray-400 mb-4">When do customers actually buy?</p>
                {data.timing.hourStats.length === 0 ? (
                  <div className="text-gray-300 text-sm">Not enough time data yet.</div>
                ) : (
                  <div className="space-y-2">
                    {data.timing.hourStats.map(h => (
                      <div key={h.hour} className="flex items-center gap-3">
                        <div className="w-12 text-xs font-semibold text-gray-500">{h.hour}</div>
                        <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                          <div className="h-full rounded flex items-center px-2 transition-all"
                            style={{ width: `${Math.max((h.total / Math.max(...data.timing.hourStats.map(x => x.total))) * 100, 4)}%`,
                              background: h.purchased > 0 ? '#f97316' : '#e5e7eb' }}>
                            {h.total > 0 && <span className="text-xs font-bold text-white">{h.total}</span>}
                          </div>
                        </div>
                        <div className="text-xs font-black text-green-600 w-16 text-right">
                          {h.purchased > 0 ? `${h.purchased} bought` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LOST DEALS ── */}
          {tab === 'lost' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total No Purchases" value={data.lostDeals.total} color="#ef4444" />
                <StatCard label="With Reason Captured" value={data.lostDeals.reasons.filter(r => r.reason !== 'Unknown').reduce((s, r) => s + r.count, 0)} color="#f97316" sub="Log reasons when closing out" />
                <StatCard label="No Reason Logged" value={data.lostDeals.reasons.find(r => r.reason === 'Unknown')?.count || 0} color="#9ca3af" sub="← Fix this" />
              </div>

              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-navy mb-1">Why We&apos;re Losing Deals</h3>
                <p className="text-xs text-gray-400 mb-5">This is your most valuable data. Log reasons every time.</p>
                {data.lostDeals.reasons.length === 0 || data.lostDeals.total === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">📋</div>
                    <div className="text-gray-400 text-sm">No lost deal data yet.</div>
                    <div className="text-gray-300 text-xs mt-1">When marking &quot;No Purchase&quot;, select a reason. That data will appear here.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.lostDeals.reasons.map((r, i) => (
                      <div key={r.reason}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-semibold text-gray-700">#{i+1} {r.reason}</span>
                          <div className="flex gap-3">
                            <span className="text-gray-400">{r.count}x</span>
                            <span className="font-bold text-red-500">{r.pct}%</span>
                          </div>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${r.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="font-semibold text-amber-800 text-sm mb-1">💡 Lost Deal Reasons to Track</div>
                <div className="text-xs text-amber-700 space-y-0.5">
                  <div>• <strong>Price Too Low</strong> — our offer wasn&apos;t competitive</div>
                  <div>• <strong>Sold to CarMax/Carvana</strong> — lost to instant offer competitor</div>
                  <div>• <strong>Changed Mind</strong> — decided to keep the car</div>
                  <div>• <strong>Vehicle Not Qualifiable</strong> — too much damage, title issue, etc.</div>
                  <div>• <strong>Sold Privately</strong> — went Facebook Marketplace / word of mouth</div>
                  <div>• <strong>Needs More Time</strong> — not ready yet, follow-up needed</div>
                </div>
              </div>
            </div>
          )}

          {/* ── OFFER INTEL ── */}
          {tab === 'offers' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Offers Made" value={data.offers.total} color="#6366f1" />
                <StatCard label="Accepted" value={data.offers.accepted} sub={`${data.offers.acceptanceRate}% rate`} color="#10b981" />
                <StatCard label="Rejected" value={data.offers.rejected} color="#ef4444" />
                <StatCard label="Avg Offer" value={data.offers.avgOffer > 0 ? `$${data.offers.avgOffer.toLocaleString()}` : '—'} color="#f97316" />
              </div>

              <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
                <h3 className="font-bold text-navy mb-1">Offer Acceptance Rate</h3>
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full flex items-center justify-center"
                      style={{ width: `${data.offers.acceptanceRate}%` }}>
                      {data.offers.acceptanceRate > 15 && (
                        <span className="text-white text-xs font-black">{data.offers.acceptanceRate}%</span>
                      )}
                    </div>
                  </div>
                  <div className="text-2xl font-black text-green-600">{data.offers.acceptanceRate}%</div>
                </div>

                {data.offers.avgOffer > 0 && data.offers.avgPurchase > 0 && (
                  <div className="grid grid-cols-2 gap-4 mt-5 border-t border-gray-50 pt-5">
                    <div className="text-center">
                      <div className="text-2xl font-black text-orange">${data.offers.avgOffer.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">Avg Offer Made</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-black text-green-600">${data.offers.avgPurchase.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">Avg Purchase Price</div>
                    </div>
                  </div>
                )}

                {data.offers.total === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">💰</div>
                    <div className="text-gray-400 text-sm">No offer data yet.</div>
                    <div className="text-gray-300 text-xs mt-1">Log offer amounts when appraising vehicles to unlock this view.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
