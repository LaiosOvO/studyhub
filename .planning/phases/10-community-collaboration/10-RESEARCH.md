# Phase 10: Community & Collaboration - Research

**Researched:** 2026-03-16
**Domain:** Researcher profiles, intelligent matching, needs marketplace, real-time messaging
**Confidence:** MEDIUM-HIGH

## Summary

Phase 10 introduces a social layer on top of the existing research platform. Four distinct subsystems are needed: (1) researcher profiles linked to the existing User model and auto-enriched via OpenAlex/CNKI/Wanfang, (2) a matching engine that computes skill complementarity using TF-IDF vector embeddings of research fields combined with co-citation analysis from Neo4j, with LLM-generated match explanations, (3) a structured needs marketplace with tag-based filtering, and (4) a lightweight direct messaging system backed by PostgreSQL with Valkey pub/sub for real-time delivery.

The project already has the core building blocks: the Scholar model (Phase 3.1) stores h-index, publications, and research fields; the embedding service (Phase 5) handles TF-IDF + UMAP/PCA; OpenAlex integration (Phase 2) provides author search via pyalex; and Valkey is already wired as a dependency with async support. The main new work is creating a ResearcherProfile model linking User to Scholar data, building the matching algorithm, the needs CRUD, and the messaging layer.

**Primary recommendation:** Use PostgreSQL for all persistent data (profiles, needs, messages), Valkey pub/sub for real-time message delivery and notification indicators, TF-IDF cosine similarity on research keywords for complementarity scoring, and Haiku for match explanation generation (cost-efficient, ~100 tokens per explanation).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | User registers with name, institution, title, email, research directions | ResearcherProfile model extending User with academic fields; Alembic migration |
| PROF-02 | System auto-enriches by matching name+institution against OpenAlex/CNKI/Wanfang | Reuse pyalex Author search (asyncio.to_thread pattern from Phase 2) + existing Scholar enrichment pipeline |
| PROF-03 | Auto-enrichment pulls publications, citations, H-index, co-authors, keywords | OpenAlex Author API returns h_index, cited_by_count, works_count, topics; co-authors via works API |
| PROF-04 | User can edit/curate auto-generated profile info | Standard CRUD PATCH endpoint with Pydantic partial update schema |
| PROF-05 | User specifies current research needs | JSON field on ResearcherProfile for structured needs; separate ResearchNeed model for marketplace |
| PROF-06 | Other users can view profiles with publications and expertise tags | Public profile endpoint (no auth required for viewing); Meilisearch index for researcher discovery |
| MTCH-01 | Recommends collaborators based on skill complementarity (not similarity) | Inverted cosine similarity on research keyword vectors: high score for DIFFERENT but adjacent fields |
| MTCH-02 | Matching combines research vectors, skill complementarity, co-citation, institutional proximity | Multi-signal weighted score: 40% complementarity, 25% co-citation, 20% research adjacency, 15% institutional proximity |
| MTCH-03 | Each match includes LLM-generated explanation | Haiku model via llm_completion with structured prompt: "Given researcher A (fields: X) and researcher B (fields: Y), explain why collaboration makes sense" |
| MTCH-04 | User views match score and complementarity breakdown | MatchResult schema with overall_score + per-signal breakdown dict |
| NEED-01 | User publishes structured research needs | ResearchNeed model: user_id, title, description, required_skills (JSON), research_direction, status, tags |
| NEED-02 | Browse needs filtered by tags, direction, match relevance | Meilisearch index on needs with filterable attributes; sorted by match score against viewer profile |
| NEED-03 | System shows match score between user profile and each need | Reuse matching engine's complementarity scorer against need's required_skills |
| NEED-04 | User can contact need publisher via in-app message | Links to messaging system; "Contact" button triggers new conversation |
| MESG-01 | User sends direct messages to other researchers | Message model with sender_id, recipient_id, content, created_at; REST endpoint + Valkey pub/sub |
| MESG-02 | User views conversation history | Conversation query: messages between two users ordered by created_at; paginated |
| MESG-03 | Notification indicator for new messages | Valkey pub/sub channel per user; unread count stored in Valkey key; WebSocket push for real-time |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.0+ (already installed) | ResearcherProfile, ResearchNeed, Message models | Project ORM standard; async support |
| Alembic | 1.14+ (already installed) | Database migrations for new tables | Project migration tool |
| pyalex | 0.21+ (already installed) | OpenAlex Author API for profile enrichment | Already used in Phase 2 for paper search |
| scikit-learn | 1.8+ (already installed) | TF-IDF vectorization + cosine similarity for matching | Already used in Phase 5 embedding service |
| valkey | 6.0+ (already installed) | Pub/sub for real-time messaging + notification counts | Already wired in dependencies.py |
| litellm | 1.55+ (already installed) | LLM match explanations via Haiku | Project LLM gateway |
| Meilisearch SDK | 7.0+ (already installed) | Full-text search for profiles and needs | Project search engine |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rapidfuzz | 3.14+ (already installed) | Fuzzy name matching for profile-scholar linking | When linking ResearcherProfile to existing Scholar records |
| neo4j | 5.27+ (already installed) | Co-citation analysis for matching signal | Query co-author and co-citation edges for matching |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TF-IDF + cosine | Sentence transformers (SBERT) | Better semantic understanding but requires model download (~400MB) and GPU; TF-IDF sufficient for keyword-level complementarity |
| Valkey pub/sub for messaging | WebSocket-only with in-memory ConnectionManager | Doesn't survive server restart; Valkey pub/sub enables multi-instance scale-out |
| PostgreSQL for messages | Dedicated message broker (RabbitMQ) | Overkill for v1 volume; PostgreSQL handles message persistence with Valkey for real-time push |
| Haiku for explanations | Sonnet | Haiku is 3x cheaper; explanations are short (<200 tokens) and formulaic |

