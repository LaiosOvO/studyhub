export interface Experiment {
  id: string;
  name: string;
  status: "running" | "queued" | "completed" | "failed" | "paused";
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  bestMetric: number;
  baselineMetric: number;
  metricName: string;
  runtime: number; // seconds
  planId: string;
  createdAt: string;
  metrics: { epoch: number; loss: number; accuracy: number; f1: number; val_loss: number; val_accuracy: number }[];
  iterations: {
    id: string; epoch: number; summary: string; metricValue: number; isBest: boolean; timestamp: string;
  }[];
  gpu: { utilization: number; memUsed: number; memTotal: number; temperature: number };
}

export const mockExperiments: Experiment[] = [
  {
    id: "exp001",
    name: "BERT-医疗NER微调 v3",
    status: "running",
    progress: 62,
    currentEpoch: 31,
    totalEpochs: 50,
    bestMetric: 0.887,
    baselineMetric: 0.821,
    metricName: "F1",
    runtime: 7832,
    planId: "plan001",
    createdAt: "2026-03-17T08:00:00Z",
    metrics: Array.from({ length: 31 }, (_, i) => ({
      epoch: i + 1,
      loss: Math.max(0.15, 0.95 - i * 0.025 + Math.random() * 0.03),
      accuracy: Math.min(0.96, 0.65 + i * 0.01 + Math.random() * 0.02),
      f1: Math.min(0.92, 0.70 + i * 0.008 + Math.random() * 0.015),
      val_loss: Math.max(0.18, 1.1 - i * 0.028 + Math.random() * 0.04),
      val_accuracy: Math.min(0.94, 0.62 + i * 0.009 + Math.random() * 0.02),
    })),
    iterations: [
      { id: "it001", epoch: 10, summary: "增加 dropout=0.3，防止过拟合", metricValue: 0.812, isBest: false, timestamp: "2026-03-17T08:45:00Z" },
      { id: "it002", epoch: 20, summary: "调整学习率为 2e-5，warmup steps 增至 500", metricValue: 0.856, isBest: false, timestamp: "2026-03-17T10:20:00Z" },
      { id: "it003", epoch: 25, summary: "加入 label smoothing=0.1", metricValue: 0.871, isBest: false, timestamp: "2026-03-17T11:10:00Z" },
      { id: "it004", epoch: 31, summary: "当前最优 checkpoint，混合精度训练 FP16", metricValue: 0.887, isBest: true, timestamp: "2026-03-17T12:30:00Z" },
    ],
    gpu: { utilization: 87, memUsed: 22.4, memTotal: 24, temperature: 74 },
  },
  {
    id: "exp002",
    name: "ViT-病理图像分类",
    status: "queued",
    progress: 0,
    currentEpoch: 0,
    totalEpochs: 100,
    bestMetric: 0,
    baselineMetric: 0.782,
    metricName: "Accuracy",
    runtime: 0,
    planId: "plan002",
    createdAt: "2026-03-17T13:00:00Z",
    metrics: [],
    iterations: [],
    gpu: { utilization: 0, memUsed: 0, memTotal: 24, temperature: 45 },
  },
  {
    id: "exp003",
    name: "GraphSAGE-药物相互作用",
    status: "completed",
    progress: 100,
    currentEpoch: 80,
    totalEpochs: 80,
    bestMetric: 0.934,
    baselineMetric: 0.871,
    metricName: "AUC-ROC",
    runtime: 28800,
    planId: "plan003",
    createdAt: "2026-03-16T09:00:00Z",
    metrics: Array.from({ length: 80 }, (_, i) => ({
      epoch: i + 1,
      loss: Math.max(0.08, 0.88 - i * 0.01 + Math.random() * 0.02),
      accuracy: Math.min(0.97, 0.71 + i * 0.0033 + Math.random() * 0.01),
      f1: Math.min(0.94, 0.72 + i * 0.0028 + Math.random() * 0.01),
      val_loss: Math.max(0.1, 0.95 - i * 0.011 + Math.random() * 0.025),
      val_accuracy: Math.min(0.95, 0.69 + i * 0.003 + Math.random() * 0.012),
    })),
    iterations: [
      { id: "it005", epoch: 40, summary: "Graph Attention 替换 Mean Aggregator", metricValue: 0.891, isBest: false, timestamp: "2026-03-16T15:00:00Z" },
      { id: "it006", epoch: 80, summary: "最终模型：3层 GAT + 残差连接", metricValue: 0.934, isBest: true, timestamp: "2026-03-17T01:00:00Z" },
    ],
    gpu: { utilization: 0, memUsed: 0, memTotal: 24, temperature: 42 },
  },
];

export interface Plan {
  id: string;
  name: string;
  targetPaper: string;
  hypothesis: string;
  method: string;
  baselineMethod: string;
  expectedImprovement: string;
  feasibilityScore: number;
  feasibilityBreakdown: { label: string; score: number }[];
  status: "draft" | "ready" | "running" | "completed";
  metrics: string[];
  datasets: { name: string; size: string; url: string }[];
  steps: string[];
  codeSketch: string;
  createdAt: string;
}

