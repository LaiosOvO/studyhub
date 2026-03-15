# Feature Landscape

**Domain:** Academic Research Platform (Paper Discovery + Experiment Automation + Researcher Collaboration)
**Target Users:** Chinese university professors/researchers, starting with ECG/medical AI domain
**Researched:** 2026-03-15

## Table Stakes

Features users expect from an academic research platform. Missing any of these means the platform feels incomplete and users default back to existing tools (Google Scholar, CNKI, manual experiment scripts).

### Pillar 1: Paper Discovery & Visualization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-source paper search | Semantic Scholar, Google Scholar, Connected Papers all do this; researchers won't use a tool with fewer sources | High | Must cover OpenAlex, Semantic Scholar, PubMed, arXiv + Chinese sources (CNKI, Wanfang). Chinese source integration is the hard part -- anti-scraping, session management, rate limits |
| Citation network visualization | Connected Papers, Litmaps, ResearchRabbit all provide this as their core value prop | Medium | Use co-citation and bibliographic coupling (not just direct citations). Connected Papers' approach of clustering by similarity rather than raw citation links is now the expected standard |
| Paper metadata display | Every academic tool shows title, authors, abstract, year, citation count, venue | Low | Must include Chinese journal names, CCF rankings, Chinese impact factors |
| Search filters and sorting | Semantic Scholar, Google Scholar all have year range, field, citation count filters | Low | Add Chinese-specific filters: CNKI source type, Chinese journal tier (SCI/EI/CSSCI/core) |
| Paper detail view with abstract | Basic requirement -- TLDR summaries (Semantic Scholar-style) are now expected | Medium | AI-generated TLDR in both Chinese and English. Confidence: HIGH -- Semantic Scholar has normalized this |
| Saved collections / reading lists | ResearchRabbit, Litmaps, Zotero all support organizing papers into collections | Low | Export to Zotero/EndNote format is expected |
| Related paper recommendations | "More like this" is standard in Semantic Scholar, Google Scholar, ResearchRabbit | Medium | Combine citation-based similarity with semantic embedding similarity |

### Pillar 2: Experiment Automation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Experiment run logging | W&B, MLflow, Aim all track runs with metrics, hyperparameters, and system info | Medium | This is bare minimum for any experiment tool. Use structured logs with metrics time-series |
| Experiment results visualization | Metric curves, comparison charts, loss plots -- standard in every ML experiment tracker | Medium | Must support Chinese labels and export for papers |
| Code version tracking | W&B and MLflow both auto-capture git commit, diff, and config per run | Low | Track which code modification produced which result |
| Experiment history and comparison | Side-by-side run comparison is table stakes in W&B, MLflow | Medium | Compare across experiment iterations: which modification improved the metric |
| Basic experiment configuration | Users need to specify dataset, model, hyperparameters, and evaluation metrics | Medium | Template-based for common tasks (classification, segmentation, etc.) |

### Pillar 3: Researcher Collaboration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Researcher profile | ResearchGate, Academia.edu, Google Scholar Profiles all have this | Medium | Auto-populate from CNKI/Wanfang/OpenAlex. Include publications, research interests, institution, H-index |
| Researcher search/discovery | Finding researchers by field/institution is basic ResearchGate functionality | Low | Must support Chinese institution names and research field taxonomy |
| Research direction/interest tags | ResearchGate has research interest tags; CNKI has subject classification | Low | Use standardized Chinese academic classification + custom tags |
| Basic messaging / contact | ResearchGate has messaging; Academia.edu has follow + message | Low | WeChat integration is more practical for Chinese academics than in-app messaging. Provide contact mechanism, not full chat system |

## Differentiators

Features that set StudyHub apart. No single competitor combines all three pillars. These are the competitive advantages.

