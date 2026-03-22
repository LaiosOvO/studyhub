# StudyHub 前端 Review 2 — 实现状态详细审查

## 一、已实现且质量好的（不需要改）

| 页面 | 完成度 | 说明 |
|------|--------|------|
| 论文地图（三视图） | 95% | React Flow 力导向图 + Deck.gl 散点 + vis-timeline，三视图切换、筛选、导出、阅读列表 Drawer 均已实现 |
| 实验方案（CRUD + 可行性评分） | 95% | 卡片网格 + 完整详情编辑（假设、方法、基线、指标、数据集、路线图、代码骨架、可行性分解）+ 审批/删除确认 |
| 社区消息（WebSocket 实时） | 95% | 双栏布局、对话列表、消息气泡、未读角标、WebSocket 实时收发、标记已读 |
| 实验仪表盘 | 90% | 队列管理、运行卡片、WebSocket 实时状态、Recharts 训练曲线、迭代表格、报告查看 |
| 研究需求市场 | 85% | 需求卡片、搜索筛选、创建表单、空状态 |
| 协作者匹配 | 80% | 匹配卡片 + 匹配分解（相似度/互补性/共引/距离）、骨架加载 |
| 登录/注册 | 100% | 邮箱 + 密码 + 确认 + 显示名称，表单验证 |

---

## 二、CRITICAL — 未实现

### 2.1 首页是空壳

**现状**：只有一行 `t('welcome')` + `t('description')`，28 行代码。

**需求**：
- Hero 区域：大标题 + 副标题
- 三种研究入口（Tab 切换）：
  1. 选择研究方向（下拉选择预置方向 + 自定义输入）
  2. 输入论文（粘贴标题/DOI/URL）
  3. AI 对话（聊天式描述研究兴趣）
- 功能卡片区（3 列）：论文地图 / AI 实验 / 学者匹配
- Footer

**应参考**：
- **gpt-researcher** — [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)
  - `frontend/nextjs/components/Hero.tsx` — 搜索框居中 + 建议话题标签
  - `frontend/nextjs/components/ResearchContent.tsx` — 研究入口布局

### 2.2 导航栏功能缺失

**现状**：只有 Logo + LanguageToggle + 登录/退出按钮。

**需求**：
- 主导航项：搜索、论文地图、实验、方案、社区
- 通知铃铛 + 未读数角标
- 用户头像下拉菜单（档案/设置/退出）
- 未登录时显示登录/注册按钮

