'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, MapPin, Plus, Users,
  Menu, X, Trophy, BarChart3, Truck, Route,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/',            label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/dispatch',    label: 'Dispatch',           icon: Truck },
  { href: '/day',         label: "Driver's Day",       icon: Route },
  { href: '/schedule',    label: 'Schedule',           icon: CalendarDays },
  { href: '/map',         label: 'Map',                icon: MapPin },
  { href: '/leaderboard', label: 'Leaderboard',        icon: Trophy },
  { href: '/analytics',   label: 'Analytics',          icon: BarChart3 },
  { href: '/agents',      label: 'Agents',             icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const NavItems = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 p-3 space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClick}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isActive(href)
              ? 'bg-orange text-white'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Icon size={17} className="flex-shrink-0" />
          {label}
        </Link>
      ))}

      <div className="pt-3 mt-2 border-t border-gray-100">
        <Link
          href="/acquire/new"
          onClick={onClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-orange border-2 border-orange/20 bg-orange/5 hover:bg-orange/10 transition-colors"
        >
          <Plus size={17} className="flex-shrink-0" />
          Schedule Acquisition
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0">
              SVG
            </div>
            <div className="min-w-0">
              <div className="font-bold text-navy text-sm leading-tight">Acquisition Hub</div>
              <div className="text-xs text-gray-400 leading-tight">SVG Motors</div>
            </div>
          </div>
        </div>

        <NavItems />

        <div className="p-3 border-t border-gray-100">
          <div className="text-xs text-gray-300 text-center">SVG Motors — Beavercreek</div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange rounded-lg flex items-center justify-center text-white font-black text-xs">
            SVG
          </div>
          <span className="font-bold text-navy text-sm">Acquisition Hub</span>
        </div>
        <button
          onClick={() => setOpen(p => !p)}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="lg:hidden fixed top-14 left-0 bottom-0 w-64 z-50 bg-white border-r border-gray-100 overflow-y-auto">
            <NavItems onClick={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
