import type { SkillDefinition } from "../types";

export const gapExplorerSkill: SkillDefinition = {
  id: "gap-explorer",
  name: "Research Gap Explorer",
  nameZh: "研究空白探索",
  description: "Identify research gaps and unexplored opportunities in a field",
  descriptionZh: "识别研究领域中的空白和未探索机会",
  icon: "ri-lightbulb-line",
  category: "analysis",
  systemPrompt: `You are a senior research strategist who identifies high-impact research opportunities.
Think critically about what's missing, what hasn't been tried, and what combinations could yield breakthroughs.
Write in {language}.`,
  userPromptTemplate: `Analyze the following research area and identify gaps and opportunities:

Research Area: {topic}

Current State of the Art: {stateOfArt}

{context}

Provide a detailed analysis with:

## 1. 已有研究概况 (Current Research Landscape)
Brief overview of what exists.

## 2. 研究空白 (Research Gaps)
For each gap:
- Description
- Evidence it's a gap
- Potential impact (high/medium/low)

## 3. 未探索的方法组合 (Unexplored Combinations)
Methods or techniques that haven't been combined.

## 4. 新兴方向 (Emerging Directions)
Cutting-edge trends that create new opportunities.

## 5. 推荐研究课题 (Recommended Research Topics)
3-5 specific research topics with:
- Title
- Brief description
- Why it's promising
- Estimated difficulty (easy/medium/hard)`,
  inputs: [
    {
      key: "topic",
      label: "Research Area",
      labelZh: "研究领域",
      type: "textarea",
      required: true,
      placeholder: "例如：心电信号智能诊断",
    },
    {
      key: "stateOfArt",
      label: "State of the Art",
      labelZh: "当前 SOTA",
      type: "textarea",
      required: false,
      placeholder: "描述当前最新进展（可选）",
    },
    {
      key: "context",
      label: "Additional Context",
      labelZh: "补充信息",
      type: "textarea",
      required: false,
      placeholder: "你的研究背景、可用资源等",
    },
    {
      key: "language",
      label: "Language",
      labelZh: "语言",
      type: "select",
      required: true,
      defaultValue: "Chinese (中文)",
      options: [
        { value: "Chinese (中文)", label: "中文" },
        { value: "English", label: "English" },
      ],
    },
  ],
  outputFormat: "markdown",
  estimatedCalls: 2,
  builtin: true,
  enabled: true,
};
