-- Keep the owner-scoped soft-delete RPC callable by authenticated users while
-- removing mutable schemas from the SECURITY DEFINER function search path.
create or replace function public.soft_delete_case_library_entry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if p_id is null then
    raise exception 'invalid id' using errcode = '22023';
  end if;

  update public.case_library_entries
  set deleted_at = pg_catalog.now()
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
grant execute on function public.soft_delete_case_library_entry(uuid)
  to authenticated, service_role;
