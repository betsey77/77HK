-- Dashboard-only lookup for identifying role assignments by email.
-- Keep this view out of the exposed public schema and deny all API roles.

create view private.user_roles_with_email
with (security_invoker = true)
as
select
  ur.id,
  ur.user_id,
  u.email,
  ur.role,
  ur.created_at
from public.user_roles ur
join auth.users u on u.id = ur.user_id;

revoke all on table private.user_roles_with_email
  from public, anon, authenticated, service_role;

comment on view private.user_roles_with_email is
  'Dashboard-only role lookup with live auth email; intentionally unavailable through API roles.';
