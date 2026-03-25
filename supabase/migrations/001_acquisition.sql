create table if not exists acq_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  color_hex text default '#f97316',
  is_active boolean default true,
  store text default 'BCK',
  created_at timestamptz default now()
);

create table if not exists acq_customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  lat float8,
  lng float8,
  notes text,
  created_at timestamptz default now()
);

create table if not exists acq_vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references acq_customers(id) on delete cascade,
  year int,
  make text,
  model text,
  trim text,
  mileage int,
  vin text,
  color text,
  condition_notes text,
  created_at timestamptz default now()
);

create table if not exists acq_appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references acq_customers(id) on delete set null,
  vehicle_id uuid references acq_vehicles(id) on delete set null,
  agent_id uuid references acq_agents(id) on delete set null,
  scheduled_date date not null,
  scheduled_time time not null,
  duration_mins int default 30,
  travel_mins_from_prev int,
  status text default 'scheduled',
  address text,
  lat float8,
  lng float8,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists acq_appraisals (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references acq_appointments(id) on delete cascade,
  condition_score int check (condition_score between 1 and 10),
  actual_mileage int,
  offer_amount numeric(10,2),
  customer_response text,
  notes text,
  completed_at timestamptz default now()
);

-- Seed agents
insert into acq_agents (name, phone, color_hex) values
  ('Marcus Webb', '937-555-0101', '#7C3AED'),
  ('Jordan Carter', '937-555-0102', '#059669'),
  ('Alexis Monroe', '937-555-0103', '#0891B2')
on conflict do nothing;
