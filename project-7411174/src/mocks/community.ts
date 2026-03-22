export interface Scholar {
  id: string;
  name: string;
  avatar: string;
  institution: string;
  title: string;
  hIndex: number;
  totalCitations: number;
  paperCount: number;
  researchAreas: string[];
  matchScore?: number;
  matchReason?: string;
  complementarity: { label: string; score: number }[];
  recentPapers: { title: string; year: number; citations: number }[];
}

export const mockScholars: Scholar[] = [
  {
    id: "s001",
    name: "张伟 Wei Zhang",
    avatar: "https://readdy.ai/api/search-image?query=professional%20headshot%20of%20asian%20male%20researcher%20professor%20with%20glasses%20wearing%20formal%20attire%20neutral%20background%20high%20quality%20portrait&width=100&height=100&seq=scholar001&orientation=squarish",
    institution: "北京大学计算机科学系",
    title: "副教授",
    hIndex: 28,
    totalCitations: 12480,
    paperCount: 84,
    researchAreas: ["知识图谱", "实体关系抽取", "问答系统", "图神经网络"],
    matchScore: 94,
    matchReason: "他的知识图谱构建技术可以增强你的文献引用关系分析，互补性极高",
    complementarity: [
      { label: "研究向量相似度", score: 88 },
      { label: "技能互补性", score: 96 },
      { label: "共引分析", score: 82 },
      { label: "机构互补", score: 78 },
    ],
    recentPapers: [
      { title: "UniKG: A Unified Knowledge Graph Framework for Cross-Domain Reasoning", year: 2025, citations: 234 },
      { title: "Relation Extraction with Graph Attention Networks", year: 2024, citations: 512 },
      { title: "Few-Shot Knowledge Graph Completion via Meta-Learning", year: 2023, citations: 891 },
    ],
  },
  {
    id: "s002",
    name: "李晓明 Xiaoming Li",
    avatar: "https://readdy.ai/api/search-image?query=professional%20headshot%20asian%20female%20researcher%20scientist%20smiling%20neutral%20clean%20background%20academic%20portrait&width=100&height=100&seq=scholar002&orientation=squarish",
    institution: "清华大学人工智能研究院",
    title: "研究员",
    hIndex: 35,
    totalCitations: 21340,
    paperCount: 127,
    researchAreas: ["大语言模型", "代码生成", "程序合成", "自动化测试"],
    matchScore: 89,
    matchReason: "在 LLM 代码生成领域的深厚积累与你的 AI 实验自动化方向高度契合",
    complementarity: [
      { label: "研究向量相似度", score: 92 },
      { label: "技能互补性", score: 85 },
      { label: "共引分析", score: 91 },
      { label: "机构互补", score: 72 },
    ],
    recentPapers: [
      { title: "AlphaCode 2: Competitive Programming with LLMs at Scale", year: 2025, citations: 1823 },
      { title: "Self-Debugging: Teaching LLMs to Debug Their Own Code", year: 2024, citations: 2341 },
      { title: "CodeBERT: A Pre-Trained Model for Programming and Natural Languages", year: 2023, citations: 4521 },
    ],
  },
  {
    id: "s003",
    name: "王芳 Fang Wang",
    avatar: "https://readdy.ai/api/search-image?query=academic%20professional%20headshot%20asian%20researcher%20female%20neutral%20background%20clean%20portrait&width=100&height=100&seq=scholar003&orientation=squarish",
    institution: "Stanford Medicine",
    title: "博士后研究员",
    hIndex: 19,
    totalCitations: 7823,
    paperCount: 56,
    researchAreas: ["医疗 AI", "电子病历", "临床 NLP", "药物发现"],
    matchScore: 83,
    matchReason: "临床 NLP 经验可以为你的医疗实体识别研究提供真实场景验证支持",
    complementarity: [
      { label: "研究向量相似度", score: 79 },
      { label: "技能互补性", score: 88 },
      { label: "共引分析", score: 76 },
      { label: "机构互补", score: 95 },
    ],
    recentPapers: [
      { title: "Foundation Models for Clinical NLP: A Systematic Review", year: 2025, citations: 445 },
      { title: "Extracting Drug-Gene Interactions from Medical Literature", year: 2024, citations: 678 },
    ],
  },
  {
    id: "s004",
    name: "陈浩 Hao Chen",
    avatar: "https://readdy.ai/api/search-image?query=professional%20academic%20male%20researcher%20headshot%20clear%20background%20formal%20clothing&width=100&height=100&seq=scholar004&orientation=squarish",
    institution: "中国科学院自动化研究所",
    title: "副研究员",
    hIndex: 22,
    totalCitations: 9102,
    paperCount: 71,
    researchAreas: ["计算机视觉", "医学图像分析", "病理组织学", "弱监督学习"],
    matchScore: 78,
    matchReason: "病理图像分析专长与你的 ViT 实验方向直接互补，可联合发表",
    complementarity: [
      { label: "研究向量相似度", score: 81 },
      { label: "技能互补性", score: 79 },
      { label: "共引分析", score: 84 },
      { label: "机构互补", score: 68 },
    ],
    recentPapers: [
      { title: "Weakly Supervised Whole Slide Image Classification with Self-Training", year: 2025, citations: 312 },
      { title: "CONCH: A Vision-Language Foundation Model for Computational Pathology", year: 2024, citations: 891 },
    ],
  },
];

