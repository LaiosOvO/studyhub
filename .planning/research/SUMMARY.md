# Research Summary: StudyHub Academic Research Platform

**Domain:** AI-powered academic research platform (paper discovery, experiment automation, researcher collaboration)
**Researched:** 2026-03-15
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

The proposed stack of FastAPI + Next.js + Tauri + Neo4j + Temporal + PostgreSQL + Meilisearch + Redis + ClickHouse + MinIO is fundamentally sound but requires three corrections for 2026 reality. MinIO's open-source repository was archived in February 2026 and must be replaced with SeaweedFS. Redis should be replaced with Valkey due to the March 2024 license change to source-available. ClickHouse should be deferred past MVP -- PostgreSQL materialized views handle analytics at early scale, and self-hosting ClickHouse demands significant DevOps expertise the team should not spend on during MVP.

The core architecture -- Python backend with Temporal workflow orchestration, graph database for citations, full-text search for papers, and a Tauri desktop agent for local experiment execution -- aligns well with the problem domain. FastAPI's Python ecosystem enables seamless integration with ML libraries (PyTorch, sentence-transformers) that power paper analysis and researcher matching. Temporal's durable execution model is a natural fit for Deep Research workflows that run 10-60 minutes across multiple stages and must survive server restarts.

The open-source reference landscape (80+ projects evaluated in open-source-references.md) provides strong foundations to build upon rather than reinventing. Key building blocks include pyalex (OpenAlex client), semanticscholar (S2 client), MinerU (PDF extraction), and GROBID (metadata parsing). The visualization stack of React Flow + D3 + Deck.gl covers the three view types (citation graph, topic map, timeline) with proven libraries.

The researcher collaboration subsystem has the least open-source precedent (only 3 projects found, all under 5 stars). This is both a risk (less reference code to learn from) and an opportunity (blue ocean market position). The matching algorithm combining embedding similarity, skill complementarity, and co-citation analysis is architecturally sound but will require careful iteration with real users.

## Key Findings

**Stack:** FastAPI + Next.js + Tauri + Neo4j + Temporal + PostgreSQL + Meilisearch + Valkey + SeaweedFS. Defer ClickHouse.
**Architecture:** Monorepo with shared types, Temporal-orchestrated workflows, event-driven via Valkey Streams.
**Critical pitfall:** MinIO is dead (repo archived Feb 2026). Using it means no security patches.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Infrastructure & Deep Research Engine** - Foundation must come first
   - Addresses: Docker Compose infra, multi-source paper search, citation network construction
   - Avoids: Building on deprecated MinIO, premature ClickHouse complexity

2. **Paper Map Visualization** - Depends on Deep Research data
   - Addresses: Citation graph (React Flow), topic map (Deck.gl), basic search
   - Avoids: Building visualization before having real data to render

3. **Plan Generation & SOTA Analysis** - Requires paper corpus from Phase 1-2
   - Addresses: AI-powered gap identification, experiment plan generation, code skeleton output
   - Avoids: LLM integration without sufficient paper data context

4. **Experiment Execution Engine** - Most complex subsystem, needs prior phases
   - Addresses: Tauri desktop agent, autoresearch loop, GPU management, web sync
   - Avoids: Premature desktop development before core platform is proven

5. **Community & Collaboration** - Needs user base from prior phases
   - Addresses: Profiles, matching, needs marketplace, messaging
   - Avoids: Building social features before having content to socialize around

6. **Polish & Scale** - Optimization after core is validated
   - Addresses: Timeline view, experiment reports, analytics (add ClickHouse here if needed)
   - Avoids: Premature optimization

**Phase ordering rationale:**
- Deep Research produces data that Paper Map visualizes, and both produce context that Plan Generation needs
- Experiment Engine is the most complex subsystem and benefits from a stable platform foundation
- Community features need existing users and content to be valuable
- Analytics infrastructure (ClickHouse) only matters after you have meaningful usage data

**Research flags for phases:**
- Phase 1: Needs deeper research on CNKI/Wanfang anti-scraping strategies and rate limiting
- Phase 4: Needs deeper research on Tauri-to-web sync protocol and GPU monitoring approaches
- Phase 5: Standard patterns for matching/messaging, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via official sources. MinIO/Redis replacements well-documented. |
| Features | MEDIUM-HIGH | Feature landscape well-defined by design doc. Collaboration features have least precedent. |
| Architecture | MEDIUM | Architecture sound in principle. Temporal workflow patterns need phase-specific research. |
| Pitfalls | MEDIUM | Common pitfalls identified. CNKI anti-scraping and Neo4j scaling limits need monitoring. |

## Gaps to Address

- CNKI and Wanfang scraping reliability and anti-bot measures -- needs hands-on testing
- Neo4j Community Edition performance ceiling -- at what paper count does single-node become a bottleneck?
- MinerU vs GROBID quality comparison on Chinese academic PDFs specifically
- LLM cost estimation for Deep Research at scale (analyzing 100+ paper full texts per query)
- Tauri-to-FastAPI real-time sync protocol design (WebSocket vs SSE vs polling)
- Researcher matching algorithm accuracy -- no benchmark exists, will need user feedback loops

---
*Research summary for: StudyHub Academic Research Platform*
*Researched: 2026-03-15*
