/**
 * Citation Network Fetcher
 *
 * Fetches paper citation relationships (references + cited-by) from multiple APIs.
 * Follows patterns from Local Citation Network (github.com/LocalCitationNetwork).
 *
 * Data sources (in priority order):
 *   1. OpenAlex   — batch up to 50 IDs via OR `|`, cursor pagination, free
 *   2. Semantic Scholar — batch POST up to 500 IDs, richer data
 *
 * All calls run browser-side to avoid server IP rate limits.
 */

// ── Types ─────────────────────────────────────────────────────────

export interface CitationPaper {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  citationCount: number;
  venue: string;
  abstract?: string;
  referenceIds: string[];
  citedByIds: string[];
}

export interface CitationNetwork {
  center: CitationPaper;
  references: CitationPaper[];
  citedBy: CitationPaper[];
  abstract: string | null;
}

// ── Constants ─────────────────────────────────────────────────────

const OA_BASE = "https://api.openalex.org";
const S2_BASE = "https://api.semanticscholar.org/graph/v1";
const MAILTO = "studyhub@studyhub.ai";
const OA_SELECT = "id,doi,title,publication_year,cited_by_count,authorships,primary_location,referenced_works,abstract_inverted_index";
const OA_SELECT_LIGHT = "id,title,publication_year,cited_by_count,authorships,primary_location";

// ── Helpers ───────────────────────────────────────────────────────

function stripOaPrefix(url: string): string {
  return url.replace("https://openalex.org/", "");
}

function reconstructAbstract(aii: Record<string, number[]> | null | undefined): string | null {
  if (!aii) return null;
  const positions: Record<number, string> = {};
  for (const [word, posList] of Object.entries(aii)) {
    for (const pos of posList) {
      positions[pos] = word;
    }
  }
  return Object.keys(positions)
    .map(Number)
    .sort((a, b) => a - b)
    .map(i => positions[i])
    .join(" ");
}

function parseOaWork(w: Record<string, unknown>): CitationPaper {
  const authorships = (w.authorships as Array<Record<string, unknown>>) || [];
  const authors = authorships
    .slice(0, 5)
    .map(a => ((a.author as Record<string, string>)?.display_name || ""))
    .filter(Boolean);
  const loc = (w.primary_location as Record<string, unknown>) || {};
  const src = (loc.source as Record<string, string>) || {};
  const refWorks = (w.referenced_works as string[]) || [];
  return {
    id: stripOaPrefix((w.id as string) || ""),
    title: (w.title as string) || "",
    year: w.publication_year as number | undefined,
    citationCount: (w.cited_by_count as number) || 0,
    authors,
    venue: src.display_name || "",
    abstract: reconstructAbstract(w.abstract_inverted_index as Record<string, number[]> | undefined),
    referenceIds: refWorks.map(stripOaPrefix),
    citedByIds: [],
  };
}

/** Single fetch — NO retry on 429, just return the response */
async function fetchOnce(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options);
}

// ── OpenAlex API ──────────────────────────────────────────────────

async function oaGetWork(oaId: string): Promise<CitationPaper | null> {
  try {
    const resp = await fetchOnce(
      `${OA_BASE}/works/${oaId}?select=${OA_SELECT}&mailto=${MAILTO}`
    );
    if (!resp.ok) return null;
    return parseOaWork(await resp.json());
  } catch {
    return null;
  }
}

/**
 * Batch fetch works by OpenAlex IDs (up to 50 per request via OR filter).
 * Returns empty immediately on 429 (caller should switch to S2).
 */
async function oaBatchFetch(oaIds: string[], maxResults = 200): Promise<CitationPaper[]> {
  if (oaIds.length === 0) return [];
  const results: CitationPaper[] = [];

  for (let i = 0; i < oaIds.length; i += 50) {
    const chunk = oaIds.slice(i, i + 50);
    const filterValue = chunk.join("|");
    let cursor: string | null = "*";

    while (cursor && results.length < maxResults) {
      try {
        const resp = await fetchOnce(
          `${OA_BASE}/works?filter=openalex:${filterValue}&per_page=50&select=${OA_SELECT_LIGHT}&cursor=${cursor}&mailto=${MAILTO}`
        );
        if (resp.status === 429) return results; // Rate limited — return what we have
        if (!resp.ok) break;
        const data = await resp.json();
        for (const w of data.results || []) {
          results.push(parseOaWork(w));
        }
        cursor = data.meta?.next_cursor ?? null;
        if (!data.results?.length) break;
      } catch {
        break;
      }
    }
  }
  return results;
}

