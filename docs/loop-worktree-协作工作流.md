# Loop + Worktree 协作工作流

> 配套文档：[77港话社媒文案器-PRD-SDD.md](./77港话社媒文案器-PRD-SDD.md)
> 用途：用 `/loop` 定时巡检 + `--worktree` 多 AI 并行，加速 Phase 3 及后续迭代

---

## 一、概念速查

| 工具 | 一句话 | 在这个项目里的角色 |
|------|--------|-------------------|
| `/loop` | 每隔 N 分钟自动执行一条指令 | 定时巡检、等待外部状态、守护服务 |
| `--worktree` | 给每个 AI 分配独立文件副本 | Phase 3 多任务并行开发，互不踩文件 |
| `/workflow` | 编排多个子 AI 协同干活 | 拆任务、分派、收结果、合并 |

**关系**：worktree = 隔间，workflow = 工头，loop = 定时器。

---

## 二、/loop 实用场景

### 2.1 守护自托管模型（日常必配）

```bash
# 每 5 分钟检查 Cantonese 4B 是否存活
/loop 5m 调用 /api/health，如果 cantonese 引擎状态不是 ok 就告诉我
```

模型挂了会悄无声息切到 DeepSeek，生成质量下降。loop 帮你第一时间发现。

### 2.2 等待 API 配额恢复

```bash
# 每 30 分钟试一次 YT API
/loop 30m 调一下 /api/inspiration/youtube-trending，有数据就通知我
```

YT Data API v3 有日配额。开发期频繁调用容易耗尽，loop 蹲点等刷新。

### 2.3 Phase 3 语料库采集守护

```bash
# 每小时跑一次去重检查
/loop 1h 跑语料库去重脚本，有新增重复就列出来
```

### 2.4 竞品监测（上线后）

```bash
# 每 6 小时扫一次竞品新广告
/loop 6h 搜索竞品"美心月餅"的广告，和上次结果对比，有新增就通知
```

---

## 三、多 AI 并行方案

### 3.1 前置条件

```bash
# 项目根目录初始化 git（只需一次）
cd D:\work\思念
git init
git add .
git commit -m "Phase 2 完成基线"
```

之后每次用 `--worktree`，每个 AI 都会在 `.claude/worktrees/` 下分到独立工位。

### 3.2 Phase 3 并行分工（推荐）

```
第 1 轮（3 个 AI 并行，互不依赖）
┌─────────────────────────────────────────────────┐
│ AI-A (worktree-rag)    → P3.1 语料库采集+清洗   │
│ AI-B (worktree-ab)     → P3.5 A/B变体实验设计   │
│ AI-C (worktree-opt)    → §16.2 短期质量优化     │
└─────────────────────────────────────────────────┘
                    ↓ 人工 review 后合并
第 2 轮（P3.1 完成后，3 个 AI 并行）
┌─────────────────────────────────────────────────┐
│ AI-A (worktree-expert) → P3.2 专家小组评分      │
│ AI-B (worktree-pub)    → P3.3 发布策略建议      │
│ AI-C (worktree-cta)    → P3.4 行业CTA基准       │
└─────────────────────────────────────────────────┘
```

### 3.3 实操步骤示例

```bash
# 启动第 1 轮（在项目根目录下分别开 3 个 Claude 会话）

# 会话 1
claude --worktree worktree-rag
> 帮我在 server/src/services/ 下建 corpusService.ts，实现语料库采集脚本...

# 会话 2
claude --worktree worktree-ab
> 帮我在 server/src/services/ 下建 abTestService.ts，设计 A/B 变体实验建议...

# 会话 3
claude --worktree worktree-opt
> 按 PRD §16.2，帮我做 Few-shot 注入 + 自检 + 地雷词库 + 温度分层...
```

### 3.4 合并节奏

```
每个 AI 完成 → git commit（在自己的 worktree）
              → 你来 review diff
              → git merge 到主分支
              → 删掉 worktree
```

---

## 四、loop + workflow 组合技

适合"批量任务 + 定期巡检"的场景：

```bash
# 每天早 9 点自动跑一轮完整检查
/loop 24h /workflow 检查所有 AI 服务状态 + 语料库增量更新 + 竞品新广告
```

---

## 五、注意事项

1. **worktree 隔离 ≠ 自动合并**。多 AI 改了同一个文件会有冲突，分工时尽量让每个 AI 创建新文件（如 `xxxService.ts`），减少交叉。
2. **loop 默认 10 分钟**。调太短浪费 token（cache 5 分钟过期），建议至少 5 分钟起步。
3. **项目没 git 初始化之前，worktree 不可用**。先做 §3.1。
4. **Phase 3 的 P3.2–P3.4 都依赖 P3.1**，第 2 轮要等第 1 轮的语料库建完才能开始。

---

## 六、参考

- PRD 任务清单：`十三、分期实施计划`（Phase 3 任务明细）
- 短期优化项：`十六、通用模型港話質量優化策略 §16.2`
- 架构全景：`七、技术架构 §7.1`