export const mockPlans: Plan[] = [
  {
    id: "plan001",
    name: "Medical NER with Domain-Adaptive BERT",
    targetPaper: "BERT: Pre-training of Deep Bidirectional Transformers",
    hypothesis: "在通用 BERT 基础上，通过医疗领域文本持续预训练 + 实体边界感知微调，可以显著提升中文医疗命名实体识别的 F1 分数。",
    method: "1. 收集 PubMed 医疗摘要 + CNKI 医学论文进行持续预训练 2. 引入 CRF 层替换 Softmax 输出以建模序列依赖 3. 实体边界感知损失函数 4. 多任务学习同时训练 NER + 关系抽取",
    baselineMethod: "标准 BERT + Linear",
    expectedImprovement: "F1 从 82.1% 提升至 88-90%，边界识别准确率提升约 15%",
    feasibilityScore: 87,
    feasibilityBreakdown: [
      { label: "计算需求", score: 85 },
      { label: "数据可用性", score: 92 },
      { label: "预期提升", score: 88 },
      { label: "实现难度", score: 82 },
    ],
    status: "running",
    metrics: ["F1", "Precision", "Recall", "Boundary-F1"],
    datasets: [
      { name: "CCKS 2019 医疗命名实体", size: "1.2 万条", url: "https://www.biendata.xyz/competition/ccks_2019_1/" },
      { name: "CMeEE 中文医疗实体", size: "3.2 万句", url: "https://github.com/bearhunter49/CMeEE" },
      { name: "BC5CDR 药物实体", size: "1,500 篇", url: "https://biocreative.bioinformatics.udel.edu/tasks/biocreative-v/track-3-cdr/" },
    ],
    steps: [
      "搭建数据预处理 Pipeline：分词 + 实体标注格式统一（BIO/BIOES）",
      "医疗文本持续预训练（Continue Pre-training）：10 epochs，lr=1e-4",
      "添加 CRF 层，配置 Viterbi 解码",
      "实体边界感知损失函数实现",
      "多任务训练：NER + 关系抽取联合优化",
      "消融实验：逐步验证每个改进的贡献度",
      "最终评估：CCKS/CMeEE 测试集 + 对比基线",
    ],
    codeSketch: `import torch
from transformers import BertForTokenClassification
from torchcrf import CRF

class MedicalNERModel(torch.nn.Module):
    def __init__(self, model_name, num_labels):
        super().__init__()
        self.bert = BertForTokenClassification.from_pretrained(
            model_name, num_labels=num_labels
        )
        self.crf = CRF(num_labels, batch_first=True)
    
    def forward(self, input_ids, attention_mask, labels=None):
        outputs = self.bert(input_ids, attention_mask=attention_mask)
        emissions = outputs.logits
        
        if labels is not None:
            loss = -self.crf(emissions, labels, 
                           mask=attention_mask.bool())
            return loss
        
        return self.crf.decode(emissions, 
                               mask=attention_mask.bool())`,
    createdAt: "2026-03-15T10:00:00Z",
  },
  {
    id: "plan002",
    name: "Self-Supervised ViT for Pathology Classification",
    targetPaper: "An Image is Worth 16x16 Words",
    hypothesis: "利用自监督预训练（DINO/MAE）在病理图像上预训练 ViT，配合多粒度注意力，可在小样本条件下超越 CNN 基线。",
    method: "DINO 自监督预训练 → 病理数据增强 → ViT-B/16 微调 → 多粒度特征融合",
    baselineMethod: "ResNet-50 ImageNet 预训练",
    expectedImprovement: "准确率从 78.2% 提升至 85%+，尤其在罕见类别上 AUC 提升约 12%",
    feasibilityScore: 79,
    feasibilityBreakdown: [
      { label: "计算需求", score: 65 },
      { label: "数据可用性", score: 88 },
      { label: "预期提升", score: 82 },
      { label: "实现难度", score: 78 },
    ],
    status: "ready",
    metrics: ["Accuracy", "AUC-ROC", "Sensitivity", "Specificity"],
    datasets: [
      { name: "TCGA-BRCA 乳腺癌", size: "1,098 例", url: "https://portal.gdc.cancer.gov/" },
      { name: "Camelyon17 淋巴结转移", size: "1,000 WSI", url: "https://camelyon17.grand-challenge.org/" },
    ],
    steps: [
      "WSI 切片预处理：组织分割 + Patch 采样（256×256）",
      "DINO 自监督预训练：100 epochs on PathologyNet",
      "多粒度特征融合模块实现",
      "小样本微调实验（10%, 20%, 50% 标注数据）",
      "对比 ResNet/EfficientNet 基线",
    ],
    codeSketch: `from torchvision.models import vit_b_16
import torch.nn as nn

class PathologyViT(nn.Module):
    def __init__(self, num_classes, pretrained_dino=None):
        super().__init__()
        self.vit = vit_b_16(pretrained=False)
        if pretrained_dino:
            state_dict = torch.load(pretrained_dino)
            self.vit.load_state_dict(state_dict, strict=False)
        self.classifier = nn.Sequential(
            nn.Linear(768, 256),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )`,
    createdAt: "2026-03-16T14:00:00Z",
  },
  {
    id: "plan003",
    name: "GraphSAGE Drug-Drug Interaction",
    targetPaper: "Graph Neural Networks for Drug Discovery",
    hypothesis: "图注意力网络结合分子指纹特征，可以有效建模药物间相互作用，在 DDI 预测上超越基于 Transformer 的方法。",
    method: "GAT + 分子指纹特征融合 + 负采样训练策略",
    baselineMethod: "Random Forest + 摩根指纹",
    expectedImprovement: "AUC-ROC 从 87.1% 提升至 93%+",
    feasibilityScore: 91,
    feasibilityBreakdown: [
      { label: "计算需求", score: 95 },
      { label: "数据可用性", score: 90 },
      { label: "预期提升", score: 88 },
      { label: "实现难度", score: 91 },
    ],
    status: "completed",
    metrics: ["AUC-ROC", "AUPR", "Accuracy", "F1"],
    datasets: [
      { name: "DrugBank v5.0", size: "10,000+ 药物", url: "https://www.drugbank.ca/" },
    ],
    steps: ["图构建", "特征工程", "模型训练", "评估"],
    codeSketch: `# GraphSAGE implementation`,
    createdAt: "2026-03-14T09:00:00Z",
  },
];
