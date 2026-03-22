# StudyHub 前端功能串联审计（基于 requirements-design-implementation）

更新时间：2026-03-20  
审计范围：
- 文档：`/Users/admin/ai/self-dev/study-community/docs/requirements-design-implementation.md`
- 前端：`/Users/admin/ai/self-dev/study-community/project-7411174/src`
- 后端（阅读列表链路核验）：`/Users/admin/ai/self-dev/study-community/backend/app`

---

## 1. 审计结论

### 1.1 总体结论
- 文档中“主流程可用”部分（登录、注册、搜索、深度研究创建、Agent 运行）大体成立。
- 但“前端每个按钮串联完整”不成立：存在多处 **UI 已有但未接后端** 或 **仅本地状态模拟**。
- 你特别关心的“增加/加入阅读列表”结论：**部分实现**（地图页可调 API；搜索页仍是 toast 占位；阅读列表页增删改多为本地态）。

### 1.2 判定分级
- **完整**：按钮触发真实 API/路由闭环，异常路径可控。
- **部分实现**：主路径可用，但有本地 fallback 假成功、持久化缺失或仅跳转。
- **未实现**：仅 toast/本地样式切换/无 onClick。

---

## 2. requirements-design-implementation 对照结果

| 文档承诺 | 文档证据 | 实际核验 | 结论 |
|---|---|---|---|
| 路由存在 `/reading-lists` 且数据源为 `readingListsApi` | 338 | 页面存在且会调用 `readingListsApi.list()`，但页面内创建/重命名/删除/排序/标记已读多为本地状态，未持久化 | 部分实现 |
| 完整研究闭环包含“论文地图 + 阅读列表” | 350 | 地图侧栏“加入阅读列表”可调 API，但搜索页同名按钮未接 API，仅 toast | 部分实现 |
| “全面代码审计修复”后流程应完整 | 272-273, 276+ | 仍存在多个关键按钮未接业务（plans/experiments/community/scholars 部分操作） | 与文档表述有偏差 |
| 注册 4 步 + 论文上传提取关键词 | 38-45, 86-95 | 前端注册页已实现 4 步与关键词 done 展示，链路打通 | 完整 |

---

## 3. 按钮串联审计（重点含阅读列表）

| 文件 | 按钮 | 当前行为 | 目标接口/路由 | 状态 | 证据 |
|---|---|---|---|---|---|
| `project-7411174/src/pages/search/components/PaperCard.tsx` + `src/pages/search/page.tsx` | 加入阅读列表 | 卡片仅切换本地 `inList`；页面回调只弹“暂不可用” | 无 API | **未实现** | PaperCard 34-38, 137-147；Search 111-117, 313 |
| `project-7411174/src/pages/research/map/components/DetailPanel.tsx` | 加入阅读列表 | `list/create/add/remove` 均有调用；但异常分支 fallback 为本地切换 | `readingListsApi.*` | **部分实现** | 20-43, 50-56, 203-212 |
| `project-7411174/src/pages/reading-lists/page.tsx` | 新建列表 | `handleCreate` 仅 `setLists` 本地新增 | 无 API create | **部分实现** | 302-317, 395-418 |
| 同上 | 重命名/删除 | 本地更新与删除 | 无 API update/delete | **部分实现** | 290-301, 440-441 |
| 同上 | 移除论文/标记已读/拖拽排序 | 全部本地状态 | 无持久化 | **部分实现** | 319-332, 354-362, 515-516 |
| 同上 | 导出 BibTeX | `setTimeout` + toast | 无导出实现 | **未实现** | 339-345, 461-467 |
| `project-7411174/src/pages/papers/components/PaperMetaPanel.tsx` | 加入阅读列表 | 仅文案按钮，无 `onClick`；且组件用 mock 数据 | 无 | **未实现** | 2, 5, 53-58 |
| `project-7411174/src/pages/plans/page.tsx` | 生成新方案 | 纯按钮，未绑定点击逻辑 | 无 | **未实现** | 76-79 |
| `project-7411174/src/pages/experiments/page.tsx` | 暂停/跳过迭代/取消/手动指导 | 多个按钮仅 UI | 无 | **未实现** | 615-634 |
| `project-7411174/src/pages/community/page.tsx` | 发布需求 | 已接 `communityApi.createNeed` | `/api/v1/needs/` | **完整** | 470-489, 544, 577 |
| 同上 | 发送消息 | 仅本地 `setMessages` | 未调 `communityApi.sendMessage` | **部分实现** | 632-645 |
| `project-7411174/src/pages/scholars/page.tsx` | 关注/取消关注 | 已调 follow/unfollow 接口 | `/scholars/:id/follow` | **完整** | 273-300 |
| 同上 | 发消息 | 仅 toast/跳转提示 | 无消息 API | **未实现** | 259-267 |

---

## 4. “增加阅读列表”专项结论

## 4.1 是否真的实现？
**结论：没有全链路实现，当前是“部分实现”。**

- 已实现部分：
  - 地图详情页可调用 `readingListsApi.list/create/addPaper/removePaper`（前端确实发请求）。
- 未实现/不完整部分：
  1. 搜索页“加入阅读列表”仍是占位（toast），未入库。  
  2. 阅读列表页核心管理动作（新建/重命名/删除/排序/已读）大多未持久化。  
  3. 异常分支存在“API 失败也本地成功态切换”，会造成假象。

## 4.2 关键数据契约断点（P0）
前后端阅读列表数据结构不一致：

- 前端类型声明（`project-7411174/src/lib/api.ts`）期望：
  - `ReadingListResponse.papers: PaperResult[]`（579-587）
- 后端 schema 实际返回：
  - `ReadingListResponse.paper_ids: list[str]`（`backend/app/schemas/reading_list.py` 24-35）

这会导致前端映射函数 `mapApiToReadingList()` 按 `res.papers` 读取（`reading-lists/page.tsx` 44-58），与后端响应不一致，属于高优先级契约问题。

---

## 5. 优先级修复建议

## P0（必须先修）
1. 统一阅读列表 API 契约：前后端统一 `papers` 或 `paper_ids`（二选一，禁止双标）。
2. 修复搜索页“加入阅读列表”：接真实 API，去掉“暂不可用”占位。
3. 阅读列表页创建/重命名/删除/移除论文改为真实持久化。

## P1
1. 去掉地图详情页“失败即本地切换”的假成功 fallback，改为明确错误提示。
2. 实现 plans 页“生成新方案”按钮真实逻辑。
3. 实现 experiments 页控制按钮与后端联动。

## P2
1. PaperMetaPanel 若继续保留，必须接线；否则删除避免误导。
2. 社区消息发送、学者页“发消息”补齐真实消息 API。

---

## 6. 可复核证据要求（执行口径）

每个按钮改造后必须附：
1. 请求证据：URL、method、请求体、响应体；
2. 成功与失败两条路径录屏；
3. 刷新后状态保持证明（验证非本地假状态）；
4. 代码位置（文件+行号）与测试结果。
