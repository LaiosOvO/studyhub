# StudyHub 前端 Review 报告

## 一、现有代码 vs 需求对照

| 页面/功能 | 需求文档 | 现有代码 | 状态 | 问题 |
|-----------|---------|---------|------|------|
| **首页 `/`** | 三种研究入口 + Hero + 功能卡片 | 只有一个简单欢迎文字 | **重写** | 缺少三种入口、Hero、功能卡片、种子方向选择 |
| **搜索页 `/search`** | 左侧筛选栏 + 卡片列表 + 分页 | 仅搜索框 + 基础结果列表 | **大改** | 缺少左侧筛选栏（年份/引用/来源/语言/OA）、操作按钮（加入阅读列表/深度研究）、分页 |
| **论文地图 `/research/[taskId]`** | 三视图切换 + 全屏画布 + 侧边面板 | 已实现三视图 + React Flow + Deck.gl + Timeline | **微调** | 基本达标，需优化视觉质量和交互细节 |
| **深度研究进度** | 配置页 + 管道步骤条 + 实时日志 | 集成在 research/[taskId] 路由 | **补充** | 缺少多轮搜索关键词展示、搜索轮次上限配置 |
| **实验方案 `/plans`** | 卡片网格 + 详情页含代码骨架 | 列表 + 详情页已实现 | **优化** | 功能基本齐全，UI 需美化 |
| **实验仪表盘 `/experiments`** | 左侧列表 + 训练曲线 + GPU 监控 | 已实现 Dashboard + 曲线 + 迭代表 + 报告 | **优化** | 缺少 GPU 监控面板（仅桌面端有）、拖拽排序队列 |
| **社区 `/community`** | 三 Tab：匹配/需求/消息 | 三子路由均已实现 | **优化** | 缺少互补性雷达图、匹配分可视化 |
| **用户档案** | 查看 + 编辑 + 合作网络可视化 | 已实现基础档案 | **补充** | 缺少合作网络可视化、自动充实功能 UI |
| **登录/注册** | 居中卡片式 | 已实现 | **微调** | 基本达标 |
| **论文详情 `/papers/[paperId]`** | 完整论文信息 + AI 分析 | **不存在** | **新建** | 整页需新建 |
| **阅读列表 `/reading-lists`** | 列表管理 + 拖拽 + BibTeX 导出 | **不存在**（仅地图页有 Drawer） | **新建** | 需独立页面 |
| **学者管理 `/scholars`** | 学者卡片 + 搜索 + 详情 | **不存在** | **新建** | 整页需新建 |
| **文献综述报告 `/research/[taskId]/report`** | Markdown 报告 + PDF 导出 | **不存在** | **新建** | 整页需新建 |
| **导航栏** | 通知铃铛 + 用户下拉 + 5 项导航 | 仅 Logo + 语言切换 + 登录按钮 | **大改** | 缺少主导航项、通知铃铛、用户下拉菜单 |
| **种子数据/方向选择** | 预置方向 + 用户自定义 + 自动搜索 | **不存在** | **新建** | 需前端选择器 + API 对接 |
| **AI 对话入口** | 首页聊天式界面 | **不存在** | **新建** | 需对话组件 |

---

## 二、核心问题

### 问题 1：首页是空壳
现有首页只有一行欢迎文字，完全没有体现平台价值。需求要求三种研究入口（选方向/输论文/AI对话）+ Hero 区域 + 功能卡片。这是用户第一印象，优先级最高。

### 问题 2：导航栏功能缺失
现有导航栏只有 Logo、语言切换、登录按钮。缺少：
- 主导航项（搜索、论文地图、实验、方案、社区）
- 通知铃铛 + 未读数角标
- 用户头像下拉菜单（档案/设置/退出）

### 问题 3：搜索页过于简陋
没有左侧筛选栏、没有分页、没有操作按钮（加入阅读列表/开始深度研究）。用户无法有效筛选和使用搜索结果。

### 问题 4：4 个页面完全缺失
论文详情、阅读列表、学者管理、文献综述报告四个页面不存在。

### 问题 5：视觉质量不足
现有 UI 是功能性的纯 Tailwind 组件，缺乏设计感。需求要求"科研工具的克制美学"，参考 O-DataMap 的视觉风格。

### 问题 6：无空状态和骨架屏
所有列表页缺少空状态引导和加载骨架屏。

---

## 三、修改建议 + 参考项目对照

### 参考项目 GitHub 仓库

