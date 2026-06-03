-- Migration: Fix admin RLS to prevent seeing other users' custom types
-- Date: 2026-06-03
-- Description: Replaces the broad admin "for all" policies and the old
--              "Anyone can view" policies with restricted visibility so
--              admins only see/edit global types and their own custom types.
--              Other users' private types remain hidden.

-- ============================================
-- pipe_types policies
-- ============================================

-- Drop the old unrestricted "Anyone can view" policy
drop policy if exists "Anyone can view pipe types" on pipe_types;

-- Drop the broad admin "for all" policy (allows seeing ALL types)
drop policy if exists "Admins can manage all pipe types" on pipe_types;

-- Create a restricted admin policy: global types OR their own custom types
create policy "Admins can manage global and their own pipe types"
  on pipe_types for all
  to authenticated
  using (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    and (created_by is null or created_by = auth.uid())
  )
  with check (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    and (created_by is null or created_by = auth.uid())
  );

-- ============================================
-- pipe_sizes policies
-- ============================================

-- Drop the old unrestricted "Anyone can view" policy
drop policy if exists "Anyone can view pipe sizes" on pipe_sizes;

-- Drop the broad admin "for all" policy (allows seeing ALL sizes)
drop policy if exists "Admins can manage all pipe sizes" on pipe_sizes;

-- Create a restricted admin policy: global sizes OR their own custom sizes
create policy "Admins can manage global and their own pipe sizes"
  on pipe_sizes for all
  to authenticated
  using (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    and (created_by is null or created_by = auth.uid())
  )
  with check (
    auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
    and (created_by is null or created_by = auth.uid())
  );
