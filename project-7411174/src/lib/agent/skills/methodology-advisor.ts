import type { SkillDefinition } from "../types";

export const methodologyAdvisorSkill: SkillDefinition = {
  id: "methodology-advisor",
  name: "Methodology Advisor",
  nameZh: "方法论顾问",
  description: "Recommend research methodologies based on your research question",
  descriptionZh: "根据研究问题推荐合适的研究方法和技术路线",
  icon: "ri-road-map-line",
  category: "experiment",
  systemPrompt: `You are a research methodology expert across multiple domains.
Recommend appropriate methods based on the research question, data characteristics, and constraints.
Be practical and specific. Write in {language}.`,
  userPromptTemplate: `Recommend research methodologies for the following:

Research Question: {question}
Domain: {domain}
Available Data: {data}
Constraints: {constraints}

Provide recommendations with:

## 1. 问题分析 (Problem Analysis)
Classify the research problem type and key challenges.

## 2. 推荐方法 (Recommended Methods)
For each method (recommend 3-5):
- Method name and brief description
- Why it's suitable for this problem
- Pros and cons
- Key implementation considerations
- Relevant papers/tools

## 3. 技术路线图 (Technical Roadmap)
Step-by-step implementation plan combining the best methods.

## 4. 评估策略 (Evaluation Strategy)
How to measure success — metrics, baselines, ablation studies.

## 5. 潜在风险 (Potential Risks)
What could go wrong and how to mitigate it.`,
  inputs: [
    {
      key: "question",
      label: "Research Question",
      labelZh: "研究问题",
      type: "textarea",
      required: true,
      placeholder: "你想要解决的具体研究问题",
    },
    {
      key: "domain",
      label: "Domain",
      labelZh: "研究领域",
      type: "text",
      required: true,
      placeholder: "例如：medical AI, NLP, computer vision",
    },
    {
      key: "data",
      label: "Available Data",
      labelZh: "可用数据",
      type: "textarea",
      required: false,
      placeholder: "描述你有或能获取的数据",
    },
    {
      key: "constraints",
      label: "Constraints",
      labelZh: "约束条件",
      type: "textarea",
      required: false,
      placeholder: "时间、计算资源、预算等限制",
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
