# Shorts/TK 本地验收记录

日期：2026-07-15

## 结果

- 用户可见平台名已统一为 `Shorts/TK`，内部平台与变体键继续使用 `shorts`。
- 生成、审核、复审、fallback 与快速检查均按 YouTube Shorts / TikTok 双平台语义处理。
- 无数据库 Migration、API 枚举变更、部署、commit 或 push。

## 自动化验证

- 定向 Client：14/14 通过。
- 定向 Server：58/58 通过。
- 全量 Client：372/372 通过。
- 全量 Server：557/557 通过。
- Client/Server TypeScript、生产构建通过。
- `npm audit --omit=dev` 与 `npm audit` 均为 0 vulnerabilities。

完整命令输出：[`../slice-02/test-output.txt`](../slice-02/test-output.txt)

## 浏览器验收

- 在官网平台区点击 `Shorts/TK` 后，卡片选中态和“Shorts/TK · 口播节奏”内容正确显示。
- 桌面 1440px：`scrollWidth = clientWidth = 1440`。
- 手机 390px：`scrollWidth = clientWidth = 390`。
- 未发现文字截断、控件重叠或横向溢出。

截图：

- [桌面视图](../slice-02/frames/shorts-tk-platforms-desktop.png)
- [手机视图](../slice-02/frames/shorts-tk-platforms-mobile.png)

## 工具说明

第一次证据归档因 `vibe_verify.py` 在 Windows 下按 GBK 解码 Unicode 输出而失败；启用 `PYTHONUTF8=1` 后同一验证完整通过并归档到 `slice-02`。产品测试没有因此失败。
