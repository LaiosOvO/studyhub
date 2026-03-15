# gpt-researcher — 项目概览

> generated_by: refindex-v2
> generated_at: 2026-03-15
> provenance: AST-backed via Tree-sitter

## 基本信息

| 指标 | 值 |
|------|------|
| 语言 | javascript, python, tsx, typescript |
| 文件数 | 281 |
| 代码行数 | 32896 |
| 解析错误 | 0 |

## 模块结构

| 模块 | 路径 | 语言 | 行数 |
|------|------|------|------|
| backend | `backend/__init__.py` | python | 1 |
| chat | `backend/chat/__init__.py` | python | 3 |
| chat | `backend/chat/chat.py` | python | 259 |
| memory | `backend/memory/__init__.py` | python | 1 |
| draft | `backend/memory/draft.py` | python | 10 |
| research | `backend/memory/research.py` | python | 21 |
| report_type | `backend/report_type/__init__.py` | python | 7 |
| basic_report | `backend/report_type/basic_report/__init__.py` | python | 1 |
| basic_report | `backend/report_type/basic_report/basic_report.py` | python | 76 |
| deep_research | `backend/report_type/deep_research/__init__.py` | python | 1 |
| example | `backend/report_type/deep_research/example.py` | python | 324 |
| main | `backend/report_type/deep_research/main.py` | python | 33 |
| detailed_report | `backend/report_type/detailed_report/__init__.py` | python | 1 |
| detailed_report | `backend/report_type/detailed_report/detailed_report.py` | python | 190 |
| run_server | `backend/run_server.py` | python | 31 |
| server | `backend/server/__init__.py` | python | 1 |
| app | `backend/server/app.py` | python | 454 |
| logging_config | `backend/server/logging_config.py` | python | 83 |
| multi_agent_runner | `backend/server/multi_agent_runner.py` | python | 34 |
| report_store | `backend/server/report_store.py` | python | 58 |
| server_utils | `backend/server/server_utils.py` | python | 413 |
| websocket_manager | `backend/server/websocket_manager.py` | python | 188 |
| utils | `backend/utils.py` | python | 130 |
| cli | `cli.py` | python | 217 |
| config | `docs/babel.config.js` | javascript | 4 |
| ask | `docs/discord-bot/commands/ask.js` | javascript | 11 |
| deploy-commands | `docs/discord-bot/deploy-commands.js` | javascript | 33 |
| gptr-webhook | `docs/discord-bot/gptr-webhook.js` | javascript | 92 |
| index | `docs/discord-bot/index.js` | javascript | 170 |
| server | `docs/discord-bot/server.js` | javascript | 29 |
| custom_prompt | `docs/docs/examples/custom_prompt.py` | python | 74 |
| sample_report | `docs/docs/examples/sample_report.py` | python | 47 |
| sample_sources_only | `docs/docs/examples/sample_sources_only.py` | python | 21 |
| config | `docs/docusaurus.config.js` | javascript | 135 |
| index | `docs/npm/index.js` | javascript | 123 |
| sidebars | `docs/sidebars.js` | javascript | 142 |
| HomepageFeatures | `docs/src/components/HomepageFeatures.js` | javascript | 79 |
| index | `docs/src/pages/index.js` | javascript | 41 |
| evals | `evals/__init__.py` | python | 1 |
| evaluate | `evals/hallucination_eval/evaluate.py` | python | 74 |
| run_eval | `evals/hallucination_eval/run_eval.py` | python | 229 |
| simple_evals | `evals/simple_evals/__init__.py` | python | 1 |
| run_eval | `evals/simple_evals/run_eval.py` | python | 196 |
| simpleqa_eval | `evals/simple_evals/simpleqa_eval.py` | python | 172 |
| apiActions | `frontend/nextjs/actions/apiActions.ts` | typescript | 108 |
| route | `frontend/nextjs/app/api/chat/route.ts` | typescript | 38 |
| route | `frontend/nextjs/app/api/reports/[id]/chat/route.ts` | typescript | 79 |
| route | `frontend/nextjs/app/api/reports/[id]/route.ts` | typescript | 116 |
| route | `frontend/nextjs/app/api/reports/route.ts` | typescript | 112 |
| layout | `frontend/nextjs/app/layout.tsx` | tsx | 82 |
| page | `frontend/nextjs/app/page.tsx` | tsx | 1017 |
| page | `frontend/nextjs/app/research/[id]/page.tsx` | tsx | 594 |
| Footer | `frontend/nextjs/components/Footer.tsx` | tsx | 82 |
| Header | `frontend/nextjs/components/Header.tsx` | tsx | 61 |
| Hero | `frontend/nextjs/components/Hero.tsx` | tsx | 285 |
| HumanFeedback | `frontend/nextjs/components/HumanFeedback.tsx` | tsx | 44 |
| ImageModal | `frontend/nextjs/components/Images/ImageModal.tsx` | tsx | 95 |
| ImagesAlbum | `frontend/nextjs/components/Images/ImagesAlbum.tsx` | tsx | 82 |
| Langgraph | `frontend/nextjs/components/Langgraph/Langgraph.js` | javascript | 49 |
| LoadingDots | `frontend/nextjs/components/LoadingDots.tsx` | tsx | 15 |
| AccessReport | `frontend/nextjs/components/ResearchBlocks/AccessReport.tsx` | tsx | 109 |
| ChatInterface | `frontend/nextjs/components/ResearchBlocks/ChatInterface.tsx` | tsx | 221 |
| ChatResponse | `frontend/nextjs/components/ResearchBlocks/ChatResponse.tsx` | tsx | 119 |
| ImageSection | `frontend/nextjs/components/ResearchBlocks/ImageSection.tsx` | tsx | 42 |
| LogsSection | `frontend/nextjs/components/ResearchBlocks/LogsSection.tsx` | tsx | 44 |
| Question | `frontend/nextjs/components/ResearchBlocks/Question.tsx` | tsx | 29 |
| Report | `frontend/nextjs/components/ResearchBlocks/Report.tsx` | tsx | 82 |
| Sources | `frontend/nextjs/components/ResearchBlocks/Sources.tsx` | tsx | 80 |
| ChatInput | `frontend/nextjs/components/ResearchBlocks/elements/ChatInput.tsx` | tsx | 150 |
| InputArea | `frontend/nextjs/components/ResearchBlocks/elements/InputArea.tsx` | tsx | 168 |
| LogMessage | `frontend/nextjs/components/ResearchBlocks/elements/LogMessage.tsx` | tsx | 87 |
| SourceCard | `frontend/nextjs/components/ResearchBlocks/elements/SourceCard.tsx` | tsx | 53 |
| SubQuestions | `frontend/nextjs/components/ResearchBlocks/elements/SubQuestions.tsx` | tsx | 42 |
| ResearchResults | `frontend/nextjs/components/ResearchResults.tsx` | tsx | 87 |
| ResearchSidebar | `frontend/nextjs/components/ResearchSidebar.tsx` | tsx | 276 |
| ChatBox | `frontend/nextjs/components/Settings/ChatBox.tsx` | tsx | 54 |
| FileUpload | `frontend/nextjs/components/Settings/FileUpload.tsx` | tsx | 81 |
| LayoutSelector | `frontend/nextjs/components/Settings/LayoutSelector.tsx` | tsx | 25 |
| MCPSelector | `frontend/nextjs/components/Settings/MCPSelector.tsx` | tsx | 398 |
| Modal | `frontend/nextjs/components/Settings/Modal.tsx` | tsx | 196 |
| ToneSelector | `frontend/nextjs/components/Settings/ToneSelector.tsx` | tsx | 39 |
| SimilarTopics | `frontend/nextjs/components/SimilarTopics.tsx` | tsx | 74 |
| Accordion | `frontend/nextjs/components/Task/Accordion.tsx` | tsx | 135 |
| AgentLogs | `frontend/nextjs/components/Task/AgentLogs.tsx` | tsx | 16 |
| DomainFilter | `frontend/nextjs/components/Task/DomainFilter.tsx` | tsx | 64 |
| Report | `frontend/nextjs/components/Task/Report.tsx` | tsx | 32 |
| ResearchForm | `frontend/nextjs/components/Task/ResearchForm.tsx` | tsx | 179 |
| TypeAnimation | `frontend/nextjs/components/TypeAnimation.tsx` | tsx | 12 |
| CopilotLayout | `frontend/nextjs/components/layouts/CopilotLayout.tsx` | tsx | 69 |
| MobileLayout | `frontend/nextjs/components/layouts/MobileLayout.tsx` | tsx | 401 |
| ResearchPageLayout | `frontend/nextjs/components/layouts/ResearchPageLayout.tsx` | tsx | 86 |
| MobileChatPanel | `frontend/nextjs/components/mobile/MobileChatPanel.tsx` | tsx | 634 |
| MobileHomeScreen | `frontend/nextjs/components/mobile/MobileHomeScreen.tsx` | tsx | 315 |
| MobileResearchContent | `frontend/nextjs/components/mobile/MobileResearchContent.tsx` | tsx | 308 |
| CopilotPanel | `frontend/nextjs/components/research/CopilotPanel.tsx` | tsx | 229 |
| CopilotResearchContent | `frontend/nextjs/components/research/CopilotResearchContent.tsx` | tsx | 340 |
| NotFoundContent | `frontend/nextjs/components/research/NotFoundContent.tsx` | tsx | 27 |
| ResearchContent | `frontend/nextjs/components/research/ResearchContent.tsx` | tsx | 123 |
| ResearchPanel | `frontend/nextjs/components/research/ResearchPanel.tsx` | tsx | 181 |
| task | `frontend/nextjs/config/task.ts` | typescript | 37 |
| findDifferences | `frontend/nextjs/helpers/findDifferences.ts` | typescript | 48 |
| getHost | `frontend/nextjs/helpers/getHost.ts` | typescript | 28 |
| markdownHelper | `frontend/nextjs/helpers/markdownHelper.ts` | typescript | 58 |
| ResearchHistoryContext | `frontend/nextjs/hooks/ResearchHistoryContext.tsx` | tsx | 44 |
| useAnalytics | `frontend/nextjs/hooks/useAnalytics.ts` | typescript | 38 |
| useResearchHistory | `frontend/nextjs/hooks/useResearchHistory.ts` | typescript | 503 |
| useScrollHandler | `frontend/nextjs/hooks/useScrollHandler.ts` | typescript | 53 |
| useWebSocket | `frontend/nextjs/hooks/useWebSocket.ts` | typescript | 153 |
| config | `frontend/nextjs/next.config.mjs` | javascript | 38 |
| config | `frontend/nextjs/postcss.config.mjs` | javascript | 9 |
| embed | `frontend/nextjs/public/embed.js` | javascript | 68 |
| sw | `frontend/nextjs/public/sw.js` | javascript | 2 |
| workbox-f1770938 | `frontend/nextjs/public/workbox-f1770938.js` | javascript | 2 |
| config | `frontend/nextjs/rollup.config.js` | javascript | 84 |
| GPTResearcher | `frontend/nextjs/src/GPTResearcher.tsx` | tsx | 375 |
| d | `frontend/nextjs/src/index.d.ts` | typescript | 13 |
| index | `frontend/nextjs/src/index.ts` | typescript | 5 |
| imageTransformPlugin | `frontend/nextjs/src/utils/imageTransformPlugin.js` | javascript | 16 |
| config | `frontend/nextjs/tailwind.config.ts` | typescript | 67 |
| data | `frontend/nextjs/types/data.ts` | typescript | 71 |
| d | `frontend/nextjs/types/react-ga4.d.ts` | typescript | 28 |
| consolidateBlocks | `frontend/nextjs/utils/consolidateBlocks.ts` | typescript | 35 |
| dataProcessing | `frontend/nextjs/utils/dataProcessing.ts` | typescript | 129 |
| getLayout | `frontend/nextjs/utils/getLayout.tsx` | tsx | 116 |
| scripts | `frontend/scripts.js` | javascript | 2470 |
| gpt_researcher | `gpt_researcher/__init__.py` | python | 3 |
| actions | `gpt_researcher/actions/__init__.py` | python | 27 |
| agent_creator | `gpt_researcher/actions/agent_creator.py` | python | 127 |
| markdown_processing | `gpt_researcher/actions/markdown_processing.py` | python | 112 |
| query_processing | `gpt_researcher/actions/query_processing.py` | python | 170 |
| report_generation | `gpt_researcher/actions/report_generation.py` | python | 310 |
| retriever | `gpt_researcher/actions/retriever.py` | python | 147 |
| utils | `gpt_researcher/actions/utils.py` | python | 163 |
| web_scraping | `gpt_researcher/actions/web_scraping.py` | python | 102 |
| agent | `gpt_researcher/agent.py` | python | 740 |
| config | `gpt_researcher/config/__init__.py` | python | 6 |
| config | `gpt_researcher/config/config.py` | python | 313 |
| variables | `gpt_researcher/config/variables/__init__.py` | python | 1 |
| base | `gpt_researcher/config/variables/base.py` | python | 51 |
| default | `gpt_researcher/config/variables/default.py` | python | 55 |
| context | `gpt_researcher/context/__init__.py` | python | 5 |
| compression | `gpt_researcher/context/compression.py` | python | 256 |
| retriever | `gpt_researcher/context/retriever.py` | python | 62 |
| document | `gpt_researcher/document/__init__.py` | python | 6 |
| azure_document_loader | `gpt_researcher/document/azure_document_loader.py` | python | 22 |
| document | `gpt_researcher/document/document.py` | python | 93 |
| langchain_document | `gpt_researcher/document/langchain_document.py` | python | 25 |
| online_document | `gpt_researcher/document/online_document.py` | python | 92 |
| llm_provider | `gpt_researcher/llm_provider/__init__.py` | python | 8 |
| generic | `gpt_researcher/llm_provider/generic/__init__.py` | python | 3 |
| base | `gpt_researcher/llm_provider/generic/base.py` | python | 335 |
| image | `gpt_researcher/llm_provider/image/__init__.py` | python | 6 |
| image_generator | `gpt_researcher/llm_provider/image/image_generator.py` | python | 441 |
| mcp | `gpt_researcher/mcp/__init__.py` | python | 43 |
| client | `gpt_researcher/mcp/client.py` | python | 180 |
| research | `gpt_researcher/mcp/research.py` | python | 271 |
| streaming | `gpt_researcher/mcp/streaming.py` | python | 102 |
| tool_selector | `gpt_researcher/mcp/tool_selector.py` | python | 204 |
| memory | `gpt_researcher/memory/__init__.py` | python | 2 |
| embeddings | `gpt_researcher/memory/embeddings.py` | python | 216 |
| prompts | `gpt_researcher/prompts.py` | python | 900 |
| retrievers | `gpt_researcher/retrievers/__init__.py` | python | 34 |
| arxiv | `gpt_researcher/retrievers/arxiv/__init__.py` | python | 1 |
| arxiv | `gpt_researcher/retrievers/arxiv/arxiv.py` | python | 40 |
| bing | `gpt_researcher/retrievers/bing/__init__.py` | python | 1 |
| bing | `gpt_researcher/retrievers/bing/bing.py` | python | 96 |
| bocha | `gpt_researcher/retrievers/bocha/__init__.py` | python | 1 |
| bocha | `gpt_researcher/retrievers/bocha/bocha.py` | python | 58 |
| custom | `gpt_researcher/retrievers/custom/__init__.py` | python | 1 |
| custom | `gpt_researcher/retrievers/custom/custom.py` | python | 52 |
| duckduckgo | `gpt_researcher/retrievers/duckduckgo/__init__.py` | python | 1 |
| duckduckgo | `gpt_researcher/retrievers/duckduckgo/duckduckgo.py` | python | 30 |
| exa | `gpt_researcher/retrievers/exa/__init__.py` | python | 1 |
| exa | `gpt_researcher/retrievers/exa/exa.py` | python | 102 |
| google | `gpt_researcher/retrievers/google/__init__.py` | python | 1 |
| google | `gpt_researcher/retrievers/google/google.py` | python | 101 |
| mcp | `gpt_researcher/retrievers/mcp/__init__.py` | python | 32 |
| retriever | `gpt_researcher/retrievers/mcp/retriever.py` | python | 324 |
| pubmed_central | `gpt_researcher/retrievers/pubmed_central/__init__.py` | python | 1 |
| pubmed_central | `gpt_researcher/retrievers/pubmed_central/pubmed_central.py` | python | 152 |
| searchapi | `gpt_researcher/retrievers/searchapi/__init__.py` | python | 1 |
| searchapi | `gpt_researcher/retrievers/searchapi/searchapi.py` | python | 85 |
| searx | `gpt_researcher/retrievers/searx/__init__.py` | python | 1 |
| searx | `gpt_researcher/retrievers/searx/searx.py` | python | 79 |
| semantic_scholar | `gpt_researcher/retrievers/semantic_scholar/__init__.py` | python | 1 |
| semantic_scholar | `gpt_researcher/retrievers/semantic_scholar/semantic_scholar.py` | python | 60 |
| serpapi | `gpt_researcher/retrievers/serpapi/__init__.py` | python | 1 |
| serpapi | `gpt_researcher/retrievers/serpapi/serpapi.py` | python | 83 |
| serper | `gpt_researcher/retrievers/serper/__init__.py` | python | 1 |
| serper | `gpt_researcher/retrievers/serper/serper.py` | python | 131 |
| tavily | `gpt_researcher/retrievers/tavily/__init__.py` | python | 1 |
| tavily_search | `gpt_researcher/retrievers/tavily/tavily_search.py` | python | 126 |
| utils | `gpt_researcher/retrievers/utils.py` | python | 102 |
| scraper | `gpt_researcher/scraper/__init__.py` | python | 22 |
| arxiv | `gpt_researcher/scraper/arxiv/__init__.py` | python | 1 |
| arxiv | `gpt_researcher/scraper/arxiv/arxiv.py` | python | 29 |
| beautiful_soup | `gpt_researcher/scraper/beautiful_soup/__init__.py` | python | 1 |
| beautiful_soup | `gpt_researcher/scraper/beautiful_soup/beautiful_soup.py` | python | 42 |
| browser | `gpt_researcher/scraper/browser/__init__.py` | python | 1 |
| browser | `gpt_researcher/scraper/browser/browser.py` | python | 246 |
| overlay | `gpt_researcher/scraper/browser/js/overlay.js` | javascript | 30 |
| nodriver_scraper | `gpt_researcher/scraper/browser/nodriver_scraper.py` | python | 261 |
| processing | `gpt_researcher/scraper/browser/processing/__init__.py` | python | 1 |
| html | `gpt_researcher/scraper/browser/processing/html.py` | python | 34 |
| scrape_skills | `gpt_researcher/scraper/browser/processing/scrape_skills.py` | python | 31 |
| firecrawl | `gpt_researcher/scraper/firecrawl/__init__.py` | python | 1 |
| firecrawl | `gpt_researcher/scraper/firecrawl/firecrawl.py` | python | 83 |
| pymupdf | `gpt_researcher/scraper/pymupdf/__init__.py` | python | 1 |
| pymupdf | `gpt_researcher/scraper/pymupdf/pymupdf.py` | python | 81 |
| scraper | `gpt_researcher/scraper/scraper.py` | python | 213 |
| tavily_extract | `gpt_researcher/scraper/tavily_extract/__init__.py` | python | 1 |
| tavily_extract | `gpt_researcher/scraper/tavily_extract/tavily_extract.py` | python | 62 |
| utils | `gpt_researcher/scraper/utils.py` | python | 132 |
| web_base_loader | `gpt_researcher/scraper/web_base_loader/__init__.py` | python | 1 |
| web_base_loader | `gpt_researcher/scraper/web_base_loader/web_base_loader.py` | python | 44 |
| skills | `gpt_researcher/skills/__init__.py` | python | 16 |
| browser | `gpt_researcher/skills/browser.py` | python | 116 |
| context_manager | `gpt_researcher/skills/context_manager.py` | python | 155 |
| curator | `gpt_researcher/skills/curator.py` | python | 97 |
| deep_research | `gpt_researcher/skills/deep_research.py` | python | 427 |
| image_generator | `gpt_researcher/skills/image_generator.py` | python | 768 |
| researcher | `gpt_researcher/skills/researcher.py` | python | 990 |
| writer | `gpt_researcher/skills/writer.py` | python | 255 |
| utils | `gpt_researcher/utils/__init__.py` | python | 1 |
| costs | `gpt_researcher/utils/costs.py` | python | 52 |
| enum | `gpt_researcher/utils/enum.py` | python | 102 |
| llm | `gpt_researcher/utils/llm.py` | python | 200 |
| logger | `gpt_researcher/utils/logger.py` | python | 97 |
| logging_config | `gpt_researcher/utils/logging_config.py` | python | 83 |
| rate_limiter | `gpt_researcher/utils/rate_limiter.py` | python | 93 |
| tools | `gpt_researcher/utils/tools.py` | python | 318 |
| validators | `gpt_researcher/utils/validators.py` | python | 27 |
| workers | `gpt_researcher/utils/workers.py` | python | 51 |
| vector_store | `gpt_researcher/vector_store/__init__.py` | python | 3 |
| vector_store | `gpt_researcher/vector_store/vector_store.py` | python | 44 |
| json_schema_generator | `json_schema_generator.py` | python | 44 |
| main | `main.py` | python | 38 |
| multi_agents | `multi_agents/__init__.py` | python | 27 |
| agent | `multi_agents/agent.py` | python | 16 |
| agents | `multi_agents/agents/__init__.py` | python | 22 |
| editor | `multi_agents/agents/editor.py` | python | 169 |
| human | `multi_agents/agents/human.py` | python | 53 |
| orchestrator | `multi_agents/agents/orchestrator.py` | python | 119 |
| publisher | `multi_agents/agents/publisher.py` | python | 72 |
| researcher | `multi_agents/agents/researcher.py` | python | 58 |
| reviewer | `multi_agents/agents/reviewer.py` | python | 80 |
| reviser | `multi_agents/agents/reviser.py` | python | 75 |
| utils | `multi_agents/agents/utils/__init__.py` | python | 1 |
| file_formats | `multi_agents/agents/utils/file_formats.py` | python | 105 |
| llms | `multi_agents/agents/utils/llms.py` | python | 37 |
| utils | `multi_agents/agents/utils/utils.py` | python | 27 |
| views | `multi_agents/agents/utils/views.py` | python | 16 |
| writer | `multi_agents/agents/writer.py` | python | 143 |
| main | `multi_agents/main.py` | python | 62 |
| memory | `multi_agents/memory/__init__.py` | python | 7 |
| draft | `multi_agents/memory/draft.py` | python | 10 |
| research | `multi_agents/memory/research.py` | python | 22 |
| multi_agents_ag2 | `multi_agents_ag2/__init__.py` | python | 2 |
| agents | `multi_agents_ag2/agents/__init__.py` | python | 21 |
| editor | `multi_agents_ag2/agents/editor.py` | python | 90 |
| orchestrator | `multi_agents_ag2/agents/orchestrator.py` | python | 216 |
| main | `multi_agents_ag2/main.py` | python | 61 |
| setup | `setup.py` | python | 48 |
| tests | `tests/__init__.py` | python | 1 |
| documents-report-source | `tests/documents-report-source.py` | python | 55 |
| gptr-logs-handler | `tests/gptr-logs-handler.py` | python | 35 |
| report-types | `tests/report-types.py` | python | 48 |
| research_test | `tests/research_test.py` | python | 111 |
| test-loaders | `tests/test-loaders.py` | python | 17 |
| test-openai-llm | `tests/test-openai-llm.py` | python | 31 |
| test-your-embeddings | `tests/test-your-embeddings.py` | python | 56 |
| test-your-llm | `tests/test-your-llm.py` | python | 24 |
| test-your-retriever | `tests/test-your-retriever.py` | python | 49 |
| test_logging | `tests/test_logging.py` | python | 61 |
| test_logging_output | `tests/test_logging_output.py` | python | 63 |
| test_logs | `tests/test_logs.py` | python | 48 |
| test_mcp | `tests/test_mcp.py` | python | 269 |
| test_quick_search | `tests/test_quick_search.py` | python | 47 |
| test_researcher_logging | `tests/test_researcher_logging.py` | python | 71 |
| test_security_fix | `tests/test_security_fix.py` | python | 352 |
| vector-store | `tests/vector-store.py` | python | 237 |