### Pillar 1: Paper Discovery & Visualization (Differentiators)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified Chinese + international search | No existing tool searches CNKI, Wanfang, AND OpenAlex/S2/PubMed in one query. This is the single biggest gap in the market for Chinese researchers | High | CNKI and Wanfang have no public APIs -- requires scrapers with anti-detection. This is technically fragile but extremely valuable. Confidence: HIGH that this is a real gap |
| AI-powered gap identification | AI reads papers in a research direction and identifies what hasn't been tried, what methods could be combined, where results are weak | High | Goes beyond Connected Papers (visualization only) and Semantic Scholar (search only). Closest: AI-Scientist's literature review, but that's not interactive |
| Interactive topic/method evolution timeline | Show how methods evolved over time in a research direction, which methods are ascending/declining | Medium | Litmaps has year-based visualization but not method-evolution tracking. This helps researchers quickly identify where the field is heading |
| Recursive citation network with configurable depth | Build full citation graph N levels deep, not just immediate citations | Medium | Connected Papers shows ~25 related papers. Full recursive expansion with depth control is rare and enables comprehensive literature reviews |
| Cross-lingual paper linking | Match Chinese papers to their English counterparts (same authors, same work published in both languages) | High | Common in Chinese academia: publish in Chinese journal first, then English version. No tool currently links these automatically |
| Paper quality scoring composite | Combine citation count + journal impact factor + H-index + citation velocity + recency into a single quality score | Medium | Existing tools show individual metrics. A composite score with configurable weights helps researchers quickly identify which papers matter most |

### Pillar 2: Experiment Automation (Differentiators)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Paper-to-experiment pipeline | Read papers in a research direction, identify SOTA, generate improvement experiment plans automatically | Very High | This is the core differentiator combining Pillar 1 and Pillar 2. No existing product does this. Closest: AI-Scientist (Sakana) does end-to-end but is not interactive and has 42% experiment failure rate |
| Autonomous overnight experiment loop | Karpathy's autoresearch pattern: modify code, train, evaluate, keep/discard, repeat. Run 50-100 experiments overnight unattended | High | Direct reference implementation exists (autoresearch, 630 lines). Key adaptation: generalize beyond LLM training to arbitrary ML tasks (ECG classification, medical imaging, etc.) |
| Desktop agent for local GPU management | Tauri-based desktop app that manages experiment execution on researcher's own GPU hardware | High | W&B requires cloud; MLflow requires server setup. A desktop agent that "just works" on a researcher's lab machine is genuinely easier for non-DevOps academics |
| Auto-generated experiment reports | After experiments complete, generate a structured report with methodology, results, figures, analysis -- in publishable format | High | W&B generates dashboards, not papers. AI-Scientist generates full papers but quality is questionable. A middle ground: structured experiment report sections that researchers can incorporate into their papers |
| SOTA benchmark tracking per research direction | Track which method achieves best results on which datasets within a specific research direction, updated as new experiments run | Medium | Papers with Code (now shutdown) did this globally. Doing it per-research-direction for a research group is a niche but valuable differentiator |
| Dataset strategy wizard | Interactive flow: check if open-source dataset exists, download it, or guide user to provide their own, with hybrid validation approach | Medium | No existing tool handles the "do I have data?" question interactively. Important for cross-disciplinary researchers who may not know what datasets exist |

### Pillar 3: Researcher Collaboration (Differentiators)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-disciplinary matching based on skill complementarity | A literature professor needs knowledge graph expertise; match them with a CS professor who does KG research. Based on research needs + capability analysis | High | ResearchGate matching is based on field similarity (find people like you). Complementarity matching (find people different from you who can help) is the opposite and far more valuable for interdisciplinary research |
| Research needs marketplace | Publish: "I need someone who can do X" / Browse: "I can help with Y" -- structured matching | Medium | No academic platform has this. ResearchGate has Q&A forums (unstructured). A structured marketplace is clearer and more actionable |
| Co-citation network-based researcher discovery | Find researchers whose work is cited alongside yours, suggesting natural collaboration opportunities | Medium | Inciteful's "literature connector" does this for papers. Extending to researchers (who bridges your field to another?) is novel |
| Auto-enriched researcher profiles from Chinese academic databases | Pull publication lists, citation counts, research directions automatically from CNKI/Wanfang/OpenAlex | Medium | ResearchGate requires manual profile creation. Auto-enrichment from Chinese sources specifically is not available on any existing platform |

## Anti-Features

