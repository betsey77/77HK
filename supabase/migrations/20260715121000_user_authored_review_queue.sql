-- User-authored favorites + explicit same-group admin review queue.
-- Remote push explicitly authorized by the user on 2026-07-15.

alter table public.favorites
  add column if not exists is_user_authored boolean not null default false,
  add column if not exists review_requested boolean not null default false,
  add column if not exists review_requested_at timestamptz null;

-- Preserve the established R2 meaning for favorites that were already reviewed
-- or edited for re-review. Unrelated legacy favorites remain not requested.
update public.favorites f
set
  review_requested = true,
  review_requested_at = coalesce(
    (
      select r.updated_at
      from public.favorite_admin_reviews r
      where r.favorite_id = f.id
    ),
    f.content_edited_at,
    f.updated_at,
    now()
  )
where f.content_edited_at is not null
   or exists (
     select 1
     from public.favorite_admin_reviews r
     where r.favorite_id = f.id
   );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'favorites_review_request_timestamp_consistent'
      and conrelid = 'public.favorites'::regclass
  ) then
    alter table public.favorites
      add constraint favorites_review_request_timestamp_consistent check (
        (review_requested and review_requested_at is not null)
        or (not review_requested and review_requested_at is null)
      );
  end if;
end
$$;

create index if not exists idx_favorites_pending_review
  on public.favorites (owner_id, review_requested_at desc)
  where review_requested = true;

-- Keep R2 content revision behavior while also invalidating stale review results
-- when review-relevant metadata changes or the owner explicitly requests review
-- again. The database owns review_requested_at; clients cannot forge queue order.
create or replace function public.reset_favorite_review_on_content_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _content_changed boolean;
  _review_metadata_changed boolean;
  _review_requested_started boolean;
begin
  if tg_op = 'INSERT' then
    if new.review_requested then
      new.review_requested_at := now();
    else
      new.review_requested_at := null;
    end if;
    return new;
  end if;

  _content_changed := old.content is distinct from new.content;
  _review_metadata_changed :=
    old.settings->>'brandName' is distinct from new.settings->>'brandName'
    or old.settings->>'copyType' is distinct from new.settings->>'copyType'
    or old.settings->>'customCopyType' is distinct from new.settings->>'customCopyType'
    or old.settings->>'publishPlatform' is distinct from new.settings->>'publishPlatform';
  _review_requested_started :=
    old.review_requested is distinct from new.review_requested
    and new.review_requested;

  if _content_changed then
    new.content_revision := old.content_revision + 1;
    new.content_edited_at := now();
  else
    new.content_revision := old.content_revision;
    new.content_edited_at := old.content_edited_at;
  end if;

  if old.review_requested is distinct from new.review_requested then
    if new.review_requested then
      new.review_requested_at := now();
    else
      new.review_requested_at := null;
    end if;
  elsif new.review_requested and (_content_changed or _review_metadata_changed) then
    new.review_requested_at := now();
  elsif new.review_requested then
    new.review_requested_at := old.review_requested_at;
  else
    new.review_requested_at := null;
  end if;

  if _content_changed or _review_metadata_changed or _review_requested_started then
    delete from public.favorite_admin_reviews
    where favorite_id = old.id;
  end if;

  return new;
end;
$$;

revoke all on function public.reset_favorite_review_on_content_change()
  from public, anon, authenticated;

drop trigger if exists trg_favorites_content_review_reset on public.favorites;
create trigger trg_favorites_content_review_reset
  before insert or update on public.favorites
  for each row execute function public.reset_favorite_review_on_content_change();
