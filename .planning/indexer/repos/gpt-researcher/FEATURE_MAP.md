# gpt-researcher — 功能地图

> generated_by: refindex-v2
> generated_at: 2026-03-15

共 134 个功能模块。

## ChatAgentWithMemory

> 类 ChatAgentWithMemory (L55-L258)，7 个方法，关键方法: quick_search, process_chat_completion, chat, get_context

| 节点 | 类型 | 路径 |
|------|------|------|
| ChatAgentWithMemory | class | `backend/chat/chat.py` |
| __init__ | function | `backend/chat/chat.py` |
| _setup_vector_store | function | `backend/chat/chat.py` |
| _process_document | function | `backend/chat/chat.py` |
| quick_search | function | `backend/chat/chat.py` |
| process_chat_completion | function | `backend/chat/chat.py` |
| chat | function | `backend/chat/chat.py` |
| get_context | function | `backend/chat/chat.py` |

## Chat 工具函数

> chat 模块的 1 个顶层函数（python），包含: get_tools

| 节点 | 类型 | 路径 |
|------|------|------|
| get_tools | function | `backend/chat/chat.py` |

## DraftState

> 类 DraftState (L5-L10)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| DraftState | class | `backend/memory/draft.py` |

## ResearchState

> 类 ResearchState (L5-L18)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchState | class | `backend/memory/research.py` |

## BasicReport

> 类 BasicReport (L9-L75)，3 个方法，关键方法: run

| 节点 | 类型 | 路径 |
|------|------|------|
| BasicReport | class | `backend/report_type/basic_report/basic_report.py` |
| __init__ | function | `backend/report_type/basic_report/basic_report.py` |
| _generate_research_id | function | `backend/report_type/basic_report/basic_report.py` |
| run | function | `backend/report_type/basic_report/basic_report.py` |

## DeepResearch

> 含组件 ResearchProgress；类 DeepResearch (L27-L324)，7 个方法，关键方法: generate_feedback, generate_serp_queries, process_serp_result, deep_research, process_query

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchProgress | class | `backend/report_type/deep_research/example.py` |
| DeepResearch | class | `backend/report_type/deep_research/example.py` |
| __init__ | function | `backend/report_type/deep_research/example.py` |
| __init__ | function | `backend/report_type/deep_research/example.py` |
| generate_feedback | function | `backend/report_type/deep_research/example.py` |
| generate_serp_queries | function | `backend/report_type/deep_research/example.py` |
| process_serp_result | function | `backend/report_type/deep_research/example.py` |
| deep_research | function | `backend/report_type/deep_research/example.py` |
| process_query | function | `backend/report_type/deep_research/example.py` |
| run | function | `backend/report_type/deep_research/example.py` |

## Main 工具函数

> main 模块的 2 个顶层函数（python），包含: main, on_progress

| 节点 | 类型 | 路径 |
|------|------|------|
| main | function | `backend/report_type/deep_research/main.py` |
| on_progress | function | `backend/report_type/deep_research/main.py` |

## DetailedReport

> 类 DetailedReport (L10-L189)，8 个方法，关键方法: run

| 节点 | 类型 | 路径 |
|------|------|------|
| DetailedReport | class | `backend/report_type/detailed_report/detailed_report.py` |
| __init__ | function | `backend/report_type/detailed_report/detailed_report.py` |
| _generate_research_id | function | `backend/report_type/detailed_report/detailed_report.py` |
| run | function | `backend/report_type/detailed_report/detailed_report.py` |
| _initial_research | function | `backend/report_type/detailed_report/detailed_report.py` |
| _get_all_subtopics | function | `backend/report_type/detailed_report/detailed_report.py` |
| _generate_subtopic_reports | function | `backend/report_type/detailed_report/detailed_report.py` |
| _get_subtopic_report | function | `backend/report_type/detailed_report/detailed_report.py` |
| _construct_detailed_report | function | `backend/report_type/detailed_report/detailed_report.py` |

## ResearchRequest

