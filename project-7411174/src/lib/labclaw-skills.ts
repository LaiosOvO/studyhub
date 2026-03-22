/**
 * LabClaw Skill Loader — loads skill markdown files as LLM system prompts.
 *
 * Skills from: https://github.com/wu-yc/LabClaw
 * Each skill is a SKILL.md file with frontmatter + instructions.
 *
 * In Tauri: reads from local filesystem.
 * In web: uses bundled skill excerpts.
 */

// Mapping of paper stages to LabClaw skills
export const STAGE_SKILLS: Record<string, string[]> = {
  literature_review: [
    "literature/citation-management",
    "literature/literature-review",
    "literature/arxiv-search",
  ],
  method_design: [
    "general/scientific-writing",
    "general/pytorch-lightning",
    "general/statistics",
  ],
  experiment_analysis: [
    "visualization/scientific-visualization",
    "visualization/matplotlib",
    "general/statistics",
    "general/exploratory-data-analysis",
  ],
  results_writing: [
    "general/scientific-writing",
    "general/statistics",
    "visualization/scientific-visualization",
  ],
  intro_abstract: [
    "general/scientific-writing",
    "literature/citation-management",
    "literature/literature-review",
  ],
  discussion_conclusion: [
    "general/scientific-writing",
    "general/scientific-critical-thinking",
    "general/scientific-brainstorming",
  ],
  supplementary: [
    "general/statistics",
    "general/scientific-writing",
  ],
  latex_compile: [
    "general/scientific-writing",
  ],
  data_preparation: [
    "general/exploratory-data-analysis",
    "general/scikit-learn",
  ],
};

// Skill base path — configurable via localStorage, defaults to bundled path
function getSkillBase(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("labclaw_skills_path");
    if (custom) return custom;
  }
  return "/Users/admin/ai/ref/LabClaw/skills";
}

/**
 * Load skill content from filesystem (Tauri only).
 * Extracts the first 2000 chars of each skill for use as system prompt.
 */
async function loadSkillFromFS(skillPath: string): Promise<string | null> {
  try {
    // Only works in Tauri environment
    const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
    if (!isTauri) return null;

    // Dynamic import to avoid build errors in web mode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tauri = await (Function('return import("@tauri-apps/api/core")')() as Promise<any>);
    const basePath = getSkillBase();
    const content = await tauri.invoke("read_skill_file", {
      skillPath: `${skillPath}/SKILL.md`,
      basePath,
    }).catch(() => null);

    if (!content) return null;

    // Extract the most useful parts: Overview + When to Use + Quick Start + Core sections
    // Limit to ~3000 chars to not blow up the context
    const lines = content.split("\n");
    const sections: string[] = [];
    let currentSection = "";
    let charCount = 0;
    const MAX_CHARS = 3000;

    for (const line of lines) {
      if (line.startsWith("---") && sections.length === 0) continue; // skip frontmatter
      if (charCount > MAX_CHARS) break;

      if (line.startsWith("## ")) {
        if (currentSection) sections.push(currentSection);
        currentSection = line + "\n";
      } else {
        currentSection += line + "\n";
      }
      charCount += line.length;
    }
    if (currentSection) sections.push(currentSection);

    return sections.join("\n");
  } catch {
    return null;
  }
}

/**
 * Build a system prompt for a paper stage by loading relevant LabClaw skills.
 * Falls back to built-in prompts if skills can't be loaded.
 */
export async function buildSkillPrompt(stage: string): Promise<string> {
  const skillPaths = STAGE_SKILLS[stage] || [];
  const loadedSkills: string[] = [];

  for (const sp of skillPaths) {
    const content = await loadSkillFromFS(sp);
    if (content) {
      loadedSkills.push(`=== SKILL: ${sp} ===\n${content}`);
    }
  }

  if (loadedSkills.length > 0) {
    return `You are an expert scientific research assistant. Follow these specialized skill instructions:

${loadedSkills.join("\n\n")}

CRITICAL RULES from skills:
- Write in full paragraphs with flowing prose (NEVER bullet points in final output)
- Use IMRAD structure for papers
- Always include proper citations
- Figures must be publication quality (300 DPI, colorblind-safe palette)
- Statistical reporting must include test statistic, p-value, confidence interval, effect size
- Use the two-stage process: (1) outline key points, (2) convert to prose`;
  }

  // Fallback: return built-in stage-specific prompts
  return FALLBACK_PROMPTS[stage] || "You are a scientific writing expert. Write in academic Chinese.";
}

// Built-in fallback prompts when skills can't be loaded
const FALLBACK_PROMPTS: Record<string, string> = {
  literature_review: `You are an academic researcher expert in literature review.
- Search and cite 15-20 relevant papers in the field
- Use citation format: [AuthorYear]
- Structure: by research theme, not chronologically
- Include both seminal works and recent advances (2020+)
- Generate valid BibTeX entries for all cited papers`,

  method_design: `You are a scientific writing expert specializing in methodology.
- Describe problem formulation with mathematical notation
- Detail model architecture (layers, dimensions, activation functions)
- Explain training strategy (optimizer, learning rate schedule, regularization)
- Justify design choices with references
- Write in flowing prose, not bullet points`,

  experiment_analysis: `You are a data scientist specializing in experiment analysis.
- Generate publication-quality figure scripts (300 DPI, PDF+PNG)
- Use colorblind-friendly palette (Okabe-Ito or similar)
- Include proper axis labels, legends, error bars
- Create statistical summary tables in LaTeX format
- Font size: 12pt labels, legible at column width`,

  results_writing: `You are a scientific writing expert.
- Report specific numerical results with confidence intervals
- Compare with baseline: absolute and relative improvements
- Discuss statistical significance (p-values, effect sizes)
- Reference figures and tables by number
- Write in flowing prose, not bullet points`,

  intro_abstract: `You are a scientific writing expert.
- Abstract: 300 words, structured (Background → Method → Results → Conclusion)
- Introduction: Start broad (field importance), narrow to specific problem, state contributions
- List 3-4 specific contributions
- End with paper structure overview
- Write in flowing prose`,

  discussion_conclusion: `You are a scientific writing expert.
- Discuss implications of each key finding
- Compare with related work (cite specific papers)
- List at least 3 limitations with honesty
- Suggest 2-3 concrete future research directions
- Conclusion: summarize contributions, broader impact`,

  supplementary: `You are a research documentation expert.
- Provide complete experiment details for reproducibility
- Include all hyperparameters in tabular format
- Document hardware/software environment
- Describe architecture evolution chronologically`,

  latex_compile: `You are a LaTeX expert.
- Use article class with ctex package for Chinese
- Compile with xelatex
- Include all sections from the paper
- Use BibTeX for references
- Include figure and table floats with proper captions`,
};
