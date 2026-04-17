'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Zap, Shield, BarChart3 } from 'lucide-react';
import Image from 'next/image';

const CURB_URL = 'https://app.curb.direct';
const DISMISS_KEY = 'curb-upgrade-dismissed';
const POPUP_KEY = 'curb-upgrade-popup-seen';

// Fire-and-forget click tracking that survives cross-origin navigation
function trackClick(event: string) {
  try {
    const payload = JSON.stringify({ event });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/log-click', blob);
    } else {
      // Fallback for older browsers
      fetch('/api/log-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never block navigation for tracking failures
  }
}

// ── Persistent top banner ──────────────────────────────────
export function CurbTopBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  if (dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-[#7c3aed] via-[#6d28d9] to-[#5b21b6] text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm shadow-lg z-50">
      <Image src="/curb-logo.png" alt="Curb" width={60} height={24} className="shrink-0 brightness-0 invert" />
      <span className="font-medium">
        Try the all-new <span className="font-black">Curb</span> acquisition platform
      </span>
      <a
        href={CURB_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackClick('banner_cta')}
        className="inline-flex items-center gap-1 bg-white text-[#6d28d9] font-bold text-xs px-3 py-1 rounded-full hover:bg-purple-50 transition-colors shrink-0"
      >
        Try it now <ArrowRight size={12} />
      </a>
      <button
        onClick={() => {
          trackClick('banner_dismiss');
          localStorage.setItem(DISMISS_KEY, 'true');
          setDismissed(true);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-200 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── One-time popup modal ───────────────────────────────────
export function CurbUpgradePopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(POPUP_KEY) === 'true') return;
    // Show after a short delay so the page loads first
    const t = setTimeout(() => {
      setShow(true);
      trackClick('popup_shown');
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    trackClick('popup_dismiss');
    localStorage.setItem(POPUP_KEY, 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in">
        {/* Hero section */}
        <div className="bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#4c1d95] px-6 pt-8 pb-6 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <button
            onClick={dismiss}
            className="absolute top-3 right-3 text-purple-200 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex justify-center mb-4">
            <Image src="/curb-logo.png" alt="Curb" width={140} height={56} className="drop-shadow-lg brightness-0 invert" />
          </div>

          <h2 className="text-2xl font-black text-white leading-tight mb-2">
            Try the All-New Curb
          </h2>
          <p className="text-purple-100 text-sm leading-relaxed">
            Everything you love about Acquisition Hub, rebuilt from the ground up with powerful new tools.
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Zap size={16} className="text-[#7c3aed]" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Faster workflows</div>
              <div className="text-xs text-gray-500">Schedule, dispatch, and close acquisitions in half the time</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <BarChart3 size={16} className="text-[#7c3aed]" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Smarter analytics</div>
              <div className="text-xs text-gray-500">Real-time dashboards, lead scoring, and conversion tracking</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <Shield size={16} className="text-[#7c3aed]" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Built for scale</div>
              <div className="text-xs text-gray-500">Multi-dealer support, team management, and automated pipelines</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-2">
          <a
            href={CURB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('popup_cta')}
            className="block w-full text-center bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white font-bold text-sm py-3 rounded-xl hover:from-[#6d28d9] hover:to-[#5b21b6] transition-all shadow-lg shadow-purple-500/25"
          >
            Try Curb Now <ArrowRight size={14} className="inline ml-1" />
          </a>
          <button
            onClick={dismiss}
            className="block w-full text-center text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-2 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
