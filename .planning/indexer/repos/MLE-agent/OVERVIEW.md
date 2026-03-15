# MLE-agent — 项目概览

> generated_by: refindex-v2
> generated_at: 2026-03-15
> provenance: AST-backed via Tree-sitter

## 基本信息

| 指标 | 值 |
|------|------|
| 语言 | javascript, python, tsx, typescript |
| 文件数 | 57 |
| 代码行数 | 8624 |
| 解析错误 | 0 |

## 模块结构

| 模块 | 路径 | 语言 | 行数 |
|------|------|------|------|
| exp | `exp/__init__.py` | python | 1 |
| cli | `exp/cli.py` | python | 295 |
| init | `exp/init.py` | python | 171 |
| mlebench_api | `exp/mlebench_api.py` | python | 89 |
| utils | `exp/utils.py` | python | 38 |
| mle | `mle/__init__.py` | python | 2 |
| agents | `mle/agents/__init__.py` | python | 8 |
| advisor | `mle/agents/advisor.py` | python | 255 |
| chat | `mle/agents/chat.py` | python | 143 |
| coder | `mle/agents/coder.py` | python | 254 |
| debugger | `mle/agents/debugger.py` | python | 180 |
| planner | `mle/agents/planner.py` | python | 131 |
| reporter | `mle/agents/reporter.py` | python | 169 |
| summarizer | `mle/agents/summarizer.py` | python | 293 |
| cli | `mle/cli.py` | python | 565 |
| function | `mle/function/__init__.py` | python | 393 |
| data | `mle/function/data.py` | python | 184 |
| execution | `mle/function/execution.py` | python | 41 |
| files | `mle/function/files.py` | python | 108 |
| interaction | `mle/function/interaction.py` | python | 24 |
| search | `mle/function/search.py` | python | 133 |
| integration | `mle/integration/__init__.py` | python | 5 |
| github | `mle/integration/github.py` | python | 589 |
| google_calendar | `mle/integration/google_calendar.py` | python | 121 |
| kaggle | `mle/integration/kaggle.py` | python | 79 |
| local_git | `mle/integration/local_git.py` | python | 238 |
| model | `mle/model/__init__.py` | python | 81 |
| anthropic | `mle/model/anthropic.py` | python | 145 |
| common | `mle/model/common.py` | python | 19 |
| deepseek | `mle/model/deepseek.py` | python | 117 |
| gemini | `mle/model/gemini.py` | python | 188 |
| mistral | `mle/model/mistral.py` | python | 118 |
| ollama | `mle/model/ollama.py` | python | 92 |
| openai | `mle/model/openai.py` | python | 101 |
| vllm | `mle/model/vllm.py` | python | 186 |
| server | `mle/server/__init__.py` | python | 2 |
| app | `mle/server/app.py` | python | 148 |
| utils | `mle/utils/__init__.py` | python | 6 |
| cache | `mle/utils/cache.py` | python | 187 |
| chunk | `mle/utils/chunk.py` | python | 131 |
| component_memory | `mle/utils/component_memory.py` | python | 404 |
| data | `mle/utils/data.py` | python | 84 |
| memory | `mle/utils/memory.py` | python | 503 |
| parser | `mle/utils/parser.py` | python | 352 |
| system | `mle/utils/system.py` | python | 426 |
| version | `mle/version.py` | python | 19 |
| workflow | `mle/workflow/__init__.py` | python | 5 |
| baseline | `mle/workflow/baseline.py` | python | 109 |
| chat | `mle/workflow/chat.py` | python | 41 |
| kaggle | `mle/workflow/kaggle.py` | python | 202 |
| report | `mle/workflow/report.py` | python | 110 |
| tests | `tests/__init__.py` | python | 1 |
| layout | `web/app/layout.tsx` | tsx | 50 |
| page | `web/app/page.tsx` | tsx | 254 |
| config | `web/next.config.mjs` | javascript | 5 |
| config | `web/postcss.config.mjs` | javascript | 9 |
| config | `web/tailwind.config.ts` | typescript | 20 |

## 关键类

| 类名 | 文件 | 行范围 |
|------|------|--------|
| AdviseAgent | `mle/agents/advisor.py` | L31-L254 |
| ChatAgent | `mle/agents/chat.py` | L7-L142 |
| CodeAgent | `mle/agents/coder.py` | L24-L253 |
| DebugAgent | `mle/agents/debugger.py` | L28-L180 |
| PlanAgent | `mle/agents/planner.py` | L18-L131 |
| ReportAgent | `mle/agents/reporter.py` | L6-L169 |
| GitHubSummaryAgent | `mle/agents/summarizer.py` | L8-L174 |
| GitSummaryAgent | `mle/agents/summarizer.py` | L177-L292 |
| GitHubIntegration | `mle/integration/github.py` | L19-L588 |
| GoogleCalendarIntegration | `mle/integration/google_calendar.py` | L36-L120 |
| KaggleIntegration | `mle/integration/kaggle.py` | L8-L78 |
| GitIntegration | `mle/integration/local_git.py` | L8-L237 |
| ObservableModel | `mle/model/__init__.py` | L21-L47 |
| ClaudeModel | `mle/model/anthropic.py` | L7-L144 |
| Model | `mle/model/common.py` | L4-L18 |
| DeepSeekModel | `mle/model/deepseek.py` | L8-L116 |
| GeminiModel | `mle/model/gemini.py` | L15-L187 |
| MistralModel | `mle/model/mistral.py` | L8-L117 |
| OllamaModel | `mle/model/ollama.py` | L7-L91 |
| OpenAIModel | `mle/model/openai.py` | L9-L100 |
| vLLMModel | `mle/model/vllm.py` | L10-L185 |
| ReportRequest | `mle/server/app.py` | L25-L32 |
| WorkflowCacheOperator | `mle/utils/cache.py` | L8-L65 |
| WorkflowCache | `mle/utils/cache.py` | L68-L187 |
| Chunker | `mle/utils/chunk.py` | L13-L40 |
| CodeChunker | `mle/utils/chunk.py` | L43-L130 |
| ComponentMemory | `mle/utils/component_memory.py` | L20-L316 |
| LanceDBMemory | `mle/utils/memory.py` | L12-L247 |
| Mem0 | `mle/utils/memory.py` | L250-L344 |
| HybridMemory | `mle/utils/memory.py` | L347-L502 |
| CodeParser | `mle/utils/parser.py` | L19-L351 |

## 依赖关系

共 253 条 import 关系。

### 目录间依赖

- `exp` → `mle` (1 条)
- `mle` → `exp` (1 条)
