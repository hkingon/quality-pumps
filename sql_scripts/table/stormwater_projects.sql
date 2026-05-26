-- Stormwater Projects Table
-- Stores saved stormwater calculator projects for users

create table if not exists stormwater_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  catchments jsonb not null default '[]'::jsonb,
  -- Each catchment: { id, area, coefficient, toc, aep }
  flow_rate numeric not null default 0,
  -- pump flow rate in m3/s
  detention_volume numeric not null default 0,
  storm_duration integer not null default 60,
  -- minutes
  max_duration integer not null default 360,
  -- minutes (default 6 hours)
  max_duration_unit text not null default 'hr',
  -- 'min' | 'hr'
  csv_data jsonb,
  -- IFD data
  rainfall_event text,
  -- e.g. "1 in 10 Years (10% AEP)"
  selected_duration integer,
  -- minutes
  run_off_coeff numeric,
  -- global runoff coefficient if needed
  hydrograph_data jsonb,
  -- cached hydrograph points
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS Policies
alter table stormwater_projects enable row level security;

create policy "Users can view their own projects"
  on stormwater_projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on stormwater_projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on stormwater_projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on stormwater_projects for delete
  using (auth.uid() = user_id);

-- Index
CREATE INDEX idx_stormwater_projects_user_id ON stormwater_projects(user_id);

-- Trigger to update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_stormwater_projects_updated_at
  before update on stormwater_projects
  for each row execute function update_updated_at_column();