async function oaGetCitedBy(oaId: string, maxResults = 50): Promise<CitationPaper[]> {
  const results: CitationPaper[] = [];
  let cursor: string | null = "*";

  while (cursor && results.length < maxResults) {
    try {
      const resp = await fetchOnce(
        `${OA_BASE}/works?filter=cites:${oaId}&sort=cited_by_count:desc&per_page=50&select=${OA_SELECT_LIGHT}&cursor=${cursor}&mailto=${MAILTO}`
      );
      if (resp.status === 429) return results; // Rate limited
      if (!resp.ok) break;
      const data = await resp.json();
      for (const w of data.results || []) {
        results.push(parseOaWork(w));
      }
      cursor = data.meta?.next_cursor ?? null;
      if (!data.results?.length) break;
    } catch {
      break;
    }
  }
  return results.slice(0, maxResults);
}

// ── Semantic Scholar API ──────────────────────────────────────────

interface S2PaperFull {
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  authors: { name: string }[];
  venue: string;
  abstract: string | null;
  references: { paperId: string | null }[];
  citations: { paperId: string | null }[];
  externalIds?: Record<string, string>;
}

function parseS2Paper(p: S2PaperFull): CitationPaper {
  return {
    id: p.paperId,
    title: p.title || "",
    year: p.year ?? undefined,
    citationCount: p.citationCount || 0,
    authors: (p.authors || []).slice(0, 5).map(a => a.name).filter(Boolean),
    venue: p.venue || "",
    abstract: p.abstract ?? undefined,
    referenceIds: (p.references || []).map(r => r.paperId).filter(Boolean) as string[],
    citedByIds: (p.citations || []).map(c => c.paperId).filter(Boolean) as string[],
  };
}

/**
 * Resolve a paper to its S2 paperId.
 * Accepts: OpenAlex ID, DOI, or S2 paperId.
 * S2 /paper endpoint supports OPENALEX: and DOI: prefixes, but
 * /references and /citations ONLY accept S2 paperId.
 */
