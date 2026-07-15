# Evidence — 管理员类型彩色 chip + 登录标题渐变

Date: 2026-07-14  
Scope: **frontend display only**

## 修改范围

| 区域 | 文件 | 说明 |
|------|------|------|
| 管理员收藏表 | `client/src/pages/AdminPage.tsx` | Badge 新增 `sky` 变体；类型 chip 用 sky，平台 chip 维持 green；`formatAdminCopyType` 不变 |
| 登录左栏标题 | `client/src/components/auth/AuthLayout.tsx` | h1「77港话通社媒文案器」对齐官网渐变：`from-emerald-300 to-lime-300` / `light:from-orange-600 light:to-amber-500` + `bg-clip-text text-transparent` |
| 测试 | `client/src/test/slice-login-admin-accordion.test.tsx` | +2 聚焦用例：类型/平台色系区分；AuthLayout 渐变 class |

## 明确未做

- 无 Migration / RLS / Supabase / `.env` / 密钥
- 无支付、订单、Webhook、额度、权限逻辑
- 未改 AuthContext / Supabase 调用 / 路由 / 服务端
- 未改标题文案、字号（仍 `text-2xl md:text-3xl`）
- 未引入依赖、未 git commit/push

## 测试命令与结果

```powershell
cd client
npx vitest run src/test/slice-login-admin-accordion.test.tsx
# → Test Files 1 passed | Tests 11 passed

npx tsc --noEmit
# → exit 0（无输出）

npm run build
# → tsc -b && vite build OK（chunk size warning only）
```

原始输出：

- `vitest.txt`
- `tsc.txt`（空 = 通过）
- `build.txt`

## 行为验收要点

1. 管理员「用户收藏」列表：类型显示中文（如「口播稿」），chip 为 sky 色，非灰色默认 Badge。
2. 同列平台 chip 仍为 green/emerald 语义，与类型可区分。
3. `/login` 左侧 h1 深色为 emerald→lime 渐变，浅色为 orange→amber 渐变。
4. 认证流程、API、详情 fail-closed 路径未改。