Features to explicitly NOT build. These are scope traps that would consume resources without delivering core value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time chat / video conferencing | Chinese academics already use WeChat for all communication. Building another chat system is wasted effort and will be ignored | Provide WeChat ID / contact info exchange. Link to WeChat group creation |
| Collaborative paper writing / editing | Overleaf and Google Docs are deeply entrenched. LaTeX collaboration tools are mature and specialized | Export experiment reports in LaTeX/Word format for use in existing writing tools |
| Social feed / likes / follows | ResearchGate's social features are widely criticized as noisy and distracting. Academics don't want another social network | Focus on functional matching and structured collaboration, not social engagement metrics |
| Full-text paper hosting / repository | CNKI, arXiv, institutional repositories handle this. Hosting full-text papers creates copyright liability | Link to papers on their original sources. Cache metadata and abstracts only |
| Grant / funding matching | Too complex for v1, requires integration with NSFC, provincial funding databases, each with different formats | Revisit after establishing user base. Could be a premium feature later |
| Mobile app | University researchers primarily work on desktop/laptop. Mobile adds development cost for minimal usage | Responsive web design covers the occasional mobile check. Tauri desktop app for experiment management |
| Plagiarism detection | CNKI already dominates this in China. Duplicating is wasteful and legally risky | Link to CNKI's plagiarism check tool if needed |
| Peer review system | Extremely complex socially and technically. Journals handle this. AI-Scientist's automated review had mixed quality | Focus on AI-assisted paper analysis, not review/judgment of others' work |
| General-purpose ML platform | Competing with W&B, MLflow, Determined on general ML experiment tracking is a losing battle | Stay focused on the paper-to-experiment pipeline. Use experiment tracking as a means to the end, not the product itself |

## Feature Dependencies

```
Multi-source paper search
  --> Citation network construction (needs paper data)
    --> Citation network visualization (needs graph data)
    --> Paper quality scoring (needs citation data)
    --> AI gap identification (needs full paper landscape)
      --> SOTA analysis (needs gap identification + quality scoring)
        --> Experiment plan generation (needs SOTA analysis)
          --> Autonomous experiment loop (needs experiment plan)
            --> Experiment results visualization (needs experiment data)
            --> Auto-generated experiment reports (needs experiment results)

PDF paper parsing (MinerU/GROBID)
  --> AI-powered paper analysis (needs full text, not just abstracts)
  --> Methodology extraction (needs structured paper content)

Researcher profiles (auto-enriched)
  --> Researcher search/discovery
  --> Cross-disciplinary matching (needs profile data)
  --> Research needs marketplace (needs researcher identity)
  --> Co-citation researcher discovery (needs publication data)

Desktop agent (Tauri)
  --> Local GPU experiment execution
  --> Web-to-desktop experiment sync
```

## MVP Recommendation

### Phase 1: Paper Discovery Core (Table Stakes)

Prioritize first -- this is the entry point that gets researchers to try the platform:

1. **Multi-source paper search** (OpenAlex + Semantic Scholar + arXiv + PubMed) -- skip CNKI/Wanfang initially due to scraping complexity
2. **Citation network visualization** -- interactive graph is the "wow" moment
3. **Paper metadata display + search filters** -- basic but essential
4. **Saved collections** -- users need to organize what they find

### Phase 2: Chinese Source Integration + AI Analysis

This is what makes the platform irreplaceable for Chinese researchers:

5. **CNKI/Wanfang integration** -- fragile but high-value differentiator
6. **PDF parsing** (MinerU) -- enables full-text analysis
7. **AI-powered paper analysis** -- TLDR, methodology extraction, gap identification
8. **Paper quality scoring composite** -- helps researchers prioritize

### Phase 3: Experiment Automation

The hardest pillar but the most differentiated:

9. **Experiment configuration and execution** -- basic run management
10. **Autonomous experiment loop** (autoresearch-style) -- the overnight experiment killer feature
11. **Experiment tracking and visualization** -- results dashboard
12. **Desktop agent** (Tauri) -- local GPU management

### Phase 4: Collaboration + Reports

Build on established user base:

13. **Researcher profiles** (auto-enriched from academic databases)
14. **Cross-disciplinary matching**
15. **Research needs marketplace**
16. **Auto-generated experiment reports**

### Defer to Later

- **Cross-lingual paper linking**: Valuable but requires sophisticated NLP alignment. Build after core platform is stable
- **SOTA benchmark tracking**: Requires critical mass of experiments. Enable after experiment automation is working
- **Co-citation researcher discovery**: Needs significant citation graph data accumulated first
- **Dataset strategy wizard**: Nice to have but manual dataset setup works for v1

## Competitive Positioning Summary

| Competitor | What They Do Well | What They Lack | StudyHub Opportunity |
|-----------|-------------------|----------------|---------------------|
| Semantic Scholar | Best AI-powered paper search, TLDR, 200M+ papers | No Chinese papers (CNKI/Wanfang), no experiments, no collaboration | Chinese source integration + experiment pipeline |
| Connected Papers | Fast, intuitive visualization, co-citation clustering | Only ~25 papers per graph, no full search, no Chinese sources | Deeper recursive graphs + Chinese coverage |
| Litmaps + ResearchRabbit | Good visualization, monitoring, iterative exploration | No Chinese sources, no experiments, no collaboration matching | All three pillars integrated |
| ResearchGate | Largest researcher network, Q&A, profiles | No paper discovery innovation, no experiments, poor for Chinese academics | Cross-disciplinary matching (complementarity, not similarity) |
| Google Scholar | Ubiquitous, good Chinese coverage via CNKI indexing | No visualization, no AI analysis, no experiments | Everything beyond basic search |
| Papers with Code (shutdown) | SOTA tracking, code links | Shut down July 2025, Hugging Face successor is model-centric | Per-direction SOTA tracking for research groups |
| W&B / MLflow | Best experiment tracking | Not paper-aware, not academic-focused, requires DevOps knowledge | Paper-to-experiment pipeline, zero-config desktop agent |
| AI-Scientist (Sakana) | End-to-end automated research | 42% experiment failure rate, not interactive, no paper discovery UI | Interactive, user-guided version with better reliability |
| CNKI / Wanfang | Definitive Chinese paper sources | No visualization, no AI analysis, no experiments, no collaboration | Modern AI-powered layer on top of their data |

## Sources

- [Semantic Scholar Review 2025](https://sider.ai/blog/ai-tools/is-semantic-scholar-the-best-free-research-tool-in-2025-a-deep-practical-review)
- [Semantic Scholar Review 2026](https://agentaya.com/ai-review/semantic-scholar/)
- [Connected Papers](https://www.connectedpapers.com/)
- [Connected Papers Deep Dive 2025](https://skywork.ai/skypage/en/Connected-Papers-My-Deep-Dive-into-the-Visual-Research-Tool-(2025-Review)/1972566882891395072)
- [Litmaps vs ResearchRabbit vs Connected Papers 2025](https://effortlessacademic.com/litmaps-vs-researchrabbit-vs-connected-papers-the-best-literature-review-tool-in-2025/)
- [ResearchRabbit 2025 Revamp](https://aarontay.substack.com/p/researchrabbits-2025-revamp-iterative)
- [Papers with Code Shutdown](https://hyper.ai/en/news/42900)
- [W&B vs MLflow vs Neptune Comparison](https://neptune.ai/vs/wandb-mlflow)
- [AI-Scientist Evaluation](https://arxiv.org/abs/2502.14297)
- [Karpathy autoresearch - VentureBeat](https://venturebeat.com/technology/andrej-karpathys-new-open-source-autoresearch-lets-you-run-hundreds-of-ai)
- [Karpathy autoresearch - The New Stack](https://thenewstack.io/karpathy-autonomous-experiment-loop/)
- [ResearchGate & Academia.edu - Virginia Tech](https://guides.lib.vt.edu/researcher-profiles/social-networks)
- [15 Best Academic Networking Platforms 2025](https://www.scijournal.org/articles/best-academic-networking-and-collaboration-platforms)
- [CNKI Overview](https://cactusglobal.com/media-center/china-national-knowledge-infrastructure-cnki-a-vital-player-in-chinas-research-landscape/)
