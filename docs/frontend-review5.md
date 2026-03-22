# StudyHub 前端 Review 5 — project-7411174 (Vite SPA) 实现审查

## 结论：UI 实现质量极高，14/14 需求已实现，但需要后端集成

**代码位置**: `/Users/admin/ai/self-dev/study-community/project-7411174/`
**技术栈**: Vite 7.0.3 + React 19.1.0 + React Router 7.6.3 + Radix UI + Tailwind CSS 3.4.17
**代码量**: ~11,100 行 TypeScript/React，67 个源文件

---

## 一、需求实现状态（全部通过）

| # | 需求 | 状态 | 评分 | 说明 |
|---|------|------|------|------|
| 1 | 首页 Hero + 三种入口 | ✅ 已实现 | 9/10 | HeroSection.tsx 505 行，方向选择/论文输入/AI 对话三 Tab |
| 2 | 导航栏 5 项导航 + 通知 + 用户菜单 | ✅ 已实现 | 9/10 | Navbar.tsx 217 行，通知 Popover + 用户 DropdownMenu |
| 3 | AI 对话入口 | ✅ 已实现 | 9/10 | 流式文字 + Slash 命令 + 建议词 + 消息气泡 |
| 4 | 搜索页筛选栏 | ✅ 已实现 | 9/10 | FilterSidebar.tsx 215 行，年份/引用/语言/来源/OA |
| 5 | 论文详情页 | ✅ 已实现 | 9/10 | 4 Tab：概览/引用/被引/AI 分析 |
| 6 | 阅读列表页 | ✅ 已实现 | 10/10 | DnD 拖拽 + 进度环 + BibTeX 导出 + Toast 通知 |
| 7 | shadcn/ui (Radix UI) | ✅ 已引入 | 9/10 | 12 个 @radix-ui 包：Dialog/DropdownMenu/Popover/Slider/Switch/Toast/Tooltip/Tabs 等 |
| 8 | 学者管理页 | ✅ 已实现 | 9/10 | 卡片网格 + 搜索筛选 + 详情抽屉 |
| 9 | 文献综述报告页 | ✅ 已实现 | 9/10 | Markdown 渲染 + TOC 侧边栏 |
| 10 | 种子方向选择器 | ✅ 已实现 | 9/10 | 20 个预置方向网格 + 图标 + 论文数 |
| 11 | 多轮搜索展示 | ✅ 已实现 | 8/10 | RoundCard + 关键词展示 + Sources 面板 |
| 12 | 全局 Toast | ✅ 已实现 | 9/10 | Radix Toast + useToast hook + 4 种变体 |
| 13 | 骨架屏统一 | ✅ 已实现 | 9/10 | Skeleton.tsx 166 行，7 种骨架类型 |
| 14 | 空状态统一 | ✅ 已实现 | 9/10 | EmptyState.tsx 77 行，带 CTA 按钮 |

**平均评分: 8.8/10** — 高质量前端原型

---

## 二、需要修复的问题（后端集成相关）

### CRITICAL — 阻塞上线

#### 1. 全部使用 Mock 数据，无 API 客户端

**现状**: 所有页面从 `src/mocks/` 导入硬编码数据，无任何真实 API 调用。

**证据**:
- `src/mocks/papers.ts` — 论文假数据
- `src/mocks/community.ts` — 社区假数据
- `src/mocks/experiments.ts` — 实验假数据
- `src/mocks/graph.ts` — 图谱假数据
- 不存在 `src/lib/api.ts` 或任何 API 客户端

**需要创建**: `src/lib/api.ts`，对接后端 `http://101.126.141.165:8000`，参考现有 Next.js 版本的 API 客户端（`apps/web/src/lib/api.ts`）。

**后端 API 端点**:
| 路径 | 方法 | 说明 |
|------|------|------|
| `POST /auth/login` | POST | 登录 |
| `POST /auth/register` | POST | 注册 |
| `POST /auth/refresh` | POST | 刷新 token |
| `GET /search/papers` | GET | 论文搜索 |
| `GET /papers/{id}` | GET | 论文详情 |
| `GET /citations/graph` | GET | 引用图谱 |
| `GET /scholars/` | GET | 学者列表 |
| `POST /api/v1/deep-research/tasks` | POST | 创建研究任务 |
| `GET /api/v1/deep-research/tasks/{id}` | GET | 任务状态 |
| `WS /api/v1/deep-research/tasks/{id}/ws` | WS | 实时进度 |
| `GET/POST /api/v1/plans/` | * | 实验方案 CRUD |
| `GET/POST /api/v1/experiments/` | * | 实验运行 CRUD |
| `GET/PUT /api/v1/profiles/me` | * | 用户档案 |
| `GET /api/v1/matching/recommendations` | GET | 协作者推荐 |
| `GET/POST /api/v1/needs/` | * | 研究需求 |
| `GET/POST /api/v1/messages/` | * | 站内消息 |
| `GET/POST /api/reading-lists/` | * | 阅读列表 |

#### 2. 无认证保护

**现状**: 所有路由无保护，登录页面是假的（`setTimeout(1200)` 模拟延迟后直接跳转）。

**需要**:
- 创建 `src/contexts/AuthContext.tsx`
- 创建 `src/components/ProtectedRoute.tsx`
- 实现 JWT token 管理（access_token + refresh_token）
- 401 自动刷新 + 失败跳登录

#### 3. 后端 URL 未配置

**需要**: 在 `vite.config.ts` 或 `.env` 中配置：
```
VITE_API_URL=http://101.126.141.165:8000
```

---

### HIGH — 需修复

#### 4. i18n 已安装但未使用