**应参考**：
- **khoj** — [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
  - `src/interface/web/app/components/navMenu/navMenu.tsx` — 完整导航系统
  - `src/interface/web/app/components/sidePanel/` — Sidebar + 顶部导航组合

### 2.3 AI 对话入口不存在

**现状**：完全没有实现。

**需求**：首页第三个 Tab，聊天式界面，用户用自然语言描述研究兴趣，AI agent 理解意图后自动拆分关键词、多轮搜索。

**应参考**：
- **khoj** — [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
  - `src/interface/web/app/components/chatInputArea/chatInputArea.tsx` — 聊天输入区域
  - `src/interface/web/app/components/chatHistory/chatHistory.tsx` — 流式消息渲染
  - `src/interface/web/app/components/chatMessage/chatMessage.tsx` — 消息气泡组件

---

## 三、HIGH — 未实现

### 3.1 搜索页缺少筛选栏

**现状**：只有搜索类型下拉 + 搜索框 + 排序 + 结果列表。无侧边筛选。

**缺失功能**：
- 左侧筛选栏（240px，可折叠）
  - 年份范围滑块（2015-2026）
  - 引用数范围滑块
  - 数据源勾选（OpenAlex / Semantic Scholar / PubMed / arXiv / CNKI / 万方）
  - 语言选择（中文 / 英文 / 全部）
  - Open Access 开关
- 分页或无限滚动（当前限制 25 条无分页）
- 操作按钮（加入阅读列表 / 开始深度研究 / 查看引用图谱）

**应参考**：
- **khoj** — [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
  - `src/interface/web/app/search/page.tsx` — 搜索页筛选模式
  - `src/interface/web/app/components/sidePanel/` — Sidebar 筛选面板

### 3.2 论文详情页不存在

**路由**：`/papers/[paperId]` — 完全未创建

**需求**：
- 标题、作者、年份、期刊/会议
- OA / 来源标识
- 完整摘要
- AI 分析摘要：方法、关键发现、贡献
- 质量分（总分 + 各维度分解）
- 引用信息：引用数、被引数、引用图谱入口
- 操作：加入阅读列表、基于此论文开始研究、生成实验方案、查看原文

**应参考**：
- **gpt-researcher** — [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)
  - `frontend/nextjs/components/ResearchResults.tsx` — 结果卡片布局、元数据展示

### 3.3 阅读列表页不存在

**路由**：`/reading-lists` — 完全未创建（仅论文地图有 ReadingListDrawer）

**需求**：
- 阅读列表管理：创建 / 重命名 / 删除列表
- 列表内论文：拖拽排序、移除、标记已读/未读
- 批量操作：导出 BibTeX、批量开始深度研究

**应参考**：
- **khoj** — [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
  - `src/interface/web/app/components/sidePanel/` — 列表管理、拖拽排序

### 3.4 shadcn/ui 组件库未引入

**现状**：所有 UI 组件都是手写 Tailwind，没有引入任何组件库。

**问题**：
- 所有下拉用原生 `<select>`
- 无 Dialog/Modal 组件库（plans 页面手写了 ConfirmDialog）
- 无 Tabs 组件（手动条件渲染）
- 无 Slider（需要做筛选范围选择）
- 无 Popover（ExportMenu 手动定位）
- 无 Tooltip
- 无标准化的键盘导航和 ARIA

**应参考**：
- **khoj** — [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
  - `src/interface/web/components/ui/` — Radix UI + shadcn/ui 封装
  - 使用了 20+ Radix 组件：Dialog, AlertDialog, Tooltip, Popover, Tabs, Menubar, DropdownMenu, Select, Slider 等

---

## 四、MEDIUM — 未实现

### 4.1 学者管理页不存在

**路由**：`/scholars` — 完全未创建

**需求**：学者卡片列表 + 搜索筛选 + 点击进入详情（发表论文、合作网络、研究方向演化时间线）

**应参考**：
- **khoj** — [khoj-ai/khoj](https://github.com/khoj-ai/khoj)
  - `src/interface/web/app/agents/` — agents 列表页的卡片网格 + 搜索模式

### 4.2 文献综述报告页不存在

**路由**：`/research/[taskId]/report` — 完全未创建（注意：实验报告 `/experiments/[runId]/report` 已有，但研究任务报告没有）

**需求**：Markdown 渲染完整综述 + 研究领域概述 + 方向分类 + 关键论文 + 研究空白 + 未来方向 + PDF 导出

**应参考**：
- **gpt-researcher** — [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)
  - `frontend/nextjs/components/ResearchContent.tsx` — Markdown 渲染、分节展示

### 4.3 种子方向选择器不存在

**现状**：无预置方向选择、无自定义方向输入、无自动搜索触发。

**需求**：
- 预置方向下拉（NLP、CV、强化学习等 20+ 方向）
- 用户可自定义输入方向
- 选择后自动启动多轮搜索
- 通过 `GET /api/v1/directions/` 获取数据

### 4.4 深度研究多轮搜索展示

**现状**：深度研究进度页已有管道阶段条，但缺少多轮搜索的关键词展示和搜索轮次配置。

**应参考**：
- **gpt-researcher** — [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)
  - `frontend/nextjs/components/ResearchBlocks/` — 分块显示搜索结果（关键词、来源、中间结论）
  - `frontend/nextjs/hooks/useWebSocket.ts` — WebSocket 懒初始化 + 分步数据块

### 4.5 骨架屏不统一

**现状**：仅 `matches` 和 `needs` 页面有 `animate-pulse` 骨架卡片，其他页面用 "Loading..." 文字。

**需求**：全局统一骨架屏组件，所有列表页首次加载使用。

### 4.6 空状态不统一

**现状**：风格不一致 — 有的用 `border-dashed`，有的纯文字，有的有 CTA 有的没有。

**需求**：统一空状态设计 + 每个空状态都有 CTA 引导用户下一步（如"还没有实验？先去生成一个方案"）。

---

## 五、代码质量问题

| 问题 | 位置 | 说明 |
|------|------|------|
| 文件过大 | `plans/[planId]/page.tsx` (827 行) | 超过 800 行上限，应拆分为子组件 |
| 样式重复 | 多处状态徽章有重复的颜色映射 | 应提取为共享工具函数 |
| 错误静默吞掉 | WebSocket handlers 的 catch 块 | 应至少 console.error 或 toast 通知 |
| 无全局 Toast | 全局 | 无统一的错误/成功通知系统 |
| 表单缺 label | 部分输入框 | 依赖 placeholder 而非 `<label>` |
| 无 skip-to-main | 全局 | 缺少无障碍跳转链接 |

---

## 六、未参考开源项目对照表

| 模块 | 应参考的项目 | GitHub 仓库 | 仓库内路径 | 当前状态 |
|------|------------|------------|-----------|---------|
| 首页 Hero | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/Hero.tsx` | 未参考，首页是空壳 |
| AI 对话入口 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatInputArea/` | 未参考，功能不存在 |
| 深度研究进度 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/hooks/useWebSocket.ts` + `components/ResearchBlocks/` | 部分实现但未参考分块进度模式 |
| 搜索筛选栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/search/page.tsx` | 未参考，无筛选栏 |
| 导航栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/navMenu/` | 未参考，导航极简 |
| 组件库 (shadcn) | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/components/ui/` | 未引入，全部手写 Tailwind |
| 方案编辑器 | MLE-agent | [MLSysOps/MLE-agent](https://github.com/MLSysOps/MLE-agent) | `web/app/page.tsx` | 已实现但未参考 Markdown 编辑器模式 |
| 消息气泡 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatMessage/` | 已实现，质量较好 |
| 论文详情 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchResults.tsx` | 未参考，页面不存在 |
| 学者列表 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/agents/` | 未参考，页面不存在 |
| 文献综述报告 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchContent.tsx` | 未参考，页面不存在 |

---

## 七、优先级排序

| 优先级 | 任务 | 工作量 | 参考项目 |
|--------|------|--------|---------|
| **P0** | 首页重写（三种入口 + Hero + 功能卡片） | 大 | gpt-researcher + khoj |
| **P0** | 导航栏补全（5 项导航 + 通知 + 用户菜单） | 中 | khoj |
| **P1** | 引入 shadcn/ui 组件库 | 中 | khoj |
| **P1** | 搜索页增加左侧筛选栏 + 操作按钮 + 分页 | 中 | khoj |
| **P1** | 新建论文详情页 `/papers/[paperId]` | 中 | gpt-researcher |
| **P1** | 新建阅读列表页 `/reading-lists` | 中 | khoj |
| **P2** | 新建学者管理页 `/scholars` | 小 | khoj |
| **P2** | 新建文献综述报告页 `/research/[taskId]/report` | 中 | gpt-researcher |
| **P2** | 种子方向选择器 + 自定义输入 | 中 | — |
| **P2** | 深度研究多轮搜索关键词展示 | 小 | gpt-researcher |
| **P2** | 全局骨架屏 + 空状态统一 | 小 | — |
| **P2** | 全局 Toast 通知系统 | 小 | khoj |
| **P3** | 社区匹配互补性雷达图 | 小 | — |
| **P3** | 用户档案合作网络可视化 | 中 | — |
| **P3** | 论文地图视觉优化（参考 O-DataMap） | 小 | — |
| **P3** | plans/[planId] 拆分（当前 827 行） | 小 | — |
