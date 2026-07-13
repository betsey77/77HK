-- Move RLS role helpers out of the exposed public API schema.
-- The authenticated role needs schema USAGE + function EXECUTE so Postgres can
-- evaluate policies, but PostgREST does not expose the private schema as RPC.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_any_role(_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = any(_roles)
  );
$$;

revoke all on function private.has_any_role(public.app_role[]) from public, anon, authenticated;
grant execute on function private.has_any_role(public.app_role[]) to authenticated, service_role;

drop policy "roles self read" on public.user_roles;
create policy "roles self read" on public.user_roles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_any_role(array['admin', 'super_admin']::public.app_role[]))
  );

drop policy "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log
  for select to authenticated
  using ((select private.has_any_role(array['admin', 'super_admin']::public.app_role[])));

drop function public.has_role(public.app_role);
drop function public.has_any_role(public.app_role[]);