> 类 ResearchRequest (L52-L60)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchRequest | class | `backend/server/app.py` |

## ChatRequest

> 类 ChatRequest (L63-L67)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ChatRequest | class | `backend/server/app.py` |

## get_* 系列

> app 模块的 3 个 get_* 函数，包含: get_all_reports, get_report_by_id, get_report_chat

| 节点 | 类型 | 路径 |
|------|------|------|
| get_all_reports | function | `backend/server/app.py` |
| get_report_by_id | function | `backend/server/app.py` |
| get_report_chat | function | `backend/server/app.py` |

## update_* 系列

> app 模块的 2 个 update_* 函数，包含: update_report, update_report

| 节点 | 类型 | 路径 |
|------|------|------|
| update_report | function | `backend/server/app.py` |
| update_report | function | `backend/server/app.py` |

## delete_* 系列

> app 模块的 3 个 delete_* 函数，包含: delete_report, delete_file, delete_report

| 节点 | 类型 | 路径 |
|------|------|------|
| delete_report | function | `backend/server/app.py` |
| delete_file | function | `backend/server/app.py` |
| delete_report | function | `backend/server/app.py` |

## App 工具函数

> app 模块的 13 个顶层函数（python），包含: lifespan, serve_frontend, read_report, create_or_update_report, add_report_chat_message

| 节点 | 类型 | 路径 |
|------|------|------|
| lifespan | function | `backend/server/app.py` |
| serve_frontend | function | `backend/server/app.py` |
| read_report | function | `backend/server/app.py` |
| create_or_update_report | function | `backend/server/app.py` |
| add_report_chat_message | function | `backend/server/app.py` |
| write_report | function | `backend/server/app.py` |
| generate_report | function | `backend/server/app.py` |
| list_files | function | `backend/server/app.py` |
| run_multi_agents | function | `backend/server/app.py` |
| upload_file | function | `backend/server/app.py` |
| websocket_endpoint | function | `backend/server/app.py` |
| chat | function | `backend/server/app.py` |
| research_report_chat | function | `backend/server/app.py` |

## JSONResearchHandler

> 类 JSONResearchHandler (L7-L36)，4 个方法，关键方法: log_event, update_content

| 节点 | 类型 | 路径 |
|------|------|------|
| JSONResearchHandler | class | `backend/server/logging_config.py` |
| __init__ | function | `backend/server/logging_config.py` |
| log_event | function | `backend/server/logging_config.py` |
| update_content | function | `backend/server/logging_config.py` |
| _save_json | function | `backend/server/logging_config.py` |

## get_* 系列

> logging_config 模块的 2 个 get_* 函数，包含: get_research_logger, get_json_handler

| 节点 | 类型 | 路径 |
|------|------|------|
| get_research_logger | function | `backend/server/logging_config.py` |
| get_json_handler | function | `backend/server/logging_config.py` |

## Logging Config 工具函数

> logging_config 模块的 1 个顶层函数（python），包含: setup_research_logging

| 节点 | 类型 | 路径 |
|------|------|------|
| setup_research_logging | function | `backend/server/logging_config.py` |

## _* 系列

> multi_agent_runner 模块的 2 个 _* 函数，包含: _ensure_repo_root_on_path, _resolve_run_research_task

| 节点 | 类型 | 路径 |
|------|------|------|
| _ensure_repo_root_on_path | function | `backend/server/multi_agent_runner.py` |
| _resolve_run_research_task | function | `backend/server/multi_agent_runner.py` |

## Multi Agent Runner 工具函数

> multi_agent_runner 模块的 1 个顶层函数（python），包含: run_multi_agent_task

| 节点 | 类型 | 路径 |
|------|------|------|
| run_multi_agent_task | function | `backend/server/multi_agent_runner.py` |

## ReportStore

> 类 ReportStore (L7-L57)，8 个方法，关键方法: list_reports, get_report, upsert_report, delete_report

