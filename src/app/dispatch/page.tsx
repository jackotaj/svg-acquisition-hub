'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Car, CheckCircle } from 'lucide-react';

interface Stop {
  id: string;
  scheduled_time: string;
  status: string;
  outcome: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  customer: { first_name: string; last_name: string } | null;
  vehicle: { year: string; make: string; model: string } | null;
}

interface TimelineBlock {
  type: 'drive' | 'appraise';
  startMin: number;
  endMin: number;
  label: string;
  appt?: Stop;
  conflict?: boolean;
}

interface AgentTimeline {
  agent: { id: string; name: string; color_hex: string };
  stops: number;
  timeline: TimelineBlock[];
  totalDriveMins: number;
  totalAppraisalMins: number;
  startMin: number;
  finishMin: number;
  finishTime: string;
  conflicts: string[];
}

interface DispatchData {
  date: string;
  agentTimelines: AgentTimeline[];
}

function minToTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`;
}

export default function DispatchPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<DispatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dispatch?date=${date}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [date]);

  // Timeline window: 7am to 8pm (420 to 1200)
  const DAY_START = 420;
  const DAY_END = 1200;
  const DAY_SPAN = DAY_END - DAY_START;

  const totalConflicts = (data?.agentTimelines || []).flatMap(a => a.conflicts).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy">Dispatch Board</h1>
          <p className="text-sm text-gray-400">Driver workload, routes, and schedule conflicts</p>
        </div>
        <div className="flex items-center gap-3">
          {totalConflicts > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg">
              <AlertTriangle size={13} />
              {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''}
            </div>
          )}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange" />
          <Link href="/acquire/new" className="bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
            + Schedule
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24 text-gray-400">Calculating routes…</div>
      ) : !data || data.agentTimelines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-gray-400 font-medium">No scheduled appointments for this day</div>
          <Link href="/acquire/new" className="text-orange text-sm font-semibold mt-3 inline-block hover:underline">
            + Schedule an acquisition →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hour ruler */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 pt-4 pb-2">
            <div className="flex items-center mb-1">
              <div className="w-40 flex-shrink-0" />
              <div className="flex-1 relative h-5">
                {[7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(h => {
                  const pct = ((h * 60 - DAY_START) / DAY_SPAN) * 100;
                  if (pct < 0 || pct > 100) return null;
                  return (
                    <div key={h} className="absolute top-0 flex flex-col items-center" style={{ left: `${pct}%` }}>
                      <div className="w-px h-3 bg-gray-200" />
                      <span className="text-xs text-gray-300 -translate-x-1/2 mt-0.5">
                        {h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Agent timelines */}
          {data.agentTimelines.map(at => (
            <div key={at.agent.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Agent header */}
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl text-white font-black text-base flex items-center justify-center flex-shrink-0"
                  style={{ background: at.agent.color_hex }}>
                  {at.agent.name[0]}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-navy">{at.agent.name}</div>
                  <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1"><Car size={10} /> {at.stops} stops</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {at.totalDriveMins}min driving</span>
                    <span className="flex items-center gap-1"><CheckCircle size={10} /> {at.totalAppraisalMins}min appraising</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Est. finish</div>
                  <div className="font-black text-navy">{at.finishTime}</div>
                </div>
                {at.conflicts.length > 0 && (
                  <div className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-xs font-bold px-2 py-1 rounded-lg">
                    <AlertTriangle size={11} />
                    {at.conflicts.length} conflict{at.conflicts.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Gantt bar */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0">
                    {/* Base label */}
                    <div className="text-xs font-semibold text-gray-400">Base → Field</div>
                  </div>
                  <div className="flex-1 relative h-8 bg-gray-50 rounded-lg overflow-hidden">
                    {at.timeline.map((block, i) => {
                      const left = Math.max(0, ((block.startMin - DAY_START) / DAY_SPAN) * 100);
                      const width = Math.min(100 - left, ((block.endMin - block.startMin) / DAY_SPAN) * 100);
                      if (width <= 0) return null;
                      return (
                        <div key={i}
                          className="absolute top-1 bottom-1 rounded flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                          style={{
                            left: `${left}%`,
                            width: `${Math.max(width, 0.5)}%`,
                            background: block.type === 'drive'
                              ? `${at.agent.color_hex}55`
                              : block.conflict
                              ? '#ef4444'
                              : at.agent.color_hex,
                          }}
                          title={block.label}
                        >
                          {width > 4 && block.type === 'appraise' && !block.conflict && '🔧'}
                          {width > 4 && block.type === 'appraise' && block.conflict && '⚠️'}
                          {width > 4 && block.type === 'drive' && '→'}
                        </div>
                      );
                    })}

                    {/* Current time indicator */}
                    {(() => {
                      const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
                      if (date === new Date().toISOString().split('T')[0] && nowMins >= DAY_START && nowMins <= DAY_END) {
                        const pct = ((nowMins - DAY_START) / DAY_SPAN) * 100;
                        return <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: `${pct}%` }} title="Now" />;
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Stop list */}
                <div className="mt-3 space-y-1.5">
                  {at.timeline.filter(b => b.type === 'appraise' && b.appt).map((block, i) => {
                    const a = block.appt!;
                    return (
                      <div key={a.id} className={`flex items-center gap-3 text-xs p-2 rounded-lg ${block.conflict ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                        <div className="w-7 h-7 rounded-full text-white text-xs font-black flex items-center justify-center flex-shrink-0"
                          style={{ background: block.conflict ? '#ef4444' : at.agent.color_hex }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-700">
                            {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : 'Unknown'}
                          </span>
                          <span className="text-gray-400 ml-2">
                            {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make}` : ''}
                          </span>
                          {a.address && <span className="text-gray-300 ml-2 truncate">· {a.address}</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-400">{a.scheduled_time.slice(0,5)}</span>
                          <span className="text-gray-300">→</span>
                          <span className="font-semibold" style={{ color: at.agent.color_hex }}>{minToTime(block.endMin)}</span>
                          {block.conflict && <span className="text-red-500 font-bold">⚠️ Late</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Conflicts */}
                {at.conflicts.length > 0 && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
                    <div className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1.5">
                      <AlertTriangle size={11} /> Schedule Issues
                    </div>
                    {at.conflicts.map((c, i) => (
                      <div key={i} className="text-xs text-red-500">• {c}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Utilization bar */}
              <div className="px-5 pb-4">
                <div className="flex gap-2 text-xs text-gray-400 mb-1.5">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: at.agent.color_hex }} />Appraising {at.totalAppraisalMins}min</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: `${at.agent.color_hex}55` }} />Driving {at.totalDriveMins}min</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200 inline-block" />Available {Math.max(0, (at.finishMin - at.startMin) - at.totalDriveMins - at.totalAppraisalMins)}min</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                  {(() => {
                    const total = Math.max(at.finishMin - at.startMin, 1);
                    const appraisePct = (at.totalAppraisalMins / total) * 100;
                    const drivePct = (at.totalDriveMins / total) * 100;
                    return <>
                      <div className="h-full rounded-l-full" style={{ width: `${appraisePct}%`, background: at.agent.color_hex }} />
                      <div className="h-full" style={{ width: `${drivePct}%`, background: `${at.agent.color_hex}55` }} />
                    </>;
                  })()}
                </div>
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-5 text-xs text-gray-400 px-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange inline-block" />Appraising</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange/30 inline-block" />Driving</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Conflict</span>
            <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-red-500 inline-block" />Now</span>
          </div>
        </div>
      )}
    </div>
  );
}