**现状**: 安装了 `i18next` + `react-i18next`，但所有文案直接硬编码中文，无 `useTranslation()` 调用。

**建议**: 要么实现双语（参考 Next.js 版本的 `messages/zh-CN.json` + `messages/en.json`），要么移除未用包。

#### 5. 未使用的依赖包

以下包已安装但未在代码中使用：
- `@supabase/supabase-js` — 未使用
- `firebase` — 未使用
- `@stripe/react-stripe-js` — 未使用

建议移除，减少包体积。

#### 6. useWebSocket hook 未使用

`src/hooks/useWebSocket.ts` 实现质量很好（自动重连 + 指数退避），但未被任何页面调用。需要在以下场景集成：
- 深度研究实时进度（`/api/v1/deep-research/tasks/{id}/ws`）
- 社区消息实时推送（`/api/v1/messages/ws`）

---

### MEDIUM — 建议改进

#### 7. community/page.tsx 过大（721 行）

应拆分为子组件：MatchesTab、NeedsTab、MessagesTab。

#### 8. 缺少 Error Boundary

`App.tsx` 无 Error Boundary 包裹，页面崩溃会白屏。

#### 9. Navbar isLoggedIn 硬编码

```tsx
const isLoggedIn = true; // 需要连接 AuthContext
```

#### 10. 搜索页筛选"应用"按钮无 onClick

FilterSidebar.tsx 的"应用筛选"按钮没有绑定事件处理。

#### 11. Toast ID 用 Math.random()

应改用 `crypto.randomUUID()` 避免碰撞。

---

### LOW — 小问题

| 问题 | 位置 | 说明 |
|------|------|------|
| Chat 消息用数组索引作 key | HeroSection.tsx:174 | 应用 message ID |
| AI 回复是模板替换 | HeroSection.tsx | 900ms 模拟流式，需对接真实 LLM |
| 内联颜色硬编码 | SVG 组件 | 应用 CSS 变量 |
| 搜索分页按钮非功能 | SearchPage.tsx | 需对接 API offset/limit |
| PaperMetaPanel 组件已导入未实现 | PapersDetailPage.tsx | stub |
| 路由缺 `/research/demo` | router/config.tsx | PaperDetailPage 引用了但未定义 |

---

## 三、开源项目参考评估

| 模块 | 参考项目 | 是否参考 | 说明 |
|------|---------|---------|------|
| 首页 Hero 搜索入口 | gpt-researcher | ✅ 已参考 | 建议词 chips + 搜索框居中布局 |
| AI 对话（Slash 命令 + 流式） | khoj | ✅ 已参考 | 流式气泡 + Slash 命令面板 |
| 搜索筛选栏 | khoj | ✅ 已参考 | Sidebar 可折叠 + 6 个数据源 |
| 导航栏 + 用户菜单 | khoj | ✅ 已参考 | Radix DropdownMenu + Popover |
| 组件库 (Radix UI) | khoj | ✅ 已参考 | 12 个 @radix-ui 包 |
| 方案编辑 | MLE-agent | ⚠️ 部分参考 | 有代码骨架预览但未用 Markdown 编辑器 |
| 消息气泡 | khoj | ✅ 已参考 | 左右气泡 + 时间戳 |
| 深度研究进度 | gpt-researcher | ✅ 已参考 | RoundCard + Sources 面板 |
| 论文详情 | gpt-researcher | ✅ 已参考 | 4 Tab 布局 |
| 学者列表 | khoj | ✅ 已参考 | 卡片网格 + 详情抽屉 |
| WebSocket 管理 | gpt-researcher | ✅ 已参考 | useWebSocket hook（暂未使用） |
| 流式渲染 | khoj | ✅ 已参考 | useStreamingText hook |

**参考覆盖率: 11/12 (92%)**

---

## 四、Tauri 集成方案

此 Vite SPA 非常适合 Tauri 集成（比 Next.js 版本更合适，因为是纯客户端 SPA）。

**步骤**:
1. 将 `project-7411174/` 移入 `apps/desktop/` 或作为 Tauri 的前端源
2. 配置 `tauri.conf.json`:
   - `devUrl`: `http://localhost:5173`（Vite dev server）
   - `frontendDist`: `../dist`（Vite build 输出）
3. 设置 `VITE_API_URL=http://101.126.141.165:8000`
4. CSP 允许远程 API 连接
5. 保留 Rust 原生命令（GPU 监控、实验控制）
6. Build: `npm run build && npm run tauri build`

**优势**:
- Vite 构建输出是纯静态文件（HTML/JS/CSS），完美适配 Tauri
- 不需要 Node.js 服务器（不像 Next.js 需要 SSR）
- 包体积更小

---

## 五、优先级排序

| 优先级 | 任务 | 工作量 |
|--------|------|--------|
| **P0** | 创建 API 客户端（对接 101.126.141.165:8000） | 大 |
| **P0** | 实现认证（JWT token 管理 + ProtectedRoute） | 中 |
| **P0** | 配置后端 URL（.env + vite.config） | 小 |
| **P1** | 替换所有 mock 数据为真实 API 调用 | 大 |
| **P1** | 集成 useWebSocket（研究进度 + 消息） | 中 |
| **P1** | 移除未用依赖（supabase/firebase/stripe） | 小 |
| **P2** | 拆分 community/page.tsx（721 行） | 小 |
| **P2** | 添加 Error Boundary | 小 |
| **P2** | 实现 i18n 或移除 | 中 |
| **P2** | Tauri 集成 | 中 |
| **P3** | 修复小问题（Toast ID、分页、PaperMetaPanel） | 小 |
