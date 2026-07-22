# V2.1 发布前 UI 回归修复验证

日期：2026-07-22  
范围：工作台底部空白、再次生成整段标红、隔离浏览器回归门禁。

## 结论

- 工作台壳层固定于当前视口；即使文档被额外拉长 900px，壳层顶部/底部仍分别贴合视口 0 和 `innerHeight`。
- 每次成功生成都把服务端结果视为新的差异基线，清空上一版 `modifiedVariants`；手改第一版后再次生成第二版，不再显示旧版红色差异。
- 普通管理员同 `review_group`、`super_admin` 全局可见的既有授权逻辑未改动。
- 本地发布门禁通过；本轮未 commit、push、部署或执行 Migration。

## 根因与最小修复

1. 工作台原为正常文档流中的 `h-[100dvh]`。文档因浏览器状态或附加内容变高后，页面滚动会把整个工作台移出视口。修复为 `fixed inset-0`、`min-h-0`、`overflow-hidden` 的全视口壳层。
2. `SET_RESULTS` 替换了新 variants，却保留上一版 `modifiedVariants`，导致新生成内容仍与旧基线做差异渲染。修复为成功生成时清空修改基线。
3. 首次浏览器闭环被 E2E fixture 自身阻塞：mock 缺少现行 `Thermometer.dimensions`，审核面板 `Object.entries` 抛错并卸载工作台。真实服务解析器和 fallback 都提供该必需字段；fixture 已补齐并显式绑定 `GenerateResponse` 类型，未给生产组件增加掩盖坏响应的兼容分支。

## 红绿证据

- 红：原工作台注入 900px 文档溢出后壳层 `top=-900`；再次生成 reducer 测试仍出现“红色标记为修改内容”。
- 红：聚焦浏览器环捕获 `/api/generate` 200 后 `bodyText=""`、`shellPresent=false` 与 `TypeError: Cannot convert undefined or null to object`，定位到缺失 `thermometer.dimensions` 的测试 fixture。
- 绿：聚焦再次生成浏览器场景 1/1；桌面与 390px 均显示第二版文案且无红色差异标记。
- 绿：完整隔离 Playwright 14/14 连续两遍，共 28/28；26 张截图；无残留 Vite/Playwright 进程。
- 绿：`npm run verify` — Client 487/487、Server 809/809、双端 typecheck/build、`audit:prod` 与完整 audit 均为 0 vulnerabilities。

## 关键证据

- 原始浏览器双跑日志：`test-output.txt`
- 固定视口：`screenshots/workbench-pinned-desktop-1440-local-mock.png`
- 再次生成桌面：`screenshots/workbench-regenerate-clean-desktop-1440-local-mock.png`
- 再次生成 390px：`screenshots/workbench-regenerate-clean-mobile-390-local-mock.png`

## 边界

隔离 Playwright 使用本地 Auth/API mock，证明前端交互与布局，不替代此前已完成的 staging Auth/RLS/DeepSeek 数据闭环。用户已确认统一人工验收通过。