async function s2ResolvePaperId(query: string): Promise<string | null> {
  try {
    const resp = await fetchOnce(`${S2_BASE}/paper/${query}?fields=paperId`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.paperId || null;
  } catch {
    return null;
  }
}

async function s2GetPaper(query: string): Promise<CitationPaper | null> {
  try {
    const fields = "paperId,title,year,citationCount,authors,venue,abstract,references.paperId,citations.paperId,externalIds";
    const resp = await fetchOnce(`${S2_BASE}/paper/${query}?fields=${fields}`);
    if (!resp.ok) return null;
    return parseS2Paper(await resp.json());
  } catch {
    return null;
  }
}

/**
 * Fetch references for a paper from S2.
 * IMPORTANT: s2Id must be a real S2 paperId (40-char hex), NOT an OPENALEX: prefixed ID.
 */
async function s2GetReferences(s2Id: string, maxResults = 50): Promise<CitationPaper[]> {
  const results: CitationPaper[] = [];
  let offset = 0;

  while (results.length < maxResults) {
    try {
      const resp = await fetchOnce(
        `${S2_BASE}/paper/${s2Id}/references?fields=paperId,title,year,citationCount,authors,venue&limit=500&offset=${offset}`
      );
      if (!resp.ok) break;
      const data = await resp.json();
      const items = data.data || [];
      for (const item of items) {
        const p = item.citedPaper;
        if (p?.paperId) {
          results.push({
            id: p.paperId,
            title: p.title || "",
            year: p.year ?? undefined,
            citationCount: p.citationCount || 0,
            authors: (p.authors || []).slice(0, 5).map((a: { name: string }) => a.name).filter(Boolean),
            venue: p.venue || "",
            referenceIds: [],
            citedByIds: [],
          });
        }
      }
      if (!items.length || data.next === undefined) break;
      offset = data.next;
    } catch {
      break;
    }
  }
  return results.slice(0, maxResults);
}

async function s2GetCitations(s2Id: string, maxResults = 50): Promise<CitationPaper[]> {
  const results: CitationPaper[] = [];
  let offset = 0;

  while (results.length < maxResults) {
    try {
      const resp = await fetchOnce(
        `${S2_BASE}/paper/${s2Id}/citations?fields=paperId,title,year,citationCount,authors,venue&limit=500&offset=${offset}`
      );
      if (!resp.ok) break;
      const data = await resp.json();
      const items = data.data || [];
      for (const item of items) {
        const p = item.citingPaper;
        if (p?.paperId) {
          results.push({
            id: p.paperId,
            title: p.title || "",
            year: p.year ?? undefined,
            citationCount: p.citationCount || 0,
            authors: (p.authors || []).slice(0, 5).map((a: { name: string }) => a.name).filter(Boolean),
            venue: p.venue || "",
            referenceIds: [],
            citedByIds: [],
          });
        }
      }
      if (!items.length || data.next === undefined) break;
      offset = data.next;
    } catch {
      break;
    }
  }
  return results.slice(0, maxResults);
}

// ── Main Public API ───────────────────────────────────────────────

export interface FetchCitationNetworkOptions {
  openalexId?: string;
  doi?: string;
  maxReferences?: number;
  maxCitedBy?: number;
  onProgress?: (stage: string, detail: string) => void;
}

/**
 * Fetch complete citation network for a paper.
 *
 * Strategy:
 *   1. Get seed paper from OpenAlex (single-work requests usually not rate-limited)
 *   2. Try OpenAlex batch for references + cited-by
 *   3. If OpenAlex 429 → immediately switch to Semantic Scholar
 *   4. For S2: first resolve to S2 paperId, then use /references and /citations
 */
export async function fetchCitationNetwork(
  opts: FetchCitationNetworkOptions
): Promise<CitationNetwork | null> {
  const { openalexId, doi, maxReferences = 50, maxCitedBy = 30, onProgress } = opts;

  if (!openalexId && !doi) return null;

  onProgress?.("start", "正在获取论文信息...");

  // ── Phase 1: Get seed paper (OpenAlex single-work usually works) ──
  let center: CitationPaper | null = null;

  if (openalexId) {
    center = await oaGetWork(openalexId);
  }
  if (!center && doi) {
    center = await oaGetWork(`doi:${doi}`);
  }

  // Fallback: get from S2
  if (!center) {
    const s2Query = openalexId ? `OPENALEX:${openalexId}` : doi ? `DOI:${doi}` : null;
    if (s2Query) {
      center = await s2GetPaper(s2Query);
    }
  }

  if (!center) {
    console.warn("[citation-fetcher] Could not fetch seed paper from any source");
    return null;
  }

  onProgress?.("seed", `获取到论文: ${center.title.slice(0, 50)}...`);

  // ── Phase 2: Try OpenAlex batch (no retry, fail fast on 429) ──
  let references: CitationPaper[] = [];
  let citedBy: CitationPaper[] = [];

  if (openalexId) {
    onProgress?.("references", `正在从 OpenAlex 获取 ${center.referenceIds.length} 篇参考文献...`);

    const refOaIds = center.referenceIds.slice(0, maxReferences);
    const [refsResult, citedByResult] = await Promise.allSettled([
      oaBatchFetch(refOaIds, maxReferences),
      oaGetCitedBy(openalexId, maxCitedBy),
    ]);

    if (refsResult.status === "fulfilled") references = refsResult.value;
    if (citedByResult.status === "fulfilled") citedBy = citedByResult.value;
  }

  // ── Phase 3: If OpenAlex returned nothing, switch to S2 ──
  if (references.length === 0 && citedBy.length === 0) {
    onProgress?.("fallback", "切换到 Semantic Scholar...");

    // Step 1: Resolve to S2 paperId (CRITICAL — /references and /citations need real S2 ID)
    // Try DOI first (best support in S2), then OpenAlex ID
    let s2PaperId: string | null = null;

    if (doi) {
      s2PaperId = await s2ResolvePaperId(`DOI:${doi}`);
      console.log(`[citation-fetcher] S2 resolved DOI:${doi} → ${s2PaperId}`);
    }
    if (!s2PaperId && openalexId) {
      s2PaperId = await s2ResolvePaperId(`OPENALEX:${openalexId}`);
      console.log(`[citation-fetcher] S2 resolved OPENALEX:${openalexId} → ${s2PaperId}`);
    }

    if (s2PaperId) {
      onProgress?.("references", "正在从 Semantic Scholar 获取引用关系...");

      // Step 2: Fetch references and citations using the REAL S2 paperId
      const [refsResult, citedByResult] = await Promise.allSettled([
        s2GetReferences(s2PaperId, maxReferences),
        s2GetCitations(s2PaperId, maxCitedBy),
      ]);

      if (refsResult.status === "fulfilled") references = refsResult.value;
      if (citedByResult.status === "fulfilled") citedBy = citedByResult.value;
    } else {
      console.warn("[citation-fetcher] Could not resolve S2 paperId");
    }
  }

  onProgress?.("done", `完成: ${references.length} 篇参考文献, ${citedBy.length} 篇被引`);

  return {
    center,
    references,
    citedBy,
    abstract: center.abstract ?? null,
  };
}

// ── Convert to legacy format ──────────────────────────────────────

export function networkToLegacyResponse(network: CitationNetwork) {
  const mapPaper = (p: CitationPaper) => ({
    openalex_id: p.id,
    title: p.title,
    year: p.year,
    citation_count: p.citationCount,
    authors: p.authors,
    venue: p.venue,
  });

  return {
    references: network.references.map(mapPaper),
    cited_by: network.citedBy.map(mapPaper),
    abstract: network.abstract,
    total_references: network.references.length,
    total_cited_by: network.citedBy.length,
  };
}
