-- Pro monthly quota: 400 -> 250.
--
-- Existing subscriptions read quota_per_cycle from plans at reservation time,
-- so this takes effect in their current period immediately. Deliberately keep
-- subscriptions.quota_used and usage_ledger unchanged.

do $$
declare
  _updated integer;
begin
  update public.plans
  set quota_per_cycle = 250,
      updated_at = now()
  where name = 'Pro';

  get diagnostics _updated = row_count;

  if _updated <> 1 then
    raise exception 'expected exactly one Pro plan, updated %', _updated;
  end if;

  if not exists (
    select 1
    from public.plans
    where name = 'Pro'
      and quota_per_cycle = 250
      and period_unit = 'month'
      and period_count = 1
  ) then
    raise exception 'Pro plan quota or monthly period verification failed';
  end if;
end
$$;
