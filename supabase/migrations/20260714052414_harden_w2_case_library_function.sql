-- W2 security hardening: eliminate mutable search_path advisory.
-- This function is in the private schema and has EXECUTE revoked from client roles.
-- Fixing search_path prevents unexpected object resolution if future schema state changes.

alter function private.case_library_tags_valid(jsonb)
  set search_path = pg_catalog;
