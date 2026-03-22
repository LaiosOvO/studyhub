/**
 * Client-side paper quality scoring.
 * Pure functions — no API calls.
 *
 * Reference: backend quality_scorer.py normalization logic.
 */

import type { SearchedPaper, ScoredPaper } from "./types";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Compute quality score from citation count and year.
 * Normalization matches backend logic:
 * - Citations: min(log10(count+1)/4.0, 1.0)
 * - Velocity: min(velocity/50.0, 1.0)
 */
export function scorePaper(paper: SearchedPaper): ScoredPaper {
  const citationsNorm = Math.min(Math.log10(paper.citationCount + 1) / 4.0, 1.0);

  let velocity: number;
  if (paper.year !== null && paper.year < CURRENT_YEAR) {
    const yearsSince = CURRENT_YEAR - paper.year + 1;
    velocity = paper.citationCount / yearsSince;
  } else {
    velocity = paper.citationCount;
  }
  const velocityNorm = Math.min(velocity / 50.0, 1.0);

  // Weighted average (citations 0.4, velocity 0.3, no impact/h-index on client)
  const qualityScore = Math.round(
    Math.min(citationsNorm * 0.55 + velocityNorm * 0.45, 1.0) * 10000
  ) / 10000;

  return {
    ...paper,
    qualityScore,
    citationsNorm: Math.round(citationsNorm * 10000) / 10000,
    velocityNorm: Math.round(velocityNorm * 10000) / 10000,
  };
}

/**
 * Score and sort papers by quality.
 */
export function scorePapers(papers: SearchedPaper[]): ScoredPaper[] {
  return papers
    .map(scorePaper)
    .sort((a, b) => b.qualityScore - a.qualityScore);
}
