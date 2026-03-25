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

  useEffect(() => {
    fetchData(currentDate);
  }, [currentDate, fetchData]);

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
      </div>

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
    </div>
  );
}
