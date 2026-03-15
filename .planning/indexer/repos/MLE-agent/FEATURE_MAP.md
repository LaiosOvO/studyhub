# MLE-agent — 功能地图

> generated_by: refindex-v2
> generated_at: 2026-03-15

共 68 个功能模块。

## Cli 工具函数

> cli 模块的 8 个顶层函数（python），包含: require_init, wrapper, bench, init, prepare

| 节点 | 类型 | 路径 |
|------|------|------|
| require_init | function | `exp/cli.py` |
| wrapper | function | `exp/cli.py` |
| bench | function | `exp/cli.py` |
| init | function | `exp/cli.py` |
| prepare | function | `exp/cli.py` |
| _read_text_utf8 | function | `exp/cli.py` |
| grade | function | `exp/cli.py` |
| grade_sample | function | `exp/cli.py` |

## Init 工具函数

> init 模块的 3 个顶层函数（python），包含: is_init, find_git_lfs, init

| 节点 | 类型 | 路径 |
|------|------|------|
| is_init | function | `exp/init.py` |
| find_git_lfs | function | `exp/init.py` |
| init | function | `exp/init.py` |

## Mlebench Api 工具函数

> mlebench_api 模块的 4 个顶层函数（python），包含: prepare, grade, grade_sample

| 节点 | 类型 | 路径 |
|------|------|------|
| prepare | function | `exp/mlebench_api.py` |
| _read_text_utf8 | function | `exp/mlebench_api.py` |
| grade | function | `exp/mlebench_api.py` |
| grade_sample | function | `exp/mlebench_api.py` |

## Utils 工具函数

> utils 模块的 1 个顶层函数（python），包含: get_logger

| 节点 | 类型 | 路径 |
|------|------|------|
| get_logger | function | `exp/utils.py` |

## AdviseAgent

> 类 AdviseAgent (L31-L254)，4 个方法，关键方法: suggest, interact, clarify_dataset

| 节点 | 类型 | 路径 |
|------|------|------|
| AdviseAgent | class | `mle/agents/advisor.py` |
| __init__ | function | `mle/agents/advisor.py` |
| suggest | function | `mle/agents/advisor.py` |
| interact | function | `mle/agents/advisor.py` |
| clarify_dataset | function | `mle/agents/advisor.py` |

## Advisor 工具函数

> advisor 模块的 1 个顶层函数（python），包含: process_report

| 节点 | 类型 | 路径 |
|------|------|------|
| process_report | function | `mle/agents/advisor.py` |

## ChatAgent

> 类 ChatAgent (L7-L142)，3 个方法，关键方法: greet, chat

| 节点 | 类型 | 路径 |
|------|------|------|
| ChatAgent | class | `mle/agents/chat.py` |
| __init__ | function | `mle/agents/chat.py` |
| greet | function | `mle/agents/chat.py` |
| chat | function | `mle/agents/chat.py` |

## CodeAgent

> 类 CodeAgent (L24-L253)，5 个方法，关键方法: read_requirement, code, debug, interact

| 节点 | 类型 | 路径 |
|------|------|------|
| CodeAgent | class | `mle/agents/coder.py` |
| __init__ | function | `mle/agents/coder.py` |
| read_requirement | function | `mle/agents/coder.py` |
| code | function | `mle/agents/coder.py` |
| debug | function | `mle/agents/coder.py` |
| interact | function | `mle/agents/coder.py` |

## Coder 工具函数

> coder 模块的 1 个顶层函数（python），包含: process_summary

| 节点 | 类型 | 路径 |
|------|------|------|
| process_summary | function | `mle/agents/coder.py` |

## DebugAgent

> 类 DebugAgent (L28-L180)，3 个方法，关键方法: analyze_with_log, analyze

| 节点 | 类型 | 路径 |
|------|------|------|
| DebugAgent | class | `mle/agents/debugger.py` |
| __init__ | function | `mle/agents/debugger.py` |
| analyze_with_log | function | `mle/agents/debugger.py` |
| analyze | function | `mle/agents/debugger.py` |

## Debugger 工具函数

