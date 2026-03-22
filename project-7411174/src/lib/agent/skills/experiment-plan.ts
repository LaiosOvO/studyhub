import type { SkillDefinition } from "../types";

export const experimentPlanSkill: SkillDefinition = {
  id: "experiment-plan",
  name: "Experiment Plan",
  nameZh: "实验方案生成",
  description: "Generate a detailed experiment plan based on research direction",
  descriptionZh: "根据研究方向和现有文献自动生成可执行的实验方案",
  icon: "ri-flask-line",
  category: "experiment",
  systemPrompt: `You are an expert research methodology consultant.
Design rigorous, reproducible experiment plans.
Write in {language}. Be specific about datasets, metrics, and baselines.`,
  userPromptTemplate: `Design a detailed experiment plan for the following research:

Research Direction: {topic}
Research Gap/Hypothesis: {hypothesis}

{context}

The plan should include:
## 1. 研究假设 (Hypothesis)
Clearly state the hypothesis to test.

## 2. 实验设计 (Experiment Design)
- Baseline methods
- Proposed approach
- Control variables

## 3. 数据集 (Datasets)
- Required datasets with sources
- Data preprocessing steps
- Train/val/test splits

## 4. 评估指标 (Metrics)
- Primary metrics
- Secondary metrics
- Statistical tests

## 5. 实施计划 (Implementation Plan)
- Technology stack
- Training configuration
- Compute requirements

## 6. 时间线 (Timeline)
- Phase breakdown with milestones

## 7. 风险分析 (Risk Analysis)
- Potential risks and mitigation strategies`,
  inputs: [
    {
      key: "topic",
      label: "Research Direction",
      labelZh: "研究方向",
      type: "textarea",
      required: true,
      placeholder: "例如：基于 Transformer 的 ECG 异常检测",
    },
    {
      key: "hypothesis",
      label: "Hypothesis / Gap",
      labelZh: "假设 / 研究空白",
      type: "textarea",
      required: false,
      placeholder: "例如：现有 CNN 方法在长程依赖建模上不足",
    },
    {
      key: "context",
      label: "Additional Context",
      labelZh: "补充信息",
      type: "textarea",
      required: false,
      placeholder: "可选：已有的实验条件、数据集、GPU 资源等",
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
