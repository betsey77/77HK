# 收藏发布平台、管理员检索与支付跳转去等待

日期：2026-07-14

## 已完成

- 收藏条目新增专属 `settings.publishPlatform` 快照；编辑它不会修改工作台的 `settings.platform`。
- 新收藏默认以其结果变体作为发布平台；旧收藏若历史平台为 `all`，展示时回退到变体，避免误显示「全部平台」。
- 收藏变更复用既有 cloud sync upsert/outbox；管理员列表和详情读取同一收藏快照。
- 管理员收藏列表与详情将平台、文案类型、评分和标签用中文展示；未知英文标签统一显示「自定义标签」。
- 管理员收藏页新增仅元信息检索与分页重置。服务端列表查询显式排除 `content`；正文仍仅在既有「审计成功后详情读取」路径返回。
- 结算页移除了 checkout 成功后额外的 1.5 秒前端等待；订单仍由服务端成功创建后才跳转至服务端返回的 `redirectUrl`。

## 未做

- 未新增或推送 Migration，未修改 RLS、数据库或 Supabase 远端状态。
- 未修改支付宝订单创建、签名、notify/webhook、幂等、回跳校验、密钥或环境变量。
- 未执行真实支付宝沙箱付款/回调 E2E。
- 左侧工作台折叠页仍按产品约定延期。

## 验证

```powershell
cd client
npx vitest run
npx tsc --noEmit
npm run build

cd ../server
npm test
npx tsc --noEmit
npm run build
```

结果：

- Client：26 files、342 tests passed；`tsc --noEmit` 和 production build 通过。
- Server：22 files、508 tests passed；`tsc --noEmit` 和 build 通过。
- 定向：新增收藏/管理员/支付跳转测试 20 项通过；管理员相关服务端测试 57 项通过。

## 回退点

- 工作区快照：`D:\work\77港话通社媒文案\77-backups\favorite-platform-admin-search-pre-grok-complete-20260714-142011.zip`
- 本地 Git tag：`local/pre-grok-favorite-platform-admin-search-20260714-141957`
- 快照不包含被 cloudflared 占用的运行时 `.log` 文件；其余项目文件已归档。
