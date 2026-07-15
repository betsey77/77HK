# Evidence — 登录视觉 / 收藏卡片布局 / 管理员备注标签 / 左侧折叠页

Date: 2026-07-14  
Scope: **frontend layout only**

## 修改范围

| 区域 | 文件 | 说明 |
|------|------|------|
| A 登录视觉 | `client/src/components/auth/AuthLayout.tsx`、`client/src/pages/LoginPage.tsx` | 对齐官网克制深色科技感：Logo、能力点≤3、格栅/光晕；登录右栏「欢迎回来」；主题与回官网顶栏保留 |
| B 收藏卡片 | `client/src/components/favorites/FavoritesPanel.tsx` | 头部元信息可换行；日期独立第二行；复制/载入/删除固定右侧 `shrink-0` |
| C 管理员表 | `client/src/pages/AdminPage.tsx` | 「备注/标签」表头可换行；备注低饱和 amber 容器；标签中文 chip（`formatAdminReasonTag`） |
| D 左侧折叠 | `client/src/components/input/InputPanel.tsx` | 四大折叠页；Source/Language 常显；内容 `hidden` 保持挂载 |
| 测试 | `client/src/test/slice-login-admin-accordion.test.tsx`；更新 `slice-w2-case-library.test.tsx` | 登录/收藏/管理员/折叠行为 |

## 明确未做

- 无 Migration / RLS / Supabase 连接 / `.env` / 密钥变更
- 无支付服务端、订单、Webhook、额度、权限逻辑变更
- 未改 `AuthContext` / Supabase 调用
- 未增加 npm 依赖或新 UI 框架
- 未做移动端专项重构
- **未执行 git commit / push**
- 左侧折叠只重组现有控件；配置保存字段与 W1 参数集合不变

## 信息架构（InputPanel）

1. **始终可见：** SourceEditor、LanguageToggle  
2. **品牌与内容场景**（默认展开）：CopyType、Brand、RedLines、TargetDate、Competitor  
3. **文案参数**（默认展开）：StructuredBrief、Creativity、Platform、Length、Tone、Cantonese、EnglishMixing  
4. **目标受众与参考**（默认收起）：Persona、ReferenceCase、CaseLibrary  
5. **配置管理**（默认收起）：ConfigManager  
6. **生成按钮** 在所有折叠页之后  

折叠收起使用 `hidden`，组件保持挂载，避免案例库/配置/草稿 state 被卸载清空。

## 测试命令与结果

```powershell
cd client
npx vitest run
# → 27 files, 351 passed

npx tsc --noEmit
npm run build
# → Vite production build OK

cd ..\server
npm test
# → 22 files, 509 passed

npx tsc --noEmit
npm run build
# → tsc OK
```

## 行为验收要点

1. `/login?next=%2Fapp`：Logo `/brand/77-logo.png`（黑底无白边）、欢迎回来、邮箱密码、忘记密码、注册、主题切换、next 白名单跳转逻辑未改。  
2. 收藏卡片窄宽：发布平台 select + 日期 + 三操作均在 DOM 且操作区不重叠。  
3. 管理员收藏表：备注高亮、标签中文 chip、详情仍 `getAdminFavoriteDetail` 审计先行路径。  
4. 左侧四折叠页默认开合正确，点击切换 `aria-expanded`，控件仍可访问。  

## 人工建议验收

- 浏览器打开登录页切换深/浅色，确认与官网同属产品气质且表单为主。  
- 工作台左侧折叠/展开后改参数、保存配置、载入配置、选择案例库，确认 state 不丢。  
- 收藏库改发布平台后刷新仍保留；管理员打开详情正文仍可读（需管理员账号）。  
