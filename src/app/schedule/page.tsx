'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import type { Appointment, Agent } from '@/lib/types';

export default function SchedulePage() {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [view, setView] = useState<'calendar' | 'past'>('calendar');
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);

  const fetchData = useCallback((date: string) => {
    fetch(`/api/appointments?date=${date}`)
      .then((r) => r.json())
      .then((data) => setAppointments(Array.isArray(data) ? data : []));
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAgents(list);
        setVisibleAgents(new Set(list.map((a: Agent) => a.id)));
      });
  }, []);

  const fetchPast = useCallback(() => {
    fetch('/api/appointments?date=past&include_cancelled=true')
      .then((r) => r.json())
      .then((data) => setPastAppointments(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    fetchData(currentDate);
  }, [currentDate, fetchData]);

  useEffect(() => {
    if (view === 'past') fetchPast();
  }, [view, fetchPast]);

  const events: EventInput[] = appointments
    .filter((a) => a.agent_id && visibleAgents.has(a.agent_id))
    .map((a) => {
      const start = `${a.scheduled_date}T${a.scheduled_time}`;
      const endDate = new Date(start);
      endDate.setMinutes(endDate.getMinutes() + (a.duration_mins || 30));
      const customerName = a.customer
        ? `${a.customer.first_name} ${a.customer.last_name}`
        : 'Unknown';
      const vehicleShort = a.vehicle
        ? `${a.vehicle.year} ${a.vehicle.make}`
        : '';
      const travelBadge =
        a.travel_mins_from_prev ? ` 🚗${a.travel_mins_from_prev}m` : '';

      return {
        id: a.id,
        title: `${customerName} - ${vehicleShort}${travelBadge}`,
        start,
        end: endDate.toISOString(),
        backgroundColor: a.agent?.color_hex || '#f97316',
        textColor: '#ffffff',
        extendedProps: { appointmentId: a.id },
      };
    });

  const handleEventClick = (info: EventClickArg) => {
    const id = info.event.extendedProps.appointmentId;
    if (id) router.push(`/appointments/${id}`);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    const time = info.start.toTimeString().slice(0, 5);
    const date = info.start.toISOString().split('T')[0];
    router.push(`/appointments/new?date=${date}&time=${time}`);
  };

  const handleDatesSet = (arg: { start: Date }) => {
    const d = arg.start.toISOString().split('T')[0];
    if (d !== currentDate) setCurrentDate(d);
  };

  const toggleAgent = (id: string) => {
    setVisibleAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-navy">Schedule</h1>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Calendar
          </button>
          <button onClick={() => setView('past')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'past' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Past / Archive
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <>
          {/* Agent filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  visibleAgents.has(agent.id)
                    ? 'border-transparent text-white'
                    : 'border-gray-200 text-gray-400 bg-white'
                }`}
                style={
                  visibleAgents.has(agent.id)
                    ? { backgroundColor: agent.color_hex }
                    : {}
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: agent.color_hex }}
                />
                {agent.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridDay"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridDay,dayGridWeek',
              }}
              slotMinTime="07:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              allDaySlot={false}
              selectable={true}
              selectMirror={true}
              nowIndicator={true}
              events={events}
              eventClick={handleEventClick}
              select={handleDateSelect}
              datesSet={handleDatesSet}
              height="auto"
              expandRows={true}
            />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Vehicle</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Seller</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Agent</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {pastAppointments.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No past appointments found</td></tr>
              )}
              {pastAppointments.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/appointments/${a.id}`)}>
                  <td className="px-4 py-3 text-gray-900">{a.scheduled_date}</td>
                  <td className="px-4 py-3 text-gray-600">{a.scheduled_time?.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-gray-900">{a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.agent?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.status === 'completed' ? 'bg-green-100 text-green-700' :
                      a.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
