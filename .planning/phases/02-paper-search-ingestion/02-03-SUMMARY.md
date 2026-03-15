---
phase: 02-paper-search-ingestion
plan: 03
status: completed
started: "2026-03-15"
completed: "2026-03-15"
duration_minutes: 25
---

# Plan 02-03 Summary: PDF Parsing Pipeline

## What Was Built

- **GROBID Docker service** in docker-compose.yml: image lfoppiano/grobid:0.8.1, 2GB heap (JAVA_OPTS=-Xmx2g), healthcheck on /api/isalive
- **GrobidClient**: async httpx wrapper for processFulltextDocument endpoint, 120s timeout, tenacity retry (2 attempts, 5s wait on timeout), is_alive health check
- **Section mapper** (`section_mapper.py`):
  - `parse_tei_to_sections`: extracts title, abstract, sections (heading+text+category), references (title+authors+year+doi) from TEI XML
  - `classify_section`: maps headings to standard categories (introduction, methodology, experiments, results, discussion, conclusion, related_work, other) with both English and Chinese keyword matching
  - `build_structured_content`: groups sections by category into methodology/experiments/results combined fields
- **ParserService**: orchestrates download PDF -> GROBID parse -> section mapping -> DB storage (parsed_content JSONB) -> optional SeaweedFS raw PDF upload
- **POST /papers/{paper_id}/parse**: trigger parsing for existing paper with pdf_url
- **POST /papers/parse-upload**: multipart PDF upload for ad-hoc parsing

## Key Decisions

- Raw httpx to GROBID (not grobid-client-python) -- simpler, fewer dependencies, more control over timeout/retry
- Section classification uses keyword matching (not ML) -- sufficient for well-structured academic PDFs
- Chinese heading support via separate keyword list (引言, 方法, 实验, 结果, 结论, etc.)
- SeaweedFS upload is non-fatal -- logs warning and skips if unavailable
- Parsing runs synchronously in request (TODO: move to Temporal workflow in Phase 5)

## Test Results

35 tests covering: TEI XML parsing (title, abstract, sections, references), section classification (English 8 cases, Chinese 5 cases), build_structured_content, GrobidClient (process_pdf, is_alive true/false), ParserService (success, GROBID failure, download failure, parse_from_bytes)

## Files Created/Modified

- `infra/docker-compose.yml` (modified -- added GROBID service)
- `backend/app/services/pdf_parser/__init__.py` (new)
- `backend/app/services/pdf_parser/grobid_client.py` (new)
- `backend/app/services/pdf_parser/section_mapper.py` (new)
- `backend/app/services/pdf_parser/parser_service.py` (new)
- `backend/app/routers/papers.py` (new)
- `backend/app/config.py` (modified -- added grobid_url)
- `backend/tests/test_pdf_parser.py` (new)