| 节点 | 类型 | 路径 |
|------|------|------|
| ReportStore | class | `backend/server/report_store.py` |
| __init__ | function | `backend/server/report_store.py` |
| _ensure_parent_dir | function | `backend/server/report_store.py` |
| _read_all_unlocked | function | `backend/server/report_store.py` |
| _write_all_unlocked | function | `backend/server/report_store.py` |
| list_reports | function | `backend/server/report_store.py` |
| get_report | function | `backend/server/report_store.py` |
| upsert_report | function | `backend/server/report_store.py` |
| delete_report | function | `backend/server/report_store.py` |

## CustomLogsHandler

> 类 CustomLogsHandler (L33-L79)，2 个方法，关键方法: send_json

| 节点 | 类型 | 路径 |
|------|------|------|
| CustomLogsHandler | class | `backend/server/server_utils.py` |
| __init__ | function | `backend/server/server_utils.py` |
| send_json | function | `backend/server/server_utils.py` |

## Researcher

> 类 Researcher (L82-L113)，2 个方法，关键方法: research

| 节点 | 类型 | 路径 |
|------|------|------|
| Researcher | class | `backend/server/server_utils.py` |
| __init__ | function | `backend/server/server_utils.py` |
| research | function | `backend/server/server_utils.py` |

## handle_* 系列

> server_utils 模块的 6 个 handle_* 函数，包含: handle_start_command, handle_human_feedback, handle_chat_command, handle_file_upload, handle_file_deletion, handle_websocket_communication

| 节点 | 类型 | 路径 |
|------|------|------|
| handle_start_command | function | `backend/server/server_utils.py` |
| handle_human_feedback | function | `backend/server/server_utils.py` |
| handle_chat_command | function | `backend/server/server_utils.py` |
| handle_file_upload | function | `backend/server/server_utils.py` |
| handle_file_deletion | function | `backend/server/server_utils.py` |
| handle_websocket_communication | function | `backend/server/server_utils.py` |

## Server Utils 工具函数

> server_utils 模块的 9 个顶层函数（python），包含: sanitize_filename, generate_report_files, send_file_paths, get_config_dict, update_environment_variables

| 节点 | 类型 | 路径 |
|------|------|------|
| sanitize_filename | function | `backend/server/server_utils.py` |
| generate_report_files | function | `backend/server/server_utils.py` |
| send_file_paths | function | `backend/server/server_utils.py` |
| get_config_dict | function | `backend/server/server_utils.py` |
| update_environment_variables | function | `backend/server/server_utils.py` |
| execute_multi_agents | function | `backend/server/server_utils.py` |
| run_long_running_task | function | `backend/server/server_utils.py` |
| safe_run | function | `backend/server/server_utils.py` |
| extract_command_data | function | `backend/server/server_utils.py` |

## WebSocketManager

> 类 WebSocketManager (L19-L112)，5 个方法，关键方法: start_sender, connect, disconnect, start_streaming

| 节点 | 类型 | 路径 |
|------|------|------|
| WebSocketManager | class | `backend/server/websocket_manager.py` |
| __init__ | function | `backend/server/websocket_manager.py` |
| start_sender | function | `backend/server/websocket_manager.py` |
| connect | function | `backend/server/websocket_manager.py` |
| disconnect | function | `backend/server/websocket_manager.py` |
| start_streaming | function | `backend/server/websocket_manager.py` |

## Websocket Manager 工具函数

> websocket_manager 模块的 1 个顶层函数（python），包含: run_agent

| 节点 | 类型 | 路径 |
|------|------|------|
| run_agent | function | `backend/server/websocket_manager.py` |

## GPTResearcher

> 类 GPTResearcher (L4-L121)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| GPTResearcher | class | `docs/npm/index.js` |

## HallucinationEvaluator

> 类 HallucinationEvaluator (L18-L53)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| HallucinationEvaluator | class | `evals/hallucination_eval/evaluate.py` |

## ResearchEvaluator

> 类 ResearchEvaluator (L34-L144)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchEvaluator | class | `evals/hallucination_eval/run_eval.py` |

## SimpleQAEval