## 关键类

| 类名 | 文件 | 行范围 |
|------|------|--------|
| ChatAgentWithMemory | `backend/chat/chat.py` | L55-L258 |
| DraftState | `backend/memory/draft.py` | L5-L10 |
| ResearchState | `backend/memory/research.py` | L5-L18 |
| BasicReport | `backend/report_type/basic_report/basic_report.py` | L9-L75 |
| ResearchProgress | `backend/report_type/deep_research/example.py` | L17-L25 |
| DeepResearch | `backend/report_type/deep_research/example.py` | L27-L324 |
| DetailedReport | `backend/report_type/detailed_report/detailed_report.py` | L10-L189 |
| ResearchRequest | `backend/server/app.py` | L52-L60 |
| ChatRequest | `backend/server/app.py` | L63-L67 |
| JSONResearchHandler | `backend/server/logging_config.py` | L7-L36 |
| ReportStore | `backend/server/report_store.py` | L7-L57 |
| CustomLogsHandler | `backend/server/server_utils.py` | L33-L79 |
| Researcher | `backend/server/server_utils.py` | L82-L113 |
| WebSocketManager | `backend/server/websocket_manager.py` | L19-L112 |
| GPTResearcher | `docs/npm/index.js` | L4-L121 |
| HallucinationEvaluator | `evals/hallucination_eval/evaluate.py` | L18-L53 |
| ResearchEvaluator | `evals/hallucination_eval/run_eval.py` | L34-L144 |
| SimpleQAEval | `evals/simple_evals/simpleqa_eval.py` | L101-L172 |
| s | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| r | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| i | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| a | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| y | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| v | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| R | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| A | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| F | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| G | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| V | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| Y | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| Z | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| et | `frontend/nextjs/public/workbox-f1770938.js` | L1-L1 |
| GPTResearcher | `gpt_researcher/agent.py` | L36-L739 |
| Config | `gpt_researcher/config/config.py` | L19-L312 |
| BaseConfig | `gpt_researcher/config/variables/base.py` | L5-L50 |
| VectorstoreCompressor | `gpt_researcher/context/compression.py` | L36-L82 |
| ContextCompressor | `gpt_researcher/context/compression.py` | L85-L178 |
| WrittenContentCompressor | `gpt_researcher/context/compression.py` | L181-L255 |
| SearchAPIRetriever | `gpt_researcher/context/retriever.py` | L10-L29 |
| SectionRetriever | `gpt_researcher/context/retriever.py` | L31-L62 |
| AzureDocumentLoader | `gpt_researcher/document/azure_document_loader.py` | L5-L22 |
| DocumentLoader | `gpt_researcher/document/document.py` | L16-L92 |
| LangChainDocumentLoader | `gpt_researcher/document/langchain_document.py` | L10-L24 |
| OnlineDocumentLoader | `gpt_researcher/document/online_document.py` | L15-L91 |
| ReasoningEfforts | `gpt_researcher/llm_provider/generic/base.py` | L67-L70 |
| ChatLogger | `gpt_researcher/llm_provider/generic/base.py` | L73-L89 |
| GenericLLMProvider | `gpt_researcher/llm_provider/generic/base.py` | L91-L313 |
| ImageGeneratorProvider | `gpt_researcher/llm_provider/image/image_generator.py` | L22-L440 |
| MCPClientManager | `gpt_researcher/mcp/client.py` | L19-L179 |
| MCPResearchSkill | `gpt_researcher/mcp/research.py` | L13-L271 |
| MCPStreamer | `gpt_researcher/mcp/streaming.py` | L13-L102 |
| MCPToolSelector | `gpt_researcher/mcp/tool_selector.py` | L14-L204 |
| Memory | `gpt_researcher/memory/embeddings.py` | L55-L215 |
| PromptFamily | `gpt_researcher/prompts.py` | L14-L749 |
| GranitePromptFamily | `gpt_researcher/prompts.py` | L752-L769 |
| Granite3PromptFamily | `gpt_researcher/prompts.py` | L772-L799 |
| Granite33PromptFamily | `gpt_researcher/prompts.py` | L802-L830 |
| ArxivSearch | `gpt_researcher/retrievers/arxiv/arxiv.py` | L4-L40 |
| BingSearch | `gpt_researcher/retrievers/bing/bing.py` | L10-L95 |
| BoChaSearch | `gpt_researcher/retrievers/bocha/bocha.py` | L10-L58 |
| CustomRetriever | `gpt_researcher/retrievers/custom/custom.py` | L6-L52 |
| Duckduckgo | `gpt_researcher/retrievers/duckduckgo/duckduckgo.py` | L5-L29 |
| ExaSearch | `gpt_researcher/retrievers/exa/exa.py` | L5-L101 |
| GoogleSearch | `gpt_researcher/retrievers/google/google.py` | L9-L100 |
| MCPRetriever | `gpt_researcher/retrievers/mcp/retriever.py` | L27-L324 |
| PubMedCentralSearch | `gpt_researcher/retrievers/pubmed_central/pubmed_central.py` | L7-L152 |
| SearchApiSearch | `gpt_researcher/retrievers/searchapi/searchapi.py` | L9-L84 |
| SearxSearch | `gpt_researcher/retrievers/searx/searx.py` | L8-L78 |
| SemanticScholarSearch | `gpt_researcher/retrievers/semantic_scholar/semantic_scholar.py` | L6-L59 |
| SerpApiSearch | `gpt_researcher/retrievers/serpapi/serpapi.py` | L9-L82 |
| SerperSearch | `gpt_researcher/retrievers/serper/serper.py` | L9-L130 |
| TavilySearch | `gpt_researcher/retrievers/tavily/tavily_search.py` | L14-L125 |
| ArxivScraper | `gpt_researcher/scraper/arxiv/arxiv.py` | L4-L28 |
| BeautifulSoupScraper | `gpt_researcher/scraper/beautiful_soup/beautiful_soup.py` | L6-L42 |
| BrowserScraper | `gpt_researcher/scraper/browser/browser.py` | L24-L245 |
| NoDriverScraper | `gpt_researcher/scraper/browser/nodriver_scraper.py` | L16-L260 |
| Browser | `gpt_researcher/scraper/browser/nodriver_scraper.py` | L31-L134 |
| FireCrawl | `gpt_researcher/scraper/firecrawl/firecrawl.py` | L5-L82 |
| PyMuPDFScraper | `gpt_researcher/scraper/pymupdf/pymupdf.py` | L8-L80 |
| Scraper | `gpt_researcher/scraper/scraper.py` | L30-L212 |
| TavilyExtract | `gpt_researcher/scraper/tavily_extract/tavily_extract.py` | L5-L62 |
| WebBaseLoaderScraper | `gpt_researcher/scraper/web_base_loader/web_base_loader.py` | L6-L43 |
| BrowserManager | `gpt_researcher/skills/browser.py` | L14-L115 |
| ContextManager | `gpt_researcher/skills/context_manager.py` | L18-L154 |
| SourceCurator | `gpt_researcher/skills/curator.py` | L15-L96 |
| ResearchProgress | `gpt_researcher/skills/deep_research.py` | L39-L47 |
| DeepResearchSkill | `gpt_researcher/skills/deep_research.py` | L50-L427 |
| ImageGenerator | `gpt_researcher/skills/image_generator.py` | L20-L767 |
| ResearchConductor | `gpt_researcher/skills/researcher.py` | L21-L988 |
| ReportGenerator | `gpt_researcher/skills/writer.py` | L20-L254 |
| ReportType | `gpt_researcher/utils/enum.py` | L6-L27 |
| ReportSource | `gpt_researcher/utils/enum.py` | L30-L51 |
| Tone | `gpt_researcher/utils/enum.py` | L54-L91 |
| PromptFamily | `gpt_researcher/utils/enum.py` | L94-L101 |
| ColourizedFormatter | `gpt_researcher/utils/logger.py` | L40-L91 |
| DefaultFormatter | `gpt_researcher/utils/logger.py` | L94-L96 |
| JSONResearchHandler | `gpt_researcher/utils/logging_config.py` | L7-L36 |
| GlobalRateLimiter | `gpt_researcher/utils/rate_limiter.py` | L13-L83 |
| Subtopic | `gpt_researcher/utils/validators.py` | L8-L14 |
| Subtopics | `gpt_researcher/utils/validators.py` | L17-L26 |
| WorkerPool | `gpt_researcher/utils/workers.py` | L8-L50 |
| VectorStoreWrapper | `gpt_researcher/vector_store/vector_store.py` | L10-L43 |
| UserSchema | `json_schema_generator.py` | L5-L10 |
| EditorAgent | `multi_agents/agents/editor.py` | L13-L168 |
| HumanAgent | `multi_agents/agents/human.py` | L4-L52 |
| ChiefEditorAgent | `multi_agents/agents/orchestrator.py` | L19-L118 |
| PublisherAgent | `multi_agents/agents/publisher.py` | L9-L71 |
| ResearchAgent | `multi_agents/agents/researcher.py` | L6-L58 |
| ReviewerAgent | `multi_agents/agents/reviewer.py` | L9-L79 |
| ReviserAgent | `multi_agents/agents/reviser.py` | L15-L74 |
| AgentColor | `multi_agents/agents/utils/views.py` | L5-L12 |
| WriterAgent | `multi_agents/agents/writer.py` | L16-L142 |
| DraftState | `multi_agents/memory/draft.py` | L5-L10 |
| ResearchState | `multi_agents/memory/research.py` | L5-L19 |
| EditorAgent | `multi_agents_ag2/agents/editor.py` | L8-L89 |
| ChiefEditorAgent | `multi_agents_ag2/agents/orchestrator.py` | L20-L215 |
| MockResearcher | `tests/test-your-retriever.py` | L19-L26 |
| TestWebSocket | `tests/test_logging_output.py` | L12-L26 |
| TestQuickSearch | `tests/test_quick_search.py` | L7-L43 |
| TestSecureFilename | `tests/test_security_fix.py` | L28-L106 |
| TestValidateFilePath | `tests/test_security_fix.py` | L109-L143 |
| TestHandleFileUpload | `tests/test_security_fix.py` | L146-L245 |
| MockDocumentLoader | `tests/test_security_fix.py` | L174-L178 |
| MockDocumentLoader | `tests/test_security_fix.py` | L230-L234 |
| TestHandleFileDeletion | `tests/test_security_fix.py` | L248-L299 |
| TestSecurityIntegration | `tests/test_security_fix.py` | L302-L347 |

