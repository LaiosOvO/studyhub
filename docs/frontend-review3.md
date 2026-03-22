# StudyHub 前端 Review 3 — project-7409495 实现审查

## 结论：和 Review 2 对比无变化

project-7409495 的代码和之前 review 时完全一致，**没有新的修改**。以下是当前完整状态。

---

## 一、无需修改的部分（已实现且质量好）

| 页面 | 完成度 | 关键实现 |
|------|--------|---------|
| 论文地图 `/research/[taskId]/map` | 95% | React Flow 力导向 + Deck.gl 散点 + vis-timeline 三视图切换、筛选栏、导出、阅读列表 Drawer、论文详情侧边栏 |
| 实验方案 `/plans` + `/plans/[planId]` | 95% | 卡片网格 + 完整编辑表单（假设/方法/基线/指标/数据集/路线图/代码骨架/可行性分解）+ 审批流程 |
| 社区消息 `/community/messages` | 95% | 双栏布局、对话列表、消息气泡（蓝/灰）、未读角标、WebSocket 实时、标记已读 |
| 实验仪表盘 `/experiments` | 90% | 队列管理、状态筛选、WebSocket 实时更新、Recharts 训练曲线、迭代表格、报告查看+生成+PDF下载 |
| 研究需求 `/community/needs` | 85% | 需求卡片网格、搜索筛选、状态标签、技能/方向标签、匹配分进度条、骨架加载、空状态 |
| 协作者匹配 `/community/matches` | 80% | 匹配卡片、分数分解（相似度/互补性/共引/距离）、骨架加载 |
| 用户档案 `/community/profile/[profileId]` | 80% | 姓名/机构/职称、H-index/引用/论文数、研究方向/专长标签、发表论文列表、合作者列表 |
| 登录/注册 | 100% | 邮箱 + 密码 + 验证、错误处理、注册后自动登录 |
| API 客户端 | 95% | 自动 Bearer token 注入、401 自动刷新、并发刷新防抖、统一 envelope 响应 |
| 状态管理 (Zustand) | 95% | auth-store / experiment-store / paper-map-store，不可变更新模式 |
| 国际化 (next-intl) | 90% | zh-CN / en 双语、路由前缀、服务端+客户端翻译 |

---

## 二、仍需修改的问题（按严重程度）

### CRITICAL（P0）

#### 2.1 首页是空壳 — 未改

**文件**: `apps/web/src/app/[locale]/page.tsx`（仅 28 行）

**现状**: 只渲染 `t('welcome')` + `t('description')` 两行文字。

**需求**:
- Hero 区域（大标题 + 副标题）
- **三种研究入口**（Tab 切换）：选择研究方向 / 输入论文 / AI 对话
- 功能卡片区（3 列）
- Footer

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/Hero.tsx`

#### 2.2 导航栏功能缺失 — 未改

**文件**: `apps/web/src/components/layout/Header.tsx`

**现状**: Logo + LanguageToggle + 登录/退出按钮。移动端有汉堡菜单但内容相同。

**缺失**:
- 主导航项（搜索、论文地图、实验、方案、社区）
- 通知铃铛 + 未读数角标（NotificationBadge 组件存在但未集成到 Header）
- 用户头像下拉菜单（档案/设置/退出）

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/navMenu/navMenu.tsx`

#### 2.3 AI 对话入口 — 不存在

**现状**: 完全未实现。

**需求**: 首页第三个 Tab，聊天式界面，用户描述研究兴趣 → AI 拆分关键词 → 自动多轮搜索。

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/chatInputArea/chatInputArea.tsx`

---

### HIGH（P1）

#### 2.4 搜索页缺少筛选栏 — 未改

**文件**: `apps/web/src/app/[locale]/search/search-content.tsx`

**已实现**: 搜索类型下拉 + 搜索框 + 排序 + PaperCard（标题/作者/年份/期刊/引用/摘要/OA/DOI/PDF）

**缺失**:
| 功能 | 说明 |
|------|------|
| 左侧筛选栏 240px | 年份范围滑块、引用数滑块、数据源勾选（6 个源）、语言选择、OA 开关 |
| 论文操作按钮 | 加入阅读列表 / 开始深度研究 / 查看引用图谱 |
| 分页 | 当前限制 25 条无分页/无限滚动 |

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/search/page.tsx`

#### 2.5 论文详情页 — 不存在

**路由**: `/papers/[paperId]` — 未创建

**需求**: 标题/作者/年份/期刊 + 完整摘要 + AI 分析 + 质量分 + 引用信息 + 操作按钮

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchResults.tsx`

#### 2.6 阅读列表独立页面 — 不存在

**路由**: `/reading-lists` — 未创建（仅论文地图有 ReadingListDrawer）

**需求**: 列表 CRUD + 拖拽排序 + 标记已读/未读 + 导出 BibTeX + 批量深度研究

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/sidePanel/`

