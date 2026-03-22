import type { SkillDefinition } from "../types";

export const paperComparisonSkill: SkillDefinition = {
  id: "paper-comparison",
  name: "Paper Comparison",
  nameZh: "论文对比分析",
  description: "Compare 2-5 papers on methodology, results, and contributions",
  descriptionZh: "对比分析 2-5 篇论文的方法论、实验结果和贡献",
  icon: "ri-scales-line",
  category: "analysis",
  systemPrompt: `You are an expert in comparative analysis of academic papers.
Provide objective, balanced comparisons. Write in {language}.`,
  userPromptTemplate: `Compare the following papers in a structured analysis:

{papers}

Generate a comparison with these sections:

## 1. 方法对比 (Methodology Comparison)
A table comparing key aspects of each method.

## 2. 实验设计对比 (Experiment Design)
Datasets, metrics, and evaluation protocols used by each paper.

## 3. 结果对比 (Results Comparison)
Key results and performance differences.

## 4. 优劣势分析 (Strengths and Weaknesses)
Each paper's strengths and limitations.

## 5. 综合评价 (Overall Assessment)
Which approach is most promising and why.

Use markdown tables where appropriate.`,
  inputs: [
    {
      key: "papers",
      label: "Papers to Compare",
      labelZh: "对比论文",
      type: "textarea",
      required: true,
      placeholder: "列出 2-5 篇论文的标题和摘要（每篇一段）",
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
