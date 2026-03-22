import type { SkillDefinition } from "../types";

export const abstractTranslatorSkill: SkillDefinition = {
  id: "abstract-translator",
  name: "Abstract Translator",
  nameZh: "摘要翻译润色",
  description: "Translate and polish academic abstracts between Chinese and English",
  descriptionZh: "中英文学术摘要互译，保持学术用语规范",
  icon: "ri-translate-2",
  category: "translation",
  systemPrompt: `You are an expert academic translator specializing in {field} research.
Translate with precision: preserve technical terms, maintain academic tone, ensure fluency.
For Chinese→English: use standard academic English conventions.
For English→Chinese: use standard Chinese academic writing conventions.`,
  userPromptTemplate: `Translate the following academic abstract from {sourceLanguage} to {targetLanguage}.

Field: {field}

<abstract>
{text}
</abstract>

Rules:
- Preserve all technical terms accurately
- Maintain academic tone and style
- Keep the same paragraph structure
- Ensure natural fluency in the target language
- Provide the translated text only, no explanations`,
  inputs: [
    {
      key: "text",
      label: "Abstract Text",
      labelZh: "摘要文本",
      type: "textarea",
      required: true,
      placeholder: "粘贴需要翻译的摘要文本",
    },
    {
      key: "sourceLanguage",
      label: "Source Language",
      labelZh: "源语言",
      type: "select",
      required: true,
      defaultValue: "English",
      options: [
        { value: "English", label: "English" },
        { value: "Chinese", label: "中文" },
      ],
    },
    {
      key: "targetLanguage",
      label: "Target Language",
      labelZh: "目标语言",
      type: "select",
      required: true,
      defaultValue: "Chinese",
      options: [
        { value: "Chinese", label: "中文" },
        { value: "English", label: "English" },
      ],
    },
    {
      key: "field",
      label: "Research Field",
      labelZh: "研究领域",
      type: "text",
      required: false,
      placeholder: "例如：medical AI, signal processing",
      defaultValue: "general science",
    },
  ],
  outputFormat: "text",
  estimatedCalls: 1,
  builtin: true,
  enabled: true,
};
