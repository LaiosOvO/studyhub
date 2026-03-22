# StudyHub 前端 Review 4 — project-7410423 实现审查

## 结论：和 Review 3 对比无变化

project-7410423 的代码和之前 review 时完全一致，**所有之前指出的问题均未修复**。

---

## 一、问题状态总览

| # | 问题 | 状态 | 严重度 |
|---|------|------|--------|
| 1 | 首页是空壳 | ❌ 未修复 | CRITICAL |
| 2 | 导航栏缺主导航/通知/用户菜单 | ❌ 未修复 | CRITICAL |
| 3 | AI 对话入口不存在 | ❌ 未修复 | CRITICAL |
| 4 | 搜索页缺左侧筛选栏 | ❌ 未修复 | HIGH |
| 5 | 论文详情页不存在 | ❌ 未修复 | HIGH |
| 6 | 阅读列表独立页面不存在 | ❌ 未修复 | HIGH |
| 7 | shadcn/ui 未引入 | ❌ 未修复 | HIGH |
| 8 | 学者管理页不存在 | ❌ 未修复 | MEDIUM |
| 9 | 文献综述报告页不存在 | ❌ 未修复 | MEDIUM |
| 10 | 种子方向选择器不存在 | ❌ 未修复 | MEDIUM |
| 11 | 深度研究多轮搜索展示缺失 | ❌ 未修复 | MEDIUM |
| 12 | 全局 Toast 通知不存在 | ❌ 未修复 | MEDIUM |
| 13 | 骨架屏不统一 | ❌ 未修复 | LOW |
| 14 | 空状态不统一、缺 CTA | ❌ 未修复 | LOW |

**0/14 个问题被修复。**

---

## 二、详细问题描述

### CRITICAL（P0）

#### 1. 首页是空壳

**文件**: `apps/web/src/app/[locale]/page.tsx`（28 行）

**现状**:
```tsx
<h1>{t('welcome')}</h1>
<p>{t('description')}</p>
```

**需求**:
- Hero 区域（大标题 + 副标题）
- 三种研究入口（Tab 切换）：选择研究方向 / 输入论文 / AI 对话
- 功能卡片区（3 列）：论文地图 / AI 实验 / 学者匹配
- Footer

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/Hero.tsx`

#### 2. 导航栏功能缺失

**文件**: `apps/web/src/components/layout/Header.tsx`（133 行）

**已有**: Logo + LanguageToggle + 登录/退出 + 移动端汉堡菜单

**缺失**:
- ❌ 主导航项（搜索、论文地图、实验、方案、社区）
- ❌ 通知铃铛 + 未读数角标（NotificationBadge 组件已存在但未集成到 Header）
- ❌ 用户头像下拉菜单（当前只有文字名称 + logout 按钮）

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/navMenu/navMenu.tsx`

#### 3. AI 对话入口不存在

**现状**: 无任何 chat/conversation 组件（社区消息不算）

**需求**: 首页第三个 Tab，聊天式界面，用户描述研究兴趣 → AI 拆分关键词 → 自动多轮搜索

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/chatInputArea/chatInputArea.tsx`

---

### HIGH（P1）

#### 4. 搜索页缺左侧筛选栏

**文件**: `apps/web/src/app/[locale]/search/search-content.tsx`（205 行）

**已有**: 搜索类型下拉 + 搜索框 + 排序 + PaperCard

**缺失**:
- ❌ 左侧筛选栏 240px（年份范围滑块、引用数滑块、数据源勾选、语言选择、OA 开关）
- ❌ 论文操作按钮（加入阅读列表 / 开始深度研究 / 查看引用图谱）
- ❌ 分页或无限滚动（当前限制 25 条）

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/search/page.tsx`

#### 5. 论文详情页不存在

**路由**: `/papers/[paperId]` — 未创建

**需求**: 标题/作者/年份/期刊 + 完整摘要 + AI 分析 + 质量分 + 引用信息 + 操作按钮

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchResults.tsx`

#### 6. 阅读列表独立页面不存在

**路由**: `/reading-lists` — 未创建

**现状**: 仅论文地图有 `ReadingListDrawer`（抽屉组件），无独立页面

**需求**: 列表 CRUD + 拖拽排序 + 标记已读/未读 + 导出 BibTeX + 批量深度研究

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/sidePanel/`

