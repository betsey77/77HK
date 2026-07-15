# 收藏卡片品牌/产品展示验证

日期：2026-07-13

## 范围

- 仅调整 `FavoritesPanel` 收藏卡片头部的信息顺序与品牌/产品文字颜色。
- 复用现有 `BookmarkedCopy.settings.brandName/productName`。
- 不修改 API、Supabase、RLS、Migration、收藏同步或生成逻辑。

## TDD 证据

1. 先新增“在平台标签左侧显示品牌名和产品名”测试。
2. 初次运行失败：找不到 `思念 · 煎饺王`。
3. 实现后定向测试通过：`slice-ui-polish.test.tsx` 5/5。
4. 颜色变更先加入 `text-red-400` / `light:text-red-600` 断言并验证失败，再实现双主题红色后通过。

## 回归验证

```text
npx vitest run
Test Files  15 passed (15)
Tests       260 passed (260)

npm run build
tsc -b && vite build
1698 modules transformed
build passed
```

Vite 仍报告既有的大于 500 kB chunk 警告；本切片未扩大范围处理代码分包。
