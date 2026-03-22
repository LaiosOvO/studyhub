import type { SkillDefinition } from "../types";

export const paperReaderSkill: SkillDefinition = {
  id: "paper-reader",
  name: "Paper Reader",
  nameZh: "论文精读助手",
  description: "Deep-read a paper and extract structured insights",
  descriptionZh: "深度阅读论文，提取结构化的见解和笔记",
  icon: "ri-article-line",
  category: "literature",
  systemPrompt: `You are an expert paper reader who excels at extracting key information from academic papers.
Be thorough but concise. Focus on actionable insights. Write in {language}.`,
  userPromptTemplate: `Deep-read the following paper and provide a structured analysis:

Title: {title}
Content: {content}

Provide:

## 1. 一句话总结 (TL;DR)
One-sentence summary of the paper.

## 2. 核心贡献 (Key Contributions)
- Main contributions (3-5 bullet points)

## 3. 方法详解 (Method Details)
Detailed explanation of the proposed approach.

## 4. 实验结果 (Key Results)
Most important experimental results and findings.

## 5. 创新点 (What's Novel)
What makes this paper different from prior work.

## 6. 局限性 (Limitations)
Acknowledged or observed limitations.

## 7. 启发与思考 (Insights & Takeaways)
What can be learned or applied from this paper.

## 8. 相关工作建议 (Related Work Suggestions)
Papers to read next based on this paper's references.`,
  inputs: [
    {
      key: "title",
      label: "Paper Title",
      labelZh: "论文标题",
      type: "text",
      required: true,
      placeholder: "论文标题",
    },
    {
      key: "content",
      label: "Paper Content",
      labelZh: "论文内容",
      type: "textarea",
      required: true,
      placeholder: "粘贴论文摘要或全文内容",
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
  estimatedCalls: 1,
  builtin: true,
  enabled: true,
};
