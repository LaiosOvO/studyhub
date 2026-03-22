import type { SkillDefinition } from "../types";

export const literatureReviewSkill: SkillDefinition = {
  id: "literature-review",
  name: "Literature Review",
  nameZh: "文献综述生成",
  description: "Generate a comprehensive literature review from research papers",
  descriptionZh: "基于论文数据自动生成结构化文献综述，包含引用标注",
  icon: "ri-book-open-line",
  category: "literature",
  systemPrompt: `You are an expert academic writer specializing in literature reviews.
Write in {language}. Use [1], [2], etc. for inline citations.
Every factual claim must have a citation. Write analytical prose, not bullet points.`,
  userPromptTemplate: `Write a comprehensive literature review on "{topic}".

The review should include:
1. 概述 (Overview) — field introduction and significance
2. 方法论综述 (Methodology Review) — main approaches and evolution
3. 关键发现 (Key Findings) — important results and contributions
4. 研究空白与未来方向 (Gaps and Future Directions) — missing areas and opportunities

{context}

Use ## for section headings. Write 2-4 paragraphs per section.
Include inline citations [1], [2], etc.`,
  inputs: [
    {
      key: "topic",
      label: "Research Topic",
      labelZh: "研究主题",
      type: "textarea",
      required: true,
      placeholder: "例如：大语言模型在医疗影像中的应用",
    },
    {
      key: "context",
      label: "Additional Context",
      labelZh: "补充上下文",
      type: "textarea",
      required: false,
      placeholder: "可选：已有的论文列表、特定关注点等",
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
  estimatedCalls: 3,
  builtin: true,
  enabled: true,
};