| 项目 | GitHub 仓库 | 前端路径 |
|------|------------|---------|
| **khoj** | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/` |
| **gpt-researcher** | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/` |
| **MLE-agent** | [MLSysOps/MLE-agent](https://github.com/MLSysOps/MLE-agent) | `web/` |
| **AI-Scientist** | [SakanaAI/AI-Scientist](https://github.com/SakanaAI/AI-Scientist) | 无前端（实验流水线参考） |
| **deep-research** | [dzhng/deep-research](https://github.com/dzhng/deep-research) | `src/` |
| **autoresearch** | [karpathy/autoresearch](https://github.com/karpathy/autoresearch) | 无前端（实验循环参考） |

---

### 1. 首页重写 — 参考 `gpt-researcher`

**GitHub**: https://github.com/assafelovic/gpt-researcher

gpt-researcher 的首页 Hero 组件做得很好：大搜索框居中 + 建议话题标签 + 一键开始研究。StudyHub 首页应：
- 参考其搜索框居中布局和建议标签模式
- 在此基础上扩展为三个 Tab（选方向 / 输论文 / AI对话）
- 功能卡片区参考其布局间距

**关键参考文件**:
```
frontend/nextjs/components/Hero.tsx
frontend/nextjs/components/ResearchContent.tsx
```

### 2. AI 对话入口 — 参考 `khoj`

**GitHub**: https://github.com/khoj-ai/khoj

khoj 的聊天输入区域是最完善的参考：
- `ChatInputArea.tsx` — 文件上传、语音输入、命令面板、Markdown 预览
- 流式响应处理 + 消息气泡渲染
- WebSocket 实时通信 + 心跳 + 断线重连

StudyHub 的 AI 对话入口应参考 khoj 的：
- 聊天界面布局和交互模式
- 流式消息渲染（用户描述需求 → AI 理解 → 确认搜索策略）
- 但简化为单轮或少轮对话（不需要完整聊天历史）

**关键参考文件**:
```
src/interface/web/app/components/chatInputArea/chatInputArea.tsx
src/interface/web/app/components/chatHistory/chatHistory.tsx
src/interface/web/app/components/chatMessage/chatMessage.tsx
```

### 3. 深度研究进度页 — 参考 `gpt-researcher`

**GitHub**: https://github.com/assafelovic/gpt-researcher

gpt-researcher 的研究流程可视化是最好的参考：
- 有序数据块（OrderedData）逐步渲染搜索进度
- WebSocket 懒初始化模式 — 按需建立连接
- 分块显示搜索结果（关键词、来源、中间结论）

StudyHub 应参考其：
- 分步进度展示模式（管道阶段条）
- 实时日志流渲染
- 多轮搜索关键词展示（每轮用了什么词、找到多少论文）

**关键参考文件**:
```
frontend/nextjs/hooks/useWebSocket.ts
frontend/nextjs/components/ResearchBlocks/
frontend/nextjs/components/ResearchResults.tsx
```

### 4. 搜索页筛选栏 — 参考 `khoj`

**GitHub**: https://github.com/khoj-ai/khoj

khoj 的搜索页有完善的筛选和结果展示：
- Sidebar 模式的筛选面板
- 可折叠的筛选组
- 结果卡片带操作按钮

StudyHub 搜索页应参考其：
- 左侧 Sidebar 布局（可折叠）
- 筛选控件组织方式（滑块、复选框、开关）
- 结果卡片的操作按钮布局

**关键参考文件**:
```
src/interface/web/app/search/page.tsx
src/interface/web/app/components/sidePanel/
```

### 5. 导航栏 — 参考 `khoj`

**GitHub**: https://github.com/khoj-ai/khoj

khoj 的导航系统最完善：
- Sidebar + 顶部导航组合
- 通知铃铛 + 未读角标
- 用户头像下拉菜单
- 移动端自适应

StudyHub 导航栏应参考其：
- 使用 Radix UI / shadcn 的 DropdownMenu 做用户菜单
- NavigationMenu 组件做主导航
- Popover 做通知面板

**关键参考文件**:
```
src/interface/web/app/components/navMenu/navMenu.tsx
src/interface/web/app/components/sidePanel/
```

### 6. 论文地图 — 现有代码已较好，微调即可

现有论文地图实现（React Flow + Deck.gl + Timeline 三视图）基本达标。建议微调：
- 参考 [O-DataMap](https://o-datamap.oall.com/) 优化主题地图的视觉效果（聚类区域着色、标签布局）
- 右侧详情面板增加"基于此论文生成实验方案"按钮
- 双击节点展开引用网络的交互

### 7. 实验方案 + 仪表盘 — 参考 `MLE-agent`

**GitHub**: https://github.com/MLSysOps/MLE-agent

MLE-agent 的方案编辑器参考价值：
- Markdown 编辑器（UIW React MD Editor）用于方案编辑
- 设置面板（Sticky Sidebar）用于配置

StudyHub 方案页应参考其：
- 代码骨架预览用语法高亮代码块
- 方案编辑用 Markdown 编辑器

**关键参考文件**:
```
web/app/page.tsx
```

### 8. 社区消息 — 参考 `khoj`

**GitHub**: https://github.com/khoj-ai/khoj

khoj 的消息气泡渲染模式适合社区消息 Tab：
- 左右气泡布局
- 时间戳显示
- 未读标识

**关键参考文件**:
```
src/interface/web/app/components/chatMessage/chatMessage.tsx
```

### 9. UI 组件库选型

建议引入 **Radix UI + shadcn/ui**（参考 khoj 的做法）：
- 提供 Dialog、Tooltip、Popover、DropdownMenu、Tabs、Select、Slider 等基础组件
- 与 Tailwind CSS 完美配合
- 可访问性内置（keyboard navigation、ARIA）
- 比纯手写 Tailwind 组件质量更高

参考 khoj 的 UI 组件封装：
```
# GitHub: https://github.com/khoj-ai/khoj
src/interface/web/components/ui/
```

### 10. 新建页面

| 新页面 | 参考项目 | GitHub | 参考什么 |
|--------|---------|--------|---------|
| 论文详情 `/papers/[paperId]` | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchResults.tsx` | 结果卡片布局、元数据展示 |
| 阅读列表 `/reading-lists` | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/components/sidePanel/` | 列表管理、拖拽排序 |
| 学者管理 `/scholars` | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) → `src/interface/web/app/agents/` | 卡片网格、搜索筛选 |
| 文献综述报告 `/research/[taskId]/report` | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) → `frontend/nextjs/components/ResearchContent.tsx` | Markdown 渲染、分节展示 |

---

## 四、优先级排序

| 优先级 | 任务 | 工作量 |
|--------|------|--------|
| **P0** | 首页重写（三种入口 + Hero） | 大 |
| **P0** | 导航栏补全（主导航 + 通知 + 用户菜单） | 中 |
| **P1** | 搜索页增加筛选栏 + 操作按钮 | 中 |
| **P1** | 引入 Radix UI / shadcn 组件库 | 中 |
| **P1** | 论文详情页新建 | 中 |
| **P2** | 阅读列表页新建 | 小 |
| **P2** | 学者管理页新建 | 小 |
| **P2** | 文献综述报告页新建 | 中 |
| **P2** | 空状态 + 骨架屏全局补充 | 小 |
| **P3** | 社区匹配雷达图 | 小 |
| **P3** | 用户档案合作网络可视化 | 中 |
| **P3** | 论文地图视觉优化 | 小 |

---

## 五、参考项目索引速查

| 功能模块 | 主要参考 | GitHub 仓库 | 仓库内路径 |
|---------|---------|------------|-----------|
| 首页 Hero + 搜索入口 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/components/Hero.tsx` |
| AI 对话入口 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatInputArea/` |
| 深度研究进度 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/hooks/useWebSocket.ts` |
| 搜索筛选栏 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/search/` |
| 导航栏 + 用户菜单 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/navMenu/` |
| 方案编辑器 | MLE-agent | [MLSysOps/MLE-agent](https://github.com/MLSysOps/MLE-agent) | `web/app/page.tsx` |
| 消息气泡 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatMessage/` |
| 组件库 (Radix + shadcn) | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/components/ui/` |
| WebSocket 管理 | gpt-researcher | [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | `frontend/nextjs/hooks/useWebSocket.ts` |
| 流式渲染 | khoj | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | `src/interface/web/app/components/chatHistory/` |
| 实验循环逻辑 | autoresearch | [karpathy/autoresearch](https://github.com/karpathy/autoresearch) | `train.py`, `prepare.py` |
| 全自动科学流水线 | AI-Scientist | [SakanaAI/AI-Scientist](https://github.com/SakanaAI/AI-Scientist) | `ai_scientist/`, `launch_scientist.py` |
| 最简 deep research | deep-research | [dzhng/deep-research](https://github.com/dzhng/deep-research) | `src/` |
