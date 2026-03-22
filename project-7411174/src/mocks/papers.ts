export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  citations: number;
  abstract: string;
  doi?: string;
  arxivId?: string;
  source: "arxiv" | "semantic_scholar" | "pubmed" | "openalex" | "cnki";
  isOpenAccess: boolean;
  tags: string[];
  qualityScore: number;
  methods?: string[];
  researchGap?: string;
}

export const mockPapers: Paper[] = [
  {
    id: "p001",
    title: "Attention Is All You Need",
    authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Lukasz Kaiser", "Illia Polosukhin"],
    year: 2017,
    venue: "NeurIPS 2017",
    citations: 98432,
    abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    doi: "10.48550/arXiv.1706.03762",
    arxivId: "1706.03762",
    source: "arxiv",
    isOpenAccess: true,
    tags: ["Transformer", "Attention Mechanism", "NLP", "Sequence Modeling"],
    qualityScore: 9.8,
    methods: ["Multi-Head Attention", "Positional Encoding", "Feed-Forward Networks"],
  },
  {
    id: "p002",
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    year: 2019,
    venue: "NAACL 2019",
    citations: 65218,
    abstract: "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
    doi: "10.18653/v1/N19-1423",
    arxivId: "1810.04805",
    source: "semantic_scholar",
    isOpenAccess: true,
    tags: ["BERT", "Pre-training", "NLP", "Language Model"],
    qualityScore: 9.5,
    methods: ["Masked Language Model", "Next Sentence Prediction", "Fine-tuning"],
  },
  {
    id: "p003",
    title: "Language Models are Few-Shot Learners",
    authors: ["Tom B. Brown", "Benjamin Mann", "Nick Ryder", "Melanie Subbiah", "Jared Kaplan"],
    year: 2020,
    venue: "NeurIPS 2020",
    citations: 42108,
    abstract: "We demonstrate that scaling language models greatly improves task-agnostic, few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art fine-tuning approaches. GPT-3, our autoregressive language model with 175 billion parameters, achieves strong performance on many NLP datasets.",
    arxivId: "2005.14165",
    source: "arxiv",
    isOpenAccess: true,
    tags: ["GPT-3", "Few-Shot Learning", "Large Language Model", "In-Context Learning"],
    qualityScore: 9.6,
    methods: ["In-Context Learning", "Prompt Engineering", "Autoregressive Modeling"],
    researchGap: "Few-shot performance still lags behind fine-tuning on specialized tasks; alignment with human preferences remains an open problem.",
  },
  {
    id: "p004",
    title: "Scaling Laws for Neural Language Models",
    authors: ["Jared Kaplan", "Sam McCandlish", "Tom Henighan", "Tom B. Brown", "Benjamin Chess", "Rewon Child"],
    year: 2020,
    venue: "arXiv 2020",
    citations: 8934,
    abstract: "We study empirical scaling laws for language model performance on the cross-entropy loss. The loss scales as a power-law with model size, dataset size, and the amount of compute used for training, with some trends spanning more than seven orders of magnitude.",
    arxivId: "2001.08361",
    source: "arxiv",
    isOpenAccess: true,
    tags: ["Scaling Laws", "Language Models", "Training Compute", "Model Size"],
    qualityScore: 9.0,
    methods: ["Empirical Analysis", "Power-Law Fitting", "Cross-Entropy Loss"],
  },
  {
    id: "p005",
    title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
    authors: ["Alexey Dosovitskiy", "Lucas Beyer", "Alexander Kolesnikov", "Dirk Weissenborn", "Xiaohua Zhai"],
    year: 2021,
    venue: "ICLR 2021",
    citations: 28741,
    abstract: "While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited. In vision, attention is either applied in conjunction with convolutional networks, or used to replace certain components of convolutional networks.",
    arxivId: "2010.11929",
    source: "semantic_scholar",
    isOpenAccess: true,
    tags: ["Vision Transformer", "ViT", "Image Classification", "Self-Supervised"],
    qualityScore: 9.3,
    methods: ["Patch Embedding", "Multi-Head Self-Attention", "Pre-training on JFT-300M"],
  },
  {
    id: "p006",
    title: "Denoising Diffusion Probabilistic Models",
    authors: ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
    year: 2020,
    venue: "NeurIPS 2020",
    citations: 18234,
    abstract: "We present high quality image synthesis results using diffusion probabilistic models, a class of latent variable models inspired by considerations from nonequilibrium thermodynamics. Our best results are obtained by training on a weighted variational bound designed according to a novel connection between diffusion probabilistic models and denoising score matching with Langevin dynamics.",
    arxivId: "2006.11239",
    source: "arxiv",
    isOpenAccess: true,
    tags: ["Diffusion Models", "Generative Models", "Image Synthesis", "DDPM"],
    qualityScore: 9.2,
    methods: ["Forward Diffusion", "Reverse Denoising", "Score Matching"],
  },
  {
    id: "p007",
    title: "Deep Residual Learning for Image Recognition",
    authors: ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
    year: 2016,
    venue: "CVPR 2016",
    citations: 155827,
    abstract: "Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.",
    doi: "10.1109/CVPR.2016.90",
    source: "openalex",
    isOpenAccess: false,
    tags: ["ResNet", "Residual Learning", "Deep Learning", "Image Recognition"],
    qualityScore: 9.9,
    methods: ["Residual Connections", "Skip Connections", "Batch Normalization"],
  },
  {
    id: "p008",
    title: "Proximal Policy Optimization Algorithms",
    authors: ["John Schulman", "Filip Wolski", "Prafulla Dhariwal", "Alec Radford", "Oleg Klimov"],
    year: 2017,
    venue: "arXiv 2017",
    citations: 12456,
    abstract: "We propose a new family of policy gradient methods for reinforcement learning, which alternate between sampling data through interaction with the environment, and optimizing a surrogate objective function using stochastic gradient ascent.",
    arxivId: "1707.06347",
    source: "arxiv",
    isOpenAccess: true,
    tags: ["PPO", "Reinforcement Learning", "Policy Gradient", "RLHF"],
    qualityScore: 8.9,
    methods: ["Clipped Surrogate Objective", "KL Divergence Penalty", "Value Function Estimation"],
    researchGap: "Sample efficiency and generalization to new environments remain challenging; combining with model-based RL is an active research area.",
  },
];