export interface ResearchNeed {
  id: string;
  title: string;
  description: string;
  skills: string[];
  researchArea: string;
  authorId: string;
  authorName: string;
  authorInstitution: string;
  matchScore: number;
  createdAt: string;
}

export const mockResearchNeeds: ResearchNeed[] = [
  {
    id: "need001",
    title: "寻求图神经网络专家合作药物靶点预测研究",
    description: "我们有丰富的药物分子数据和生物信息学背景，希望找到有图神经网络建模经验的合作者，共同推进基于 GNN 的药物靶点预测项目，目标发表 Nature Machine Intelligence。",
    skills: ["图神经网络", "PyTorch Geometric", "药物发现", "生物信息学"],
    researchArea: "AI+医疗",
    authorId: "s003",
    authorName: "王芳",
    authorInstitution: "Stanford Medicine",
    matchScore: 91,
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "need002",
    title: "招募 NLP 工程师共建中文科技文献解析系统",
    description: "国家重点实验室项目，需要有中文 NLP 和科技文献处理经验的合作者，协助开发科技论文自动解析、知识提取和数据库构建系统。提供研究经费支持。",
    skills: ["中文 NLP", "信息抽取", "PDF 解析", "数据库设计"],
    researchArea: "自然语言处理",
    authorId: "s001",
    authorName: "张伟",
    authorInstitution: "北京大学",
    matchScore: 88,
    createdAt: "2026-03-16T14:00:00Z",
  },
  {
    id: "need003",
    title: "寻找强化学习专家参与机器人操控研究",
    description: "具身智能实验室在机器人灵巧操控方向有大量真实数据，希望与有 PPO/SAC 等深度强化学习算法经验的研究者合作，探索 sim-to-real 迁移方法。",
    skills: ["强化学习", "PPO", "SAC", "MuJoCo", "机器人学"],
    researchArea: "机器人学",
    authorId: "s004",
    authorName: "陈浩",
    authorInstitution: "中国科学院自动化所",
    matchScore: 74,
    createdAt: "2026-03-17T09:00:00Z",
  },
];

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantInstitution: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export const mockConversations: Conversation[] = [
  {
    id: "conv001",
    participantId: "s001",
    participantName: "张伟",
    participantAvatar: "https://readdy.ai/api/search-image?query=professional%20headshot%20of%20asian%20male%20researcher%20professor%20with%20glasses%20wearing%20formal%20attire%20neutral%20background%20high%20quality%20portrait&width=100&height=100&seq=scholar001&orientation=squarish",
    participantInstitution: "北京大学",
    lastMessage: "你好！看了你在 StudyHub 上的研究方向，我觉得我们的工作很互补",
    lastMessageTime: "2026-03-17T14:30:00Z",
    unreadCount: 2,
    messages: [
      { id: "m001", senderId: "s001", senderName: "张伟", content: "你好！看了你在 StudyHub 上的研究方向，我觉得我们的工作很互补，尤其是在文献引用关系图谱这块。", timestamp: "2026-03-17T14:25:00Z", read: false },
      { id: "m002", senderId: "s001", senderName: "张伟", content: "我最近在做一个知识图谱增强的文献推荐系统，如果用上你们的论文地图数据会非常有价值，有时间聊聊吗？", timestamp: "2026-03-17T14:30:00Z", read: false },
    ],
  },
  {
    id: "conv002",
    participantId: "s002",
    participantName: "李晓明",
    participantAvatar: "https://readdy.ai/api/search-image?query=professional%20headshot%20asian%20female%20researcher%20scientist%20smiling%20neutral%20clean%20background%20academic%20portrait&width=100&height=100&seq=scholar002&orientation=squarish",
    participantInstitution: "清华大学",
    lastMessage: "好的，我明天有空，下午三点可以吗？",
    lastMessageTime: "2026-03-16T18:00:00Z",
    unreadCount: 0,
    messages: [
      { id: "m003", senderId: "me", senderName: "我", content: "李老师好！我看到你在 LLM 代码生成方面的工作，想请教一下自动实验执行方面的技术路线。", timestamp: "2026-03-16T17:30:00Z", read: true },
      { id: "m004", senderId: "s002", senderName: "李晓明", content: "好的，我明天有空，下午三点可以吗？可以开个视频会议聊聊。", timestamp: "2026-03-16T18:00:00Z", read: true },
    ],
  },
];