> debugger 模块的 1 个顶层函数（python），包含: process_debug_report

| 节点 | 类型 | 路径 |
|------|------|------|
| process_debug_report | function | `mle/agents/debugger.py` |

## PlanAgent

> 类 PlanAgent (L18-L131)，3 个方法，关键方法: plan, interact

| 节点 | 类型 | 路径 |
|------|------|------|
| PlanAgent | class | `mle/agents/planner.py` |
| __init__ | function | `mle/agents/planner.py` |
| plan | function | `mle/agents/planner.py` |
| interact | function | `mle/agents/planner.py` |

## Planner 工具函数

> planner 模块的 1 个顶层函数（python），包含: process_plan

| 节点 | 类型 | 路径 |
|------|------|------|
| process_plan | function | `mle/agents/planner.py` |

## ReportAgent

> 类 ReportAgent (L6-L169)，3 个方法，关键方法: process_knowledge, gen_report

| 节点 | 类型 | 路径 |
|------|------|------|
| ReportAgent | class | `mle/agents/reporter.py` |
| __init__ | function | `mle/agents/reporter.py` |
| process_knowledge | function | `mle/agents/reporter.py` |
| gen_report | function | `mle/agents/reporter.py` |

## GitHubSummaryAgent

> 类 GitHubSummaryAgent (L8-L174)，4 个方法，关键方法: process_knowledge, summarize, kaggle_request_summarize

| 节点 | 类型 | 路径 |
|------|------|------|
| GitHubSummaryAgent | class | `mle/agents/summarizer.py` |
| __init__ | function | `mle/agents/summarizer.py` |
| process_knowledge | function | `mle/agents/summarizer.py` |
| summarize | function | `mle/agents/summarizer.py` |
| kaggle_request_summarize | function | `mle/agents/summarizer.py` |

## GitSummaryAgent

> 类 GitSummaryAgent (L177-L292)，3 个方法，关键方法: process_knowledge, summarize

| 节点 | 类型 | 路径 |
|------|------|------|
| GitSummaryAgent | class | `mle/agents/summarizer.py` |
| __init__ | function | `mle/agents/summarizer.py` |
| process_knowledge | function | `mle/agents/summarizer.py` |
| summarize | function | `mle/agents/summarizer.py` |

## Cli 工具函数

> cli 模块的 12 个顶层函数（python），包含: cli, start, report, report_local, kaggle

| 节点 | 类型 | 路径 |
|------|------|------|
| cli | function | `mle/cli.py` |
| start | function | `mle/cli.py` |
| report | function | `mle/cli.py` |
| report_local | function | `mle/cli.py` |
| kaggle | function | `mle/cli.py` |
| chat | function | `mle/cli.py` |
| serve | function | `mle/cli.py` |
| web | function | `mle/cli.py` |
| new | function | `mle/cli.py` |
| integrate | function | `mle/cli.py` |
| memory | function | `mle/cli.py` |
| traces | function | `mle/cli.py` |

## Function 工具函数

> function 模块的 2 个顶层函数（python），包含: get_function, process_function_name

| 节点 | 类型 | 路径 |
|------|------|------|
| get_function | function | `mle/function/__init__.py` |
| process_function_name | function | `mle/function/__init__.py` |

## preview_* 系列

> data 模块的 2 个 preview_* 函数，包含: preview_zip_structure, preview_csv_data

| 节点 | 类型 | 路径 |
|------|------|------|
| preview_zip_structure | function | `mle/function/data.py` |
| preview_csv_data | function | `mle/function/data.py` |

## Data 工具函数

> data 模块的 1 个顶层函数（python），包含: unzip_data

| 节点 | 类型 | 路径 |
|------|------|------|
| unzip_data | function | `mle/function/data.py` |

## Execution 工具函数

> execution 模块的 1 个顶层函数（python），包含: execute_command

| 节点 | 类型 | 路径 |
|------|------|------|
| execute_command | function | `mle/function/execution.py` |

## create_* 系列

> files 模块的 2 个 create_* 函数，包含: create_file, create_directory

| 节点 | 类型 | 路径 |
|------|------|------|
| create_file | function | `mle/function/files.py` |
| create_directory | function | `mle/function/files.py` |

