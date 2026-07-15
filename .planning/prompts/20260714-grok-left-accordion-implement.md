只实现一个小目标：重组工作台左侧 InputPanel 为可访问的折叠页。

项目 D:\work\77港话通社媒文案\77。先阅读 README.md、AGENTS.md、CLAUDE.md、docs/design-system.md、spec/WORKBENCH_CONTENT_CONTROLS.md 和 InputPanel 相关代码与测试。

实现规范第 8 节已经得到用户明确授权：

1. 五个分组：创作任务、品牌与受众、表达参数、参考与案例、配置管理。
2. 保留每一个既有输入控件、字段、默认值和行为；只改变左侧信息架构，不删除或降级功能。
3. 同一时刻仅展开一个非关键分组；含校验错误的分组自动展开。
4. 生成按钮固定在左栏底部，左栏内容可滚动；保持亮色橙色、暗色荧光绿、现有 Logo 和 shadcn/ui 风格。
5. 具备键盘和屏幕阅读器支持：button、aria-expanded、aria-controls、可见标题与焦点顺序。
6. 增加最少必要的行为测试并更新 ACCEPTANCE、CHANGELOG、status 和证据说明。

禁止：修改任何 .env、密钥、支付、路由、认证、额度、数据库、RLS、管理员权限、案例库、生成 Prompt；禁止 Migration、部署、git reset/checkout/clean/stash/rebase/commit/push/worktree；禁止删除文件或重构无关代码；禁止子代理。

完成后运行 Client TypeScript、相关 Vitest 和 Client production build，报告修改文件与测试结果。
