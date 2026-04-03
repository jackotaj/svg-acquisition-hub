'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Clock, Car, Navigation, Coffee } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { BASE_LOCATION } from '@/lib/types';
import type { Appointment, Agent } from '@/lib/types';

interface Stop {
  appt: Appointment;
  driveFromPrev: number | null; // minutes
  arrivalTime: string; // HH:MM
  departTime: string;  // HH:MM from prev stop
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function minutesBetween(t1: string, t2: string): number {
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

async function getDriveTime(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<number> {
  try {
    const res = await fetch(
      `/api/travel-time?origin=${originLat},${originLng}&dest=${destLat},${destLng}`
    );
    const data = await res.json();
    return data.minutes || 25;
  } catch {
    return 25;
  }
}

export default function DayPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentObj, setAgentObj] = useState<Agent | null>(null);

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0].id);
      });
  }, []);

  const buildItinerary = useCallback(async () => {
    if (!selectedAgent || !selectedDate) return;
    setLoading(true);
    setStops([]);

    const agent = agents.find(a => a.id === selectedAgent) || null;
    setAgentObj(agent);

    // Fetch appointments for this agent on this date
    const res = await fetch(`/api/appointments?date=${selectedDate}`);
    const all: Appointment[] = await res.json();
    const appts = all
      .filter(a => a.agent_id === selectedAgent && a.status !== 'cancelled')
      .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

    if (appts.length === 0) {
      setStops([]);
      setLoading(false);
      return;
    }

    // Calculate drive times leg by leg
    const result: Stop[] = [];
    let prevLat = BASE_LOCATION.lat;
    let prevLng = BASE_LOCATION.lng;
    let prevDoneTime: string | null = null; // when previous stop finishes

    for (const appt of appts) {
      const apptLat = appt.lat ?? null;
      const apptLng = appt.lng ?? null;

      let driveMin: number | null = null;
      if (apptLat !== null && apptLng !== null) {
        driveMin = await getDriveTime(prevLat, prevLng, apptLat, apptLng);
      }

      // Depart time = when prev stop finished (or base departure)
      // Arrival = scheduled_time (we show drive before it)
      const scheduledTime = appt.scheduled_time.slice(0, 5); // HH:MM
      const departTime = driveMin !== null
        ? addMinutes(scheduledTime, -driveMin)
        : scheduledTime;

      result.push({
        appt,
        driveFromPrev: driveMin,
        arrivalTime: scheduledTime,
        departTime,
      });

      // Next leg starts from this stop; assume ~45 min appraisal duration
      const apptDuration = appt.duration_mins || 45;
      prevDoneTime = addMinutes(scheduledTime, apptDuration);
      prevLat = apptLat ?? prevLat;
      prevLng = apptLng ?? prevLng;
    }

    setStops(result);
    setLoading(false);
  }, [selectedAgent, selectedDate, agents]);

  useEffect(() => {
    if (selectedAgent) buildItinerary();
  }, [buildItinerary, selectedAgent, selectedDate]);

  const totalAppts = stops.length;
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const dayStart = firstStop ? addMinutes(firstStop.arrivalTime, -(firstStop.driveFromPrev || 0)) : null;
  const dayEnd = lastStop ? addMinutes(lastStop.arrivalTime, lastStop.appt.duration_mins || 45) : null;
  const totalMins = dayStart && dayEnd ? minutesBetween(dayStart, dayEnd) : 0;
  const totalDriveMin = stops.reduce((sum, s) => sum + (s.driveFromPrev || 0), 0);

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-navy dark:text-white">Driver&apos;s Day View</h1>
      </div>

      {/* Controls */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Agent</label>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="w-full border border-card-border rounded-lg bg-card text-foreground px-3 py-2 text-sm"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full border border-card-border rounded-lg bg-card text-foreground px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-10 text-center text-gray-400">
          Building itinerary…
        </div>
      ) : stops.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-10 text-center text-gray-400">
          No appointments for {agentObj?.name || 'this agent'} on {dateLabel}.
          <div className="mt-3">
            <Link href="/appointments/new" className="text-orange text-sm underline">Schedule one</Link>
          </div>
        </div>
      ) : (
        <>
          {/* Day summary bar */}
          <div className="bg-navy text-white rounded-xl px-5 py-4 mb-5 flex flex-wrap gap-4 items-center justify-between" id="day-summary">
            <div>
              <div className="text-xs text-blue-200 font-medium uppercase tracking-wide">{agentObj?.name}</div>
              <div className="font-semibold text-lg">{dateLabel}</div>
            </div>
            <div className="flex gap-5 text-center">
              <div>
                <div className="text-2xl font-bold">{totalAppts}</div>
                <div className="text-xs text-blue-200">Stop{totalAppts !== 1 ? 's' : ''}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalDriveMin}</div>
                <div className="text-xs text-blue-200">Drive min</div>
              </div>
              <div>
                <div className="text-lg font-bold">{dayStart ? formatTime(dayStart) : '—'}</div>
                <div className="text-xs text-blue-200">Depart base</div>
              </div>
              <div>
                <div className="text-lg font-bold">{dayEnd ? formatTime(dayEnd) : '—'}</div>
                <div className="text-xs text-blue-200">Est. done</div>
              </div>
            </div>
          </div>

          {/* Add appointment button */}
          <div className="flex justify-end mb-4">
            <Link
              href={`/appointments/new?agent=${selectedAgent}&date=${selectedDate}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#f97316] text-white text-sm font-semibold shadow hover:bg-orange-600 transition-colors"
            >
              + Add Appointment
            </Link>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Base start */}
            <div className="flex gap-4 mb-2">
              <div className="flex flex-col items-center w-10 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-orange text-white flex items-center justify-center">
                  <Navigation size={14} />
                </div>
                <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
              </div>
              <div className="pb-4 pt-1">
                <div className="font-semibold text-sm text-navy dark:text-white">Base — 3415 Seajay Dr, Beavercreek</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Depart {dayStart ? formatTime(dayStart) : '—'}
                </div>
              </div>
            </div>

            {stops.map((stop, idx) => {
              const appt = stop.appt;
              const isLast = idx === stops.length - 1;
              const doneTime = addMinutes(stop.arrivalTime, appt.duration_mins || 45);

              return (
                <div key={appt.id}>
                  {/* Drive leg */}
                  {stop.driveFromPrev !== null && (
                    <div className="flex gap-4 mb-1">
                      <div className="flex flex-col items-center w-10 flex-shrink-0">
                        <div className="w-0.5 bg-gray-200 flex-1" />
                      </div>
                      <div className="flex items-center gap-2 py-1.5 text-xs text-gray-400 italic">
                        <Car size={12} className="text-gray-300" />
                        {stop.driveFromPrev} min drive
                        <span className="text-gray-300">·</span>
                        Depart {formatTime(stop.departTime)}
                      </div>
                    </div>
                  )}

                  {/* Stop card */}
                  <div className="flex gap-4 mb-1">
                    <div className="flex flex-col items-center w-10 flex-shrink-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: agentObj?.color_hex || '#f97316' }}
                      >
                        {idx + 1}
                      </div>
                      {!isLast && <div className="w-0.5 bg-gray-200 flex-1 mt-1" />}
                    </div>

                    <Link
                      href={`/appointments/${appt.id}`}
                      className="flex-1 mb-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-orange/40 hover:shadow-md transition-all"
                    >
                      {/* Time header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-orange" />
                          <span className="font-bold text-navy text-sm">
                            {formatTime(stop.arrivalTime)}
                          </span>
                          <span className="text-xs text-gray-400">
                            → {formatTime(doneTime)}
                          </span>
                        </div>
                        <StatusBadge status={appt.status} />
                      </div>

                      {/* Customer + Vehicle */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Customer</div>
                          <div className="font-semibold text-navy text-sm">
                            {appt.customer
                              ? `${appt.customer.first_name} ${appt.customer.last_name}`
                              : '—'}
                          </div>
                          {appt.customer?.phone && (
                            <div className="text-xs text-gray-500 mt-0.5">{appt.customer.phone}</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-0.5">Vehicle</div>
                          <div className="font-semibold text-navy text-sm">
                            {appt.vehicle
                              ? `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}`
                              : '—'}
                          </div>
                          {appt.vehicle?.mileage && (
                            <div className="text-xs text-gray-500 mt-0.5">{appt.vehicle.mileage.toLocaleString()} mi</div>
                          )}
                        </div>
                      </div>

                      {/* Address */}
                      {appt.address && (
                        <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-gray-50">
                          <MapPin size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <a
                            href={`https://www.google.com/maps/dir/3415+Seajay+Dr,+Beavercreek,+OH+45430/${encodeURIComponent(`${appt.address}, ${appt.city || ''}, ${appt.state || 'OH'} ${appt.zip || ''}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            {appt.address}{appt.city ? `, ${appt.city}` : ''}{appt.state ? `, ${appt.state}` : ''}
                          </a>
                        </div>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* End of day */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center w-10 flex-shrink-0">
                <div className="w-0.5 bg-gray-200 h-4" />
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <Coffee size={14} />
                </div>
              </div>
              <div className="pt-1">
                <div className="font-semibold text-sm text-gray-600">Day Complete</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Est. finish {dayEnd ? formatTime(dayEnd) : '—'} · {Math.floor(totalMins / 60)}h {totalMins % 60}m total
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
