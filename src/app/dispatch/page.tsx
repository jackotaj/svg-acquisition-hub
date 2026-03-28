'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Clock, Navigation, Car, AlertTriangle, CheckCircle, Plus, ExternalLink } from 'lucide-react';

interface Stop {
  appt: {
    id: string; scheduled_time: string; status: string; outcome: string | null;
    address: string | null; lat: number | null; lng: number | null;
    customer: { first_name: string; last_name: string; phone: string | null } | null;
    vehicle: { year: string; make: string; model: string } | null;
  };
  driveMinsBefore: number;
  arriveMin: number;
  leaveMin: number;
  conflict: boolean;
  lateBy: number;
}

interface AgentTimeline {
  agent: { id: string; name: string; color_hex: string };
  stops: number;
  totalDriveMins: number;
  totalAppraisalMins: number;
  finishTime: string;
  finishMin: number;
  conflicts: string[];
  timeline: Array<{
    type: 'drive' | 'appraise';
    startMin: number; endMin: number; label: string;
    appt?: Stop['appt'];
    conflict?: boolean;
  }>;
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: 'bg-blue-400',
    completed: 'bg-green-500',
    cancelled: 'bg-red-400',
    arrived: 'bg-yellow-400',
    appraising: 'bg-yellow-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-gray-400'}`} />;
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return null;
  const map: Record<string, { label: string; cls: string }> = {
    purchased:   { label: '✅ Purchased',   cls: 'bg-green-100 text-green-700' },
    no_purchase: { label: '❌ No Purchase', cls: 'bg-red-100 text-red-600' },
    no_show:     { label: '👻 No Show',     cls: 'bg-gray-100 text-gray-500' },
  };
  const m = map[outcome];
  if (!m) return null;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

export default function DispatchPage() {
  const [data, setData] = useState<{ date: string; agentTimelines: AgentTimeline[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dispatch?date=${date}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  const timelines = data?.agentTimelines || [];
  const hasConflicts = timelines.some(t => t.conflicts.length > 0);

  // Build stop list per agent from timeline
  function getStops(at: AgentTimeline) {
    const stops: Array<{ appt: AgentTimeline['timeline'][0]['appt']; driveMin: number; startMin: number; endMin: number; conflict: boolean }> = [];
    let pendingDrive = 0;
    for (const block of at.timeline) {
      if (block.type === 'drive') { pendingDrive = block.endMin - block.startMin; }
      if (block.type === 'appraise' && block.appt) {
        stops.push({ appt: block.appt, driveMin: pendingDrive, startMin: block.startMin, endMin: block.endMin, conflict: !!block.conflict });
        pendingDrive = 0;
      }
    }
    return stops;
  }

  // Return drive from last stop
  function getReturnDrive(at: AgentTimeline) {
    const driveLast = [...at.timeline].reverse().find(b => b.type === 'drive');
    return driveLast ? driveLast.endMin - driveLast.startMin : 0;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy dark:text-white">Dispatch Board</h1>
          <p className="text-muted text-sm mt-0.5">Daily driver itineraries & route planning</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-card-border rounded-lg px-3 py-2 text-sm bg-card text-foreground" />
          <Link href="/acquire/new" className="flex items-center gap-1.5 bg-orange text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange/90 transition-colors">
            <Plus size={15} />+ Schedule
          </Link>
        </div>
      </div>

      {/* Conflict banner */}
      {hasConflicts && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-700 dark:text-red-400 text-sm mb-1">Schedule Conflicts</div>
            {timelines.flatMap(t => t.conflicts).map((c, i) => (
              <div key={i} className="text-red-600 dark:text-red-400 text-xs">• {c}</div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-muted">Loading…</div>
      )}

      {!loading && timelines.length === 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
          <Car size={40} className="mx-auto text-muted opacity-30 mb-4" />
          <div className="font-semibold text-foreground mb-1">No appointments scheduled</div>
          <div className="text-muted text-sm mb-4">Nothing dispatched for {new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <Link href="/acquire/new" className="inline-flex items-center gap-1.5 bg-orange text-white px-4 py-2 rounded-lg text-sm font-semibold">
            <Plus size={14} />Schedule Acquisition
          </Link>
        </div>
      )}

      {/* Agent route cards */}
      {timelines.map(at => {
        const stops = getStops(at);
        const returnDrive = getReturnDrive(at);
        const departMin = stops.length > 0 ? stops[0].startMin - stops[0].driveMin : 480;

        return (
          <div key={at.agent.id} className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">

            {/* Card header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl text-white font-black text-base flex items-center justify-center"
                  style={{ backgroundColor: at.agent.color_hex }}>
                  {at.agent.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-foreground">{at.agent.name}</div>
                  <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                    <span>{at.stops} stop{at.stops !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{at.totalDriveMins}min driving</span>
                    <span>·</span>
                    <span>{at.totalAppraisalMins}min appraising</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Est. done</div>
                <div className="text-lg font-black" style={{ color: at.agent.color_hex }}>{at.finishTime}</div>
              </div>
            </div>

            {/* Itinerary */}
            <div className="px-5 py-4 space-y-0">

              {/* Depart base */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-orange/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={14} className="text-orange" />
                  </div>
                  <div className="w-0.5 bg-card-border flex-1 my-1" style={{ minHeight: 24 }} />
                </div>
                <div className="pb-4 pt-1">
                  <div className="text-xs font-bold text-muted uppercase tracking-wide">{minToTime(departMin)}</div>
                  <div className="font-semibold text-foreground text-sm mt-0.5">Depart Base</div>
                  <div className="text-xs text-muted">SVG Beavercreek — 3415 Seajay Dr</div>
                </div>
              </div>

              {/* Each stop */}
              {stops.map((stop, idx) => {
                const appt = stop.appt;
                const navUrl = appt?.address
                  ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appt.address)}&travelmode=driving`
                  : null;
                const isLast = idx === stops.length - 1;

                return (
                  <div key={appt?.id || idx}>
                    {/* Drive leg */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-0.5 bg-card-border flex-1" style={{ minHeight: 8 }} />
                        <div className="w-6 h-6 rounded-full bg-muted-bg flex items-center justify-center flex-shrink-0 my-1">
                          <Car size={11} className="text-muted" />
                        </div>
                        <div className="w-0.5 bg-card-border flex-1" style={{ minHeight: 8 }} />
                      </div>
                      <div className="py-2">
                        <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${stop.conflict ? 'bg-red-100 text-red-600' : 'bg-muted-bg text-muted'}`}>
                          {stop.conflict ? `⚠ ${stop.driveMin}min drive — running late` : `${stop.driveMin}min drive`}
                        </div>
                      </div>
                    </div>

                    {/* Stop card */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: at.agent.color_hex }}>
                          {idx + 1}
                        </div>
                        {!isLast && <div className="w-0.5 bg-card-border flex-1 my-1" style={{ minHeight: 24 }} />}
                        {isLast && returnDrive > 0 && <div className="w-0.5 bg-card-border flex-1 my-1" style={{ minHeight: 24 }} />}
                      </div>
                      <div className={`pb-4 pt-1 flex-1 p-3 rounded-xl mb-2 border ${stop.conflict ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/10' : 'border-card-border bg-muted-bg'}`}
                        style={{ marginLeft: 0 }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-muted">{minToTime(stop.startMin)}</span>
                              <StatusDot status={appt?.status || 'scheduled'} />
                              <span className="text-xs text-muted capitalize">{appt?.status}</span>
                              {appt?.outcome && <OutcomeBadge outcome={appt.outcome} />}
                            </div>
                            <div className="font-bold text-foreground mt-1">
                              {appt?.customer ? `${appt.customer.first_name} ${appt.customer.last_name}` : 'Unknown Customer'}
                            </div>
                            <div className="text-sm text-muted">
                              {appt?.vehicle ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}` : ''}
                            </div>
                            {appt?.address && (
                              <div className="flex items-center gap-1 mt-1.5 text-xs text-muted">
                                <MapPin size={11} className="flex-shrink-0" />
                                <span className="truncate">{appt.address}</span>
                              </div>
                            )}
                            {appt?.customer?.phone && (
                              <a href={`tel:${appt.customer.phone}`} className="flex items-center gap-1 mt-1 text-xs text-orange hover:underline">
                                📞 {appt.customer.phone}
                              </a>
                            )}
                            {!appt?.address && (
                              <div className="text-xs text-orange mt-1">⚠ No address — not on map route</div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0">
                            {appt?.id && (
                              <Link href={`/appointments/${appt.id}`}
                                className="flex items-center gap-1 text-xs text-orange font-semibold hover:underline">
                                <ExternalLink size={11} />Details
                              </Link>
                            )}
                            {navUrl && (
                              <a href={navUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                                <Navigation size={11} />Navigate
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-card-border text-xs text-muted">
                          <span>⏱ 45min appraisal</span>
                          <span>·</span>
                          <span>Done by {minToTime(stop.endMin)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Return to base */}
              {returnDrive > 0 && (
                <>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 bg-card-border" style={{ minHeight: 8 }} />
                      <div className="w-6 h-6 rounded-full bg-muted-bg flex items-center justify-center flex-shrink-0 my-1">
                        <Car size={11} className="text-muted" />
                      </div>
                      <div className="w-0.5 bg-card-border" style={{ minHeight: 8 }} />
                    </div>
                    <div className="py-2">
                      <div className="text-xs font-medium px-2 py-0.5 rounded-full inline-block bg-muted-bg text-muted">
                        {returnDrive}min return drive
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={14} className="text-green-600" />
                      </div>
                    </div>
                    <div className="pt-1">
                      <div className="text-xs font-bold text-muted uppercase tracking-wide">{at.finishTime}</div>
                      <div className="font-semibold text-foreground text-sm mt-0.5">Return to Base</div>
                      <div className="text-xs text-muted">Day complete</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer stats */}
            <div className="px-5 py-3 flex gap-6 text-xs" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
              <div><span className="text-muted">Start</span> <span className="font-bold text-foreground">{minToTime(departMin)}</span></div>
              <div><span className="text-muted">Driving</span> <span className="font-bold text-foreground">{at.totalDriveMins}min</span></div>
              <div><span className="text-muted">Appraising</span> <span className="font-bold text-foreground">{at.totalAppraisalMins}min</span></div>
              <div><span className="text-muted">Done</span> <span className="font-bold" style={{ color: at.agent.color_hex }}>{at.finishTime}</span></div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      {timelines.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted pb-4">
          <span className="flex items-center gap-1.5"><Car size={11} /> Drive segment</span>
          <span className="flex items-center gap-1.5"><MapPin size={11} className="text-orange" /> Appraisal stop</span>
          <span className="flex items-center gap-1.5"><CheckCircle size={11} className="text-green-500" /> Return to base</span>
          <span className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-red-500" /> Conflict</span>
        </div>
      )}
    </div>
  );
}
