# Phase 2: Paper Search & Ingestion - Research

**Researched:** 2026-03-15
**Domain:** Multi-source academic paper search, deduplication, full-text indexing, PDF parsing
**Confidence:** HIGH

## Summary

Phase 2 builds the paper data pipeline: four academic API clients (OpenAlex, Semantic Scholar, PubMed, arXiv) feed into a unified paper schema, which is deduplicated, indexed in Meilisearch for sub-second search, and optionally parsed from PDF into structured sections via GROBID. The existing FastAPI backend (httpx already installed) provides the async HTTP foundation. Meilisearch v1.12 is already running in Docker Compose with built-in Jieba Chinese tokenization -- no external tokenizer needed.

The reference projects gpt-researcher and MLE-agent both implement similar multi-source search patterns with simple httpx/requests clients per source, a common result schema, and fan-out/fan-in aggregation. This is a well-understood pattern.

**Primary recommendation:** Use httpx AsyncClient for all API calls (already a dependency), pyalex for OpenAlex convenience, meilisearch-python-sdk for async Meilisearch operations, and GROBID (Docker service) with grobid-client-python for PDF parsing. Avoid MinerU in Phase 2 -- it requires GPU and heavy dependencies; GROBID is lighter and production-proven.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | Search by keywords from OpenAlex, S2, PubMed, arXiv | Multi-source client pattern with unified PaperResult schema; all 4 APIs documented below |
| SRCH-02 | Search by title/DOI for specific paper | OpenAlex supports DOI lookup natively; S2 supports paperId/DOI; PubMed supports PMID; arXiv supports id_list |
| SRCH-03 | Search by author name | OpenAlex author filter; S2 author search endpoint; PubMed author[au] field; arXiv au: prefix |
| SRCH-04 | Deduplication across sources (DOI + fuzzy title/author) | Three-tier dedup: exact DOI match, normalized title+year match, fuzzy title similarity (>0.9) |
| SRCH-05 | Filter by year, citations, venue, language | Meilisearch filterable attributes + source API native filters |
| SRCH-06 | Sort by relevance, citations, recency, quality | Meilisearch sortable attributes + custom ranking rules |
| SRCH-07 | Chinese+English search with proper tokenization | Meilisearch v1.12 built-in Jieba tokenizer for CJK; no config needed |
| SRCH-08 | Paper metadata in Meilisearch for ms-level search | meilisearch-python-sdk AsyncClient for index management |
| PARS-01 | Extract full text from PDF via MinerU/GROBID | GROBID Docker service with processFulltextDocument endpoint |
| PARS-02 | Handle Chinese PDFs with OCR | GROBID handles multilingual; fallback to MinerU if GROBID fails on Chinese-only PDFs |
| PARS-03 | Structured sections: title, abstract, methodology, experiments, results, references | GROBID TEI XML output provides header, body sections, references; post-process to map sections |
| PARS-04 | Parsed papers stored for LLM analysis | PostgreSQL papers table + SeaweedFS for raw PDF; parsed_content JSONB column |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | >=0.28.0 | Async HTTP client for all API calls | Already in project deps; async-native; connection pooling |
| pyalex | >=0.14 | OpenAlex Python client | Official-ish wrapper; handles pagination, polite pool, API key |
| meilisearch-python-sdk | >=7.0.3 | Async Meilisearch client | Native async support; 30% faster than sync; matches FastAPI pattern |
| grobid-client-python | >=0.0.9 | GROBID REST client for PDF parsing | Official Python client; handles batch processing |
| rapidfuzz | >=3.0 | Fast fuzzy string matching for dedup | C++ core; 10x faster than fuzzywuzzy; ratio/partial_ratio |
| pydantic | >=2.10.0 | Paper schema validation | Already in project; strict validation at boundaries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tenacity | >=8.2 | Retry with exponential backoff | All external API calls; rate limit handling |
| asyncio.Semaphore | stdlib | Concurrency limiting | Fan-out to 4 sources simultaneously with per-source limits |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GROBID | MinerU | MinerU better for Chinese PDFs but requires GPU + 5GB+ models; use as Phase 3 fallback |
| pyalex | Raw httpx to OpenAlex | pyalex handles pagination/polite pool; saves boilerplate |
| rapidfuzz | python-Levenshtein | rapidfuzz is faster, MIT licensed, better API |
| meilisearch-python-sdk | meilisearch (official) | Official SDK is sync-only; async SDK matches FastAPI pattern |