## Files 工具函数

> files 模块的 3 个顶层函数（python），包含: read_file, write_file, list_files

| 节点 | 类型 | 路径 |
|------|------|------|
| read_file | function | `mle/function/files.py` |
| write_file | function | `mle/function/files.py` |
| list_files | function | `mle/function/files.py` |

## ask_* 系列

> interaction 模块的 3 个 ask_* 函数，包含: ask_question, ask_yes_no, ask_choices

| 节点 | 类型 | 路径 |
|------|------|------|
| ask_question | function | `mle/function/interaction.py` |
| ask_yes_no | function | `mle/function/interaction.py` |
| ask_choices | function | `mle/function/interaction.py` |

## search_* 系列

> search 模块的 3 个 search_* 函数，包含: search_github_repos, search_arxiv, search_papers_with_code

| 节点 | 类型 | 路径 |
|------|------|------|
| search_github_repos | function | `mle/function/search.py` |
| search_arxiv | function | `mle/function/search.py` |
| search_papers_with_code | function | `mle/function/search.py` |

## Search 工具函数

> search 模块的 1 个顶层函数（python），包含: web_search

| 节点 | 类型 | 路径 |
|------|------|------|
| web_search | function | `mle/function/search.py` |

## GitHubIntegration

> 类 GitHubIntegration (L19-L588)，19 个方法，关键方法: get_user_info, get_readme, get_license, get_contributors, get_source_code

| 节点 | 类型 | 路径 |
|------|------|------|
| GitHubIntegration | class | `mle/integration/github.py` |
| __init__ | function | `mle/integration/github.py` |
| _make_request | function | `mle/integration/github.py` |
| _process_items | function | `mle/integration/github.py` |
| get_user_info | function | `mle/integration/github.py` |
| get_readme | function | `mle/integration/github.py` |
| get_license | function | `mle/integration/github.py` |
| get_contributors | function | `mle/integration/github.py` |
| get_source_code | function | `mle/integration/github.py` |
| get_contents | function | `mle/integration/github.py` |
| get_commit_history | function | `mle/integration/github.py` |
| get_issues | function | `mle/integration/github.py` |
| get_metadata | function | `mle/integration/github.py` |
| get_pull_requests | function | `mle/integration/github.py` |
| get_pull_request_commits | function | `mle/integration/github.py` |
| get_pull_request_diff | function | `mle/integration/github.py` |
| get_releases | function | `mle/integration/github.py` |
| get_structure | function | `mle/integration/github.py` |
| traverse_tree | function | `mle/integration/github.py` |
| get_user_activity | function | `mle/integration/github.py` |

## Github 工具函数

> github 模块的 1 个顶层函数（python），包含: github_login

| 节点 | 类型 | 路径 |
|------|------|------|
| github_login | function | `mle/integration/github.py` |

## GoogleCalendarIntegration

> 类 GoogleCalendarIntegration (L36-L120)，2 个方法，关键方法: get_events

| 节点 | 类型 | 路径 |
|------|------|------|
| GoogleCalendarIntegration | class | `mle/integration/google_calendar.py` |
| __init__ | function | `mle/integration/google_calendar.py` |
| get_events | function | `mle/integration/google_calendar.py` |

## Google Calendar 工具函数

> google_calendar 模块的 1 个顶层函数（python），包含: google_calendar_login

| 节点 | 类型 | 路径 |
|------|------|------|
| google_calendar_login | function | `mle/integration/google_calendar.py` |

## KaggleIntegration

> 类 KaggleIntegration (L8-L78)，4 个方法，关键方法: list_competition, download_competition_dataset, fetch_competition_overview

| 节点 | 类型 | 路径 |
|------|------|------|
| KaggleIntegration | class | `mle/integration/kaggle.py` |
| __init__ | function | `mle/integration/kaggle.py` |
| list_competition | function | `mle/integration/kaggle.py` |
| download_competition_dataset | function | `mle/integration/kaggle.py` |
| fetch_competition_overview | function | `mle/integration/kaggle.py` |

## GitIntegration

