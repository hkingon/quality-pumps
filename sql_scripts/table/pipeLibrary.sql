-- Pipe Types Table (for categorizing pipe materials / standards)
create table if not exists pipe_types (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  description text,
  standard text, -- e.g. AS4130-2009
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Pipe Sizes Table (individual bore entries per pipe type)
create table if not exists pipe_sizes (
  id uuid default gen_random_uuid() primary key,
  pipe_type_id uuid not null references pipe_types(id) on delete cascade,
  nominal_size text not null,
  internal_diameter_mm numeric not null,
  hazen_williams_c numeric not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(pipe_type_id, nominal_size)
);

-- RLS Policies: pipe_types
alter table pipe_types enable row level security;

create policy "Anyone can view pipe types"
  on pipe_types for select
  to authenticated, anon
  using (true);

create policy "Admins can manage pipe types"
  on pipe_types for all
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  with check (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies: pipe_sizes
alter table pipe_sizes enable row level security;

create policy "Anyone can view pipe sizes"
  on pipe_sizes for select
  to authenticated, anon
  using (true);

create policy "Admins can manage pipe sizes"
  on pipe_sizes for all
  to authenticated
  using (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  with check (
    exists (
      select 1 from auth.users
      where auth.users.id = auth.uid()
        and auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Indexes
create index idx_pipe_sizes_type on pipe_sizes(pipe_type_id);
create index idx_pipe_types_name on pipe_types(name);

-- Trigger for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_pipe_types_updated_at
  before update on pipe_types
  for each row execute function update_updated_at_column();

create trigger update_pipe_sizes_updated_at
  before update on pipe_sizes
  for each row execute function update_updated_at_column();

-- Seed default pipe types matching existing hardcoded data
insert into pipe_types (name, description, standard)
values
  ('PE_PN12@5', 'Polyethylene (PE) Pipe | PN12.5 Series 1 | Based on AS4130-2009', 'AS4130-2009'),
  ('PVC_PN12', 'PVC Pipe | PN12 Series 1 | Based on AS4130-2009', 'AS4130-2009'),
  ('COPPER_B', 'Copper Tube | Type B | Based on AS1432-2004', 'AS1432-2004'),
  ('PE_PN16', 'Polyethylene (PE) Pipe | PN16 Series 1 | Based on AS4130-2009', 'AS4130-2009')
on conflict (name) do nothing;

-- Seed default pipe sizes for PE_PN12@5
with type_pe as (select id from pipe_types where name = 'PE_PN12@5')
insert into pipe_sizes (pipe_type_id, nominal_size, internal_diameter_mm, hazen_williams_c)
select type_pe.id, d.size, d.id_mm, d.c
from type_pe,
(values
  ('20', 16.65, 144.3),
  ('25', 21.05, 144.6),
  ('32', 26.95, 144.7),
  ('40', 33.8, 145.8),
  ('50', 42.4, 147.1),
  ('63', 53.3, 147.6),
  ('75', 63.7, 147.7),
  ('90', 76.5, 148.0),
  ('110', 93.3, 148.3),
  ('125', 106.1, 148.7),
  ('140', 118.9, 149.3),
  ('160', 135.9, 152)
) as d(size, id_mm, c);

-- Seed default pipe sizes for PVC_PN12
with type_pvc as (select id from pipe_types where name = 'PVC_PN12')
insert into pipe_sizes (pipe_type_id, nominal_size, internal_diameter_mm, hazen_williams_c)
select type_pvc.id, d.size, d.id_mm, d.c
from type_pvc,
(values
  ('20', 23.7, 144.9),
  ('25', 29.8, 144.7),
  ('32', 37.5, 146.8),
  ('40', 42.8, 147.3),
  ('50', 53.7, 147.6),
  ('65', 67.0, 146.4),
  ('80', 79.0, 146.3),
  ('100', 101.7, 147.3),
  ('125', 124.9, 149.7),
  ('150', 142.7, 148.9),
  ('175', 180.6, 148.9),
  ('200', 203.1, 149.4),
  ('225', 225.8, 150.6),
  ('250', 252.9, 150.8),
  ('300', 284.5, 151.4),
  ('350', 320.6, 152.2)
) as d(size, id_mm, c);

-- Seed default pipe sizes for COPPER_B
with type_cu as (select id from pipe_types where name = 'COPPER_B')
insert into pipe_sizes (pipe_type_id, nominal_size, internal_diameter_mm, hazen_williams_c)
select type_cu.id, d.size, d.id_mm, d.c
from type_cu,
(values
  ('6', 4.88, 138.9),
  ('8', 6.47, 138.4),
  ('10', 7.65, 140.3),
  ('15', 10.81, 141.3),
  ('18', 13.8, 142.8),
  ('20', 16.9, 143.7),
  ('25', 22.8, 144.6),
  ('32', 29.1, 144.9),
  ('40', 35.4, 145.9),
  ('50', 48.3, 147.1),
  ('65', 61.0, 146.7),
  ('80', 72.9, 146.5),
  ('90', 85.5, 146.9),
  ('100', 98.2, 147.2),
  ('125', 123.6, 148.8),
  ('150', 148.2, 148.7),
  ('200', 198.9, 149.2)
) as d(size, id_mm, c);

-- Seed default pipe sizes for PE_PN16
with type_pe16 as (select id from pipe_types where name = 'PE_PN16')
insert into pipe_sizes (pipe_type_id, nominal_size, internal_diameter_mm, hazen_williams_c)
select type_pe16.id, d.size, d.id_mm, d.c
from type_pe16,
(values
  ('20', 16.65, 144.3),
  ('25', 21.05, 144.6),
  ('32', 26.95, 144.7),
  ('40', 33.8, 145.8),
  ('50', 42.4, 147.1),
  ('63', 53.3, 147.6),
  ('75', 63.7, 147.7),
  ('90', 76.5, 148.0),
  ('110', 93.3, 148.3),
  ('125', 106.1, 148.7),
  ('140', 118.9, 149.5)
) as d(size, id_mm, c);