#### 2.7 shadcn/ui 未引入

**现状**: 全部手写 Tailwind，所有下拉用原生 `<select>`，无 Dialog/Tabs/Slider/Popover/Tooltip 组件库。

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/components/ui/`（使用 20+ Radix UI 组件）

---

### MEDIUM（P2）

#### 2.8 学者管理页 — 不存在

**路由**: `/scholars` — 未创建

**需求**: 学者卡片列表 + 搜索筛选 + 详情（论文、合作网络、方向演化时间线）

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/agents/`

#### 2.9 文献综述报告页 — 不存在

**路由**: `/research/[taskId]/report` — 未创建（实验报告 `/experiments/[runId]/report` 已有，但研究报告没有）

**需求**: Markdown 综述 + 领域概述 + 方向分类 + 关键论文 + 研究空白 + 未来方向 + PDF 导出

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchContent.tsx`

#### 2.10 种子方向选择器 — 不存在

**需求**: 预置方向下拉（20+ 方向）+ 用户自定义输入 + 选择后自动搜索 + `GET /api/v1/directions/` API 对接

#### 2.11 深度研究多轮搜索展示 — 缺失

**需求**: 每轮搜索的关键词展示 + 新发现论文数 + 搜索轮次上限配置

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchBlocks/`

#### 2.12 骨架屏不统一

**现状**: 仅 matches、needs 页有 `animate-pulse` 骨架，其他页面用 "Loading..." 文字。

#### 2.13 空状态不统一

**现状**: 风格不一致（有的 `border-dashed`，有的纯文字），部分缺少 CTA 引导。

#### 2.14 无全局 Toast 通知

**现状**: 错误用内联红色 div 显示，无统一通知系统。

---

### LOW（P3）

| 问题 | 说明 |
|------|------|
| 社区匹配缺少雷达图 | 匹配分解只有数字，没有互补性雷达图 |
| 用户档案缺少合作网络可视化 | 合作者以列表形式展示，没有图谱 |
| 论文地图视觉优化 | 可参考 O-DataMap 优化聚类着色和标签布局 |
| plans/[planId] 文件过大 | 827 行，超过 800 行上限，应拆分子组件 |
| WebSocket catch 静默吞错 | 应至少 console.error 或 toast |
| 部分表单缺 `<label>` | 依赖 placeholder 而非语义化 label |

---

## 三、未参考开源项目对照表

| 模块 | 应参考 | GitHub | 路径 | 状态 |
|------|--------|--------|------|------|
| 首页 Hero | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/Hero.tsx` | 未参考 |
| AI 对话入口 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatInputArea/` | 未参考 |
| 深度研究进度 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchBlocks/` | 未参考 |
| 搜索筛选栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/search/page.tsx` | 未参考 |
| 导航栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/navMenu/` | 未参考 |
| 组件库 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/components/ui/` | 未引入 |
| 方案编辑 Markdown | MLE-agent | [MLSysOps/MLE-agent](https://github.com/MLSysOps/MLE-agent) | `web/app/page.tsx` | 未参考 |
| 论文详情 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchResults.tsx` | 页面不存在 |
| 学者列表 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/agents/` | 页面不存在 |
| 文献综述报告 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchContent.tsx` | 页面不存在 |
| WebSocket 管理 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/hooks/useWebSocket.ts` | 部分实现 |
| 流式渲染 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatHistory/` | 未参考 |

---

## 四、Tauri 桌面端集成方案

当前 Tauri 桌面端（`apps/desktop/`）使用独立的 Vite + React 极简界面（仅实验控制 + GPU 监控）。用户要求使用 web 前端作为 Tauri 的真实界面。

**推荐方案**：部署 web 前端到服务器 → Tauri 加载远程 URL

1. 创建 `apps/web/Dockerfile`（Node.js 容器运行 Next.js）
2. 添加 `web` 服务到 `infra/docker-compose.prod.yml`
3. 设置 `NEXT_PUBLIC_API_URL=http://101.126.141.165:8000`
4. 部署到服务器，暴露 3000 端口
5. 修改 Tauri 配置：`devUrl` → `http://localhost:3000`，生产模式加载 `http://101.126.141.165:3000`
6. CSP 允许连接远程服务器
7. 保留 Rust 原生命令（GPU 监控、实验控制）供桌面特有功能使用

**注意**：服务器 4GB RAM，目前已用 ~774MB。Next.js 容器预估需要 256-512MB，需确认内存余量。

---

## 五、完整优先级排序

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
| **P3** | 论文地图视觉优化 | 小 | — |
| **P3** | plans/[planId] 拆分（827 行） | 小 | — |
