你是本项目的增量实现者。只实现一个清晰切片：W1 工作台内容控制参数和左侧折叠页。不要实现 W2 案例库 CRUD、Migration、RLS、管理员正文权限或任何支付变更。

工作目录：D:\work\77港话通社媒文案\77。

开始前完整阅读 README.md、AGENTS.md、CLAUDE.md、spec/WORKBENCH_CONTENT_CONTROLS.md、docs/design-system.md，以及相关 Client/Server 实现与测试。

本切片必须完成：

1. 新增文案类型：social 默认、spoken、poster、advertorial、poetry、custom；custom 时要求 2–20 字说明。
2. 新增长度控制开关，默认关闭；开启后显示五档滑杆。关闭时不向生成 Prompt 注入长度要求。
3. 新增一个主语气加最多两个修饰语气。保留现有 tone 的向后兼容。
4. 新字段进入 AppSettings、生成请求、保存配置、云同步、工作台快照、生成历史恢复、收藏 settings 快照。历史或旧配置缺字段时安全回退默认。
5. 在工作台左侧实现规范第 8 节的五个可访问折叠分组：创作任务、品牌与受众、表达参数、参考与案例、配置管理。只同时展开一个非关键分组；有校验错误的分组自动展开；生成按钮固定在左栏底部。保留当前暗色荧光绿、亮色橙色、Logo、shadcn/ui 视觉语言，且不能移除现有输入控件。
6. Prompt 中让文案类型、开启后的长度、主/修饰语气实际影响 DeepSeek、自部署模型与 rules fallback；未启用长度时必须保持当前长度行为。
7. 为 W1 添加或更新针对默认值、切换、保存加载、历史恢复、生成请求、Prompt 和折叠可访问性的测试。
8. 更新 spec/ACCEPTANCE.md、spec/CHANGELOG.md、.planning/status.md 和证据文件，准确标注只完成 W1 与折叠页。

严格边界：

- 当前工作树有用户和其他代理的未提交修改。不要使用 git reset、git checkout、git clean、git stash、rebase、commit、push、worktree 或删除文件。
- 已建立只读回退快照 D:\work\77港话通社媒文案\77-backups\pre-grok-w1-collapse-20260714-115005.zip；不要修改这个目录。
- 不读取、打印、修改 .env 或密钥；不部署、不推送 Migration、不进行真实支付。
- 不创建平行应用，不改端口、路由、认证、套餐、支付、RLS、管理员权限、案例库表。
- 不使用子代理。
- 不做无关重构；每个改动必须可追溯到本任务。

完成后必须运行与报告：

- Client TypeScript 检查和生产构建。
- Server TypeScript 检查和生产构建。
- 受影响的 Vitest 测试；如时间允许，再运行两端全量测试。
- 列出新增、修改、未改的文件；列出已知未完成项 W2–W4。

直接编辑文件并完成实现；不要只给计划。