> 类 GitIntegration (L8-L237)，9 个方法，关键方法: get_repo_status, get_commit_history, get_commit_diff, get_source_code, get_contents

| 节点 | 类型 | 路径 |
|------|------|------|
| GitIntegration | class | `mle/integration/local_git.py` |
| __init__ | function | `mle/integration/local_git.py` |
| get_repo_status | function | `mle/integration/local_git.py` |
| get_commit_history | function | `mle/integration/local_git.py` |
| get_commit_diff | function | `mle/integration/local_git.py` |
| get_source_code | function | `mle/integration/local_git.py` |
| get_contents | function | `mle/integration/local_git.py` |
| get_readme | function | `mle/integration/local_git.py` |
| get_structure | function | `mle/integration/local_git.py` |
| get_user_activity | function | `mle/integration/local_git.py` |

## ObservableModel

> 类 ObservableModel (L21-L47)，3 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| ObservableModel | class | `mle/model/__init__.py` |
| __init__ | function | `mle/model/__init__.py` |
| query | function | `mle/model/__init__.py` |
| stream | function | `mle/model/__init__.py` |

## Model 工具函数

> model 模块的 1 个顶层函数（python），包含: load_model

| 节点 | 类型 | 路径 |
|------|------|------|
| load_model | function | `mle/model/__init__.py` |

## ClaudeModel

> 类 ClaudeModel (L7-L144)，4 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| ClaudeModel | class | `mle/model/anthropic.py` |
| __init__ | function | `mle/model/anthropic.py` |
| _add_tool_result_into_chat_history | function | `mle/model/anthropic.py` |
| query | function | `mle/model/anthropic.py` |
| stream | function | `mle/model/anthropic.py` |

## Model

> 类 Model (L4-L18)，3 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| Model | class | `mle/model/common.py` |
| __init__ | function | `mle/model/common.py` |
| query | function | `mle/model/common.py` |
| stream | function | `mle/model/common.py` |

## DeepSeekModel

> 类 DeepSeekModel (L8-L116)，4 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| DeepSeekModel | class | `mle/model/deepseek.py` |
| __init__ | function | `mle/model/deepseek.py` |
| _convert_functions_to_tools | function | `mle/model/deepseek.py` |
| query | function | `mle/model/deepseek.py` |
| stream | function | `mle/model/deepseek.py` |

## GeminiModel

> 类 GeminiModel (L15-L187)，5 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| GeminiModel | class | `mle/model/gemini.py` |
| __init__ | function | `mle/model/gemini.py` |
| _create_gemini_tools | function | `mle/model/gemini.py` |
| _adapt_history_for_gemini | function | `mle/model/gemini.py` |
| query | function | `mle/model/gemini.py` |
| stream | function | `mle/model/gemini.py` |

## MistralModel

> 类 MistralModel (L8-L117)，4 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| MistralModel | class | `mle/model/mistral.py` |
| __init__ | function | `mle/model/mistral.py` |
| _convert_functions_to_tools | function | `mle/model/mistral.py` |
| query | function | `mle/model/mistral.py` |
| stream | function | `mle/model/mistral.py` |

## OllamaModel

> 类 OllamaModel (L7-L91)，5 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| OllamaModel | class | `mle/model/ollama.py` |
| __init__ | function | `mle/model/ollama.py` |
| _clean_think_tags | function | `mle/model/ollama.py` |
| _process_message | function | `mle/model/ollama.py` |
| query | function | `mle/model/ollama.py` |
| stream | function | `mle/model/ollama.py` |

## OpenAIModel

> 类 OpenAIModel (L9-L100)，3 个方法，关键方法: query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| OpenAIModel | class | `mle/model/openai.py` |
| __init__ | function | `mle/model/openai.py` |
| query | function | `mle/model/openai.py` |
| stream | function | `mle/model/openai.py` |

## vLLMModel

> 类 vLLMModel (L10-L185)，4 个方法，关键方法: normalize_chat_history, query, stream