export interface ReadingList {
  id: string;
  name: string;
  description: string;
  paperCount: number;
  createdAt: string;
  papers: { id: string; title: string; authors: string[]; year: number; citations: number; read: boolean }[];
}

export const mockReadingLists: ReadingList[] = [
  {
    id: "rl001",
    name: "Transformer 核心论文",
    description: "自注意力机制和 Transformer 架构相关的基础性工作",
    paperCount: 8,
    createdAt: "2026-03-01T00:00:00Z",
    papers: [
      { id: "p001", title: "Attention Is All You Need", authors: ["Vaswani et al."], year: 2017, citations: 98432, read: true },
      { id: "p002", title: "BERT: Pre-training of Deep Bidirectional Transformers", authors: ["Devlin et al."], year: 2019, citations: 65218, read: true },
      { id: "p003", title: "Language Models are Few-Shot Learners (GPT-3)", authors: ["Brown et al."], year: 2020, citations: 42108, read: false },
      { id: "p005", title: "An Image is Worth 16x16 Words (ViT)", authors: ["Dosovitskiy et al."], year: 2021, citations: 28741, read: false },
    ],
  },
  {
    id: "rl002",
    name: "医疗 AI 必读",
    description: "AI 在医疗健康领域应用的重要论文",
    paperCount: 5,
    createdAt: "2026-03-10T00:00:00Z",
    papers: [
      { id: "pm001", title: "Med-PaLM 2: Towards Expert-Level Medical Question Answering", authors: ["Singhal et al."], year: 2023, citations: 1823, read: false },
      { id: "pm002", title: "CheXpert: A Large Chest Radiograph Dataset", authors: ["Irvin et al."], year: 2019, citations: 2341, read: true },
    ],
  },
  {
    id: "rl003",
    name: "深度研究待读",
    description: "准备深入研究的论文，尚未系统阅读",
    paperCount: 12,
    createdAt: "2026-03-15T00:00:00Z",
    papers: [],
  },
];
