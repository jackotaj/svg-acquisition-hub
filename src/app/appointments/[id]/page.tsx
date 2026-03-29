'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, MapPin, Clock, Car, User, CheckCircle } from 'lucide-react';

const BASE_LAT = 39.7174;
const BASE_LNG = -84.0639;

function RouteMapCard({ appt }: {
  appt: { id: string; address: string; city?: string; state?: string; zip?: string; lat?: number | null; lng?: number | null }
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    appt.lat && appt.lng ? { lat: appt.lat, lng: appt.lng } : null
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(appt.lat && appt.lng ? 'ready' : 'loading');

  const fullAddress = [appt.address, appt.city, appt.state, appt.zip].filter(Boolean).join(', ');
  const gmapsUrl = `https://www.google.com/maps/dir/3415+Seajay+Dr,+Beavercreek,+OH+45430/${encodeURIComponent(fullAddress)}`;

  useEffect(() => {
    if (coords) return;
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1&countrycodes=us`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'SVGAcquisitionHub/1.0' } }
    )
      .then(r => r.json())
      .then(data => {
        if (!data[0]) { setStatus('error'); return; }
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setCoords({ lat, lng });
        setStatus('ready');
        // Save coords back to DB so next load is instant
        fetch(`/api/appointments/${appt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        }).catch(() => {});
      })
      .catch(() => setStatus('error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const osmSrc = coords ? (() => {
    const pad = 0.06;
    const minLat = Math.min(BASE_LAT, coords.lat) - pad;
    const maxLat = Math.max(BASE_LAT, coords.lat) + pad;
    const minLng = Math.min(BASE_LNG, coords.lng) - pad;
    const maxLng = Math.max(BASE_LNG, coords.lng) + pad;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${coords.lat},${coords.lng}`;
  })() : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#f97316]" /> Location
        </div>
        <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#f97316] hover:underline">
          Get Directions ↗
        </a>
      </div>
      {status === 'loading' && (
        <div className="h-[220px] flex items-center justify-center text-sm text-slate-400 animate-pulse">
          Locating address…
        </div>
      )}
      {status === 'ready' && osmSrc && (
        <iframe title="Map" src={osmSrc} width="100%" height="220"
          style={{ border: 0, display: 'block' }} loading="lazy" />
      )}
      {status === 'error' && (
        <div className="h-[220px] flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-slate-400">Couldn&apos;t locate address — open in Maps instead</p>
          <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-medium">
            Get Directions in Google Maps ↗
          </a>
        </div>
      )}
    </div>
  );
}

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: string;
  notes: string | null;
  travel_minutes: number | null;
  appraisal_notes: string | null;
  final_offer: number | null;
  outcome: string | null;
  vas_rep: string | null;
  lead_source: string | null;
  purchase_amount: number | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  };
  vehicle: {
    id: string;
    year: string;
    make: string;
    model: string;
    trim: string | null;
    mileage: number | null;
    vin: string | null;
    color: string | null;
    condition_notes: string | null;
  };
  agent: {
    id: string;
    name: string;
    color_hex: string;
    phone: string | null;
  } | null;
}

const STATUS_FLOW = ['scheduled', 'en_route', 'arrived', 'appraising', 'completed', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  en_route: 'En Route',
  arrived: 'Arrived',
  appraising: 'Appraising',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  en_route: 'bg-amber-100 text-amber-700',
  arrived: 'bg-purple-100 text-purple-700',
  appraising: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [offerInput, setOfferInput] = useState('');
  const [appraisalNotes, setAppraisalNotes] = useState('');

  const fetchAppt = () => {
    fetch(`/api/appointments/${id}`)
      .then(r => r.json())
      .then(data => {
        setAppt(data);
        setOfferInput(data.final_offer ? String(data.final_offer) : '');
        setAppraisalNotes(data.appraisal_notes || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAppt(); }, [id]);

  const updateStatus = async (status: string) => {
    if (!appt) return;
    setUpdating(true);
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchAppt();
    setUpdating(false);
  };

  const saveAppraisal = async () => {
    setUpdating(true);
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appraisal_notes: appraisalNotes,
        final_offer: offerInput ? parseInt(offerInput.replace(/\D/g, ''), 10) : null,
        outcome: offerInput ? 'offer_made' : 'no_offer',
      }),
    });
    fetchAppt();
    setUpdating(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400">Loading…</div>
    </div>
  );

  if (!appt) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🔍</div>
        <div className="text-slate-600">Appointment not found</div>
        <Link href="/" className="text-[#f97316] text-sm mt-2 inline-block">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const statusIdx = STATUS_FLOW.indexOf(appt.status);
  const nextStatus = STATUS_FLOW[statusIdx + 1];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#1a1a2e] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[appt.status] || 'bg-slate-100 text-slate-500'}`}>
            {STATUS_LABELS[appt.status] || appt.status}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">

        {/* Customer + Vehicle Summary */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1a1a2e] flex items-center justify-center text-white font-bold flex-shrink-0">
              {appt.customer.first_name.charAt(0)}{appt.customer.last_name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-[#1a1a2e]">
                {appt.customer.first_name} {appt.customer.last_name}
              </h1>
              <div className="flex flex-wrap gap-3 mt-1">
                {appt.customer.phone && (
                  <a href={`tel:${appt.customer.phone}`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#f97316]">
                    <Phone className="w-3.5 h-3.5" />{appt.customer.phone}
                  </a>
                )}
                {appt.customer.email && (
                  <a href={`mailto:${appt.customer.email}`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#f97316]">
                    <Mail className="w-3.5 h-3.5" />{appt.customer.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Car className="w-3 h-3" /> Vehicle</div>
              <div className="font-semibold text-[#1a1a2e]">{appt.vehicle.year} {appt.vehicle.make} {appt.vehicle.model}</div>
              {appt.vehicle.trim && <div className="text-sm text-slate-500">{appt.vehicle.trim}</div>}
              {appt.vehicle.mileage && <div className="text-sm text-slate-500">{appt.vehicle.mileage.toLocaleString()} mi</div>}
              {appt.vehicle.color && <div className="text-sm text-slate-500">{appt.vehicle.color}</div>}
              {appt.vehicle.vin && <div className="text-xs text-slate-400 font-mono mt-1">{appt.vehicle.vin}</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Appointment</div>
              <div className="font-semibold text-[#1a1a2e]">{new Date(appt.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <div className="text-sm text-slate-500">{appt.scheduled_time.slice(0, 5)}</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{appt.address}, {appt.city}
              </div>
              {appt.travel_minutes && <div className="text-xs text-slate-400">~{appt.travel_minutes} min drive</div>}
            </div>
          </div>

          {/* VAS Rep + Lead Source */}
          {(appt.vas_rep || appt.lead_source) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3">
              {appt.vas_rep && (
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">
                  👤 Scheduled by {appt.vas_rep}
                </span>
              )}
              {appt.lead_source && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                  📣 {appt.lead_source}
                </span>
              )}
            </div>
          )}

          {appt.agent && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: appt.agent.color_hex }}>
                {appt.agent.name.charAt(0)}
              </div>
              <div>
                <div className="text-xs text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> Acquisition Agent</div>
                <div className="text-sm font-medium text-[#1a1a2e]">{appt.agent.name}</div>
              </div>
              {appt.agent.phone && (
                <a href={`tel:${appt.agent.phone}`} className="ml-auto text-[#f97316] hover:text-orange-600">
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Route Map */}
        {appt.address && (
          <RouteMapCard appt={appt} />
        )}

        {/* Status Progression */}
        {appt.status !== 'cancelled' && appt.status !== 'completed' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="text-sm font-semibold text-slate-700 mb-3">Update Status</div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_FLOW.filter(s => s !== 'cancelled').map((s, i) => (
                <button key={s}
                  onClick={() => s !== appt.status && updateStatus(s)}
                  disabled={updating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    s === appt.status
                      ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                      : i < statusIdx
                      ? 'bg-slate-50 text-slate-400 border-slate-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#f97316] hover:text-[#f97316] cursor-pointer'
                  }`}>
                  {s === appt.status && <CheckCircle className="w-3 h-3 inline mr-1" />}
                  {STATUS_LABELS[s]}
                </button>
              ))}
              <button onClick={() => updateStatus('cancelled')} disabled={updating}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-400 hover:bg-red-50 transition-colors">
                Cancel
              </button>
            </div>
            {nextStatus && nextStatus !== 'cancelled' && (
              <button onClick={() => updateStatus(nextStatus)} disabled={updating}
                className="mt-3 w-full py-2.5 bg-[#f97316] hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {updating ? 'Updating…' : `Mark as ${STATUS_LABELS[nextStatus]} →`}
              </button>
            )}
          </div>
        )}

        {/* Appraisal Notes + Offer */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="text-sm font-semibold text-slate-700 mb-3">Appraisal Results</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#f97316] resize-none"
                rows={3}
                value={appraisalNotes}
                onChange={e => setAppraisalNotes(e.target.value)}
                placeholder="Condition issues, damage, rust, etc." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Offer Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#f97316]"
                  value={offerInput}
                  onChange={e => setOfferInput(e.target.value)}
                  placeholder="0" />
              </div>
            </div>
            {appt.final_offer && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium">
                ✅ Offer made: ${appt.final_offer.toLocaleString()}
              </div>
            )}
            <button onClick={saveAppraisal} disabled={updating}
              className="w-full py-2.5 bg-[#1a1a2e] hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {updating ? 'Saving…' : 'Save Appraisal'}
            </button>
          </div>
        </div>

        {/* Notes */}
        {appt.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <span className="font-semibold">Notes: </span>{appt.notes}
          </div>
        )}
      </div>
    </div>
  );
}