## 依赖关系

共 996 条 import 关系。

### 目录间依赖

- `tests` → `gpt_researcher` (18 条)
- `backend` → `gpt_researcher` (16 条)
- `multi_agents_ag2` → `multi_agents` (16 条)
- `tests` → `backend` (10 条)
- `evals` → `gpt_researcher` (5 条)
- `multi_agents` → `gpt_researcher` (4 条)
- `.` → `backend` (3 条)
- `docs` → `gpt_researcher` (3 条)
- `.` → `gpt_researcher` (2 条)
- `backend` → `multi_agents` (1 条)
- `backend` → `multi_agents_ag2` (1 条)
- `multi_agents_ag2` → `gpt_researcher` (1 条)

## Git 热点文件

| 文件 | 变更次数 | 风险 |
|------|---------|------|
| `README.md` | 10 | medium |
| `gpt_researcher/agent.py` | 5 | medium |
| `backend/server/websocket_manager.py` | 4 | low |
| `gpt_researcher/skills/writer.py` | 4 | low |
| `backend/server/server_utils.py` | 4 | low |
| `docs/docs/gpt-researcher/gptr/image_generation.md` | 4 | low |
| `pyproject.toml` | 3 | low |
| `backend/report_type/basic_report/basic_report.py` | 3 | low |
| `backend/report_type/detailed_report/detailed_report.py` | 3 | low |
| `gpt_researcher/memory/embeddings.py` | 3 | low |
