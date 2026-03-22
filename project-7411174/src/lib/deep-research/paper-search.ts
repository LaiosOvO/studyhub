/**
 * Client-side academic paper search via OpenAlex API.
 * Runs entirely in the browser — no backend needed.
 *
 * Reference: citation-fetcher.ts OpenAlex patterns.
 */

import type { SearchedPaper } from "./types";

const OA_BASE = "https://api.openalex.org";
const MAILTO = "studyhub@studyhub.ai";
const OA_FIELDS = "id,doi,title,publication_year,cited_by_count,authorships,primary_location,referenced_works,abstract_inverted_index";

function stripOaPrefix(url: string): string {
  return url.replace("https://openalex.org/", "");
}

function reconstructAbstract(aii: Record<string, number[]> | null | undefined): string | null {
  if (!aii) return null;
  const positions: Record<number, string> = {};
  for (const [word, posList] of Object.entries(aii)) {
    for (const pos of posList) positions[pos] = word;
  }
  return Object.keys(positions)
    .map(Number)
    .sort((a, b) => a - b)
    .map(i => positions[i])
    .join(" ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOaWork(w: any): SearchedPaper {
  const authorships = w.authorships || [];
  const authors = authorships
    .slice(0, 10)
    .map((a: { author?: { display_name?: string } }) => a.author?.display_name || "")
    .filter(Boolean);
  const loc = w.primary_location || {};
  const src = loc.source || {};
  const refWorks: string[] = (w.referenced_works || []).map(stripOaPrefix);
  const doi = w.doi?.replace("https://doi.org/", "") ?? undefined;

  return {
    id: stripOaPrefix(w.id || ""),
    title: w.title || "",
    abstract: reconstructAbstract(w.abstract_inverted_index),
    authors,
    year: w.publication_year ?? null,
    venue: src.display_name || "",
    citationCount: w.cited_by_count || 0,
    referenceIds: refWorks,
    citedByIds: [],
    doi,
    openalexId: stripOaPrefix(w.id || ""),
  };
}

/**
 * Search papers by keyword query via OpenAlex.
 */
export async function searchPapers(opts: {
  query: string;
  maxResults?: number;
  yearFrom?: number;
  yearTo?: number;
  onProgress?: (msg: string) => void;
}): Promise<SearchedPaper[]> {
  const { query, maxResults = 100, yearFrom, yearTo, onProgress } = opts;
  const results: SearchedPaper[] = [];
  let cursor: string | null = "*";
  let page = 0;

  // Build filter
  const filters: string[] = [];
  if (yearFrom) filters.push(`from_publication_date:${yearFrom}-01-01`);
  if (yearTo) filters.push(`to_publication_date:${yearTo}-12-31`);
  const filterStr = filters.length > 0 ? `&filter=${filters.join(",")}` : "";

  while (cursor && results.length < maxResults) {
    page++;
    onProgress?.(`搜索第 ${page} 页...`);

    try {
      const resp = await fetch(
        `${OA_BASE}/works?search=${encodeURIComponent(query)}&per_page=50&select=${OA_FIELDS}&sort=cited_by_count:desc&cursor=${cursor}${filterStr}&mailto=${MAILTO}`
      );

      if (resp.status === 429) {
        onProgress?.("OpenAlex 限流，等待后重试...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!resp.ok) break;
      const data = await resp.json();

      for (const w of data.results || []) {
        results.push(parseOaWork(w));
      }

      cursor = data.meta?.next_cursor ?? null;
      if (!data.results?.length) break;
      onProgress?.(`已搜索到 ${results.length} 篇论文`);
    } catch (err) {
      onProgress?.(`搜索出错: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  return results.slice(0, maxResults);
}

/**
 * Expand citation network: fetch references for given papers.
 * Returns newly discovered papers (not already in known set).
 */
export async function expandCitations(opts: {
  papers: SearchedPaper[];
  maxNew?: number;
  onProgress?: (msg: string) => void;
}): Promise<SearchedPaper[]> {
  const { papers, maxNew = 50, onProgress } = opts;
  const knownIds = new Set(papers.map(p => p.id));
  const newPapers: SearchedPaper[] = [];

  // Collect all reference IDs from existing papers
  const allRefIds: string[] = [];
  for (const paper of papers) {
    for (const refId of paper.referenceIds) {
      if (!knownIds.has(refId)) allRefIds.push(refId);
    }
  }

  // Deduplicate
  const uniqueRefIds = [...new Set(allRefIds)].slice(0, maxNew * 2);
  if (uniqueRefIds.length === 0) return [];

  onProgress?.(`扩展引用网络: 获取 ${uniqueRefIds.length} 篇被引论文...`);

  // Batch fetch via OpenAlex OR filter (50 per batch)
  for (let i = 0; i < uniqueRefIds.length && newPapers.length < maxNew; i += 50) {
    const chunk = uniqueRefIds.slice(i, i + 50);
    const filterValue = chunk.join("|");

    try {
      const resp = await fetch(
        `${OA_BASE}/works?filter=openalex:${filterValue}&per_page=50&select=${OA_FIELDS}&mailto=${MAILTO}`
      );
      if (resp.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!resp.ok) break;
      const data = await resp.json();
      for (const w of data.results || []) {
        const paper = parseOaWork(w);
        if (!knownIds.has(paper.id)) {
          knownIds.add(paper.id);
          newPapers.push(paper);
        }
      }
    } catch {
      break;
    }
  }

  onProgress?.(`引用扩展完成: 新增 ${newPapers.length} 篇论文`);
  return newPapers;
}
