-- R1.1: preserve the R1 RPC contract while fixing audit_log.actor_role writes.

create or replace function public.admin_update_favorite_review(
  _actor_id uuid,
  _favorite_id uuid,
  _status text,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  _actor_role text;
  _actor_group text;
  _owner_id uuid;
  _owner_group text;
  _is_super boolean := false;
  _old_status text;
  _old_note text;
  _old_note_len integer := 0;
  _new_note text;
  _new_note_len integer := 0;
  _action_kind text;
begin
  if _actor_id is null or _favorite_id is null then
    raise exception 'invalid_args' using errcode = '22023';
  end if;

  select case
    when bool_or(r.role = 'super_admin') then 'super_admin'
    when bool_or(r.role = 'admin') then 'admin'
    else null
  end
  into _actor_role
  from public.user_roles r
  where r.user_id = _actor_id
    and r.role in ('admin', 'super_admin');

  if _actor_role is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  _is_super := (_actor_role = 'super_admin');

  select f.owner_id into _owner_id
  from public.favorites f
  where f.id = _favorite_id;

  if _owner_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select p.review_group into _actor_group
  from public.profiles p
  where p.id = _actor_id;

  select p.review_group into _owner_group
  from public.profiles p
  where p.id = _owner_id;

  if not _is_super then
    if _actor_group is null
       or _owner_group is null
       or _actor_group <> _owner_group then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  select r.review_status, r.note
  into _old_status, _old_note
  from public.favorite_admin_reviews r
  where r.favorite_id = _favorite_id;

  if found then
    _old_note_len := coalesce(char_length(_old_note), 0);
  end if;

  if _status is null then
    delete from public.favorite_admin_reviews
    where favorite_id = _favorite_id;
    _action_kind := 'clear';
    _new_note_len := 0;

    insert into public.audit_log (
      actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
    ) values (
      _actor_id,
      _actor_role::public.app_role,
      'admin_update_favorite_review',
      'favorite_admin_reviews',
      _favorite_id,
      null,
      jsonb_build_object(
        'kind', _action_kind,
        'old_status', _old_status,
        'new_status', null,
        'old_note_length', _old_note_len,
        'new_note_length', 0
      ),
      null,
      now()
    );

    return jsonb_build_object(
      'ok', true,
      'favoriteId', _favorite_id,
      'reviewStatus', null,
      'reviewNote', null,
      'reviewUpdatedAt', null
    );
  end if;

  if _status not in ('adopted', 'changes_requested') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  if _note is null then
    _new_note := null;
  else
    _new_note := btrim(_note);
    if _new_note = '' then
      _new_note := null;
    end if;
  end if;

  if char_length(coalesce(_new_note, '')) > 2000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;

  if _status = 'changes_requested' and _new_note is null then
    raise exception 'note_required' using errcode = '22023';
  end if;

  _new_note_len := coalesce(char_length(_new_note), 0);
  _action_kind := case when _old_status is null then 'create' else 'update' end;

  insert into public.favorite_admin_reviews (
    favorite_id, reviewer_id, review_status, note, created_at, updated_at
  ) values (
    _favorite_id, _actor_id, _status, _new_note, now(), now()
  )
  on conflict (favorite_id) do update set
    reviewer_id = excluded.reviewer_id,
    review_status = excluded.review_status,
    note = excluded.note,
    updated_at = now();

  insert into public.audit_log (
    actor, actor_role, action, entity, entity_id, reason, diff, request_id, created_at
  ) values (
    _actor_id,
    _actor_role::public.app_role,
    'admin_update_favorite_review',
    'favorite_admin_reviews',
    _favorite_id,
    null,
    jsonb_build_object(
      'kind', _action_kind,
      'old_status', _old_status,
      'new_status', _status,
      'old_note_length', _old_note_len,
      'new_note_length', _new_note_len
    ),
    null,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'favoriteId', _favorite_id,
    'reviewStatus', _status,
    'reviewNote', _new_note,
    'reviewUpdatedAt', now()
  );
end;
$$;

revoke all on function public.admin_update_favorite_review(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_favorite_review(uuid, uuid, text, text)
  to service_role;