export const mockResearchDirections = [
  { id: "ecg-diagnosis", label: "ECG 自动诊断", en: "ECG Auto-Diagnosis", icon: "ri-heart-pulse-line" },
  { id: "ecg-pacing", label: "ECG 起搏类型", en: "ECG Pacing Classification", icon: "ri-pulse-line" },
  { id: "ecg-age", label: "AI-ECG 年龄预测", en: "AI-ECG Age Prediction", icon: "ri-timer-line" },
  { id: "ecg-image", label: "ECG 图像数字化", en: "ECG Image Digitization", icon: "ri-image-line" },
  { id: "medical-llm", label: "跨模态医疗大模型", en: "Multimodal Medical LLM", icon: "ri-brain-line" },
  { id: "ultrasound-seg", label: "超声图像分割", en: "Ultrasound Segmentation", icon: "ri-scan-line" },
  { id: "medical-ai", label: "医疗 AI", en: "Medical AI", icon: "ri-hospital-line" },
  { id: "llm", label: "大语言模型", en: "Large Language Models", icon: "ri-message-3-line" },
  { id: "cv", label: "计算机视觉", en: "Computer Vision", icon: "ri-eye-line" },
  { id: "nlp", label: "自然语言处理", en: "Natural Language Processing", icon: "ri-translate-2" },
  { id: "multimodal", label: "多模态学习", en: "Multimodal Learning", icon: "ri-collage-line" },
  { id: "gnn", label: "图神经网络", en: "Graph Neural Networks", icon: "ri-share-circle-line" },
];

export const mockPaperDetail: Paper & {
  references: Pick<Paper, "id" | "title" | "authors" | "year" | "citations">[];
  citedBy: Pick<Paper, "id" | "title" | "authors" | "year" | "citations">[];
  qualityDimensions: { name: string; score: number }[];
  aiSummary: string;
} = {
  ...mockPapers[0],
  references: [
    { id: "ref1", title: "Neural Machine Translation by Jointly Learning to Align and Translate", authors: ["Dzmitry Bahdanau", "Kyunghyun Cho"], year: 2015, citations: 32145 },
    { id: "ref2", title: "Long Short-Term Memory", authors: ["Sepp Hochreiter", "Jürgen Schmidhuber"], year: 1997, citations: 89234 },
    { id: "ref3", title: "Sequence to Sequence Learning with Neural Networks", authors: ["Ilya Sutskever", "Oriol Vinyals", "Quoc V. Le"], year: 2014, citations: 21456 },
    { id: "ref4", title: "Effective Approaches to Attention-based Neural Machine Translation", authors: ["Minh-Thang Luong", "Hieu Pham", "Christopher D. Manning"], year: 2015, citations: 12893 },
    { id: "ref5", title: "A Decomposable Attention Model for Natural Language Inference", authors: ["Ankur Parikh", "Oscar Täckström", "Dipanjan Das"], year: 2016, citations: 3421 },
  ],
  citedBy: [
    { id: "cb1", title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding", authors: ["Jacob Devlin", "Ming-Wei Chang"], year: 2019, citations: 65218 },
    { id: "cb2", title: "GPT-3: Language Models are Few-Shot Learners", authors: ["Tom Brown", "Benjamin Mann"], year: 2020, citations: 42108 },
    { id: "cb3", title: "An Image is Worth 16x16 Words", authors: ["Alexey Dosovitskiy", "Lucas Beyer"], year: 2021, citations: 28741 },
    { id: "cb4", title: "T5: Exploring the Limits of Transfer Learning", authors: ["Colin Raffel", "Noam Shazeer"], year: 2020, citations: 18234 },
    { id: "cb5", title: "XLNet: Generalized Autoregressive Pretraining for Language Understanding", authors: ["Zhilin Yang", "Zihang Dai"], year: 2019, citations: 9823 },
  ],
  qualityDimensions: [
    { name: "创新性", score: 10 },
    { name: "方法论", score: 9.5 },
    { name: "实验质量", score: 9.8 },
    { name: "写作清晰度", score: 9.2 },
    { name: "影响力", score: 10 },
  ],
  aiSummary: "这篇论文提出了 Transformer 架构，彻底改变了序列建模的范式。核心创新是完全基于注意力机制的编解码器，去除了 RNN 的顺序依赖，实现了高度并行化训练。多头注意力机制允许模型同时关注不同表示子空间的信息，位置编码解决了注意力机制对序列位置不感知的问题。该工作直接催生了 BERT、GPT 等系列模型，奠定了现代 NLP 的基础。",
};
