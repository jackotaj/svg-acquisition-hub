'use client';

import { useEffect, useState } from 'react';
import { Activity, Globe, MapPin, Eye, Users, Filter } from 'lucide-react';

interface ActivityData {
  total: number;
  uniqueVisitors: number;
  byRegion: [string, number][];
  byCity: [string, number][];
  byPath: [string, number][];
  recent: Array<{
    id: number;
    path: string;
    city: string | null;
    region: string | null;
    country: string | null;
    ip: string | null;
    user_agent: string | null;
    referrer: string | null;
    created_at: string;
  }>;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function deviceFromUA(ua: string | null) {
  if (!ua) return '—';
  if (/iPhone|Android.*Mobile/i.test(ua)) return '📱 Mobile';
  if (/iPad|Android(?!.*Mobile)/i.test(ua)) return '📱 Tablet';
  if (/bot|crawler|spider|googlebot/i.test(ua)) return '🤖 Bot';
  return '💻 Desktop';
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(21);
  const [excludeVA, setExcludeVA] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (excludeVA) params.set('exclude_region', 'VA');
    fetch(`/api/activity?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days, excludeVA]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Activity size={24} /> Activity Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">Who&apos;s been visiting acquire.svgstrategies.com</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExcludeVA(!excludeVA)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              excludeVA
                ? 'bg-orange text-white border-orange'
                : 'bg-card text-gray-500 border-card-border hover:border-gray-300'
            }`}
          >
            <Filter size={13} />
            {excludeVA ? 'VA Hidden' : 'Hide VA'}
          </button>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-card border border-card-border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={21}>Last 21 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading activity data...</div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-20">
          <Activity size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">No activity yet</h2>
          <p className="text-sm text-gray-500">
            Tracking is now live. Page views will appear here as people visit the site.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
              <div className="text-2xl font-black text-orange">{data.total}</div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-0.5 flex items-center gap-1">
                <Eye size={12} /> Page Views
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
              <div className="text-2xl font-black text-blue-500">{data.uniqueVisitors}</div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-0.5 flex items-center gap-1">
                <Users size={12} /> Unique IPs
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
              <div className="text-2xl font-black text-emerald-500">{data.byCity.length}</div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-0.5 flex items-center gap-1">
                <MapPin size={12} /> Cities
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
              <div className="text-2xl font-black text-purple-500">{data.byRegion.length}</div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-0.5 flex items-center gap-1">
                <Globe size={12} /> Regions
              </div>
            </div>
          </div>

          {/* Location Breakdown + Top Pages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <MapPin size={14} /> Visitors by City
              </h3>
              <div className="space-y-2">
                {data.byCity.slice(0, 10).map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{city}</span>
                    <span className="text-sm font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl shadow-sm p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Eye size={14} /> Top Pages
              </h3>
              <div className="space-y-2">
                {data.byPath.slice(0, 10).map(([path, count]) => (
                  <div key={path} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{path}</span>
                    <span className="text-sm font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-card-border">
              <h3 className="text-sm font-bold text-foreground">Recent Visits</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 border-b border-card-border">
                    <th className="text-left px-4 py-2 font-bold">When</th>
                    <th className="text-left px-4 py-2 font-bold">Page</th>
                    <th className="text-left px-4 py-2 font-bold">Location</th>
                    <th className="text-left px-4 py-2 font-bold">Device</th>
                    <th className="text-left px-4 py-2 font-bold">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map(row => (
                    <tr key={row.id} className="border-b border-card-border/50 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{timeAgo(row.created_at)}</td>
                      <td className="px-4 py-2 font-mono text-foreground">{row.path}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {[row.city, row.region, row.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{deviceFromUA(row.user_agent)}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs">{row.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