#### 7. shadcn/ui 未引入

**现状**: package.json 无 @radix-ui 包，无 `src/components/ui/` 目录，全部手写 Tailwind

**影响**: 所有下拉用原生 `<select>`，无 Dialog/Tabs/Slider/Popover/Tooltip，无标准键盘导航和 ARIA

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/components/ui/`

---

### MEDIUM（P2）

#### 8. 学者管理页不存在

**路由**: `/scholars` — 未创建

**需求**: 学者卡片列表 + 搜索筛选 + 详情（论文、合作网络、方向演化时间线）

**参考**: [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/agents/`

#### 9. 文献综述报告页不存在

**路由**: `/research/[taskId]/report` — 未创建

**注意**: 实验报告 `/experiments/[runId]/report` 已有，但研究任务报告没有

**需求**: Markdown 综述 + 领域概述 + 方向分类 + 关键论文 + 研究空白 + 未来方向 + PDF 导出

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchContent.tsx`

#### 10. 种子方向选择器不存在

**现状**: NeedForm 中有简单文字输入 "Research Direction"，但无预置方向下拉

**需求**: 预置方向下拉（20+ 方向）+ 用户自定义输入 + 选择后自动搜索 + `GET /api/v1/directions/` API

#### 11. 深度研究多轮搜索展示缺失

**需求**: 每轮搜索的关键词展示 + 新发现论文数 + 搜索轮次上限配置

**参考**: [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchBlocks/`

#### 12. 全局 Toast 通知不存在

**现状**: 错误用内联红色 div 显示，无 useToast hook、无 Toast provider、无统一通知

---

### LOW（P3）

#### 13. 骨架屏不统一

**现状**: matches 和 needs 页有 `animate-pulse` 骨架，其他页面用 "Loading..." 文字

#### 14. 空状态不统一

**现状**: 风格不一致（border-dashed / border / 纯文字），部分缺少 CTA 引导

---

## 三、未参考开源项目对照

| 模块 | 应参考 | GitHub | 路径 | 状态 |
|------|--------|--------|------|------|
| 首页 Hero | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/Hero.tsx` | ❌ 未参考 |
| AI 对话入口 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatInputArea/` | ❌ 未参考 |
| 深度研究进度 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchBlocks/` | ❌ 未参考 |
| 搜索筛选栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/search/page.tsx` | ❌ 未参考 |
| 导航栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/navMenu/` | ❌ 未参考 |
| 组件库 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/components/ui/` | ❌ 未引入 |
| 方案 Markdown 编辑 | MLE-agent | [MLSysOps/MLE-agent](https://github.com/MLSysOps/MLE-agent) | `web/app/page.tsx` | ❌ 未参考 |
| 论文详情 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchResults.tsx` | ❌ 页面不存在 |
| 学者列表 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/agents/` | ❌ 页面不存在 |
| 文献综述报告 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/ResearchContent.tsx` | ❌ 页面不存在 |
| WebSocket 管理 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/hooks/useWebSocket.ts` | ⚠️ 部分实现 |
| 流式渲染 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatHistory/` | ❌ 未参考 |

---

## 四、已实现质量好的部分（无需修改）

| 页面 | 完成度 |
|------|--------|
| 论文地图（三视图：React Flow + Deck.gl + Timeline） | 95% |
| 实验方案（CRUD + 可行性评分 + 代码骨架） | 95% |
| 社区消息（WebSocket + 双栏 + 未读角标） | 95% |
| 实验仪表盘（队列 + 曲线 + 迭代表 + 报告） | 90% |
| 研究需求市场（卡片 + 搜索 + CRUD） | 85% |
| 协作者匹配（卡片 + 分数分解） | 80% |
| 用户档案（查看模式） | 80% |
| 登录/注册 | 100% |
| API 客户端（token 自动刷新） | 95% |
| 国际化（zh-CN / en） | 90% |

---

## 五、优先级排序

| 优先级 | 任务 | 工作量 | 参考项目 |
|--------|------|--------|---------|
| **P0** | 首页重写（三种入口 + Hero + 功能卡片） | 大 | gpt-researcher + khoj |
| **P0** | 导航栏补全（5 项导航 + 通知铃铛 + 用户菜单） | 中 | khoj |
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
