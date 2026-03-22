import type { SkillDefinition } from "../types";

export const writingPolishSkill: SkillDefinition = {
  id: "writing-polish",
  name: "Academic Writing Polish",
  nameZh: "学术写作润色",
  description: "Polish and improve academic writing quality",
  descriptionZh: "润色和提升学术写作质量，改善逻辑、语法和表达",
  icon: "ri-quill-pen-line",
  category: "writing",
  systemPrompt: `You are an expert academic editor who improves writing quality while preserving the author's voice.
Focus on: clarity, logical flow, grammar, academic tone, and precision.
Write in {language}. Show both the revised text and a changelog of improvements.`,
  userPromptTemplate: `Polish the following academic text:

Document Type: {docType}
Target Journal/Venue: {venue}

<text>
{text}
</text>

Provide:
1. The polished version of the full text
2. A changelog listing each significant change with brief explanation

Format:
## 润色后的文本 (Polished Text)
[full polished text]

## 修改清单 (Changelog)
| # | Original | Revised | Reason |
|---|----------|---------|--------|
| 1 | ... | ... | ... |`,
  inputs: [
    {
      key: "text",
      label: "Text to Polish",
      labelZh: "待润色文本",
      type: "textarea",
      required: true,
      placeholder: "粘贴需要润色的学术文本",
    },
    {
      key: "docType",
      label: "Document Type",
      labelZh: "文档类型",
      type: "select",
      required: true,
      defaultValue: "paper",
      options: [
        { value: "paper", label: "论文正文" },
        { value: "abstract", label: "摘要" },
        { value: "introduction", label: "引言" },
        { value: "response", label: "审稿回复" },
        { value: "proposal", label: "基金申请" },
      ],
    },
    {
      key: "venue",
      label: "Target Venue",
      labelZh: "目标期刊/会议",
      type: "text",
      required: false,
      placeholder: "例如：IEEE TMI, MICCAI",
    },
    {
      key: "language",
      label: "Language",
      labelZh: "语言",
      type: "select",
      required: true,
      defaultValue: "English",
      options: [
        { value: "English", label: "English" },
        { value: "Chinese (中文)", label: "中文" },
      ],
    },
  ],
  outputFormat: "markdown",
  estimatedCalls: 1,
  builtin: true,
  enabled: true,
};
