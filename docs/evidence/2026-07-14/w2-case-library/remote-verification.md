# W2 远端 Migration 与安全补丁复核

日期：2026-07-14

## 已推送

- `w2_case_library`：创建 `public.case_library_entries`、约束、更新时间触发器、RLS 与 owner-only 策略。
- `harden_w2_case_library_function`：固定 `private.case_library_tags_valid(jsonb)` 的 `search_path=pg_catalog`。

## 只读复核结果

- `case_library_entries` 已启用 RLS。
- authenticated 仅拥有 select、insert、update 权限；没有 delete 权限。
- select、insert、update 三条策略均要求 owner 为当前 `auth.uid()`；select/update 仅作用于未软删除记录。
- `trg_case_library_entries_updated` 触发器存在。
- 安全顾问不再报告 `private.case_library_tags_valid` 的 mutable search_path 提示。

## 非 W2 的既有安全提示

- `payment_webhook_events` 已启用 RLS 但没有策略。
- `public.soft_delete_generation_job` 为 authenticated 可调用的 SECURITY DEFINER 函数。
- Supabase Auth 尚未开启泄露密码保护。

以上三项未在本次变更中修改，需另立安全切片评估，避免无关改动影响支付、历史或登录功能。
