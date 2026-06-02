-- Migration: Update RLS policies for user-owned pipe types and sizes
-- Date: 2026-06-02
-- Description: Replaces the old admin-only "ALL" policies with granular
--              user-scoped policies so non-admins can create and manage
--              their own private pipe types and sizes.

-- ============================================
-- pipe_types policies
-- ============================================

-- Drop old admin-only "ALL" policy (too broad)
drop policy if exists "Admins can manage pipe types" on pipe_types;

-- Create new granular policies
create policy "Users can view global and their own pipe types"
  on pipe_types for select
  to authenticated
  using (created_by is null or created_by = auth.uid());

create policy "Users can create their own pipe types"
  on pipe_types for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Users can update their own pipe types"
  on pipe_types for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Users can delete their own pipe types"
  on pipe_types for delete
  to authenticated
  using (created_by = auth.uid());

create policy "Admins can manage all pipe types"
  on pipe_types for all
  to authenticated
  using (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  with check (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

-- ============================================
-- pipe_sizes policies
-- ============================================

-- Drop old admin-only "ALL" policy (too broad)
drop policy if exists "Admins can manage pipe sizes" on pipe_sizes;

-- Create new granular policies
create policy "Users can view global and their own pipe sizes"
  on pipe_sizes for select
  to authenticated
  using (created_by is null or created_by = auth.uid());

create policy "Users can create their own pipe sizes"
  on pipe_sizes for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from pipe_types pt
      where pt.id = pipe_type_id and pt.created_by = auth.uid()
    )
  );

create policy "Users can update their own pipe sizes"
  on pipe_sizes for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Users can delete their own pipe sizes"
  on pipe_sizes for delete
  to authenticated
  using (created_by = auth.uid());

create policy "Admins can manage all pipe sizes"
  on pipe_sizes for all
  to authenticated
  using (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  with check (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');
