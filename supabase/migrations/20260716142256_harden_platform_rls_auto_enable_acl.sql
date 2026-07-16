-- Supabase creates this event-trigger helper outside the repository migrations.
-- It does not need direct RPC execution privileges to keep enabling RLS on new
-- public tables, so remove the grants flagged by Security Advisor when present.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end;
$$;

notify pgrst, 'reload schema';