**Installation:**
No new dependencies needed. All libraries already in `pyproject.toml`.

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
  models/
    researcher_profile.py    # ResearcherProfile SQLAlchemy model
    research_need.py          # ResearchNeed model
    message.py                # Message model
  schemas/
    profile.py                # Pydantic schemas for profiles
    need.py                   # Pydantic schemas for needs
    message.py                # Pydantic schemas for messaging
    match.py                  # Match result schemas
  routers/
    profiles.py               # Profile CRUD + public view
    matching.py               # Match recommendations endpoint
    needs.py                  # Needs marketplace CRUD + browse
    messages.py               # Send/list messages + WebSocket
  services/
    community/
      __init__.py
      profile_enricher.py     # OpenAlex/CNKI/Wanfang enrichment
      matching_engine.py      # Multi-signal matching algorithm
      match_explainer.py      # LLM explanation generation
      need_matcher.py         # Need-to-profile matching
      message_service.py      # Message persistence + Valkey pub/sub
      notification_service.py # Unread counts + WebSocket push
```

### Pattern 1: ResearcherProfile as User Extension

**What:** Separate model linked 1:1 to User via user_id FK, not extending User directly. Keeps auth model lean.
**When to use:** Adding domain-specific profile data to an existing auth system.
**Example:**
```python
class ResearcherProfile(Base):
    __tablename__ = "researcher_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False, index=True)

    # Identity
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(300), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    research_directions: Mapped[list] = mapped_column(JSON, default=list)
    expertise_tags: Mapped[list] = mapped_column(JSON, default=list)

    # Enriched data (from OpenAlex/Scholar)
    h_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_citations: Mapped[int | None] = mapped_column(Integer, nullable=True)
    publication_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    publications: Mapped[list] = mapped_column(JSON, default=list)  # Top publications
    co_authors: Mapped[list] = mapped_column(JSON, default=list)
    openalex_author_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Linked Scholar (if matched to existing Scholar record)
    scholar_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Enrichment tracking
    enrichment_status: Mapped[str] = mapped_column(String(20), default="pending")
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

### Pattern 2: Complementarity-Based Matching

**What:** Invert similarity scoring so researchers with DIFFERENT but ADJACENT fields score highest.
**When to use:** When the goal is collaboration (complementary skills) not duplication (similar skills).
**Example:**
```python
def compute_complementarity(profile_a_keywords: list[str], profile_b_keywords: list[str]) -> float:
    """High score when fields are different but related (adjacent clusters).

    1. Compute TF-IDF vectors for both keyword sets
    2. Cosine similarity gives 'raw_similarity' (0-1)
    3. Complementarity = 1 - raw_similarity, BUT penalize if too dissimilar
    4. Optimal: moderate similarity (0.2-0.5) = high complementarity
    """
    # Bell curve: peaks at ~0.35 similarity (adjacent fields)
    raw_sim = cosine_similarity(vec_a, vec_b)
    complementarity = math.exp(-((raw_sim - 0.35) ** 2) / (2 * 0.15 ** 2))
    return complementarity
```

### Pattern 3: Valkey Pub/Sub for Real-Time Messages

