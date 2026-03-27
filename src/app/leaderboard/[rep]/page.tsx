'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, MapPin, Car } from 'lucide-react';

interface Appt {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string | null;
  lead_source: string | null;
  status: string;
  outcome: string | null;
  purchase_amount: number | null;
  notes: string | null;
  customer: { first_name: string; last_name: string; phone: string | null } | null;
  vehicle: { year: string; make: string; model: string } | null;
}

const REP_COLORS: Record<string, string> = { Bianka: '#f97316', David: '#6366f1' };

function OutcomeBadge({ outcome, status }: { outcome: string | null; status: string }) {
  if (outcome === 'purchased')    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">✅ Purchased</span>;
  if (outcome === 'no_purchase')  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">❌ No Purchase</span>;
  if (outcome === 'no_show')      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500">👻 No Show</span>;
  if (outcome === 'pending')      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">⏳ Pending</span>;
  if (status === 'cancelled')     return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-400">🚫 Canceled</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-600">Scheduled</span>;
}

export default function RepPage({ params }: { params: Promise<{ rep: string }> }) {
  const { rep } = use(params);
  const repName = decodeURIComponent(rep);
  const color = REP_COLORS[repName] || '#f97316';

  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leaderboard/rep?name=${encodeURIComponent(repName)}`)
      .then(r => r.json())
      .then(d => { setAppts(Array.isArray(d) ? d : []); setLoading(false); });
  }, [repName]);

  // Compute stats
  const total = appts.length;
  const purchased = appts.filter(a => a.outcome === 'purchased');
  const noPurchase = appts.filter(a => a.outcome === 'no_purchase').length;
  const noShow = appts.filter(a => a.outcome === 'no_show').length;
  const canceled = appts.filter(a => a.status === 'cancelled').length;
  const pending = appts.filter(a => a.outcome === 'pending').length;
  const showed = appts.filter(a => ['completed','arrived','appraising'].includes(a.status) && a.outcome !== 'no_show').length;

  // Lead sources
  const sources: Record<string, number> = {};
  appts.forEach(a => { const s = a.lead_source || 'Unknown'; sources[s] = (sources[s] || 0) + 1; });
  const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/leaderboard" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: color }}>
            {repName.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">{repName}</h1>
            <p className="text-sm text-gray-400">Vehicle Acquisition Specialist</p>
          </div>
        </div>
        <Link href="/vas/new" className="ml-auto bg-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          + Log Appointment
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Appts', value: total, color: 'text-navy' },
          { label: 'Showed', value: showed, color: 'text-blue-600', sub: total > 0 ? `${Math.round(showed/total*100)}%` : '—' },
          { label: 'Acquired', value: purchased.length, color: 'text-green-600', sub: showed > 0 ? `${Math.round(purchased.length/showed*100)}% close` : '—' },
          { label: 'Canceled', value: canceled + noShow, color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</div>
            {s.sub && <div className="text-xs text-gray-300 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Lead source + outcome breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Lead Sources</div>
          {Object.entries(sources).sort((a,b) => b[1]-a[1]).map(([src, cnt]) => (
            <div key={src} className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 font-medium">{src}</span>
                  <span className="font-bold text-navy">{cnt}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(cnt/total)*100}%`, backgroundColor: color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Outcomes</div>
          {[
            { label: 'Acquired',    count: purchased.length, color: '#10b981' },
            { label: 'No Purchase', count: noPurchase,        color: '#ef4444' },
            { label: 'No Show',     count: noShow,             color: '#9ca3af' },
            { label: 'Canceled',    count: canceled,           color: '#d1d5db' },
            { label: 'Pending',     count: pending,            color: '#f59e0b' },
          ].filter(o => o.count > 0).map(o => (
            <div key={o.label} className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
              <span className="text-sm text-gray-600 flex-1">{o.label}</span>
              <span className="font-bold text-navy">{o.count}</span>
              <span className="text-xs text-gray-300">{total > 0 ? `${Math.round(o.count/total*100)}%` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Appointment list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-navy">All Appointments</h2>
          <span className="text-xs text-gray-400">{total} total</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : appts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No appointments yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {[...appts].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)).map(appt => (
              <div key={appt.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="text-center flex-shrink-0 w-12">
                    <div className="text-xs text-gray-400">{new Date(appt.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}</div>
                    <div className="text-lg font-black text-navy">{new Date(appt.scheduled_date + 'T12:00:00').getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-navy">
                        {appt.customer ? `${appt.customer.first_name} ${appt.customer.last_name}` : '—'}
                      </span>
                      <OutcomeBadge outcome={appt.outcome} status={appt.status} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      {appt.vehicle && (
                        <span className="flex items-center gap-1">
                          <Car size={11} />
                          {appt.vehicle.year} {appt.vehicle.make} {appt.vehicle.model}
                        </span>
                      )}
                      {appt.customer?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} />
                          {appt.customer.phone}
                        </span>
                      )}
                      {appt.address && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} />
                          {appt.address}
                        </span>
                      )}
                      {appt.lead_source && (
                        <span className="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">
                          {appt.lead_source}
                        </span>
                      )}
                    </div>
                    {appt.notes && (
                      <div className="text-xs text-gray-400 italic mt-1">"{appt.notes}"</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">{appt.scheduled_time?.slice(0,5)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