**Installation:**
```bash
# Backend dependencies (add to pyproject.toml)
uv add pyalex meilisearch-python-sdk grobid-client-python rapidfuzz tenacity
```

**Docker addition (GROBID service in docker-compose.yml):**
```yaml
grobid:
  image: lfoppiano/grobid:0.8.1
  ports:
    - "8070:8070"
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:8070/api/isalive"]
    interval: 15s
    timeout: 10s
    retries: 5
    start_period: 30s
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── paper_search/
│   │   ├── __init__.py
│   │   ├── base_client.py       # Abstract base for all source clients
│   │   ├── openalex_client.py   # OpenAlex API client
│   │   ├── s2_client.py         # Semantic Scholar client
│   │   ├── pubmed_client.py     # PubMed/NCBI client
│   │   ├── arxiv_client.py      # arXiv API client
│   │   ├── aggregator.py        # Fan-out search + dedup + merge
│   │   └── deduplicator.py      # DOI + fuzzy title dedup logic
│   ├── search_index/
│   │   ├── __init__.py
│   │   ├── meilisearch_service.py  # Index CRUD, search, config
│   │   └── index_config.py      # Filterable/sortable attrs, ranking
│   └── pdf_parser/
│       ├── __init__.py
│       ├── grobid_client.py     # GROBID REST wrapper
│       ├── section_mapper.py    # TEI XML -> structured sections
│       └── parser_service.py    # Orchestrates download + parse + store
├── models/
│   └── paper.py                 # Paper SQLAlchemy model
├── schemas/
│   ├── paper.py                 # PaperResult, PaperCreate, PaperSearch Pydantic models
│   └── search.py                # SearchRequest, SearchResponse schemas
└── routers/
    ├── papers.py                # /api/papers endpoints
    └── search.py                # /api/search endpoints
```

### Pattern 1: Unified Paper Schema
**What:** All source clients return the same `PaperResult` Pydantic model regardless of source
**When to use:** Every source client maps its raw response to this common schema
**Example:**
```python
from pydantic import BaseModel
from enum import Enum

class PaperSource(str, Enum):
    OPENALEX = "openalex"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    PUBMED = "pubmed"
    ARXIV = "arxiv"

class PaperResult(BaseModel):
    """Unified paper representation across all sources."""
    # Identity
    doi: str | None = None
    openalex_id: str | None = None
    s2_id: str | None = None
    pmid: str | None = None
    arxiv_id: str | None = None

    # Metadata
    title: str
    abstract: str | None = None
    authors: list[str] = []
    year: int | None = None
    venue: str | None = None
    language: str | None = None

    # Metrics
    citation_count: int = 0
    pdf_url: str | None = None
    is_open_access: bool = False

    # Provenance
    sources: list[PaperSource] = []
```

### Pattern 2: Fan-Out Aggregator with Semaphore
**What:** Search all 4 sources concurrently, merge results, deduplicate
**When to use:** Every user search triggers this
**Example:**
```python
import asyncio
from typing import Sequence

async def search_all_sources(
    query: str,
    search_type: str = "keyword",
    max_per_source: int = 25,
) -> list[PaperResult]:
    """Fan out to all sources, gather, deduplicate."""
    clients = [openalex, s2, pubmed, arxiv]
    tasks = [
        client.search(query, search_type, max_per_source)
        for client in clients
    ]
    # asyncio.gather with return_exceptions=True for resilience
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_papers: list[PaperResult] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning(f"Source failed: {result}")
            continue
        all_papers.extend(result)

    return deduplicate(all_papers)
```

### Pattern 3: Three-Tier Deduplication
**What:** Merge duplicates found across sources using DOI, normalized title, then fuzzy match
**When to use:** After aggregating results from multiple sources
**Example:**
```python
from rapidfuzz import fuzz

def deduplicate(papers: list[PaperResult]) -> list[PaperResult]:
    """Three-tier dedup: DOI exact -> title+year exact -> fuzzy title."""
    seen_dois: dict[str, PaperResult] = {}
    seen_titles: dict[str, PaperResult] = {}  # normalized title+year key
    unique: list[PaperResult] = []

    for paper in papers:
        # Tier 1: Exact DOI match
        if paper.doi:
            normalized_doi = paper.doi.lower().strip()
            if normalized_doi in seen_dois:
                _merge_sources(seen_dois[normalized_doi], paper)
                continue
            seen_dois[normalized_doi] = paper

        # Tier 2: Normalized title + year
        title_key = _normalize_title(paper.title) + str(paper.year or "")
        if title_key in seen_titles:
            _merge_sources(seen_titles[title_key], paper)
            continue

        # Tier 3: Fuzzy title match against existing
        matched = False
        for existing in unique:
            if fuzz.ratio(paper.title.lower(), existing.title.lower()) > 90:
                _merge_sources(existing, paper)
                matched = True
                break

        if not matched:
            seen_titles[title_key] = paper
            unique.append(paper)

    return unique
```