| 节点 | 类型 | 路径 |
|------|------|------|
| vLLMModel | class | `mle/model/vllm.py` |
| __init__ | function | `mle/model/vllm.py` |
| normalize_chat_history | function | `mle/model/vllm.py` |
| query | function | `mle/model/vllm.py` |
| stream | function | `mle/model/vllm.py` |

## ReportRequest

> 类 ReportRequest (L25-L32)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReportRequest | class | `mle/server/app.py` |

## gen_* 系列

> app 模块的 2 个 gen_* 函数，包含: gen_report, gen_report_async

| 节点 | 类型 | 路径 |
|------|------|------|
| gen_report | function | `mle/server/app.py` |
| gen_report_async | function | `mle/server/app.py` |

## App 工具函数

> app 模块的 2 个顶层函数（python），包含: root, read_latest_report

| 节点 | 类型 | 路径 |
|------|------|------|
| root | function | `mle/server/app.py` |
| read_latest_report | function | `mle/server/app.py` |

## WorkflowCacheOperator

> 类 WorkflowCacheOperator (L8-L65)，5 个方法，关键方法: store, resume

| 节点 | 类型 | 路径 |
|------|------|------|
| WorkflowCacheOperator | class | `mle/utils/cache.py` |
| __init__ | function | `mle/utils/cache.py` |
| store | function | `mle/utils/cache.py` |
| resume | function | `mle/utils/cache.py` |
| __enter__ | function | `mle/utils/cache.py` |
| __exit__ | function | `mle/utils/cache.py` |

## WorkflowCache

> 类 WorkflowCache (L68-L187)，9 个方法，关键方法: is_empty, remove, current_step, resume_variable

| 节点 | 类型 | 路径 |
|------|------|------|
| WorkflowCache | class | `mle/utils/cache.py` |
| __init__ | function | `mle/utils/cache.py` |
| is_empty | function | `mle/utils/cache.py` |
| remove | function | `mle/utils/cache.py` |
| current_step | function | `mle/utils/cache.py` |
| resume_variable | function | `mle/utils/cache.py` |
| _load_cache_buffer | function | `mle/utils/cache.py` |
| _store_cache_buffer | function | `mle/utils/cache.py` |
| __call__ | function | `mle/utils/cache.py` |
| __str__ | function | `mle/utils/cache.py` |

## CodeChunker

> 含组件 Chunker, chunk, get_chunk, print_chunks, consolidate_chunks_into_file, count_lines；类 CodeChunker (L43-L130)，3 个方法，关键方法: chunk, get_chunk

| 节点 | 类型 | 路径 |
|------|------|------|
| Chunker | class | `mle/utils/chunk.py` |
| __init__ | function | `mle/utils/chunk.py` |
| chunk | function | `mle/utils/chunk.py` |
| get_chunk | function | `mle/utils/chunk.py` |
| print_chunks | function | `mle/utils/chunk.py` |
| consolidate_chunks_into_file | function | `mle/utils/chunk.py` |
| count_lines | function | `mle/utils/chunk.py` |
| CodeChunker | class | `mle/utils/chunk.py` |
| __init__ | function | `mle/utils/chunk.py` |
| chunk | function | `mle/utils/chunk.py` |
| get_chunk | function | `mle/utils/chunk.py` |

## Chunk 工具函数

> chunk 模块的 1 个顶层函数（python），包含: count_tokens

| 节点 | 类型 | 路径 |
|------|------|------|
| count_tokens | function | `mle/utils/chunk.py` |

## ComponentMemory

> 类 ComponentMemory (L20-L316)，11 个方法，关键方法: store_trace, get_trace, get_recent_traces, search_traces, add_relationship

| 节点 | 类型 | 路径 |
|------|------|------|
| ComponentMemory | class | `mle/utils/component_memory.py` |
| __init__ | function | `mle/utils/component_memory.py` |
| store_trace | function | `mle/utils/component_memory.py` |
| get_trace | function | `mle/utils/component_memory.py` |
| get_recent_traces | function | `mle/utils/component_memory.py` |
| search_traces | function | `mle/utils/component_memory.py` |
| add_relationship | function | `mle/utils/component_memory.py` |
| get_related_traces | function | `mle/utils/component_memory.py` |
| close | function | `mle/utils/component_memory.py` |
| _serialize_data | function | `mle/utils/component_memory.py` |
| _deserialize_data | function | `mle/utils/component_memory.py` |
| _process_trace_result | function | `mle/utils/component_memory.py` |

