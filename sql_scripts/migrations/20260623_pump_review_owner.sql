-- Migration: Pump Category Review — owner lookup
-- Date: 2026-06-23
-- Description: Admin RPC that returns open pump_category_review rows joined to the
--              owning user (via pumps -> profiles). SECURITY DEFINER so admins can
--              see owners of other users' (private) pumps, which RLS would otherwise
--              hide. Mirrors the admin guard used by get_admin_users_dashboard.

create or replace function get_pump_category_review()
returns table (
  id uuid,
  pump_id uuid,
  pump_name text,
  reason text,
  old_values jsonb,
  suggested jsonb,
  status text,
  created_at timestamptz,
  owner_user_id uuid,
  owner_email text,
  owner_name text
) as $$
begin
  -- Restrict execution to admins only
  if not exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  ) and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Access denied. Administrator privileges required.';
  end if;

  return query
  select
    pcr.id,
    pcr.pump_id,
    pcr.pump_name,
    pcr.reason,
    pcr.old_values,
    pcr.suggested,
    pcr.status,
    pcr.created_at,
    p.user_id as owner_user_id,
    pr.email::text as owner_email,
    pr.full_name::text as owner_name
  from public.pump_category_review pcr
  left join public.pumps p on p.id = pcr.pump_id
  left join public.profiles pr on pr.id = p.user_id
  where pcr.status = 'open'
  order by pcr.created_at desc;
end;
$$ language plpgsql security definer;
