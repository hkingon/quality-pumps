-- Migration: Pump Categories — taxonomy cleanup
-- Date: 2026-06-23
-- Description: Adds the new taxonomy columns for the Pump Categories spec
--              (Power Source, Installation Configuration, Wetted Materials)
--              and a review-queue table for the one-time data migration.
--              The old `type`, `configuration` and numeric `phases` columns are
--              intentionally kept (non-destructive) — they are simply no longer
--              read/written by the UI after migration.

-- ============================================
-- New taxonomy columns on pumps
-- ============================================
alter table pumps add column if not exists power_source text;
alter table pumps add column if not exists installation_configuration text[];
alter table pumps add column if not exists wetted_materials text[];

-- Marker so the migration script is idempotent
alter table pumps add column if not exists categories_migrated_at timestamptz;

-- ============================================
-- Review queue for ambiguous migrations (REVIEW items for the admin)
-- ============================================
create table if not exists pump_category_review (
  id uuid primary key default gen_random_uuid(),
  pump_id uuid references pumps(id) on delete cascade,
  pump_name text,
  reason text not null,
  old_values jsonb,
  suggested jsonb,
  status text not null default 'open', -- 'open' | 'resolved'
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table pump_category_review enable row level security;

-- Admins can read/manage the review queue
drop policy if exists "Admins manage pump category review" on pump_category_review;
create policy "Admins manage pump category review"
  on pump_category_review for all
  to authenticated
  using (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  with check (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');
-- (the migration script writes via the service-role key, which bypasses RLS)