### Pattern 4: Abstract Source Client
**What:** Base class enforcing interface contract for all source clients
**When to use:** Every source client inherits from this
**Example:**
```python
from abc import ABC, abstractmethod
import httpx

class BasePaperClient(ABC):
    """Base class for academic paper source clients."""

    def __init__(self, http_client: httpx.AsyncClient):
        self._client = http_client

    @abstractmethod
    async def search_keywords(self, query: str, limit: int = 25) -> list[PaperResult]:
        ...

    @abstractmethod
    async def search_doi(self, doi: str) -> PaperResult | None:
        ...

    @abstractmethod
    async def search_author(self, author: str, limit: int = 25) -> list[PaperResult]:
        ...
```

### Anti-Patterns to Avoid
- **Creating httpx.AsyncClient per request:** Share a single client with connection pooling across the app lifetime
- **Blocking PDF downloads in the request cycle:** PDF parse is slow; use Temporal workflow or background task
- **Storing raw API responses:** Always normalize to unified schema before persistence
- **Searching Meilisearch for every query without caching:** Use Valkey to cache hot queries (TTL 5min)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein | rapidfuzz | C++ optimized, handles Unicode, well-tested edge cases |
| PDF text extraction | Custom PDF parser | GROBID service | 15+ years of ML models for academic papers; handles tables, formulas, references |
| Full-text search engine | Custom inverted index | Meilisearch | Typo-tolerant, CJK tokenization, faceted filtering, millisecond response |
| Retry logic with backoff | Custom retry loops | tenacity | Handles jitter, exponential backoff, per-exception retry config |
| API rate limiting | Custom token bucket | asyncio.Semaphore + tenacity | Combined semaphore for concurrency + tenacity for retry-after headers |
| XML parsing (PubMed/arXiv) | regex on XML | xml.etree.ElementTree | Stdlib; handles namespaces, entities, malformed input gracefully |

**Key insight:** Each academic API has its own quirks (XML vs JSON, different field names, different pagination). The complexity is in normalization, not in HTTP calls. Focus effort on the unified schema mapping, not on HTTP plumbing.

## Common Pitfalls

### Pitfall 1: OpenAlex API Key Required (Feb 2026)
**What goes wrong:** API calls return 403/429 without an API key
**Why it happens:** OpenAlex switched from "polite pool" (email only) to mandatory API keys in Feb 2026
**How to avoid:** Register for free API key at openalex.org; store in settings/env; pyalex.config.api_key
**Warning signs:** 403 responses from api.openalex.org

### Pitfall 2: arXiv Rate Limit is Very Strict
**What goes wrong:** IP gets temporarily banned from arXiv API
**Why it happens:** arXiv allows only 1 request per 3 seconds; no API key system
**How to avoid:** Use asyncio.Semaphore(1) for arXiv client; add 3-second delay between requests; implement retry with exponential backoff
**Warning signs:** HTTP 429 or connection refused from export.arxiv.org

### Pitfall 3: Semantic Scholar Shared Rate Pool
**What goes wrong:** Unauthenticated S2 requests fail because 5000 req/5min is shared across ALL unauthenticated users
**Why it happens:** S2 rate limit pool is global, not per-IP
**How to avoid:** Get a free S2 API key for dedicated 1 RPS; add x-api-key header; implement exponential backoff
**Warning signs:** HTTP 429 from api.semanticscholar.org

### Pitfall 4: Meilisearch Index Schema Must Be Set Before First Document
**What goes wrong:** Filterable/sortable attributes don't work; queries return empty
**Why it happens:** Meilisearch requires explicit declaration of filterable/sortable attributes BEFORE indexing documents
**How to avoid:** Create index with settings (filterableAttributes, sortableAttributes, rankingRules) before any document insertion
**Warning signs:** Filter queries returning 0 results despite documents existing

### Pitfall 5: GROBID Cold Start and Memory
**What goes wrong:** First PDF parse takes 30+ seconds; container OOM-kills
**Why it happens:** GROBID loads ML models lazily on first request; default JVM heap is small
**How to avoid:** Set JAVA_OPTS=-Xmx2g in docker-compose; send a warmup request on container start
**Warning signs:** First request timeout; container restarts in docker-compose logs

