# Slice A 独立验收复核

日期：2026-07-11  
测试地址：`http://localhost:5175`（`5173` 实际被旧 `D:\work\思念\client` 占用）

## 通过项

- Client TypeScript：通过。
- Client Vite build：通过，1639 modules transformed。
- Server TypeScript/build：通过。
- 未登录访问 `/app` 会进入 `/login`。
- 登录页可见 Mock 标识。
- 注册数据写入 `hk-cantonese-mock-auth`，刷新后可恢复到工作台。
- 工作台可显示用户邮箱和退出入口。

## 未通过项

### P1：不存在的账户也会显示“密码已重置”

- 复现：访问 `/reset-password`，输入未注册邮箱和合法新密码。
- 实际：页面显示“密码已重置”。
- 预期：显示“未找到该邮箱的账户”，不得进入 success 状态。
- 根因：`mockResetPassword()` 返回 `void`；`ResetPasswordPage.handleSubmit()` 在 await 后无条件执行 `setSuccess(true)`。
- 证据：`04-reset-missing-account.png`。

### P1：亮色模式品牌交互色未统一为橙色

- 工作台的主生成按钮、选中态、focus/slider/tab 等多处仍写死 emerald。
- 修复必须按语义区分：品牌交互/主 CTA 在 light 为 orange；审核通过、质量分数等“成功语义”允许保留 green。
- Auth 页面各自从 localStorage 计算 `isDark`，而主题状态只存在 AuthLayout 内；切换时子表单不可靠地同步主题。应使用单一 ThemeContext，或让页面只使用 `light:` CSS 变体。
- 证据：`02-login-light-after-toggle.png` 与源代码扫描。

### P1：没有 TDD 行为测试

- `client`、`server` 中没有 `*.test.*` 或 `*.spec.*` 文件。
- 当前证据只有类型检查、构建和手工说明，不能证明登录错误、路由保护、会话恢复、退出和重置密码边界。
- 引入 Vitest/Testing Library/jsdom 属于新增依赖，需用户批准后再安装。

### P2：表单 label 未与 input 关联

- 登录页实测：9 个 label，`htmlFor` 为 0；7 个 input，`id` 为 0。
- 应为每个字段补稳定 id + `htmlFor`，错误信息使用 `aria-describedby`/`role=alert`。

### P2：登录页主标题在 1440 宽度出现单字孤行

- “器”单独落在第三行，影响专业感。
- 应降低桌面 clamp 上限、增加左栏有效宽度或使用经过设计的换行。
- 证据：`01-login-dark.png`。

## 验收结论

Slice A：`Needs Fix`。静态构建通过，但不满足 TDD/严格 UI 验收，不能进入 Slice B。

