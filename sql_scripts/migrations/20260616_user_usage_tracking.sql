-- Migration: Add user usage logs and administrative query functions
-- Date: 2026-06-16
-- Description: Creates the user_usage_logs table, enables RLS, and sets up RPCs for frontend heartbeats and admin queries.

-- Create user_usage_logs table
create table if not exists user_usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  duration_seconds integer default 0 not null,
  last_active_at timestamptz default now() not null,
  unique(user_id, week_start_date)
);

-- Enable RLS on user_usage_logs
alter table user_usage_logs enable row level security;

-- Policies for user_usage_logs
drop policy if exists "Admins can view all usage logs" on user_usage_logs;
create policy "Admins can view all usage logs"
  on user_usage_logs for select
  to authenticated
  using (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    or exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'admin'
    )
  );

drop policy if exists "Users can view their own usage logs" on user_usage_logs;
create policy "Users can view their own usage logs"
  on user_usage_logs for select
  to authenticated
  using (user_id = auth.uid());

-- Heartbeat function to increment user usage
create or replace function increment_user_usage(
  p_user_id uuid,
  p_week_start date,
  p_seconds integer
)
returns void as $$
begin
  -- Prevent users from writing logs for other users (except admins)
  if auth.uid() <> p_user_id and not exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin'
  ) then
    raise exception 'Permission denied. Cannot log activity for another user.';
  end if;

  insert into public.user_usage_logs (user_id, week_start_date, duration_seconds, last_active_at)
  values (p_user_id, p_week_start, p_seconds, now())
  on conflict (user_id, week_start_date)
  do update set
    duration_seconds = user_usage_logs.duration_seconds + p_seconds,
    last_active_at = now();
end;
$$ language plpgsql security definer;

-- Admin dashboard overview function with server-side search, filters, and pagination
create or replace function get_admin_users_dashboard(
  p_search text default '',
  p_disclaimer_filter text default 'all',
  p_activity_filter text default 'all',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  disclaimer_agreed_at timestamptz,
  hours_this_week numeric,
  private_pumps_count bigint,
  private_pipe_sizes_count bigint,
  total_count bigint
) as $$
declare
  v_search text := '%' || coalesce(p_search, '') || '%';
begin
  -- Restrict execution to admins only
  if not exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  ) and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Access denied. Administrator privileges required.';
  end if;

  return query
  with filtered_users as (
    select 
      p.id as user_id,
      p.email::text as email,
      p.full_name::text as full_name,
      p.role::text as role,
      p.disclaimer_agreed_at as disclaimer_agreed_at,
      coalesce(
        (
          select round(sum(u.duration_seconds)::numeric / 3600.0, 2)
          from public.user_usage_logs u
          where u.user_id = p.id
            and u.week_start_date = date_trunc('week', now())::date
        ), 
        0.00
      ) as hours_this_week,
      (
        select count(*)
        from public.pumps pu
        where pu.user_id = p.id and pu.is_public = false
      ) as private_pumps_count,
      (
        select count(*)
        from public.pipe_sizes ps
        where ps.created_by = p.id
      ) as private_pipe_sizes_count
    from public.profiles p
    where 
      -- Search filter
      (p.full_name iLike v_search or p.email iLike v_search)
      -- Disclaimer filter
      and (
        p_disclaimer_filter = 'all'
        or (p_disclaimer_filter = 'agreed' and p.disclaimer_agreed_at is not null)
        or (p_disclaimer_filter = 'not_agreed' and p.disclaimer_agreed_at is null)
      )
  ),
  with_activity_filter as (
    select * from filtered_users f
    where 
      -- Activity filter
      p_activity_filter = 'all'
      or (p_activity_filter = 'active' and f.hours_this_week > 0)
      or (p_activity_filter = 'inactive' and f.hours_this_week = 0)
  ),
  count_pct as (
    select count(*) as full_count from with_activity_filter
  )
  select 
    w.user_id,
    w.email,
    w.full_name,
    w.role,
    w.disclaimer_agreed_at,
    w.hours_this_week,
    w.private_pumps_count,
    w.private_pipe_sizes_count,
    c.full_count as total_count
  from with_activity_filter w
  cross join count_pct c
  order by w.full_name asc, w.email asc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

-- Admin detailed user view function
create or replace function get_admin_user_details(p_user_id uuid)
returns json as $$
declare
  v_pumps json;
  v_pipe_sizes json;
  v_usage_logs json;
  v_result json;
begin
  -- Restrict execution to admins only
  if not exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  ) and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Access denied. Administrator privileges required.';
  end if;

  -- Fetch private pumps
  select coalesce(json_agg(t), '[]'::json) into v_pumps
  from (
    select id, brand, model, kw, rpm, hz, created_at
    from public.pumps
    where user_id = p_user_id and is_public = false
    order by created_at desc
  ) t;

  -- Fetch private pipe sizes
  select coalesce(json_agg(t), '[]'::json) into v_pipe_sizes
  from (
    select ps.id, pt.name as pipe_type_name, pt.standard, ps.nominal_size, ps.internal_diameter_mm, ps.hazen_williams_c, ps.created_at
    from public.pipe_sizes ps
    join public.pipe_types pt on ps.pipe_type_id = pt.id
    where ps.created_by = p_user_id
    order by pt.name asc, ps.nominal_size asc
  ) t;

  -- Fetch weekly usage logs
  select coalesce(json_agg(t), '[]'::json) into v_usage_logs
  from (
    select week_start_date::text as week_start_date, round(duration_seconds::numeric / 3600.0, 2) as hours
    from public.user_usage_logs
    where user_id = p_user_id
    order by week_start_date desc
  ) t;

  v_result := json_build_object(
    'pumps', v_pumps,
    'pipe_sizes', v_pipe_sizes,
    'usage_logs', v_usage_logs
  );

  return v_result;
end;
$$ language plpgsql security definer;

-- Admin dashboard overall metrics function
create or replace function get_admin_dashboard_aggregates()
returns json as $$
declare
  v_total_users bigint;
  v_active_this_week bigint;
  v_private_pumps bigint;
  v_private_pipe_sizes bigint;
  v_result json;
begin
  -- Restrict execution to admins only
  if not exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  ) and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Access denied. Administrator privileges required.';
  end if;

  select count(*) into v_total_users from public.profiles;

  select count(distinct user_id) into v_active_this_week
  from public.user_usage_logs
  where week_start_date = date_trunc('week', now())::date
    and duration_seconds > 0;

  select count(*) into v_private_pumps
  from public.pumps
  where is_public = false;

  select count(*) into v_private_pipe_sizes
  from public.pipe_sizes
  where created_by is not null;

  v_result := json_build_object(
    'total_users', v_total_users,
    'active_this_week', v_active_this_week,
    'private_pumps', v_private_pumps,
    'private_pipe_sizes', v_private_pipe_sizes
  );

  return v_result;
end;
$$ language plpgsql security definer;


