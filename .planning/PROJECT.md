# StudyHub 学术研究社区平台

## What This Is

An AI-powered academic research platform that lets researchers input a research direction, automatically discovers and maps all related papers across Chinese and international sources, generates improvement experiment plans, executes experiments autonomously overnight, and matches researchers for cross-disciplinary collaboration. Primary users are university professors and research teams, starting with ECG/medical AI researchers.

## Core Value

Input a research direction → get a complete paper landscape with AI-identified gaps and opportunities → generate and auto-execute experiment plans that improve on existing work.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-source paper search (OpenAlex, Semantic Scholar, PubMed, arXiv, CNKI, Wanfang)
- [ ] Recursive citation network construction (configurable depth)
- [ ] Paper quality scoring (citations, impact factor, H-index, citation velocity)
- [ ] AI-powered paper analysis (methodology extraction, gap identification, trend detection)
- [ ] Interactive paper map visualization (citation graph, topic map, timeline views)
- [ ] SOTA analysis and improvement plan generation
- [ ] Automated experiment execution (autoresearch-style loop: modify → train → evaluate → keep/discard)
- [ ] Desktop agent for local GPU experiment management (Tauri)
- [ ] Experiment dashboard with real-time progress and metrics
- [ ] Auto-generated experiment reports (publishable quality)
- [ ] Researcher profile with auto-enrichment from academic databases
- [ ] Cross-disciplinary researcher matching (skill complementarity, co-citation analysis)
- [ ] Research needs marketplace (publish/browse/match)
- [ ] In-app messaging for collaboration
- [ ] Dataset strategy (open-source first, then user-provided, hybrid)
- [ ] PDF paper parsing (MinerU/GROBID for full-text extraction)
- [ ] Web-to-desktop experiment sync
- [ ] Freemium tier system

### Out of Scope

- Real-time chat/video conferencing — use existing tools (WeChat, Zoom)
- Collaborative paper editing — use Overleaf/Google Docs
- Grant/funding matching — too complex for v1, revisit after community growth
- Mobile app — web responsive is sufficient for v1
- Non-academic social features (feeds, likes) — not the core value

## Context

- **First users**: ECG research team (pacemaker rhythm diagnosis, ECG age prediction, cross-modal medical AI)
- **Reference projects**: Karpathy's autoresearch (experiment loop), O-DataMap (paper visualization), AI-Scientist (Sakana), scholarmaps
- **Data sources**: OpenAlex (250M papers, free), Semantic Scholar (200M), PubMed (biomedical core), CNKI/Wanfang (Chinese papers)
- **Key open-source refs**: See `open-source-references.md` for 80+ evaluated projects
- **Deployment**: Self-hosted server with GPU for experiments
- **Design doc**: Detailed system design at `docs/plans/2026-03-15-studyhub-design.md`

## Constraints

- **Tech stack**: To be determined after research — design doc proposes FastAPI + Next.js + Tauri + Neo4j + Temporal but needs validation
- **Deployment**: Self-hosted server — must support Docker Compose for all infrastructure
- **GPU**: Available on self-hosted server for experiment execution
- **Chinese support**: Must handle Chinese papers, Chinese UI, Chinese NLP (tokenization, search)
- **API rate limits**: OpenAlex polite pool 10/s, S2 needs API key for 100/s, PubMed 10/s without key
- **Anti-scraping**: CNKI and Wanfang require careful rate limiting and session management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tech stack pending research | User wants 2025 best practices validated before committing | — Pending |
| ECG team as first users | Concrete use case with known requirements, real feedback | — Pending |
| Self-hosted deployment | Data sovereignty for academic data, GPU access | — Pending |
| Comprehensive planning depth | Large complex project with 6 MVP phases | — Pending |
| YOLO mode with all verification agents | Move fast but catch issues early | — Pending |

---
*Last updated: 2026-03-15 after initialization*
