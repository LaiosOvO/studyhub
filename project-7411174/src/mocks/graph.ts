export interface GraphPaper {
  id: string;
  title: string;
  shortTitle: string;
  authors: string[];
  year: number;
  citations: number;
  cluster: number;
  abstract: string;
  methods: string[];
  venue: string;
  doi?: string;
  researchGap?: string;
  qualityScore: number;
  // Pre-computed layout position (center-based)
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string; // source cites target
}

export const CLUSTER_CONFIGS = [
  { id: 0, name: "Transformer 架构", shortName: "Transformer", color: "#00D4B8", labelColor: "#00D4B8" },
  { id: 1, name: "大语言模型", shortName: "LLM", color: "#F59E0B", labelColor: "#F59E0B" },
  { id: 2, name: "计算机视觉", shortName: "Vision", color: "#10B981", labelColor: "#10B981" },
  { id: 3, name: "生成模型", shortName: "Generative", color: "#F43F5E", labelColor: "#F43F5E" },
  { id: 4, name: "图神经网络", shortName: "GNN", color: "#F97316", labelColor: "#F97316" },
  { id: 5, name: "医疗 AI", shortName: "Medical", color: "#14B8A6", labelColor: "#14B8A6" },
  { id: 6, name: "强化学习", shortName: "RL", color: "#EAB308", labelColor: "#EAB308" },
];

export const getNodeSize = (citations: number): number => {
  const MIN = 38;
  const MAX = 96;
  const logMin = Math.log(500);
  const logMax = Math.log(160000);
  const logVal = Math.log(Math.max(citations, 500));
  return Math.round(MIN + ((logVal - logMin) / (logMax - logMin)) * (MAX - MIN));
};

