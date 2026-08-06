# SEO 搜索发现修复验证

日期：2026-08-06

## 范围

- 为公开首页补充 canonical。
- 提供 `robots.txt` 和 `sitemap.xml`。
- 不包含生产部署、Google Search Console 或 Bing Webmaster Tools 提交。

## 测试证据

- RED：`npx vitest run src/test/seo-static-contract.test.ts`，新增实现前 3 项断言失败（缺少 robots、sitemap、canonical）。
- GREEN：同一命令通过，1 个测试文件、3 项测试全部通过。
- 客户端回归：`npm run test:client`，58 个测试文件、491 项测试全部通过。
- 生产构建：`npm run build:client` 通过。
- 本地构建产物预览：
  - `/` 返回 200、`text/html`，canonical 为 `https://77hk.net/`。
  - `/robots.txt` 返回 200、`text/plain`。
  - `/sitemap.xml` 返回 200、`text/xml`。

## 剩余步骤

代码尚未部署到生产环境；上线后需再次检查公开 URL，并向搜索引擎提交 sitemap 或请求编入索引。
