# Supabase 内部运营：手动开通 Pro 与角色邮箱查询

> 适用于尚未接入真实支付的内部 Preview。只在 Supabase Dashboard 的 SQL Editor 中执行，不要把这段 SQL 放到前端。

## 按邮箱开通 Pro 250 次

1. 先确认用户已完成注册。
2. 打开目标 Supabase 项目的 **SQL Editor**。
3. 只替换下方 `target_email` 的邮箱，再执行。

```sql
do $$
declare
  target_email constant text := lower('user@example.com');
  target_user_id uuid;
  target_user_count integer;
  pro_plan_id uuid;
  target_subscription_id uuid;
begin
  select count(*)
  into target_user_count
  from auth.users
  where lower(email) = target_email;

  if target_user_count <> 1 then
    raise exception 'Expected exactly one user for %, found %',
      target_email, target_user_count;
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = target_email
  limit 1;

  select id
  into pro_plan_id
  from public.plans
  where name = 'Pro';

  if pro_plan_id is null then
    raise exception 'Pro plan not found';
  end if;

  insert into public.subscriptions (
    user_id,
    plan_id,
    status,
    quota_used,
    current_period_start,
    current_period_end
  )
  values (
    target_user_id,
    pro_plan_id,
    'active',
    0,
    now(),
    now() + interval '1 month'
  )
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      status = excluded.status,
      quota_used = 0,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end
  returning id into target_subscription_id;

  insert into public.audit_log (
    action,
    entity,
    entity_id,
    reason,
    diff,
    request_id
  )
  values (
    'manual_pro_grant',
    'subscription',
    target_subscription_id,
    'Internal Preview manual Pro grant',
    jsonb_build_object('email', target_email, 'plan', 'Pro', 'quota', 250),
    'supabase-sql-editor'
  );
end
$$;
```

这个操作会把当前周期重置为从现在开始的 1 个月，已用额度重置为 0。它不会创建支付订单。

## 验证开通结果

```sql
select
  u.email,
  p.name as plan_name,
  p.quota_per_cycle,
  s.quota_used,
  s.status,
  s.current_period_start,
  s.current_period_end
from auth.users u
join public.subscriptions s on s.user_id = u.id
join public.plans p on p.id = s.plan_id
where lower(u.email) = lower('user@example.com');
```

预期：`plan_name = Pro`、`quota_per_cycle = 250`、`status = active`。

## 用邮箱识别 user_roles

staging 已建立 Dashboard-only 实时视图，避免在 `user_roles` 里复制一份会过期的邮箱。在 Supabase SQL Editor 执行：

```sql
select *
from private.user_roles_with_email
order by lower(email), role;
```

该视图实时联结 `auth.users.email`，不会产生过期副本。它不开放给浏览器、`anon`、`authenticated` 或 `service_role`，仅供 Dashboard SQL Editor 的数据库角色查询。