**What:** Each user subscribes to a personal Valkey channel. Messages published to recipient's channel trigger WebSocket push.
**When to use:** Real-time message delivery without polling.
**Example:**
```python
# Publisher side (when sending message)
async def publish_message(valkey: Valkey, recipient_id: str, message_data: dict):
    channel = f"user:{recipient_id}:messages"
    await valkey.publish(channel, json.dumps(message_data))
    # Increment unread count
    await valkey.incr(f"user:{recipient_id}:unread")

# Subscriber side (WebSocket endpoint)
@router.websocket("/ws/messages")
async def message_ws(websocket: WebSocket, user: User = Depends(ws_get_current_user)):
    await websocket.accept()
    valkey = await get_valkey()
    pubsub = valkey.pubsub()
    await pubsub.subscribe(f"user:{user.id}:messages")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    finally:
        await pubsub.unsubscribe()
```

### Pattern 4: Multi-Signal Weighted Matching

**What:** Combine multiple scoring signals with configurable weights for final match score.
**When to use:** When matching quality depends on multiple independent factors.
**Example:**
```python
MATCH_WEIGHTS = {
    "complementarity": 0.40,   # Research field complementarity
    "co_citation": 0.25,       # Co-citation proximity in Neo4j
    "adjacency": 0.20,         # Topic adjacency (share some but not all topics)
    "institutional": 0.15,     # Same institution / nearby institutions
}

def compute_match_score(signals: dict[str, float]) -> float:
    return sum(MATCH_WEIGHTS[k] * signals.get(k, 0.0) for k in MATCH_WEIGHTS)
```

### Anti-Patterns to Avoid

- **Extending the User model directly:** Bloats the auth model. Use a separate ResearcherProfile with FK.
- **Polling for new messages:** Use Valkey pub/sub + WebSocket push instead of periodic API polling.
- **Storing unread counts in PostgreSQL:** Hot path data -- use Valkey atomic counters, much faster.
- **Running matching on every request:** Pre-compute match scores periodically or on profile change, cache top-N matches in Valkey.
- **Symmetric similarity for collaboration matching:** Collaboration needs complementarity, not similarity. Two NLP researchers don't need each other as much as an NLP researcher + a systems engineer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text vectorization for matching | Custom embedding logic | scikit-learn TfidfVectorizer (already used in embedding_service.py) | Handles tokenization, stop words, IDF weighting |
| Fuzzy name matching | Custom string distance | rapidfuzz (already installed) | Handles CJK, Unicode normalization, multiple algorithms |
| Real-time message delivery | Custom WebSocket connection pool | Valkey pub/sub + valkey-py async | Survives restart, scales to multiple instances |
| Author metadata enrichment | Custom API wrappers | pyalex (already installed) for OpenAlex | Handles pagination, polite pool, rate limiting |
| Match explanation text | Template strings | LLM (Haiku via litellm) | Natural, contextual explanations; adapts to each pair |
| Co-citation analysis | Custom graph traversal | Neo4j Cypher queries (driver already installed) | Efficient graph operations on existing citation data |

**Key insight:** Phase 10 is a integration phase -- almost every component reuses existing infrastructure. The only genuinely new code is the matching algorithm and the messaging layer.

## Common Pitfalls

### Pitfall 1: Profile Enrichment Taking Too Long

**What goes wrong:** OpenAlex + CNKI + Wanfang enrichment runs sequentially per user, blocking profile creation for 30+ seconds.
**Why it happens:** Enrichment involves multiple external API calls, each with rate limits.
**How to avoid:** Run enrichment asynchronously via Temporal workflow (existing pattern from Phase 5). Profile creation returns immediately with `enrichment_status: "pending"`. Client polls or receives WebSocket notification when enrichment completes.
**Warning signs:** Profile creation endpoint response time > 5s.

### Pitfall 2: Matching Algorithm Cold Start

**What goes wrong:** New users with no publications get zero match scores. No useful recommendations.
**Why it happens:** Matching relies on research keywords and publication data that new users lack.
**How to avoid:** Fall back to self-reported research_directions and expertise_tags when enrichment data is sparse. Always require at least research_directions during profile creation (PROF-01).
**Warning signs:** Match recommendations returning empty for users who just registered.

### Pitfall 3: Message Fan-Out Scaling

