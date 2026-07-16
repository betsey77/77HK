-- ============================================================================
-- Fix W2 case library writes
--
-- 1) CHECK uses private.case_library_tags_valid(jsonb) but W2 revoked EXECUTE
--    from authenticated/service_role → every INSERT failed with:
--      42501 permission denied for function case_library_tags_valid
--
-- 2) Soft-delete (UPDATE deleted_at) failed under authenticated RLS with:
--      new row violates row-level security policy
--    even though WITH CHECK only required owner_id = auth.uid().
--    Provide a SECURITY DEFINER soft-delete that enforces owner_id = auth.uid()
--    and only touches non-deleted rows.
-- ============================================================================

grant usage on schema private to authenticated, service_role;

grant execute on function private.case_library_tags_valid(jsonb)
  to authenticated, service_role;

create or replace function public.soft_delete_case_library_entry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  updated_count integer;
begin
  if p_id is null then
    raise exception 'invalid id' using errcode = '22023';
  end if;

  update public.case_library_entries
  set deleted_at = now()
  where id = p_id
    and owner_id = auth.uid()
    and deleted_at is null;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Case not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.soft_delete_case_library_entry(uuid) from public, anon;
grant execute on function public.soft_delete_case_library_entry(uuid) to authenticated, service_role;