export const mockGraphPapers: GraphPaper[] = [
  // ── Cluster 0: Transformer 架构 ──
  { id: "n001", title: "Attention Is All You Need", shortTitle: "Transformer", authors: ["Vaswani", "Shazeer", "Parmar"], year: 2017, citations: 98432, cluster: 0, venue: "NeurIPS 2017", qualityScore: 9.8, x: 0, y: 0, abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.", methods: ["Multi-Head Attention", "Positional Encoding", "Feed-Forward Networks"] },
  { id: "n002", title: "BERT: Pre-training of Deep Bidirectional Transformers", shortTitle: "BERT", authors: ["Devlin", "Chang", "Lee"], year: 2019, citations: 65218, cluster: 0, venue: "NAACL 2019", qualityScore: 9.5, x: -160, y: 130, abstract: "We introduce BERT, designed to pre-train deep bidirectional representations from unlabeled text.", methods: ["Masked LM", "Next Sentence Prediction", "Fine-tuning"] },
  { id: "n003", title: "Language Models are Few-Shot Learners (GPT-3)", shortTitle: "GPT-3", authors: ["Brown", "Mann", "Ryder"], year: 2020, citations: 42108, cluster: 0, venue: "NeurIPS 2020", qualityScore: 9.6, x: 160, y: 130, abstract: "We show that scaling language models greatly improves task-agnostic, few-shot performance.", methods: ["In-Context Learning", "Prompt Engineering", "Autoregressive LM"], researchGap: "Alignment with human preferences and safety remain open problems." },

  // ── Cluster 1: 大语言模型 ──
  { id: "n012", title: "Scaling Laws for Neural Language Models", shortTitle: "Scaling Laws", authors: ["Kaplan", "McCandlish"], year: 2020, citations: 8934, cluster: 1, venue: "arXiv 2020", qualityScore: 9.0, x: 540, y: -350, abstract: "We study empirical scaling laws for language model performance.", methods: ["Power-Law Fitting", "Cross-Entropy Loss"] },
  { id: "n013", title: "Training language models to follow instructions with human feedback", shortTitle: "InstructGPT", authors: ["Ouyang", "Wu", "Jiang"], year: 2022, citations: 7823, cluster: 1, venue: "NeurIPS 2022", qualityScore: 9.2, x: 650, y: -260, abstract: "We train language models with RLHF to follow instructions.", methods: ["RLHF", "PPO", "Reward Modeling"] },
  { id: "n014", title: "LLaMA: Open and Efficient Foundation Language Models", shortTitle: "LLaMA", authors: ["Touvron", "Lavril", "Izacard"], year: 2023, citations: 6234, cluster: 1, venue: "arXiv 2023", qualityScore: 8.8, x: 700, y: -420, abstract: "We introduce LLaMA, a collection of foundation language models.", methods: ["SentencePiece", "Pre-training", "Efficient Attention"] },
  { id: "n021", title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models", shortTitle: "Chain-of-Thought", authors: ["Wei", "Wang", "Schuurmans"], year: 2022, citations: 5821, cluster: 1, venue: "NeurIPS 2022", qualityScore: 8.9, x: 580, y: -490, abstract: "We explore how generating a chain of thought improves complex reasoning.", methods: ["Chain-of-Thought", "In-Context Learning", "Reasoning"] },
  { id: "n026", title: "Llama 2: Open Foundation and Fine-Tuned Chat Models", shortTitle: "LLaMA 2", authors: ["Touvron", "Martin", "Stone"], year: 2023, citations: 4123, cluster: 1, venue: "arXiv 2023", qualityScore: 8.7, x: 780, y: -340, abstract: "An updated LLaMA with fine-tuned chat models and improved safety.", methods: ["RLHF", "Ghost Attention", "Safety Fine-tuning"] },

  // ── Cluster 2: 计算机视觉 ──
  { id: "n004", title: "Deep Residual Learning for Image Recognition", shortTitle: "ResNet", authors: ["He", "Zhang", "Ren"], year: 2016, citations: 155827, cluster: 2, venue: "CVPR 2016", qualityScore: 9.9, x: 760, y: 320, abstract: "We present a residual learning framework to ease training of deeper networks.", methods: ["Residual Connections", "Skip Connections", "Batch Norm"] },
  { id: "n005", title: "An Image is Worth 16x16 Words: Transformers for Image Recognition", shortTitle: "ViT", authors: ["Dosovitskiy", "Beyer"], year: 2021, citations: 28741, cluster: 2, venue: "ICLR 2021", qualityScore: 9.3, x: 590, y: 240, abstract: "We show that a pure Transformer applied directly to image patches can perform well on image recognition tasks.", methods: ["Patch Embedding", "Self-Attention", "ImageNet Pre-training"] },
  { id: "n006", title: "Learning Transferable Visual Models from Natural Language", shortTitle: "CLIP", authors: ["Radford", "Kim", "Hallacy"], year: 2021, citations: 21340, cluster: 2, venue: "ICML 2021", qualityScore: 9.1, x: 680, y: 440, abstract: "We train CLIP on 400M image-text pairs. CLIP can be applied to any visual classification benchmark.", methods: ["Contrastive Learning", "Vision-Language Pre-training", "Zero-shot Transfer"] },
  { id: "n016", title: "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows", shortTitle: "Swin", authors: ["Liu", "Lin", "Cao"], year: 2021, citations: 15823, cluster: 2, venue: "ICCV 2021", qualityScore: 9.2, x: 870, y: 270, abstract: "We present Swin Transformer, a hierarchical Transformer whose representation is computed with shifted windows.", methods: ["Shifted Window Attention", "Hierarchical Features"] },
  { id: "n022", title: "Training data-efficient image transformers & distillation through attention", shortTitle: "DeiT", authors: ["Touvron", "Cord", "Douze"], year: 2021, citations: 8234, cluster: 2, venue: "ICML 2021", qualityScore: 8.7, x: 660, y: 370, abstract: "We train data-efficient image transformers using knowledge distillation.", methods: ["Knowledge Distillation", "Token Distillation", "Teacher-Student"] },

  // ── Cluster 3: 生成模型 ──
  { id: "n007", title: "Denoising Diffusion Probabilistic Models", shortTitle: "DDPM", authors: ["Ho", "Jain", "Abbeel"], year: 2020, citations: 18234, cluster: 3, venue: "NeurIPS 2020", qualityScore: 9.2, x: 0, y: 580, abstract: "We present high quality image synthesis results using diffusion probabilistic models.", methods: ["Forward Diffusion", "Reverse Denoising", "Score Matching"] },
  { id: "n015", title: "High-Resolution Image Synthesis with Latent Diffusion Models", shortTitle: "Stable Diffusion", authors: ["Rombach", "Blattmann", "Lorenz"], year: 2022, citations: 12341, cluster: 3, venue: "CVPR 2022", qualityScore: 9.1, x: -120, y: 700, abstract: "We apply diffusion models in the latent space of powerful pretrained autoencoders.", methods: ["Latent Diffusion", "VQ-VAE", "Cross-Attention"] },
  { id: "n027", title: "Hierarchical Text-Conditional Image Generation with CLIP Latents", shortTitle: "DALL-E 2", authors: ["Ramesh", "Dhariwal", "Nichol"], year: 2022, citations: 5234, cluster: 3, venue: "arXiv 2022", qualityScore: 8.8, x: 120, y: 700, abstract: "A hierarchical method to create images and artwork using CLIP.", methods: ["CLIP Embeddings", "Diffusion Prior", "GLIDE Decoder"] },
  { id: "n028", title: "Score-Based Generative Modeling through Stochastic Differential Equations", shortTitle: "Score-SDE", authors: ["Song", "Sohl-Dickstein", "Kingma"], year: 2021, citations: 7821, cluster: 3, venue: "ICLR 2021", qualityScore: 9.0, x: -60, y: 460, abstract: "We generalize score-based and diffusion models through SDEs.", methods: ["SDEs", "Score Matching", "Reverse SDE"] },

  // ── Cluster 4: 图神经网络 ──
  { id: "n010", title: "Semi-Supervised Classification with Graph Convolutional Networks", shortTitle: "GCN", authors: ["Kipf", "Welling"], year: 2017, citations: 12341, cluster: 4, venue: "ICLR 2017", qualityScore: 9.3, x: -620, y: 310, abstract: "We present a scalable semi-supervised classification method for graph-structured data.", methods: ["Graph Convolution", "Spectral Filters", "Semi-supervised Learning"] },
  { id: "n011", title: "Graph Attention Networks", shortTitle: "GAT", authors: ["Veličković", "Cucurull", "Casanova"], year: 2018, citations: 8934, cluster: 4, venue: "ICLR 2018", qualityScore: 9.1, x: -730, y: 200, abstract: "We present graph attention networks, operating on graph-structured data using attention mechanisms.", methods: ["Graph Attention", "Multi-Head Attention on Graphs", "Node Classification"] },
  { id: "n023", title: "Inductive Representation Learning on Large Graphs", shortTitle: "GraphSAGE", authors: ["Hamilton", "Ying", "Leskovec"], year: 2017, citations: 7231, cluster: 4, venue: "NeurIPS 2017", qualityScore: 8.9, x: -760, y: 400, abstract: "We present an inductive framework that leverages node feature information to generate node embeddings.", methods: ["Neighborhood Sampling", "Aggregation Functions", "Inductive Learning"] },
  { id: "n029", title: "How Powerful are Graph Neural Networks?", shortTitle: "GIN", authors: ["Xu", "Hu", "Leskovec"], year: 2019, citations: 5823, cluster: 4, venue: "ICLR 2019", qualityScore: 8.8, x: -630, y: 450, abstract: "We characterize the discriminative power of GNNs in terms of the Weisfeiler-Lehman test.", methods: ["Graph Isomorphism Network", "WL Test", "Expressiveness Analysis"] },

  // ── Cluster 5: 医疗 AI ──
  { id: "n017", title: "CheXpert: A Large Chest Radiograph Dataset and Competition", shortTitle: "CheXpert", authors: ["Irvin", "Rajpurkar", "Ko"], year: 2019, citations: 4521, cluster: 5, venue: "AAAI 2019", qualityScore: 8.5, x: -590, y: -350, abstract: "We present CheXpert, a large dataset of chest X-rays with labels for 14 observations.", methods: ["Label Extraction", "U-Ignore", "Self-Training"] },
  { id: "n018", title: "Large Language Models Encode Clinical Knowledge", shortTitle: "Med-PaLM", authors: ["Singhal", "Azizi", "Tu"], year: 2023, citations: 2341, cluster: 5, venue: "Nature 2023", qualityScore: 9.0, x: -700, y: -280, abstract: "We present a clinically-aligned LLM for medical question answering achieving expert-level performance.", methods: ["Domain Alignment", "Chain-of-Thought", "RLHF"] },
  { id: "n019", title: "BioGPT: Generative Pre-trained Transformer for Biomedical Text Generation", shortTitle: "BioGPT", authors: ["Luo", "Sun", "Xia"], year: 2022, citations: 3821, cluster: 5, venue: "Brief. Bioinform. 2022", qualityScore: 8.6, x: -510, y: -470, abstract: "We introduce BioGPT, a domain-specific generative Transformer language model pre-trained on large-scale biomedical literature.", methods: ["Domain Pre-training", "Autoregressive LM", "Biomedical NLP"] },
  { id: "n020", title: "A Visual-Language Foundation Model for Computational Pathology", shortTitle: "CONCH", authors: ["Lu", "Chen", "Williamson"], year: 2024, citations: 891, cluster: 5, venue: "Nature Medicine 2024", qualityScore: 9.2, x: -660, y: -480, abstract: "We develop CONCH, a vision-language foundation model for pathology.", methods: ["CLIP Pre-training", "Pathology Data", "Zero-shot Pathology"] },

  // ── Cluster 6: 强化学习 ──
  { id: "n008", title: "Human-level control through deep reinforcement learning", shortTitle: "DQN", authors: ["Mnih", "Kavukcuoglu", "Silver"], year: 2015, citations: 15234, cluster: 6, venue: "Nature 2015", qualityScore: 9.5, x: 0, y: -680, abstract: "We develop a novel agent—a deep Q-network (DQN)—that learns to play Atari games.", methods: ["Q-Learning", "Experience Replay", "Target Network"] },
  { id: "n009", title: "Proximal Policy Optimization Algorithms", shortTitle: "PPO", authors: ["Schulman", "Wolski", "Dhariwal"], year: 2017, citations: 12456, cluster: 6, venue: "arXiv 2017", qualityScore: 8.9, x: -160, y: -580, abstract: "We propose PPO, a policy gradient method that alternates between sampling data and optimizing.", methods: ["Clipped Objective", "KL Divergence Penalty", "Value Function"] },
  { id: "n024", title: "Mastering the game of Go with deep neural networks and tree search", shortTitle: "AlphaGo", authors: ["Silver", "Huang", "Maddison"], year: 2016, citations: 8234, cluster: 6, venue: "Nature 2016", qualityScore: 9.7, x: 160, y: -610, abstract: "We introduce AlphaGo, the first computer program to defeat a professional human Go player.", methods: ["Monte Carlo Tree Search", "Policy/Value Networks", "Self-play"] },
  { id: "n025", title: "Learning to summarize with human feedback", shortTitle: "RLHF", authors: ["Stiennon", "Ouyang", "Wu"], year: 2020, citations: 6234, cluster: 6, venue: "NeurIPS 2020", qualityScore: 8.8, x: -60, y: -800, abstract: "We train a model to summarize documents using learned reward models from human feedback.", methods: ["Reward Modeling", "PPO Fine-tuning", "Human Feedback"] },
];

export const mockGraphEdges: GraphEdge[] = [
  // BERT & GPT cite Transformer
  { source: "n002", target: "n001" },
  { source: "n003", target: "n001" },
  { source: "n003", target: "n002" },
  // ViT, CLIP, Swin cite Transformer/BERT
  { source: "n005", target: "n001" },
  { source: "n005", target: "n004" },
  { source: "n006", target: "n005" },
  { source: "n016", target: "n005" },
  { source: "n016", target: "n004" },
  { source: "n022", target: "n005" },
  // LLM cluster
  { source: "n012", target: "n003" },
  { source: "n013", target: "n003" },
  { source: "n013", target: "n002" },
  { source: "n013", target: "n009" },
  { source: "n014", target: "n003" },
  { source: "n014", target: "n013" },
  { source: "n021", target: "n003" },
  { source: "n021", target: "n002" },
  { source: "n026", target: "n014" },
  { source: "n026", target: "n013" },
  // Generative models
  { source: "n015", target: "n007" },
  { source: "n027", target: "n006" },
  { source: "n027", target: "n007" },
  { source: "n028", target: "n007" },
  // GNN cluster
  { source: "n011", target: "n010" },
  { source: "n023", target: "n010" },
  { source: "n029", target: "n010" },
  { source: "n029", target: "n011" },
  // Medical
  { source: "n018", target: "n002" },
  { source: "n018", target: "n017" },
  { source: "n019", target: "n002" },
  { source: "n019", target: "n017" },
  { source: "n020", target: "n006" },
  { source: "n020", target: "n017" },
  // RL cluster
  { source: "n009", target: "n008" },
  { source: "n024", target: "n008" },
  { source: "n025", target: "n009" },
  { source: "n025", target: "n013" },
  // Cross-cluster
  { source: "n006", target: "n001" }, // CLIP uses Transformer
  { source: "n018", target: "n003" }, // Med-PaLM from GPT-3
  { source: "n020", target: "n005" }, // CONCH uses ViT
];

// Papers available for expansion when double-clicking a node
export const expansionPapers: Record<string, GraphPaper[]> = {
  n001: [
    { id: "exp001", title: "Universal Transformers", shortTitle: "Universal TF", authors: ["Dehghani", "Gouws"], year: 2019, citations: 2341, cluster: 0, venue: "ICLR 2019", qualityScore: 8.3, x: 100, y: -150, abstract: "Universal Transformers combine the parallelism of Transformers with the recurrent inductive bias of RNNs.", methods: ["Universal Transformer", "Adaptive Computation"], doi: undefined },
    { id: "exp002", title: "Transformer-XL: Attentive Language Models Beyond a Fixed-Length Context", shortTitle: "Transformer-XL", authors: ["Dai", "Yang", "Yang"], year: 2019, citations: 3892, cluster: 0, venue: "ACL 2019", qualityScore: 8.6, x: -100, y: -170, abstract: "We propose a novel neural architecture that enables learning dependency beyond a fixed length.", methods: ["Segment-Level Recurrence", "Relative Positional Encoding"], doi: undefined },
  ],
  n003: [
    { id: "exp003", title: "GPT-4 Technical Report", shortTitle: "GPT-4", authors: ["OpenAI"], year: 2023, citations: 8234, cluster: 1, venue: "arXiv 2023", qualityScore: 9.3, x: 300, y: 100, abstract: "GPT-4 is a large multimodal model that exhibits human-level performance on various benchmarks.", methods: ["RLHF", "Constitutional AI", "Multimodal"], doi: undefined },
  ],
};
