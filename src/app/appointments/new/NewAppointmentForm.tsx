'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, User, Car, Calendar, ClipboardList } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  color_hex: string;
  is_active?: boolean;
  appt_count?: number;
}

const STEPS = [
  { label: 'Customer', icon: User },
  { label: 'Vehicle', icon: Car },
  { label: 'Schedule', icon: Calendar },
  { label: 'Review', icon: ClipboardList },
];

const MAKES = ['Toyota','Honda','Ford','Chevrolet','GMC','Dodge','Jeep','Ram','Chrysler','Buick',
  'Cadillac','Nissan','Hyundai','Kia','Subaru','Mazda','Volkswagen','BMW','Mercedes-Benz','Audi',
  'Lexus','Acura','Infiniti','Volvo','Lincoln','Tesla','Rivian','Other'];

const COLORS_LIST = ['White','Black','Silver','Gray','Red','Blue','Green','Brown','Beige','Orange','Yellow','Gold'];

const TIMES: string[] = [];
for (let h = 8; h <= 19; h++) {
  TIMES.push(`${h.toString().padStart(2,'0')}:00`);
  if (h < 19) TIMES.push(`${h.toString().padStart(2,'0')}:30`);
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2,'0')} ${ampm}`;
}

export default function NewAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [travelTime, setTravelTime] = useState<{ minutes: number; estimated: boolean } | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);

  const [customer, setCustomer] = useState({
    first_name: '', last_name: '', phone: '', email: '', notes: '',
  });
  const [vehicle, setVehicle] = useState({
    year: new Date().getFullYear().toString(),
    make: '', model: '', trim: '', mileage: '', vin: '', color: '', condition_notes: '',
  });
  const [appt, setAppt] = useState({
    address: '', city: '', state: 'OH', zip: '',
    date: new Date().toISOString().split('T')[0],
    agent_id: searchParams.get('agent') || '',
    time: searchParams.get('time') || '09:00',
    notes: '',
    vas_rep: '',
    lead_source: '',
  });

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => setAgents(Array.isArray(data) ? data : []));
  }, []);

  // Fetch real travel time when on schedule step with an address
  useEffect(() => {
    if (step !== 2 || !appt.address || !appt.city) return;
    const destAddr = encodeURIComponent(`${appt.address}, ${appt.city}, ${appt.state} ${appt.zip}`);
    const originAddr = encodeURIComponent('3415 Seajay Dr, Beavercreek, OH 45430'); // acquisition base
    setTravelLoading(true);
    setTravelTime(null);
    fetch(`/api/travel-time?origin=${originAddr}&dest=${destAddr}`)
      .then(r => r.json())
      .then(data => setTravelTime(data))
      .catch(() => setTravelTime({ minutes: 25, estimated: true }))
      .finally(() => setTravelLoading(false));
  }, [step, appt.address, appt.city, appt.state, appt.zip]);

  const selectedAgent = agents.find(a => a.id === appt.agent_id);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, vehicle, appointment: appt }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/appointments/${data.id}`);
      } else {
        alert(`Error: ${data.error || 'Unknown error — please try again.'}`);
        setSubmitting(false);
      }
    } catch (e) {
      alert(`Network error: ${e instanceof Error ? e.message : 'Please try again.'}`);
      setSubmitting(false);
    }
  };

  const canNext = () => {
    if (step === 0) return customer.first_name && customer.last_name;
    if (step === 1) return vehicle.year && vehicle.make && vehicle.model;
    if (step === 2) return appt.address && appt.city && appt.date && appt.agent_id && appt.time;
    return true;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a1a2e]">New Appointment</h1>
        <p className="text-slate-500 mt-1">Schedule an at-home appraisal</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${active ? 'text-[#f97316]' : done ? 'text-[#1a1a2e]' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2
                  ${active ? 'border-[#f97316] bg-[#f97316] text-white' :
                    done ? 'border-[#1a1a2e] bg-[#1a1a2e] text-white' :
                    'border-slate-300 text-slate-400'}`}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="hidden sm:block text-sm font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-[#1a1a2e]' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">

        {/* Step 0: Customer */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">Customer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={customer.first_name}
                  onChange={e => setCustomer(p => ({...p, first_name: e.target.value}))} placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={customer.last_name}
                  onChange={e => setCustomer(p => ({...p, last_name: e.target.value}))} placeholder="Smith" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={customer.phone} type="tel"
                  onChange={e => setCustomer(p => ({...p, phone: e.target.value}))} placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={customer.email} type="email"
                  onChange={e => setCustomer(p => ({...p, email: e.target.value}))} placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" rows={3} value={customer.notes}
                onChange={e => setCustomer(p => ({...p, notes: e.target.value}))}
                placeholder="Any notes about the customer..." />
            </div>
          </div>
        )}

        {/* Step 1: Vehicle */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">Vehicle Information</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Year <span className="text-red-500">*</span></label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={vehicle.year}
                  onChange={e => setVehicle(p => ({...p, year: e.target.value}))}>
                  {Array.from({length: 26}, (_, i) => new Date().getFullYear() + 1 - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Make <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" list="makes-list" value={vehicle.make}
                  onChange={e => setVehicle(p => ({...p, make: e.target.value}))} placeholder="Toyota" />
                <datalist id="makes-list">{MAKES.map(m => <option key={m} value={m} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={vehicle.model}
                  onChange={e => setVehicle(p => ({...p, model: e.target.value}))} placeholder="Camry" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trim</label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={vehicle.trim}
                  onChange={e => setVehicle(p => ({...p, trim: e.target.value}))} placeholder="XLE" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" list="colors-list" value={vehicle.color}
                  onChange={e => setVehicle(p => ({...p, color: e.target.value}))} placeholder="Silver" />
                <datalist id="colors-list">{COLORS_LIST.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mileage</label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" type="number" value={vehicle.mileage}
                  onChange={e => setVehicle(p => ({...p, mileage: e.target.value}))} placeholder="45000" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                VIN <span className="text-slate-400 font-normal">(optional — helps with valuation)</span>
              </label>
              <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors font-mono" value={vehicle.vin}
                onChange={e => setVehicle(p => ({...p, vin: e.target.value.toUpperCase()}))}
                placeholder="1HGBH41JXMN109186" maxLength={17} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Condition Notes</label>
              <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" rows={3} value={vehicle.condition_notes}
                onChange={e => setVehicle(p => ({...p, condition_notes: e.target.value}))}
                placeholder="Dents, scratches, accidents, modifications, etc." />
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">Schedule</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Street Address <span className="text-red-500">*</span></label>
              <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={appt.address}
                onChange={e => setAppt(p => ({...p, address: e.target.value}))} placeholder="123 Main Street" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">City <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={appt.city}
                  onChange={e => setAppt(p => ({...p, city: e.target.value}))} placeholder="Dayton" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={appt.state}
                  onChange={e => setAppt(p => ({...p, state: e.target.value}))}>
                  {['OH','IN','KY','IL','MI'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={appt.zip}
                  onChange={e => setAppt(p => ({...p, zip: e.target.value}))} placeholder="45402" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" type="date" value={appt.date}
                  onChange={e => setAppt(p => ({...p, date: e.target.value}))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time <span className="text-red-500">*</span></label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" value={appt.time}
                  onChange={e => setAppt(p => ({...p, time: e.target.value}))}>
                  {TIMES.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Acquisition Agent <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 gap-2">
                {agents.filter(a => a.is_active !== false).map(agent => (
                  <button key={agent.id} type="button"
                    onClick={() => setAppt(p => ({...p, agent_id: agent.id}))}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all
                      ${appt.agent_id === agent.id ? 'border-[#f97316] bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{backgroundColor: agent.color_hex}} />
                    <div className="flex-1">
                      <div className="font-medium text-[#1a1a2e]">{agent.name}</div>
                      {agent.appt_count !== undefined && (
                        <div className="text-xs text-slate-500">{agent.appt_count} appointment{agent.appt_count !== 1 ? 's' : ''} on this date</div>
                      )}
                    </div>
                    {appt.agent_id === agent.id && <Check className="w-4 h-4 text-[#f97316]" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              {travelLoading ? (
                <span>📍 Calculating travel time from Beavercreek base…</span>
              ) : travelTime ? (
                <span>
                  📍 {travelTime.estimated ? 'Estimated' : 'Drive time from Beavercreek base'}:{' '}
                  <strong>~{travelTime.minutes} min</strong>
                  {travelTime.estimated && ' (estimate)'}
                </span>
              ) : (
                <span>📍 Enter the appointment address to see drive time</span>
              )}
            </div>

            {/* VAS Rep + Lead Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled By (VAS)</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] bg-white"
                  value={appt.vas_rep} onChange={e => setAppt(p => ({...p, vas_rep: e.target.value}))}>
                  <option value="">— Select —</option>
                  <option value="Bianka">Bianka</option>
                  <option value="David">David</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] bg-white"
                  value={appt.lead_source} onChange={e => setAppt(p => ({...p, lead_source: e.target.value}))}>
                  <option value="">— Select —</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Craigslist">Craigslist</option>
                  <option value="Instagram">Instagram</option>
                  <option value="CarGurus">CarGurus</option>
                  <option value="Walk-In">Walk-In</option>
                  <option value="Referral">Referral</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 bg-white transition-colors" rows={2} value={appt.notes}
                onChange={e => setAppt(p => ({...p, notes: e.target.value}))}
                placeholder="Gate code, parking instructions, etc." />
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">Review & Confirm</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Customer</div>
                <div className="font-semibold text-[#1a1a2e]">{customer.first_name} {customer.last_name}</div>
                {customer.phone && <div className="text-sm text-slate-600">{customer.phone}</div>}
                {customer.email && <div className="text-sm text-slate-600">{customer.email}</div>}
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vehicle</div>
                <div className="font-semibold text-[#1a1a2e]">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                {vehicle.trim && <div className="text-sm text-slate-600">{vehicle.trim}</div>}
                {vehicle.mileage && <div className="text-sm text-slate-600">{Number(vehicle.mileage).toLocaleString()} miles</div>}
                {vehicle.color && <div className="text-sm text-slate-600">{vehicle.color}</div>}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Appointment</div>
              <div className="font-semibold text-[#1a1a2e]">
                {new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'})} at {formatTime(appt.time)}
              </div>
              <div className="text-sm text-slate-600 mt-1">{appt.address}, {appt.city}, {appt.state} {appt.zip}</div>
              {selectedAgent && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: selectedAgent.color_hex}} />
                  <span className="text-sm text-slate-600">{selectedAgent.name}</span>
                </div>
              )}
              {appt.notes && <div className="text-sm text-slate-500 mt-1 italic">"{appt.notes}"</div>}
            </div>

            {vehicle.condition_notes && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Condition Notes</div>
                <div className="text-sm text-slate-600">{vehicle.condition_notes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < 3 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="flex items-center gap-2 px-6 py-2 bg-[#f97316] text-white rounded-lg font-medium
              hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 px-6 py-2 bg-[#1a1a2e] text-white rounded-lg font-medium
              hover:bg-slate-800 disabled:opacity-60 transition-colors">
            {submitting ? 'Booking...' : 'Book Appointment'} <Check className="w-4 h-4" />
          </button>
        )}
      </div>


    </div>
  );
}
