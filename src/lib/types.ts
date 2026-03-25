export interface Agent {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  color_hex: string;
  is_active: boolean;
  store: string;
  created_at: string;
  appointment_count?: number;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  customer_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  vin: string | null;
  color: string | null;
  condition_notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  agent_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_mins: number;
  travel_mins_from_prev: number | null;
  status: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  vehicle?: Vehicle;
  agent?: Agent;
}

export interface Appraisal {
  id: string;
  appointment_id: string;
  condition_score: number | null;
  actual_mileage: number | null;
  offer_amount: number | null;
  customer_response: string | null;
  notes: string | null;
  completed_at: string;
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-slate-100', text: 'text-slate-700' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700' },
  en_route: { bg: 'bg-amber-100', text: 'text-amber-700' },
  arrived: { bg: 'bg-orange-100', text: 'text-orange-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700' },
};

export const BASE_LOCATION = {
  lat: 39.7227107,
  lng: -84.0644755,
  label: 'Acquisition Base',
  address: '3415 Seajay Dr, Beavercreek, OH 45430',
};
