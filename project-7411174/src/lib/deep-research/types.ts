/**
 * Types for client-side deep research engine.
 */

export interface LLMConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  /** Max context window tokens for the model (default: 32000) */
  maxContextTokens: number;
}

export interface ResearchConfig {
  direction: string;
  depth: number;
  maxPapers: number;
  sources: string[];
  yearFrom: number;
  yearTo: number;
  languages: string[];
  llm: LLMConfig;
}

export interface SearchedPaper {
  id: string;
  title: string;
  abstract: string | null;
  authors: string[];
  year: number | null;
  venue: string;
  citationCount: number;
  referenceIds: string[];
  citedByIds: string[];
  doi?: string;
  openalexId?: string;
}

export interface ScoredPaper extends SearchedPaper {
  qualityScore: number;
  citationsNorm: number;
  velocityNorm: number;
}

export interface AnalyzedPaper extends ScoredPaper {
  tldrEn: string;
  tldrZh: string;
  methods: string[];
  datasets: string[];
  paperType: string;
}

export interface PaperRelationship {
  sourceId: string;
  targetId: string;
  relationship: string;
  confidence: number;
  explanation: string;
}

export interface GapAnalysis {
  gaps: { description: string; evidence: string; potential_impact: string }[];
  underexplored: { combination: string; why_promising: string }[];
  missingEvaluations: { method: string; missing: string }[];
}

export interface ResearchReport {
  overview: string;
  methodology: string;
  findings: string;
  gaps: string;
  references: string;
}

export type PipelinePhase =
  | "searching"
  | "expanding"
  | "scoring"
  | "analyzing"
  | "classifying"
  | "detecting_gaps"
  | "generating_report"
  | "completed"
  | "failed";

export interface PipelineProgress {
  phase: PipelinePhase;
  papersFound: number;
  papersAnalyzed: number;
  totalPapers: number;
  currentActivity: string;
  error: string | null;
}

export interface PipelineResult {
  papers: AnalyzedPaper[];
  relationships: PaperRelationship[];
  gapAnalysis: GapAnalysis | null;
  report: ResearchReport | null;
  totalPapers: number;
  analyzedPapers: number;
}