### Pitfall 6: Chinese Title Deduplication
**What goes wrong:** Same Chinese paper appears as duplicates because fuzzy match fails on CJK
**Why it happens:** Character-level Levenshtein works poorly for Chinese (each char is a word)
**How to avoid:** Use token-level comparison for CJK titles (jieba segmentation before fuzzy match); or normalize to pinyin first
**Warning signs:** Duplicate Chinese papers in search results from different sources

### Pitfall 7: PubMed Returns PMC IDs, Not DOIs
**What goes wrong:** Deduplication fails because PubMed papers lack DOIs
**Why it happens:** PubMed primary IDs are PMID/PMCID, not DOI; many older papers have no DOI
**How to avoid:** Use efetch to get DOI from PubMed XML; fall back to title-based dedup when DOI absent
**Warning signs:** Papers from PubMed never matching OpenAlex/S2 papers

## Code Examples

### OpenAlex Client (using pyalex)
```python
# Reference: gpt-researcher pattern + pyalex official docs
import pyalex
from pyalex import Works

pyalex.config.email = "studyhub@example.com"
pyalex.config.api_key = settings.openalex_api_key

async def search_openalex(query: str, limit: int = 25) -> list[PaperResult]:
    """Search OpenAlex works. pyalex is sync; run in executor."""
    results = (
        Works()
        .search(query)
        .select(["id", "doi", "title", "authorships", "publication_year",
                 "cited_by_count", "primary_location", "open_access",
                 "abstract_inverted_index", "language"])
        .get(per_page=limit)
    )
    return [_map_openalex_to_paper(r) for r in results]
```

### Semantic Scholar Client (httpx async)
```python
# Reference: gpt-researcher/retrievers/semantic_scholar
S2_BASE = "https://api.semanticscholar.org/graph/v1"

async def search_s2(query: str, limit: int = 25) -> list[PaperResult]:
    response = await client.get(
        f"{S2_BASE}/paper/search",
        params={
            "query": query,
            "limit": limit,
            "fields": "paperId,externalIds,title,abstract,authors,year,"
                      "citationCount,venue,isOpenAccess,openAccessPdf",
        },
        headers={"x-api-key": settings.s2_api_key},
    )
    response.raise_for_status()
    return [_map_s2_to_paper(p) for p in response.json().get("data", [])]
```

### Meilisearch Index Configuration
```python
# Source: meilisearch-python-sdk docs
from meilisearch_python_sdk import AsyncClient

async def setup_papers_index(ms_client: AsyncClient) -> None:
    index = ms_client.index("papers")
    await index.update_filterable_attributes([
        "year", "citation_count", "venue", "language", "sources", "is_open_access"
    ])
    await index.update_sortable_attributes([
        "citation_count", "year", "relevance_score"
    ])
    await index.update_ranking_rules([
        "words", "typo", "proximity", "attribute", "sort", "exactness"
    ])
    # Meilisearch auto-detects Chinese and uses Jieba
    await index.update_searchable_attributes([
        "title", "abstract", "authors", "venue", "doi"
    ])
```

### GROBID PDF Parsing
```python
import httpx

GROBID_URL = "http://localhost:8070/api"

async def parse_pdf(pdf_bytes: bytes) -> dict:
    """Send PDF to GROBID, get structured TEI XML, map to sections."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{GROBID_URL}/processFulltextDocument",
            files={"input": ("paper.pdf", pdf_bytes, "application/pdf")},
            data={"consolidateHeader": "1", "consolidateCitations": "1"},
        )
        response.raise_for_status()
        return parse_tei_to_sections(response.text)

def parse_tei_to_sections(tei_xml: str) -> dict:
    """Map TEI XML to structured sections dict."""
    import xml.etree.ElementTree as ET
    ns = {"tei": "http://www.tei-c.org/ns/1.0"}
    root = ET.fromstring(tei_xml)
    return {
        "title": _extract_text(root, ".//tei:titleStmt/tei:title", ns),
        "abstract": _extract_text(root, ".//tei:abstract", ns),
        "sections": _extract_body_sections(root, ns),
        "references": _extract_references(root, ns),
    }
```

