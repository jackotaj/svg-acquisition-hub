'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  Users,
  TrendingUp,
  Plus,
  MapPin,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import type { Appointment } from '@/lib/types';

function formatDayHeader(dateStr: string) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch upcoming (today + future, non-cancelled/completed)
    fetch('/api/appointments?date=upcoming')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAppointments(list);
        const today = new Date().toISOString().split('T')[0];
        setTodayAppts(list.filter((a: Appointment) => a.scheduled_date === today));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Group by date
  const grouped: Record<string, Appointment[]> = {};
  appointments.forEach((a) => {
    if (!grouped[a.scheduled_date]) grouped[a.scheduled_date] = [];
    grouped[a.scheduled_date].push(a);
  });
  const sortedDates = Object.keys(grouped).sort();

  const completed = todayAppts.filter((a) => a.status === 'completed').length;
  const agents = new Set(todayAppts.map((a) => a.agent_id).filter(Boolean));
  const conversionRate = todayAppts.length > 0
    ? Math.round((completed / todayAppts.length) * 100)
    : 0;

  const stats = [
    { label: "Today's Appointments", value: todayAppts.length, icon: CalendarDays, color: 'text-orange' },
    { label: 'Completed Today', value: completed, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Active Agents', value: agents.size, icon: Users, color: 'text-blue-600' },
    { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-purple-600' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{s.label}</span>
              <s.icon size={16} className={s.color} />
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/appointments/new" className="flex items-center gap-2 bg-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
          <Plus size={16} /> New Appointment
        </Link>
        <Link href="/schedule" className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
          <CalendarDays size={16} /> View Calendar
        </Link>
        <Link href="/map" className="flex items-center gap-2 bg-white text-navy border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          <MapPin size={16} /> View Map
        </Link>
        <Link href="/day" className="flex items-center gap-2 bg-white text-navy border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          <CalendarDays size={16} /> Driver&apos;s Day
        </Link>
      </div>

      {/* Upcoming Appointments grouped by day */}
      <div className="space-y-6">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">Loading...</div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
            No upcoming appointments.{' '}
            <Link href="/appointments/new" className="text-orange underline">Schedule one</Link>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Day header */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="font-semibold text-navy">
                  {formatDayHeader(date)}
                </h2>
                <span className="text-xs text-gray-400 font-medium">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}{grouped[date].length} appt{grouped[date].length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase">
                      <th className="px-5 py-2 text-left font-medium">Time</th>
                      <th className="px-5 py-2 text-left font-medium">Agent</th>
                      <th className="px-5 py-2 text-left font-medium">Customer</th>
                      <th className="px-5 py-2 text-left font-medium">Vehicle</th>
                      <th className="px-5 py-2 text-left font-medium">Address</th>
                      <th className="px-5 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {grouped[date]
                      .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                      .map((a) => (
                        <tr
                          key={a.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => (window.location.href = `/appointments/${a.id}`)}
                        >
                          <td className="px-5 py-3 font-medium whitespace-nowrap">{a.scheduled_time?.slice(0, 5)}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: a.agent?.color_hex || '#999' }} />
                              {a.agent?.name || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap text-gray-600">
                            {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{a.address || '—'}</td>
                          <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
