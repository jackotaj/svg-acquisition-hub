'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const VAS_REPS = ['Bianka', 'David', 'Other'];
const LEAD_SOURCES = ['Facebook', 'Craigslist', 'Instagram', 'CarGurus', 'Walk-In', 'Referral', 'Other'];
const OUTCOMES = [
  { value: '',            label: '— Not yet —' },
  { value: 'purchased',  label: '✅ Purchased' },
  { value: 'no_purchase',label: '❌ No Purchase' },
  { value: 'no_show',    label: '👻 No Show' },
  { value: 'pending',    label: '⏳ Pending' },
  { value: 'offered',    label: '💬 Offered — Waiting' },
];

const CONDITIONS = ['Clean', 'Good', 'Fair', 'Poor', 'Unknown'];

const LOST_REASONS = [
  'Price Too Low',
  'Sold to CarMax/Carvana',
  'Sold Privately',
  'Changed Mind / Keeping Car',
  'Vehicle Not Qualifiable',
  'Needs More Time',
  'Other',
];

interface FormData {
  vas_rep: string;
  lead_source: string;
  first_name: string;
  last_name: string;
  phone: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  outcome: string;
  purchase_amount: string;
  notes: string;
  mileage: string;
  condition: string;
  offer_amount: string;
  lost_reason: string;
}

const EMPTY: FormData = {
  vas_rep: '', lead_source: '', first_name: '', last_name: '', phone: '',
  vehicle_year: '', vehicle_make: '', vehicle_model: '',
  scheduled_date: new Date().toISOString().split('T')[0],
  scheduled_time: '10:00',
  address: '', outcome: '', purchase_amount: '', notes: '',
  mileage: '', condition: '', offer_amount: '', lost_reason: '',
};

export default function VasNewPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormData, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vas_rep || !form.first_name || !form.vehicle_make || !form.scheduled_date) {
      setError('VAS rep, customer name, vehicle make, and date are required.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      // Create customer
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: form.first_name, last_name: form.last_name, phone: form.phone || null }),
      });
      const cust = await custRes.json();
      if (!custRes.ok) throw new Error(cust.error || 'Failed to create customer');

      // Create vehicle
      const vehRes = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: cust.id,
          year: form.vehicle_year ? parseInt(form.vehicle_year) : null,
          make: form.vehicle_make,
          model: form.vehicle_model || null,
          mileage: form.mileage ? parseInt(form.mileage.replace(/[^0-9]/g, '')) : null,
          condition: form.condition || null,
        }),
      });
      const veh = await vehRes.json();
      if (!vehRes.ok) throw new Error(veh.error || 'Failed to create vehicle');

      // Determine status from outcome
      let status = 'scheduled';
      if (form.outcome === 'purchased' || form.outcome === 'no_purchase' || form.outcome === 'no_show') status = 'completed';
      if (form.outcome === '') status = 'scheduled';

      // Create appointment
      const apptRes = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: cust.id,
          vehicle_id: veh.id,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time + ':00',
          address: form.address || null,
          vas_rep: form.vas_rep,
          lead_source: form.lead_source || null,
          outcome: form.outcome || null,
          purchase_amount: form.purchase_amount ? parseFloat(form.purchase_amount.replace(/[^0-9.]/g, '')) : null,
          offer_amount: form.offer_amount ? parseFloat(form.offer_amount.replace(/[^0-9.]/g, '')) : null,
          lost_reason: form.lost_reason || null,
          notes: form.notes || null,
          status,
        }),
      });
      const appt = await apptRes.json();
      if (!apptRes.ok) throw new Error(appt.error || 'Failed to create appointment');

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-green-600" size={32} />
        </div>
        <h2 className="text-xl font-bold text-navy mb-2">Added Successfully</h2>
        <p className="text-gray-500 text-sm mb-6">The acquisition record has been logged.</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => { setForm(EMPTY); setSuccess(false); }}
            className="px-4 py-2 bg-orange text-white rounded-lg text-sm font-medium">
            Add Another
          </button>
          <Link href="/leaderboard" className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium">
            View Leaderboard
          </Link>
          <Link href="/vas" className="px-4 py-2 bg-white border border-gray-200 text-navy rounded-lg text-sm font-medium">
            All Records
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/leaderboard" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-bold text-navy">Log Acquisition Appointment</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Who + Source */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">VAS Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">VAS Rep <span className="text-red-500">*</span></label>
              <select value={form.vas_rep} onChange={e => set('vas_rep', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange">
                <option value="">Select rep</option>
                {VAS_REPS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Lead Source</label>
              <select value={form.lead_source} onChange={e => set('lead_source', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange">
                <option value="">Select source</option>
                {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">Customer</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">First Name <span className="text-red-500">*</span></label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="First" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Last Name</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="Last" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="(937) 555-0000" />
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">Vehicle</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Year</label>
              <input value={form.vehicle_year} onChange={e => set('vehicle_year', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="2019" maxLength={4} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Make <span className="text-red-500">*</span></label>
              <input value={form.vehicle_make} onChange={e => set('vehicle_make', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="Toyota" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Model</label>
              <input value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="Highlander" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Mileage</label>
              <input value={form.mileage} onChange={e => set('mileage', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="87,500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Condition</label>
              <select value={form.condition} onChange={e => set('condition', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange">
                <option value="">Select condition</option>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Appointment */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">Appointment</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Date <span className="text-red-500">*</span></label>
              <input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Time</label>
              <input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Location / Address</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
              placeholder="SVG Beavercreek or 123 Main St, Dayton OH" />
          </div>
        </div>

        {/* Outcome */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">Outcome</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Result</label>
              <select value={form.outcome} onChange={e => set('outcome', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange">
                {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Offer Amount Made</label>
              <input value={form.offer_amount} onChange={e => set('offer_amount', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="$0 — what we offered" />
            </div>
          </div>
          {form.outcome === 'purchased' && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Purchase Price (Final)</label>
              <input value={form.purchase_amount} onChange={e => set('purchase_amount', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange"
                placeholder="$0" />
            </div>
          )}
          {form.outcome === 'no_purchase' && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Why Did They Say No? <span className="text-orange">*</span></label>
              <select value={form.lost_reason} onChange={e => set('lost_reason', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange">
                <option value="">Select reason (important!)</option>
                {LOST_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">This data drives your analytics. Log it every time.</p>
            </div>
          )}
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange resize-none"
              placeholder="Anything worth noting..." />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div className="flex gap-3 pb-8">
          <button type="submit" disabled={submitting}
            className="flex-1 bg-orange text-white rounded-lg py-3 font-semibold text-sm hover:bg-orange-600 transition-colors disabled:opacity-50">
            {submitting ? 'Saving…' : 'Log Appointment'}
          </button>
          <Link href="/leaderboard" className="px-6 py-3 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