### Paper PostgreSQL Model
```python
from sqlalchemy import String, Integer, JSON, DateTime, Boolean, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
import uuid
from datetime import datetime

class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doi: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    openalex_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    s2_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    pmid: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    arxiv_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    title: Mapped[str] = mapped_column(Text, nullable=False)
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)
    authors: Mapped[list] = mapped_column(JSON, default=list)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    venue: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)

    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_open_access: Mapped[bool] = mapped_column(Boolean, default=False)

    # Parsed content from PDF
    parsed_content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pdf_storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    sources: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pyalex email-only polite pool | API key required | Feb 2026 | Must register and configure API key |
| meilisearch sync Python client | meilisearch-python-sdk async | 2024+ | Use AsyncClient for FastAPI compatibility |
| MinerU magic-pdf package | MinerU mineru package v2.7+ | 2025 | Package renamed; GPU required for best results |
| GROBID 0.7.x | GROBID 0.8.1 | 2024 | Better table extraction, improved CRF models |
| Semantic Scholar open access | S2 API key recommended | 2024+ | Shared rate pool too crowded; get dedicated key |

**Deprecated/outdated:**
- `meilisearch-python-async`: Renamed to `meilisearch-python-sdk`; old package no longer maintained
- `magic-pdf`: Renamed to `mineru` on PyPI
- pyalex without API key: Will fail after Feb 2026 enforcement

## Open Questions

1. **pyalex is synchronous -- how to integrate with async FastAPI?**
   - What we know: pyalex uses requests internally (sync)
   - What's unclear: Whether to run in asyncio executor or use raw httpx for OpenAlex
   - Recommendation: Use `asyncio.to_thread(pyalex_call)` for simplicity; if performance is an issue, switch to raw httpx. pyalex handles pagination and polite pool which is valuable.

2. **GROBID vs MinerU for Chinese PDFs**
   - What we know: GROBID handles multilingual but is weaker on Chinese-only PDFs; MinerU excels at Chinese but requires GPU
   - What's unclear: Actual quality difference for Chinese academic PDFs in our use case
   - Recommendation: Start with GROBID (CPU-only, lighter); add MinerU as optional GPU-accelerated fallback in Phase 3 when CNKI integration brings more Chinese PDFs

3. **Meilisearch document size limits for large abstracts**
   - What we know: Meilisearch has a default max payload size of ~100MB per batch
   - What's unclear: Performance impact of indexing full abstracts for 100K+ papers
   - Recommendation: Index title + truncated abstract (first 500 chars) + metadata fields; store full abstract in PostgreSQL

## API Rate Limits Summary

| Source | Rate Limit | Auth Required | Key Type |
|--------|-----------|---------------|----------|
| OpenAlex | 100K req/day (polite pool) | Yes (API key, free) | api_key query param |
| Semantic Scholar | 1 RPS (with key) / shared 5K/5min (without) | Recommended | x-api-key header |
| PubMed E-utilities | 10 RPS (with key) / 3 RPS (without) | Recommended | api_key query param |
| arXiv | 1 req/3 sec | No auth available | N/A -- rate limit only |

## Sources

### Primary (HIGH confidence)
- [OpenAlex API docs](https://docs.openalex.org) - Works endpoint, search, filters, API key requirement
- [Semantic Scholar API docs](https://api.semanticscholar.org/api-docs/) - Paper search, fields, rate limits
- [Meilisearch docs](https://www.meilisearch.com/docs) - CJK tokenization, filterable/sortable attributes
- [GROBID docs](https://grobid.readthedocs.io/en/latest/) - TEI XML output, processFulltextDocument endpoint
- gpt-researcher source code - Multi-source retriever pattern (S2, PubMed, arXiv clients)
- MLE-agent source code - arXiv search pattern

### Secondary (MEDIUM confidence)
- [pyalex GitHub](https://github.com/J535D165/pyalex) - Python client usage, API key config
- [meilisearch-python-sdk GitHub](https://github.com/sanders41/meilisearch-python-sdk) - AsyncClient, v7.0.3
- [MinerU GitHub](https://github.com/opendatalab/MinerU) - v2.7.6, GPU requirements
- [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25497/) - Rate limits, API key

### Tertiary (LOW confidence)
- Meilisearch Jieba tokenizer quality for academic Chinese text -- needs validation with real queries
- GROBID section mapping accuracy for non-STEM papers -- may need custom post-processing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via PyPI, official docs, and reference project usage
- Architecture: HIGH - Fan-out/dedup pattern is well-established in reference projects and production systems
- Pitfalls: HIGH - Rate limits verified from official API docs; GROBID behavior from production deployments
- PDF parsing: MEDIUM - GROBID is proven but Chinese PDF quality needs validation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain; API rate limits may change)