## Component Memory 工具函数

> component_memory 模块的 3 个顶层函数（python），包含: trace_component, decorator, wrapper

| 节点 | 类型 | 路径 |
|------|------|------|
| trace_component | function | `mle/utils/component_memory.py` |
| decorator | function | `mle/utils/component_memory.py` |
| wrapper | function | `mle/utils/component_memory.py` |

## Data 工具函数

> data 模块的 5 个顶层函数（python），包含: dict_to_markdown, write_item, is_markdown_file, read_markdown, clean_json_string

| 节点 | 类型 | 路径 |
|------|------|------|
| dict_to_markdown | function | `mle/utils/data.py` |
| write_item | function | `mle/utils/data.py` |
| is_markdown_file | function | `mle/utils/data.py` |
| read_markdown | function | `mle/utils/data.py` |
| clean_json_string | function | `mle/utils/data.py` |

## LanceDBMemory

> 类 LanceDBMemory (L12-L247)，12 个方法，关键方法: add, query, list_all_keys, get, get_by_metadata

| 节点 | 类型 | 路径 |
|------|------|------|
| LanceDBMemory | class | `mle/utils/memory.py` |
| __init__ | function | `mle/utils/memory.py` |
| _open_table | function | `mle/utils/memory.py` |
| add | function | `mle/utils/memory.py` |
| query | function | `mle/utils/memory.py` |
| list_all_keys | function | `mle/utils/memory.py` |
| get | function | `mle/utils/memory.py` |
| get_by_metadata | function | `mle/utils/memory.py` |
| delete | function | `mle/utils/memory.py` |
| delete_by_metadata | function | `mle/utils/memory.py` |
| drop | function | `mle/utils/memory.py` |
| count | function | `mle/utils/memory.py` |
| reset | function | `mle/utils/memory.py` |

## Mem0

> 类 Mem0 (L250-L344)，5 个方法，关键方法: add, query, get_all, reset

| 节点 | 类型 | 路径 |
|------|------|------|
| Mem0 | class | `mle/utils/memory.py` |
| __init__ | function | `mle/utils/memory.py` |
| add | function | `mle/utils/memory.py` |
| query | function | `mle/utils/memory.py` |
| get_all | function | `mle/utils/memory.py` |
| reset | function | `mle/utils/memory.py` |

## HybridMemory

> 类 HybridMemory (L347-L502)，7 个方法，关键方法: add, query, reset, last_n_consolidate, top_k_consolidate

| 节点 | 类型 | 路径 |
|------|------|------|
| HybridMemory | class | `mle/utils/memory.py` |
| __init__ | function | `mle/utils/memory.py` |
| add | function | `mle/utils/memory.py` |
| query | function | `mle/utils/memory.py` |
| reset | function | `mle/utils/memory.py` |
| last_n_consolidate | function | `mle/utils/memory.py` |
| top_k_consolidate | function | `mle/utils/memory.py` |
| prompt_based_consolidate | function | `mle/utils/memory.py` |

## CodeParser

> 类 CodeParser (L19-L351)，12 个方法，关键方法: parse_code, extract_points_of_interest, extract_comments, get_lines_for_points_of_interest, get_lines_for_comments

| 节点 | 类型 | 路径 |
|------|------|------|
| CodeParser | class | `mle/utils/parser.py` |
| __init__ | function | `mle/utils/parser.py` |
| _install_parsers | function | `mle/utils/parser.py` |
| _is_repo_valid | function | `mle/utils/parser.py` |
| parse_code | function | `mle/utils/parser.py` |
| extract_points_of_interest | function | `mle/utils/parser.py` |
| _get_node_types_of_interest | function | `mle/utils/parser.py` |
| _get_nodes_for_comments | function | `mle/utils/parser.py` |
| extract_comments | function | `mle/utils/parser.py` |
| get_lines_for_points_of_interest | function | `mle/utils/parser.py` |
| get_lines_for_comments | function | `mle/utils/parser.py` |
| print_all_line_types | function | `mle/utils/parser.py` |
| map_line_to_node_type | function | `mle/utils/parser.py` |