**What goes wrong:** Valkey pub/sub with one channel per user works fine at 100 users but becomes unwieldy at 10K+.
**Why it happens:** Each WebSocket connection maintains a Valkey subscription, consuming server memory.
**How to avoid:** For v1, single-channel-per-user is fine. If scaling becomes necessary, batch notifications and use Valkey Streams instead of pub/sub. Document this as a v2 consideration.
**Warning signs:** Valkey memory usage growing linearly with connected users.

### Pitfall 4: N+1 Queries in Match Listing

**What goes wrong:** Generating matches for a user triggers N individual profile lookups + N LLM calls.
**Why it happens:** Naive implementation fetches profiles one-by-one for each match candidate.
**How to avoid:** Batch-fetch all candidate profiles in one query. Cache top-N matches in Valkey with TTL (e.g., 1 hour). Generate LLM explanations lazily (only when user views match detail) or in background batch.
**Warning signs:** Match listing endpoint taking > 10s.

### Pitfall 5: Co-Citation Signal Requiring Full Graph Traversal

**What goes wrong:** Computing co-citation overlap for all user pairs requires expensive Neo4j queries.
**Why it happens:** Checking "do users A and B cite the same papers" across the full graph is O(papers_A * papers_B).
**How to avoid:** Only compute co-citation for candidate pairs that already score > threshold on cheaper signals (complementarity + adjacency). Use Neo4j's efficient path queries with LIMIT.
**Warning signs:** Match computation taking minutes for users with large publication sets.

## Code Examples

### OpenAlex Author Enrichment

```python
# Reuses pyalex + asyncio.to_thread pattern from Phase 2
# Source: OpenAlex Authors API (https://docs.openalex.org/api-entities/authors)

import asyncio
from pyalex import Authors, Institutions

def _search_openalex_author_sync(name: str, institution: str | None) -> dict | None:
    """Search OpenAlex for an author by name + institution."""
    try:
        if institution:
            insts = Institutions().search(institution).get()
            if insts:
                inst_id = insts[0]["id"].replace("https://openalex.org/", "")
                results = Authors().search(name).filter(
                    affiliations={"institution": {"id": inst_id}}
                ).get()
            else:
                results = Authors().search(name).get()
        else:
            results = Authors().search(name).get()

        if not results:
            return None

        author = results[0]
        return {
            "openalex_id": author["id"],
            "display_name": author.get("display_name"),
            "h_index": author.get("summary_stats", {}).get("h_index"),
            "cited_by_count": author.get("cited_by_count", 0),
            "works_count": author.get("works_count", 0),
            "topics": [t.get("display_name") for t in (author.get("topics") or [])[:20]],
        }
    except Exception:
        return None

async def enrich_from_openalex(name: str, institution: str | None) -> dict | None:
    return await asyncio.to_thread(_search_openalex_author_sync, name, institution)
```

### Valkey Pub/Sub Notification Pattern

```python
# Source: valkey-py docs (https://valkey-py.readthedocs.io/en/latest/examples/asyncio_examples.html)

import json
from valkey.asyncio import Valkey

async def notify_new_message(valkey: Valkey, recipient_id: str, message: dict) -> None:
    """Publish message notification and increment unread counter."""
    channel = f"user:{recipient_id}:messages"
    payload = json.dumps({"type": "new_message", "data": message})
    await valkey.publish(channel, payload)
    await valkey.incr(f"unread:{recipient_id}")

async def get_unread_count(valkey: Valkey, user_id: str) -> int:
    """Get unread message count from Valkey."""
    count = await valkey.get(f"unread:{user_id}")
    return int(count) if count else 0

async def mark_read(valkey: Valkey, user_id: str) -> None:
    """Reset unread count to zero."""
    await valkey.set(f"unread:{user_id}", 0)
```

### Co-Citation Neo4j Query

