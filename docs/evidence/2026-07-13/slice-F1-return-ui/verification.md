# F1 支付确认回跳 UI 验证

日期：2026-07-13

## 范围

- 结算页账户折叠菜单
- 服务端确认支付后的自动回跳
- 结算页支付成功弹窗
- 参考收藏案例 Flex 压缩修复

## 安全边界

- 支付宝同步返回参数不作为支付成功依据。
- 仅非 Mock 且服务端订单状态为 `paid` 时生成成功回跳地址。
- 结算页必须在已拉取订单中找到同 ID 的 `paid` 订单才显示成功弹窗。
- 本切片不直接写订阅、不直接授予 Pro、不读取或记录支付密钥。

## 自动化结果

```text
npx vitest run src/test/slice-e.test.tsx src/test/slice-ux-f1.test.tsx
2 files passed; 50 tests passed

npx vitest run
13 files passed; 253 tests passed

npm run build
TypeScript passed; Vite production build passed; 1698 modules transformed
```

## 已知非阻断项

- 构建提示主 JavaScript chunk 大于 500 kB，后续可单独做代码分割，不属于本切片。
- `npm install` 报告 1 个 high、2 个 critical 依赖审计项；未自动运行 `npm audit fix`，避免未经评估升级依赖。
