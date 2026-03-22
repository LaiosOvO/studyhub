/**
 * Skill registry — manages built-in and user-defined skills.
 * Stores user skills in localStorage for persistence.
 */

import type { SkillDefinition } from "./types";
import { literatureReviewSkill } from "./skills/literature-review";
import { experimentPlanSkill } from "./skills/experiment-plan";
import { abstractTranslatorSkill } from "./skills/abstract-translator";
import { paperComparisonSkill } from "./skills/paper-comparison";
import { gapExplorerSkill } from "./skills/gap-explorer";
import { methodologyAdvisorSkill } from "./skills/methodology-advisor";
import { paperReaderSkill } from "./skills/paper-reader";
import { writingPolishSkill } from "./skills/writing-polish";

const STORAGE_KEY = "studyhub_custom_skills";
const DISABLED_KEY = "studyhub_disabled_skills";

/** All built-in skills */
const BUILTIN_SKILLS: SkillDefinition[] = [
  literatureReviewSkill,
  experimentPlanSkill,
  paperReaderSkill,
  paperComparisonSkill,
  gapExplorerSkill,
  methodologyAdvisorSkill,
  abstractTranslatorSkill,
  writingPolishSkill,
];

/**
 * Get disabled skill IDs from localStorage.
 */
function getDisabledIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISABLED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Get custom skills from localStorage.
 */
function getCustomSkills(): SkillDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Get all skills (built-in + custom), with enabled state applied.
 */
export function getAllSkills(): SkillDefinition[] {
  const disabled = getDisabledIds();
  const builtins = BUILTIN_SKILLS.map((s) => ({
    ...s,
    enabled: !disabled.has(s.id),
  }));
  const custom = getCustomSkills().map((s) => ({
    ...s,
    enabled: !disabled.has(s.id),
  }));
  return [...builtins, ...custom];
}

/**
 * Get only enabled skills.
 */
export function getEnabledSkills(): SkillDefinition[] {
  return getAllSkills().filter((s) => s.enabled);
}

/**
 * Get a skill by ID.
 */
export function getSkillById(id: string): SkillDefinition | undefined {
  return getAllSkills().find((s) => s.id === id);
}

/**
 * Toggle a skill's enabled state.
 */
export function toggleSkill(id: string, enabled: boolean): void {
  const disabled = getDisabledIds();
  if (enabled) {
    disabled.delete(id);
  } else {
    disabled.add(id);
  }
  localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
}

/**
 * Save a custom skill.
 */
export function saveCustomSkill(skill: SkillDefinition): void {
  const customs = getCustomSkills();
  const idx = customs.findIndex((s) => s.id === skill.id);
  const updated = idx >= 0
    ? customs.map((s, i) => (i === idx ? { ...skill, builtin: false } : s))
    : [...customs, { ...skill, builtin: false }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Delete a custom skill.
 */
export function deleteCustomSkill(id: string): void {
  const customs = getCustomSkills().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
}

/**
 * Get skills grouped by category.
 */
export function getSkillsByCategory(): Record<string, SkillDefinition[]> {
  const skills = getEnabledSkills();
  const grouped: Record<string, SkillDefinition[]> = {};
  for (const skill of skills) {
    const cat = skill.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(skill);
  }
  return grouped;
}

export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  literature: { label: "文献研究", icon: "ri-book-open-line" },
  experiment: { label: "实验设计", icon: "ri-flask-line" },
  analysis: { label: "分析工具", icon: "ri-pie-chart-line" },
  writing: { label: "学术写作", icon: "ri-quill-pen-line" },
  translation: { label: "翻译工具", icon: "ri-translate-2" },
  custom: { label: "自定义", icon: "ri-tools-line" },
};