```python
# Source: existing Neo4j patterns from Phase 4 (citation_network/)

CO_CITATION_QUERY = """
MATCH (a:Paper)<-[:AUTHORED]-(author_a:Author {profile_id: $profile_a_id})
MATCH (b:Paper)<-[:AUTHORED]-(author_b:Author {profile_id: $profile_b_id})
MATCH (a)-[:CITES]->(shared:Paper)<-[:CITES]-(b)
RETURN count(DISTINCT shared) AS co_cited_papers
"""
# Note: actual graph schema may differ; adapt to existing Neo4j node types from Phase 4
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keyword-only researcher search | Embedding-based semantic matching | 2023-2024 | Better discovery of cross-disciplinary collaborators |
| Redis pub/sub for messaging | Valkey pub/sub (fork) | 2024 | Open-source, same API, drop-in replacement |
| Manual profile creation only | Auto-enrichment from OpenAlex + academic DBs | 2024-2025 | Lower friction, richer profiles with zero effort |
| Similarity-based matching | Complementarity-based matching | 2024-2025 | More useful recommendations for collaboration vs. competition |
| OpenAlex free API | OpenAlex requires API key (free) | Feb 2025 | Must configure OPENALEX_API_KEY in settings |

**Deprecated/outdated:**
- Microsoft Academic Graph: Shut down 2021, replaced by OpenAlex
- Google Scholar API: Never had an official API; scholarly library scrapes and is fragile
- Redis: Forked to Valkey; project uses Valkey throughout

## Open Questions

1. **Co-author graph schema in Neo4j**
   - What we know: Phase 4 stores citation edges (CITES) between Paper nodes. Scholar/Author nodes may or may not exist.
   - What's unclear: Whether author-paper relationships are stored as Neo4j edges or only in PostgreSQL JSON fields.
   - Recommendation: Check Phase 4 Neo4j schema. If no Author nodes exist, create them during profile enrichment. Co-citation can alternatively be computed from PostgreSQL authors JSON field if Neo4j lacks author nodes.

2. **OpenAlex API key requirement**
   - What we know: As of Feb 2025, OpenAlex requires an API key (free).
   - What's unclear: Whether the project's pyalex configuration already includes API key setup.
   - Recommendation: Add `openalex_api_key` to Settings (already exists in config.py). Ensure pyalex is configured with `pyalex.config.api_key = settings.openalex_api_key`.

3. **Researcher matching benchmark**
   - What we know: STATE.md flags "Researcher matching has no benchmark -- will need user feedback loops."
   - What's unclear: How to evaluate match quality without ground truth data.
   - Recommendation: Ship with configurable weights (MATCH_WEIGHTS dict). Add an optional "was this match helpful?" feedback button for future tuning. For v1, reasonable defaults based on literature are sufficient.

4. **Scholar model reuse vs. new ResearcherProfile**
   - What we know: Phase 3.1 created a Scholar model for harvested academic profiles (external researchers). Phase 10 needs profiles for platform users.
   - What's unclear: Should ResearcherProfile merge into Scholar, or stay separate?
   - Recommendation: Keep them separate. Scholar = external harvested data. ResearcherProfile = platform user's self-managed profile. Link via optional `scholar_id` FK when a platform user is matched to an existing Scholar record.

## Sources

### Primary (HIGH confidence)
- OpenAlex Authors API: https://docs.openalex.org/api-entities/authors -- author profile fields, h-index, works count
- OpenAlex search tutorial: https://github.com/ourresearch/openalex-api-tutorials -- pyalex author search patterns
- Valkey pub/sub docs: https://valkey.io/topics/pubsub/ -- channel subscription, pattern matching
- valkey-py async docs: https://valkey-py.readthedocs.io/en/latest/examples/asyncio_examples.html -- asyncio pub/sub patterns
- FastAPI WebSocket docs: https://fastapi.tiangolo.com/advanced/websockets/ -- WebSocket endpoint patterns
- pyalex GitHub: https://github.com/J535D165/pyalex -- Python OpenAlex client usage

### Secondary (MEDIUM confidence)
- Cosine similarity for researcher matching (SSRN): https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4346965 -- validated approach using cosine similarity on research profiles
- Vector embedding talent matching: https://www.ingedata.ai/blog/2025/04/01/talent-matching-with-vector-embeddings/ -- multi-embedding approach with weighted signals
- FastAPI WebSocket messaging patterns: https://blog.greeden.me/en/2025/10/28/weaponizing-real-time-websocket-sse-notifications-with-fastapi-connection-management-rooms-reconnection-scale-out-and-observability/ -- connection management, rooms, scale-out

### Tertiary (LOW confidence)
- Complementarity vs. similarity for collaboration: Inferred from academic literature on team formation. No single authoritative source for the bell-curve complementarity formula. Needs validation with real user feedback.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and used in earlier phases; no new dependencies.
- Architecture: HIGH -- Patterns directly reuse existing project conventions (separate model, async enrichment, Valkey pub/sub, LLM via litellm).
- Matching algorithm: MEDIUM -- Complementarity scoring is well-grounded in theory but the specific weight tuning (40/25/20/15) is a reasonable starting point, not empirically validated.
- Pitfalls: MEDIUM-HIGH -- Based on common patterns in real-time messaging systems and academic matching platforms.

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no fast-moving dependencies)
