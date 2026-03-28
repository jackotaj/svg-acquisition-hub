'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  Plus,
  Users,
  Menu,
  X,
  Trophy,
  BarChart3,
  Truck,
} from 'lucide-react';
import { useState } from 'react';

const NAV = [
  { href: '/',           label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/dispatch',   label: 'Dispatch',     icon: Truck },
  { href: '/schedule',   label: 'Schedule',     icon: CalendarDays },
  { href: '/map',        label: 'Map',          icon: MapPin },
  { href: '/leaderboard',label: 'Leaderboard',  icon: Trophy },
  { href: '/analytics',  label: 'Analytics',    icon: BarChart3 },
  { href: '/agents',     label: 'Agents',       icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const NavLinks = () => (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link key={href} href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active
                ? 'bg-orange text-white shadow-sm'
                : 'text-gray-500 hover:text-navy hover:bg-gray-100'
            }`}>
            <Icon size={18} />
            {label}
          </Link>
        );
      })}

      {/* Primary CTA */}
      <div className="pt-3 mt-3 border-t border-gray-100">
        <Link href="/acquire/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-orange border-2 border-orange/20 bg-orange/5 hover:bg-orange/10 transition-all">
          <Plus size={18} />
          Schedule Acquisition
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white border-r border-gray-100 min-h-screen">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange rounded-lg flex items-center justify-center text-white font-black text-sm">SVG</div>
            <div>
              <div className="font-bold text-navy text-sm leading-tight">Acquisition Hub</div>
              <div className="text-xs text-gray-400 leading-tight">SVG Motors</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks />
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="text-xs text-gray-300 text-center">SVG Motors — Beavercreek</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange rounded-lg flex items-center justify-center text-white font-black text-xs">SVG</div>
          <span className="font-bold text-navy text-sm">Acquisition Hub</span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-gray-500">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)}>
          <div className="bg-white w-64 h-full p-4 space-y-1" onClick={e => e.stopPropagation()}>
            <NavLinks />
          </div>
        </div>
      )}
    </>
  );
}
