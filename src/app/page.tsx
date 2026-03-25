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

export default function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/appointments?date=today')
      .then((r) => r.json())
      .then((data) => {
        setAppointments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const completed = appointments.filter((a) => a.status === 'completed').length;
  const agents = new Set(appointments.map((a) => a.agent_id).filter(Boolean));
  const conversionRate =
    completed > 0
      ? Math.round((completed / appointments.length) * 100)
      : 0;

  const stats = [
    {
      label: "Today's Appointments",
      value: appointments.length,
      icon: CalendarDays,
      color: 'text-orange',
    },
    {
      label: 'Completed',
      value: completed,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
    {
      label: 'Active Agents',
      value: agents.size,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">
                {s.label}
              </span>
              <s.icon size={16} className={s.color} />
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link
          href="/appointments/new"
          className="flex items-center gap-2 bg-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus size={16} /> New Appointment
        </Link>
        <Link
          href="/schedule"
          className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
        >
          <CalendarDays size={16} /> View Calendar
        </Link>
        <Link
          href="/map"
          className="flex items-center gap-2 bg-white text-navy border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <MapPin size={16} /> View Map
        </Link>
      </div>

      {/* Today's Appointments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-navy">Today&apos;s Appointments</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No appointments today.{' '}
            <Link href="/appointments/new" className="text-orange underline">
              Schedule one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="px-5 py-3 text-left font-medium">Time</th>
                  <th className="px-5 py-3 text-left font-medium">Agent</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium">Vehicle</th>
                  <th className="px-5 py-3 text-left font-medium">Address</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/appointments/${a.id}`)
                    }
                  >
                    <td className="px-5 py-3 font-medium whitespace-nowrap">
                      {a.scheduled_time?.slice(0, 5)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{
                            backgroundColor: a.agent?.color_hex || '#999',
                          }}
                        />
                        {a.agent?.name || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {a.customer
                        ? `${a.customer.first_name} ${a.customer.last_name}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-600">
                      {a.vehicle
                        ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">
                      {a.address || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
