# 审核分组管理（Supabase Dashboard）

面向非技术用户：如何把用户和管理员分到同一审核组，以及如何授予/撤销管理员。

> **状态：** R1 Migration `20260714190000_review_groups_admin_notes.sql` 已于 2026-07-14 推送到远端 Supabase。现在可以按本文步骤配置管理员与用户的审核分组。

---

## 1. Table Editor：设置 `review_group`

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目。
2. 左侧 **Table Editor** → 选择表 **`profiles`**。
3. 用 `display_name` 或对照用户邮箱找到目标用户行。
4. 编辑 **`review_group`** 列，填入组名，例如：`group1`。
5. 规则：
   - 只能小写字母或数字开头；
   - 后续可含小写字母、数字、`_`、`-`；
   - 最长 32 字符；
   - 留空（NULL）= **未分组**。
6. **普通管理员本人也必须填与组员相同的 `review_group`**，否则该管理员看不到任何用户收藏。
7. 保存后，**下一次**管理员请求列表/详情时生效（无需重启前端）。

---

## 2. Table Editor：授予管理员角色

1. Table Editor → 表 **`user_roles`**。
2. 插入一行（或确认已存在）：
   - `user_id`：该用户的 UUID（与 `profiles.id` / Auth users 相同）
   - `role`：`admin`（普通管理员）或 `super_admin`（超级管理员）
3. 默认用户通常已有 `user` 角色行；**保留 `user` 行**，再额外加 `admin` 即可。
4. 不要随意删除 `super_admin` 行。

---

## 3. SQL Editor 可复制模板

打开 **SQL Editor**，按需复制执行（先 SELECT 确认，再 UPDATE/INSERT）。

### 3.1 按邮箱查看 UUID、角色、分组

```sql
select
  u.id as user_id,
  u.email,
  p.display_name,
  p.review_group,
  coalesce(
    (
      select array_agg(r.role::text order by r.role::text)
      from public.user_roles r
      where r.user_id = u.id
    ),
    array[]::text[]
  ) as roles
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('user@example.com');
```

### 3.2 按邮箱设置 / 清除 review_group

```sql
-- 设置分组
update public.profiles p
set review_group = 'group1'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('user@example.com');

-- 清除分组（变为未分组）
update public.profiles p
set review_group = null
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('user@example.com');
```

### 3.3 按邮箱授予 / 撤销 admin（安全模板）

```sql
-- 授予 admin（枚举类型 + 冲突安全；不删除 super_admin）
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = lower('admin@example.com')
on conflict (user_id, role) do nothing;

-- 撤销 admin（不会删除 super_admin）
delete from public.user_roles r
using auth.users u
where r.user_id = u.id
  and lower(u.email) = lower('admin@example.com')
  and r.role = 'admin'::public.app_role;
```

> 若项目的 `user_roles` 主键/唯一约束列名不同，请先 `select * from public.user_roles limit 1` 确认后再改 `on conflict` 子句。

---

## 4. 风险提示

| 不要做 | 原因 |
| --- | --- |
| 把 `service_role` / secret key 放进前端或浏览器 | 可绕过全部 RLS，等同全库权限 |
| 给 anon/authenticated 客户端使用 service key | 同上 |
| 假设分组修改“立即出现在已打开的页面” | 仅影响**下一次**管理员 API 请求；用户需重新 bootstrap/刷新才看到审核 |
| 未授权就 push migration 或在生产乱改角色 | 可能阻断登录、错组可见性或权限扩大 |

---

## 5. 远端 migration 状态

- 本地文件：`supabase/migrations/20260714190000_review_groups_admin_notes.sql`
- **远端推送已完成**。当前尚未配置任何 `review_group`；需为普通管理员及其负责用户填写相同分组值后再验收。
- 推送完成前：不要依赖 Dashboard 中不存在的列/表；开发联调可先用本地测试与 mock。