## Parser 工具函数

> parser 模块的 1 个顶层函数（python），包含: return_simple_line_numbers_with_code

| 节点 | 类型 | 路径 |
|------|------|------|
| return_simple_line_numbers_with_code | function | `mle/utils/parser.py` |

## check_* 系列

> system 模块的 2 个 check_* 函数，包含: check_config, check_installed

| 节点 | 类型 | 路径 |
|------|------|------|
| check_config | function | `mle/utils/system.py` |
| check_installed | function | `mle/utils/system.py` |

## get_* 系列

> system 模块的 5 个 get_* 函数，包含: get_config, get_directory_name, get_user_id, get_session_id, get_langfuse_observer

| 节点 | 类型 | 路径 |
|------|------|------|
| get_config | function | `mle/utils/system.py` |
| get_directory_name | function | `mle/utils/system.py` |
| get_user_id | function | `mle/utils/system.py` |
| get_session_id | function | `mle/utils/system.py` |
| get_langfuse_observer | function | `mle/utils/system.py` |

## list_* 系列

> system 模块的 2 个 list_* 函数，包含: list_files, list_dir_structure

| 节点 | 类型 | 路径 |
|------|------|------|
| list_files | function | `mle/utils/system.py` |
| list_dir_structure | function | `mle/utils/system.py` |

## _* 系列

> system 模块的 2 个 _* 函数，包含: _observe, _fn

| 节点 | 类型 | 路径 |
|------|------|------|
| _observe | function | `mle/utils/system.py` |
| _fn | function | `mle/utils/system.py` |

## System 工具函数

> system 模块的 10 个顶层函数（python），包含: print_in_box, ask_text, write_config, delete_directory, extract_file_name

| 节点 | 类型 | 路径 |
|------|------|------|
| print_in_box | function | `mle/utils/system.py` |
| ask_text | function | `mle/utils/system.py` |
| write_config | function | `mle/utils/system.py` |
| delete_directory | function | `mle/utils/system.py` |
| extract_file_name | function | `mle/utils/system.py` |
| read_file | function | `mle/utils/system.py` |
| is_hidden_path | function | `mle/utils/system.py` |
| load_file | function | `mle/utils/system.py` |
| startup_web | function | `mle/utils/system.py` |
| query | function | `mle/utils/system.py` |

## Baseline 工具函数

> baseline 模块的 2 个顶层函数（python），包含: ask_data, baseline

| 节点 | 类型 | 路径 |
|------|------|------|
| ask_data | function | `mle/workflow/baseline.py` |
| baseline | function | `mle/workflow/baseline.py` |

## Chat 工具函数

> chat 模块的 1 个顶层函数（python），包含: chat

| 节点 | 类型 | 路径 |
|------|------|------|
| chat | function | `mle/workflow/chat.py` |

## Kaggle 工具函数

> kaggle 模块的 2 个顶层函数（python），包含: auto_kaggle, kaggle

| 节点 | 类型 | 路径 |
|------|------|------|
| auto_kaggle | function | `mle/workflow/kaggle.py` |
| kaggle | function | `mle/workflow/kaggle.py` |

## Report 工具函数

> report 模块的 3 个顶层函数（python），包含: ask_data, report, report_local

| 节点 | 类型 | 路径 |
|------|------|------|
| ask_data | function | `mle/workflow/report.py` |
| report | function | `mle/workflow/report.py` |
| report_local | function | `mle/workflow/report.py` |

## Layout 工具函数

> layout 模块的 1 个顶层函数（tsx），包含: RootLayout

| 节点 | 类型 | 路径 |
|------|------|------|
| RootLayout | function | `web/app/layout.tsx` |

## Page 工具函数

> page 模块的 1 个顶层函数（tsx），包含: Home

| 节点 | 类型 | 路径 |
|------|------|------|
| Home | function | `web/app/page.tsx` |
