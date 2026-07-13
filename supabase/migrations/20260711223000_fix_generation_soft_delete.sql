-- ============================================================================
-- Slice C1 patch: Fix soft-delete RLS via SECURITY DEFINER RPC
-- 77港话通社媒文案器
--
-- Why: The UPDATE RLS policy's WITH CHECK on generation_jobs rejects
-- soft-delete operations on remote Supabase (42501: new row violates
-- row-level security policy). This RPC bypasses RLS but enforces
-- ownership + non-deleted checks internally.
--
-- Version: 20260711223000 (after 20260711213000_slice_c1_generation_jobs)
-- ============================================================================

create or replace function public.soft_delete_generation_job(_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Must be authenticated
  if auth.uid() is null then
    return false;
  end if;

  -- Single atomic statement: owner + non-deleted enforced in the UPDATE itself.
  -- No SELECT-then-UPDATE TOCTOU window.
  update public.generation_jobs
  set deleted_at = now(), updated_at = now()
  where id = _job_id
    and owner_id = auth.uid()
    and deleted_at is null;

  return found;
end;
$$;

-- Revoke from public and anon — no unauthenticated access
revoke all on function public.soft_delete_generation_job(uuid) from public, anon;

-- Grant execute to authenticated users (ownership enforced inside the function)
-- and service_role (for admin/trusted operations)
grant execute on function public.soft_delete_generation_job(uuid) to authenticated, service_role;