> 类 SimpleQAEval (L101-L172)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SimpleQAEval | class | `evals/simple_evals/simpleqa_eval.py` |

## s

> 类 s (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| s | class | `frontend/nextjs/public/workbox-f1770938.js` |

## r

> 类 r (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| r | class | `frontend/nextjs/public/workbox-f1770938.js` |

## i

> 类 i (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| i | class | `frontend/nextjs/public/workbox-f1770938.js` |

## a

> 类 a (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| a | class | `frontend/nextjs/public/workbox-f1770938.js` |

## y

> 类 y (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| y | class | `frontend/nextjs/public/workbox-f1770938.js` |

## v

> 类 v (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| v | class | `frontend/nextjs/public/workbox-f1770938.js` |

## R

> 类 R (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| R | class | `frontend/nextjs/public/workbox-f1770938.js` |

## A

> 类 A (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| A | class | `frontend/nextjs/public/workbox-f1770938.js` |

## F

> 类 F (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| F | class | `frontend/nextjs/public/workbox-f1770938.js` |

## G

> 类 G (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| G | class | `frontend/nextjs/public/workbox-f1770938.js` |

## V

> 类 V (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| V | class | `frontend/nextjs/public/workbox-f1770938.js` |

## Y

> 类 Y (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Y | class | `frontend/nextjs/public/workbox-f1770938.js` |

## Z

> 类 Z (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Z | class | `frontend/nextjs/public/workbox-f1770938.js` |

## et

> 类 et (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| et | class | `frontend/nextjs/public/workbox-f1770938.js` |

## V

> 类 V (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| V | class | `frontend/nextjs/public/workbox-f1770938.js` |

## Z

> 类 Z (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Z | class | `frontend/nextjs/public/workbox-f1770938.js` |

## et

> 类 et (L1-L1)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| et | class | `frontend/nextjs/public/workbox-f1770938.js` |

## GPTResearcher

> 类 GPTResearcher (L36-L739)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| GPTResearcher | class | `gpt_researcher/agent.py` |

## Config

> 类 Config (L19-L312)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Config | class | `gpt_researcher/config/config.py` |

## BaseConfig

> 类 BaseConfig (L5-L50)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| BaseConfig | class | `gpt_researcher/config/variables/base.py` |

## ContextCompressor

> 含组件 VectorstoreCompressor, async_get_context；类 ContextCompressor (L85-L178)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| VectorstoreCompressor | class | `gpt_researcher/context/compression.py` |
| ContextCompressor | class | `gpt_researcher/context/compression.py` |

## WrittenContentCompressor

> 类 WrittenContentCompressor (L181-L255)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| WrittenContentCompressor | class | `gpt_researcher/context/compression.py` |

## SearchAPIRetriever

> 类 SearchAPIRetriever (L10-L29)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SearchAPIRetriever | class | `gpt_researcher/context/retriever.py` |

## SectionRetriever

> 类 SectionRetriever (L31-L62)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SectionRetriever | class | `gpt_researcher/context/retriever.py` |

## AzureDocumentLoader

> 类 AzureDocumentLoader (L5-L22)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| AzureDocumentLoader | class | `gpt_researcher/document/azure_document_loader.py` |

## DocumentLoader

> 类 DocumentLoader (L16-L92)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| DocumentLoader | class | `gpt_researcher/document/document.py` |

## LangChainDocumentLoader

> 类 LangChainDocumentLoader (L10-L24)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| LangChainDocumentLoader | class | `gpt_researcher/document/langchain_document.py` |

## OnlineDocumentLoader

> 类 OnlineDocumentLoader (L15-L91)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| OnlineDocumentLoader | class | `gpt_researcher/document/online_document.py` |

## GenericLLMProvider

> 含组件 ChatLogger, log_request；含组件 ReasoningEfforts；类 GenericLLMProvider (L91-L313)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReasoningEfforts | class | `gpt_researcher/llm_provider/generic/base.py` |
| ChatLogger | class | `gpt_researcher/llm_provider/generic/base.py` |
| GenericLLMProvider | class | `gpt_researcher/llm_provider/generic/base.py` |

## ImageGeneratorProvider

> 类 ImageGeneratorProvider (L22-L440)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ImageGeneratorProvider | class | `gpt_researcher/llm_provider/image/image_generator.py` |

## MCPClientManager

> 类 MCPClientManager (L19-L179)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MCPClientManager | class | `gpt_researcher/mcp/client.py` |

## MCPResearchSkill

> 类 MCPResearchSkill (L13-L271)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MCPResearchSkill | class | `gpt_researcher/mcp/research.py` |

## MCPStreamer

> 类 MCPStreamer (L13-L102)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MCPStreamer | class | `gpt_researcher/mcp/streaming.py` |

## MCPToolSelector

> 类 MCPToolSelector (L14-L204)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MCPToolSelector | class | `gpt_researcher/mcp/tool_selector.py` |

## Memory

> 类 Memory (L55-L215)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Memory | class | `gpt_researcher/memory/embeddings.py` |

## PromptFamily

> 类 PromptFamily (L14-L749)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| PromptFamily | class | `gpt_researcher/prompts.py` |

## GranitePromptFamily

> 类 GranitePromptFamily (L752-L769)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| GranitePromptFamily | class | `gpt_researcher/prompts.py` |

## Granite3PromptFamily

> 类 Granite3PromptFamily (L772-L799)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Granite3PromptFamily | class | `gpt_researcher/prompts.py` |

## Granite33PromptFamily

> 类 Granite33PromptFamily (L802-L830)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Granite33PromptFamily | class | `gpt_researcher/prompts.py` |

## ArxivSearch

> 类 ArxivSearch (L4-L40)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ArxivSearch | class | `gpt_researcher/retrievers/arxiv/arxiv.py` |

## BingSearch

> 类 BingSearch (L10-L95)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| BingSearch | class | `gpt_researcher/retrievers/bing/bing.py` |

## BoChaSearch

> 类 BoChaSearch (L10-L58)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| BoChaSearch | class | `gpt_researcher/retrievers/bocha/bocha.py` |

## CustomRetriever

> 类 CustomRetriever (L6-L52)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| CustomRetriever | class | `gpt_researcher/retrievers/custom/custom.py` |

## Duckduckgo

> 类 Duckduckgo (L5-L29)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Duckduckgo | class | `gpt_researcher/retrievers/duckduckgo/duckduckgo.py` |

## ExaSearch

> 类 ExaSearch (L5-L101)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ExaSearch | class | `gpt_researcher/retrievers/exa/exa.py` |

## GoogleSearch

> 类 GoogleSearch (L9-L100)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| GoogleSearch | class | `gpt_researcher/retrievers/google/google.py` |

## MCPRetriever

> 类 MCPRetriever (L27-L324)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MCPRetriever | class | `gpt_researcher/retrievers/mcp/retriever.py` |

## PubMedCentralSearch

> 类 PubMedCentralSearch (L7-L152)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| PubMedCentralSearch | class | `gpt_researcher/retrievers/pubmed_central/pubmed_central.py` |

## SearchApiSearch

> 类 SearchApiSearch (L9-L84)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SearchApiSearch | class | `gpt_researcher/retrievers/searchapi/searchapi.py` |

## SearxSearch

> 类 SearxSearch (L8-L78)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SearxSearch | class | `gpt_researcher/retrievers/searx/searx.py` |

## SemanticScholarSearch

> 类 SemanticScholarSearch (L6-L59)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SemanticScholarSearch | class | `gpt_researcher/retrievers/semantic_scholar/semantic_scholar.py` |

## SerpApiSearch

> 类 SerpApiSearch (L9-L82)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SerpApiSearch | class | `gpt_researcher/retrievers/serpapi/serpapi.py` |

## SerperSearch

> 类 SerperSearch (L9-L130)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SerperSearch | class | `gpt_researcher/retrievers/serper/serper.py` |

## TavilySearch

> 类 TavilySearch (L14-L125)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TavilySearch | class | `gpt_researcher/retrievers/tavily/tavily_search.py` |

## ArxivScraper

> 类 ArxivScraper (L4-L28)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ArxivScraper | class | `gpt_researcher/scraper/arxiv/arxiv.py` |

## BeautifulSoupScraper

> 类 BeautifulSoupScraper (L6-L42)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| BeautifulSoupScraper | class | `gpt_researcher/scraper/beautiful_soup/beautiful_soup.py` |

## BrowserScraper

> 类 BrowserScraper (L24-L245)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| BrowserScraper | class | `gpt_researcher/scraper/browser/browser.py` |

## NoDriverScraper

> 类 NoDriverScraper (L16-L260)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| NoDriverScraper | class | `gpt_researcher/scraper/browser/nodriver_scraper.py` |

## Browser

> 类 Browser (L31-L134)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Browser | class | `gpt_researcher/scraper/browser/nodriver_scraper.py` |

## FireCrawl

> 类 FireCrawl (L5-L82)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| FireCrawl | class | `gpt_researcher/scraper/firecrawl/firecrawl.py` |

## PyMuPDFScraper

> 类 PyMuPDFScraper (L8-L80)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| PyMuPDFScraper | class | `gpt_researcher/scraper/pymupdf/pymupdf.py` |

## Scraper

> 类 Scraper (L30-L212)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Scraper | class | `gpt_researcher/scraper/scraper.py` |

## TavilyExtract

> 类 TavilyExtract (L5-L62)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TavilyExtract | class | `gpt_researcher/scraper/tavily_extract/tavily_extract.py` |

## WebBaseLoaderScraper

> 类 WebBaseLoaderScraper (L6-L43)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| WebBaseLoaderScraper | class | `gpt_researcher/scraper/web_base_loader/web_base_loader.py` |

## BrowserManager

> 类 BrowserManager (L14-L115)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| BrowserManager | class | `gpt_researcher/skills/browser.py` |

## ContextManager

> 类 ContextManager (L18-L154)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ContextManager | class | `gpt_researcher/skills/context_manager.py` |

## SourceCurator

> 类 SourceCurator (L15-L96)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| SourceCurator | class | `gpt_researcher/skills/curator.py` |

## DeepResearchSkill

> 含组件 ResearchProgress；类 DeepResearchSkill (L50-L427)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchProgress | class | `gpt_researcher/skills/deep_research.py` |
| DeepResearchSkill | class | `gpt_researcher/skills/deep_research.py` |

## ImageGenerator

> 类 ImageGenerator (L20-L767)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ImageGenerator | class | `gpt_researcher/skills/image_generator.py` |

## ResearchConductor

> 类 ResearchConductor (L21-L988)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchConductor | class | `gpt_researcher/skills/researcher.py` |

## ReportGenerator

> 类 ReportGenerator (L20-L254)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReportGenerator | class | `gpt_researcher/skills/writer.py` |

## ReportType

> 类 ReportType (L6-L27)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReportType | class | `gpt_researcher/utils/enum.py` |

## ReportSource

> 类 ReportSource (L30-L51)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReportSource | class | `gpt_researcher/utils/enum.py` |

## Tone

> 类 Tone (L54-L91)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Tone | class | `gpt_researcher/utils/enum.py` |

## PromptFamily

> 类 PromptFamily (L94-L101)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| PromptFamily | class | `gpt_researcher/utils/enum.py` |

## ColourizedFormatter

> 类 ColourizedFormatter (L40-L91)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ColourizedFormatter | class | `gpt_researcher/utils/logger.py` |

## DefaultFormatter

> 类 DefaultFormatter (L94-L96)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| DefaultFormatter | class | `gpt_researcher/utils/logger.py` |

## JSONResearchHandler

> 类 JSONResearchHandler (L7-L36)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| JSONResearchHandler | class | `gpt_researcher/utils/logging_config.py` |

## GlobalRateLimiter

> 类 GlobalRateLimiter (L13-L83)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| GlobalRateLimiter | class | `gpt_researcher/utils/rate_limiter.py` |

## Subtopic

> 类 Subtopic (L8-L14)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Subtopic | class | `gpt_researcher/utils/validators.py` |

## Subtopics

> 类 Subtopics (L17-L26)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| Subtopics | class | `gpt_researcher/utils/validators.py` |

## WorkerPool

> 类 WorkerPool (L8-L50)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| WorkerPool | class | `gpt_researcher/utils/workers.py` |

## VectorStoreWrapper

> 类 VectorStoreWrapper (L10-L43)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| VectorStoreWrapper | class | `gpt_researcher/vector_store/vector_store.py` |

## UserSchema

> 类 UserSchema (L5-L10)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| UserSchema | class | `json_schema_generator.py` |

## EditorAgent

> 类 EditorAgent (L13-L168)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| EditorAgent | class | `multi_agents/agents/editor.py` |

## HumanAgent

> 类 HumanAgent (L4-L52)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| HumanAgent | class | `multi_agents/agents/human.py` |

## ChiefEditorAgent

> 类 ChiefEditorAgent (L19-L118)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ChiefEditorAgent | class | `multi_agents/agents/orchestrator.py` |

## PublisherAgent

> 类 PublisherAgent (L9-L71)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| PublisherAgent | class | `multi_agents/agents/publisher.py` |

## ResearchAgent

> 类 ResearchAgent (L6-L58)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchAgent | class | `multi_agents/agents/researcher.py` |

## ReviewerAgent

> 类 ReviewerAgent (L9-L79)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReviewerAgent | class | `multi_agents/agents/reviewer.py` |

## ReviserAgent

> 类 ReviserAgent (L15-L74)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ReviserAgent | class | `multi_agents/agents/reviser.py` |

## AgentColor

> 类 AgentColor (L5-L12)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| AgentColor | class | `multi_agents/agents/utils/views.py` |

## WriterAgent

> 类 WriterAgent (L16-L142)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| WriterAgent | class | `multi_agents/agents/writer.py` |

## DraftState

> 类 DraftState (L5-L10)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| DraftState | class | `multi_agents/memory/draft.py` |

## ResearchState

> 类 ResearchState (L5-L19)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ResearchState | class | `multi_agents/memory/research.py` |

## EditorAgent

> 类 EditorAgent (L8-L89)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| EditorAgent | class | `multi_agents_ag2/agents/editor.py` |

## ChiefEditorAgent

> 类 ChiefEditorAgent (L20-L215)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| ChiefEditorAgent | class | `multi_agents_ag2/agents/orchestrator.py` |

## MockResearcher

> 类 MockResearcher (L19-L26)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MockResearcher | class | `tests/test-your-retriever.py` |

## TestWebSocket

> 类 TestWebSocket (L12-L26)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TestWebSocket | class | `tests/test_logging_output.py` |

## TestQuickSearch

> 类 TestQuickSearch (L7-L43)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TestQuickSearch | class | `tests/test_quick_search.py` |

## TestSecureFilename

> 类 TestSecureFilename (L28-L106)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TestSecureFilename | class | `tests/test_security_fix.py` |

## TestHandleFileUpload

> 含组件 TestValidateFilePath, test_valid_path, test_path_traversal_blocked, test_symlink_traversal_blocked；类 TestHandleFileUpload (L146-L245)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TestValidateFilePath | class | `tests/test_security_fix.py` |
| TestHandleFileUpload | class | `tests/test_security_fix.py` |

## TestHandleFileDeletion

> 含组件 MockDocumentLoader；类 TestHandleFileDeletion (L248-L299)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| MockDocumentLoader | class | `tests/test_security_fix.py` |
| MockDocumentLoader | class | `tests/test_security_fix.py` |
| TestHandleFileDeletion | class | `tests/test_security_fix.py` |

## TestSecurityIntegration

> 类 TestSecurityIntegration (L302-L347)，0 个方法

| 节点 | 类型 | 路径 |
|------|------|------|
| TestSecurityIntegration | class | `tests/test_security_fix.py` |
