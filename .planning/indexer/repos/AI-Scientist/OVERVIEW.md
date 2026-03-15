# AI-Scientist — 项目概览

> generated_by: refindex-v2
> generated_at: 2026-03-15
> provenance: AST-backed via Tree-sitter

## 基本信息

| 指标 | 值 |
|------|------|
| 语言 | python |
| 文件数 | 131 |
| 代码行数 | 43260 |
| 解析错误 | 0 |

## 模块结构

| 模块 | 路径 | 语言 | 行数 |
|------|------|------|------|
| ai_scientist | `ai_scientist/__init__.py` | python | 1 |
| generate_ideas | `ai_scientist/generate_ideas.py` | python | 547 |
| llm | `ai_scientist/llm.py` | python | 352 |
| perform_experiments | `ai_scientist/perform_experiments.py` | python | 167 |
| perform_review | `ai_scientist/perform_review.py` | python | 396 |
| perform_writeup | `ai_scientist/perform_writeup.py` | python | 580 |
| prepare | `data/enwik8/prepare.py` | python | 75 |
| prepare | `data/shakespeare_char/prepare.py` | python | 69 |
| prepare | `data/text8/prepare.py` | python | 76 |
| datasets | `example_papers/adaptive_dual_scale_denoising/datasets.py` | python | 68 |
| ema_pytorch | `example_papers/adaptive_dual_scale_denoising/ema_pytorch.py` | python | 287 |
| experiment | `example_papers/adaptive_dual_scale_denoising/experiment.py` | python | 334 |
| plot | `example_papers/adaptive_dual_scale_denoising/plot.py` | python | 123 |
| run_1 | `example_papers/adaptive_dual_scale_denoising/run_1.py` | python | 328 |
| run_2 | `example_papers/adaptive_dual_scale_denoising/run_2.py` | python | 328 |
| run_3 | `example_papers/adaptive_dual_scale_denoising/run_3.py` | python | 332 |
| run_4 | `example_papers/adaptive_dual_scale_denoising/run_4.py` | python | 332 |
| run_5 | `example_papers/adaptive_dual_scale_denoising/run_5.py` | python | 334 |
| experiment | `example_papers/data_augmentation_grokking/experiment.py` | python | 488 |
| plot | `example_papers/data_augmentation_grokking/plot.py` | python | 156 |
| run_1 | `example_papers/data_augmentation_grokking/run_1.py` | python | 453 |
| run_2 | `example_papers/data_augmentation_grokking/run_2.py` | python | 483 |
| run_3 | `example_papers/data_augmentation_grokking/run_3.py` | python | 489 |
| run_4 | `example_papers/data_augmentation_grokking/run_4.py` | python | 488 |
| run_5 | `example_papers/data_augmentation_grokking/run_5.py` | python | 488 |
| datasets | `example_papers/dual_expert_denoiser/datasets.py` | python | 68 |
| ema_pytorch | `example_papers/dual_expert_denoiser/ema_pytorch.py` | python | 287 |
| experiment | `example_papers/dual_expert_denoiser/experiment.py` | python | 342 |
| plot | `example_papers/dual_expert_denoiser/plot.py` | python | 151 |
| run_1 | `example_papers/dual_expert_denoiser/run_1.py` | python | 327 |
| run_2 | `example_papers/dual_expert_denoiser/run_2.py` | python | 329 |
| run_3 | `example_papers/dual_expert_denoiser/run_3.py` | python | 333 |
| run_4 | `example_papers/dual_expert_denoiser/run_4.py` | python | 341 |
| run_5 | `example_papers/dual_expert_denoiser/run_5.py` | python | 342 |
| datasets | `example_papers/gan_diffusion/datasets.py` | python | 68 |
| discriminator | `example_papers/gan_diffusion/discriminator.py` | python | 16 |
| ema_pytorch | `example_papers/gan_diffusion/ema_pytorch.py` | python | 287 |
| experiment | `example_papers/gan_diffusion/experiment.py` | python | 333 |
| plot | `example_papers/gan_diffusion/plot.py` | python | 103 |
| run_1 | `example_papers/gan_diffusion/run_1.py` | python | 316 |
| run_2 | `example_papers/gan_diffusion/run_2.py` | python | 333 |
| run_3 | `example_papers/gan_diffusion/run_3.py` | python | 333 |
| run_4 | `example_papers/gan_diffusion/run_4.py` | python | 333 |
| run_5 | `example_papers/gan_diffusion/run_5.py` | python | 333 |
| datasets | `example_papers/grid_based_noise_adaptation/datasets.py` | python | 68 |
| ema_pytorch | `example_papers/grid_based_noise_adaptation/ema_pytorch.py` | python | 287 |
| experiment | `example_papers/grid_based_noise_adaptation/experiment.py` | python | 349 |
| plot | `example_papers/grid_based_noise_adaptation/plot.py` | python | 145 |
| run_1 | `example_papers/grid_based_noise_adaptation/run_1.py` | python | 330 |
| run_2 | `example_papers/grid_based_noise_adaptation/run_2.py` | python | 331 |
| run_3 | `example_papers/grid_based_noise_adaptation/run_3.py` | python | 343 |
| run_4 | `example_papers/grid_based_noise_adaptation/run_4.py` | python | 349 |
| run_5 | `example_papers/grid_based_noise_adaptation/run_5.py` | python | 349 |
| experiment | `example_papers/layerwise_lr_grokking/experiment.py` | python | 421 |
| plot | `example_papers/layerwise_lr_grokking/plot.py` | python | 168 |
| run_1 | `example_papers/layerwise_lr_grokking/run_1.py` | python | 421 |
| run_2 | `example_papers/layerwise_lr_grokking/run_2.py` | python | 421 |
| run_3 | `example_papers/layerwise_lr_grokking/run_3.py` | python | 421 |
| run_4 | `example_papers/layerwise_lr_grokking/run_4.py` | python | 421 |
| experiment | `example_papers/mdl_grokking_correlation/experiment.py` | python | 435 |
| plot | `example_papers/mdl_grokking_correlation/plot.py` | python | 490 |
| run_1 | `example_papers/mdl_grokking_correlation/run_1.py` | python | 435 |
| run_2 | `example_papers/mdl_grokking_correlation/run_2.py` | python | 435 |
| run_3 | `example_papers/mdl_grokking_correlation/run_3.py` | python | 435 |
| run_4 | `example_papers/mdl_grokking_correlation/run_4.py` | python | 435 |
| run_5 | `example_papers/mdl_grokking_correlation/run_5.py` | python | 435 |
| experiment | `example_papers/multi_style_adapter/experiment.py` | python | 846 |
| plot | `example_papers/multi_style_adapter/plot.py` | python | 149 |
| run_1 | `example_papers/multi_style_adapter/run_1.py` | python | 736 |
| run_2 | `example_papers/multi_style_adapter/run_2.py` | python | 737 |
| run_3 | `example_papers/multi_style_adapter/run_3.py` | python | 736 |
| run_4 | `example_papers/multi_style_adapter/run_4.py` | python | 792 |
| run_5 | `example_papers/multi_style_adapter/run_5.py` | python | 846 |
| experiment | `example_papers/rl_lr_adaptation/experiment.py` | python | 712 |
| plot | `example_papers/rl_lr_adaptation/plot.py` | python | 97 |
| q_learning_agent | `example_papers/rl_lr_adaptation/q_learning_agent.py` | python | 32 |
| run_1 | `example_papers/rl_lr_adaptation/run_1.py` | python | 712 |
| run_2 | `example_papers/rl_lr_adaptation/run_2.py` | python | 712 |
| run_3 | `example_papers/rl_lr_adaptation/run_3.py` | python | 712 |
| run_4 | `example_papers/rl_lr_adaptation/run_4.py` | python | 712 |
| run_5 | `example_papers/rl_lr_adaptation/run_5.py` | python | 712 |
| experiment | `example_papers/weight_initialization_grokking/experiment.py` | python | 430 |
| plot | `example_papers/weight_initialization_grokking/plot.py` | python | 196 |
| run_1 | `example_papers/weight_initialization_grokking/run_1.py` | python | 428 |
| run_2 | `example_papers/weight_initialization_grokking/run_2.py` | python | 430 |
| run_3 | `example_papers/weight_initialization_grokking/run_3.py` | python | 430 |
| run_4 | `example_papers/weight_initialization_grokking/run_4.py` | python | 430 |
| run_5 | `example_papers/weight_initialization_grokking/run_5.py` | python | 430 |
| launch_oe_scientist | `experimental/launch_oe_scientist.py` | python | 395 |
| launch_scientist | `launch_scientist.py` | python | 421 |
| iclr_analysis | `review_iclr_bench/iclr_analysis.py` | python | 489 |
| datasets | `templates/2d_diffusion/datasets.py` | python | 68 |
| ema_pytorch | `templates/2d_diffusion/ema_pytorch.py` | python | 286 |
| experiment | `templates/2d_diffusion/experiment.py` | python | 295 |
| plot | `templates/2d_diffusion/plot.py` | python | 100 |
| experiment | `templates/MACE/experiment.py` | python | 188 |
| plot | `templates/MACE/plot.py` | python | 123 |
| experiment | `templates/earthquake-prediction/experiment.py` | python | 448 |
| plot | `templates/earthquake-prediction/plot.py` | python | 116 |
| experiment | `templates/grokking/experiment.py` | python | 416 |
| plot | `templates/grokking/plot.py` | python | 164 |
| experiment | `templates/mobilenetV3/experiment.py` | python | 608 |
| plot | `templates/mobilenetV3/plot.py` | python | 209 |
| experiment | `templates/nanoGPT/experiment.py` | python | 721 |
| plot | `templates/nanoGPT/plot.py` | python | 96 |
| experiment | `templates/nanoGPT_lite/experiment.py` | python | 719 |
| plot | `templates/nanoGPT_lite/plot.py` | python | 96 |
| experiment | `templates/probes/experiment.py` | python | 360 |
| plot | `templates/probes/plot.py` | python | 1 |
| experiment | `templates/seir/experiment.py` | python | 61 |
| plot | `templates/seir/plot.py` | python | 49 |
| experiment | `templates/sketch_rnn/experiment.py` | python | 405 |
| plot | `templates/sketch_rnn/plot.py` | python | 148 |
| utils | `templates/sketch_rnn/utils.py` | python | 110 |
| dataLoader | `templates/tensorf/dataLoader/__init__.py` | python | 12 |
| blender | `templates/tensorf/dataLoader/blender.py` | python | 123 |
| colmap2nerf | `templates/tensorf/dataLoader/colmap2nerf.py` | python | 315 |
| llff | `templates/tensorf/dataLoader/llff.py` | python | 241 |
| nsvf | `templates/tensorf/dataLoader/nsvf.py` | python | 160 |
| ray_utils | `templates/tensorf/dataLoader/ray_utils.py` | python | 278 |
| tankstemple | `templates/tensorf/dataLoader/tankstemple.py` | python | 212 |
| your_own_data | `templates/tensorf/dataLoader/your_own_data.py` | python | 124 |
| experiment | `templates/tensorf/experiment.py` | python | 356 |
| models | `templates/tensorf/models/__init__.py` | python | 1 |
| sh | `templates/tensorf/models/sh.py` | python | 136 |
| tensoRF | `templates/tensorf/models/tensoRF.py` | python | 407 |
| tensorBase | `templates/tensorf/models/tensorBase.py` | python | 455 |
| opt | `templates/tensorf/opt.py` | python | 135 |
| plot | `templates/tensorf/plot.py` | python | 146 |
| renderer | `templates/tensorf/renderer.py` | python | 144 |
| utils | `templates/tensorf/utils.py` | python | 233 |

## 关键类

| 类名 | 文件 | 行范围 |
|------|------|--------|
| EMA | `example_papers/adaptive_dual_scale_denoising/ema_pytorch.py` | L31-L286 |
| SinusoidalEmbedding | `example_papers/adaptive_dual_scale_denoising/experiment.py` | L25-L38 |
| ResidualBlock | `example_papers/adaptive_dual_scale_denoising/experiment.py` | L41-L48 |
| MLPDenoiser | `example_papers/adaptive_dual_scale_denoising/experiment.py` | L51-L111 |
| NoiseScheduler | `example_papers/adaptive_dual_scale_denoising/experiment.py` | L114-L198 |
| SinusoidalEmbedding | `example_papers/adaptive_dual_scale_denoising/run_1.py` | L25-L38 |
| ResidualBlock | `example_papers/adaptive_dual_scale_denoising/run_1.py` | L41-L48 |
| MLPDenoiser | `example_papers/adaptive_dual_scale_denoising/run_1.py` | L51-L109 |
| NoiseScheduler | `example_papers/adaptive_dual_scale_denoising/run_1.py` | L112-L196 |
| SinusoidalEmbedding | `example_papers/adaptive_dual_scale_denoising/run_2.py` | L25-L38 |
| ResidualBlock | `example_papers/adaptive_dual_scale_denoising/run_2.py` | L41-L48 |
| MLPDenoiser | `example_papers/adaptive_dual_scale_denoising/run_2.py` | L51-L109 |
| NoiseScheduler | `example_papers/adaptive_dual_scale_denoising/run_2.py` | L112-L196 |
| SinusoidalEmbedding | `example_papers/adaptive_dual_scale_denoising/run_3.py` | L25-L38 |
| ResidualBlock | `example_papers/adaptive_dual_scale_denoising/run_3.py` | L41-L48 |
| MLPDenoiser | `example_papers/adaptive_dual_scale_denoising/run_3.py` | L51-L109 |
| NoiseScheduler | `example_papers/adaptive_dual_scale_denoising/run_3.py` | L112-L196 |
| SinusoidalEmbedding | `example_papers/adaptive_dual_scale_denoising/run_4.py` | L25-L38 |
| ResidualBlock | `example_papers/adaptive_dual_scale_denoising/run_4.py` | L41-L48 |
| MLPDenoiser | `example_papers/adaptive_dual_scale_denoising/run_4.py` | L51-L109 |
| NoiseScheduler | `example_papers/adaptive_dual_scale_denoising/run_4.py` | L112-L196 |
| SinusoidalEmbedding | `example_papers/adaptive_dual_scale_denoising/run_5.py` | L25-L38 |
| ResidualBlock | `example_papers/adaptive_dual_scale_denoising/run_5.py` | L41-L48 |
| MLPDenoiser | `example_papers/adaptive_dual_scale_denoising/run_5.py` | L51-L111 |
| NoiseScheduler | `example_papers/adaptive_dual_scale_denoising/run_5.py` | L114-L198 |
| AbstractDataset | `example_papers/data_augmentation_grokking/experiment.py` | L15-L62 |
| ModSumDataset | `example_papers/data_augmentation_grokking/experiment.py` | L65-L85 |
| ModSubtractDataset | `example_papers/data_augmentation_grokking/experiment.py` | L88-L114 |
| ModDivisonDataset | `example_papers/data_augmentation_grokking/experiment.py` | L117-L137 |
| PermutationGroup | `example_papers/data_augmentation_grokking/experiment.py` | L140-L147 |
| GroupDataset | `example_papers/data_augmentation_grokking/experiment.py` | L150-L169 |
| DecoderBlock | `example_papers/data_augmentation_grokking/experiment.py` | L202-L226 |
| Transformer | `example_papers/data_augmentation_grokking/experiment.py` | L229-L263 |
| AbstractDataset | `example_papers/data_augmentation_grokking/run_1.py` | L15-L62 |
| ModSumDataset | `example_papers/data_augmentation_grokking/run_1.py` | L65-L80 |
| ModSubtractDataset | `example_papers/data_augmentation_grokking/run_1.py` | L83-L91 |
| ModDivisonDataset | `example_papers/data_augmentation_grokking/run_1.py` | L94-L102 |
| PermutationGroup | `example_papers/data_augmentation_grokking/run_1.py` | L105-L112 |
| GroupDataset | `example_papers/data_augmentation_grokking/run_1.py` | L115-L134 |
| DecoderBlock | `example_papers/data_augmentation_grokking/run_1.py` | L167-L191 |
| Transformer | `example_papers/data_augmentation_grokking/run_1.py` | L194-L228 |
| AbstractDataset | `example_papers/data_augmentation_grokking/run_2.py` | L15-L62 |
| ModSumDataset | `example_papers/data_augmentation_grokking/run_2.py` | L65-L86 |
| ModSubtractDataset | `example_papers/data_augmentation_grokking/run_2.py` | L89-L109 |
| ModDivisonDataset | `example_papers/data_augmentation_grokking/run_2.py` | L112-L132 |
| PermutationGroup | `example_papers/data_augmentation_grokking/run_2.py` | L135-L142 |
| GroupDataset | `example_papers/data_augmentation_grokking/run_2.py` | L145-L164 |
| DecoderBlock | `example_papers/data_augmentation_grokking/run_2.py` | L197-L221 |
| Transformer | `example_papers/data_augmentation_grokking/run_2.py` | L224-L258 |
| AbstractDataset | `example_papers/data_augmentation_grokking/run_3.py` | L15-L62 |
| ModSumDataset | `example_papers/data_augmentation_grokking/run_3.py` | L65-L86 |
| ModSubtractDataset | `example_papers/data_augmentation_grokking/run_3.py` | L89-L115 |
| ModDivisonDataset | `example_papers/data_augmentation_grokking/run_3.py` | L118-L138 |
| PermutationGroup | `example_papers/data_augmentation_grokking/run_3.py` | L141-L148 |
| GroupDataset | `example_papers/data_augmentation_grokking/run_3.py` | L151-L170 |
| DecoderBlock | `example_papers/data_augmentation_grokking/run_3.py` | L203-L227 |
| Transformer | `example_papers/data_augmentation_grokking/run_3.py` | L230-L264 |
| AbstractDataset | `example_papers/data_augmentation_grokking/run_4.py` | L15-L62 |
| ModSumDataset | `example_papers/data_augmentation_grokking/run_4.py` | L65-L85 |
| ModSubtractDataset | `example_papers/data_augmentation_grokking/run_4.py` | L88-L114 |
| ModDivisonDataset | `example_papers/data_augmentation_grokking/run_4.py` | L117-L137 |
| PermutationGroup | `example_papers/data_augmentation_grokking/run_4.py` | L140-L147 |
| GroupDataset | `example_papers/data_augmentation_grokking/run_4.py` | L150-L169 |
| DecoderBlock | `example_papers/data_augmentation_grokking/run_4.py` | L202-L226 |
| Transformer | `example_papers/data_augmentation_grokking/run_4.py` | L229-L263 |
| AbstractDataset | `example_papers/data_augmentation_grokking/run_5.py` | L15-L62 |
| ModSumDataset | `example_papers/data_augmentation_grokking/run_5.py` | L65-L85 |
| ModSubtractDataset | `example_papers/data_augmentation_grokking/run_5.py` | L88-L114 |
| ModDivisonDataset | `example_papers/data_augmentation_grokking/run_5.py` | L117-L137 |
| PermutationGroup | `example_papers/data_augmentation_grokking/run_5.py` | L140-L147 |
| GroupDataset | `example_papers/data_augmentation_grokking/run_5.py` | L150-L169 |
| DecoderBlock | `example_papers/data_augmentation_grokking/run_5.py` | L202-L226 |
| Transformer | `example_papers/data_augmentation_grokking/run_5.py` | L229-L263 |
| EMA | `example_papers/dual_expert_denoiser/ema_pytorch.py` | L31-L286 |
| SinusoidalEmbedding | `example_papers/dual_expert_denoiser/experiment.py` | L25-L38 |
| ResidualBlock | `example_papers/dual_expert_denoiser/experiment.py` | L41-L48 |
| MLPDenoiser | `example_papers/dual_expert_denoiser/experiment.py` | L51-L101 |
| NoiseScheduler | `example_papers/dual_expert_denoiser/experiment.py` | L104-L188 |
| SinusoidalEmbedding | `example_papers/dual_expert_denoiser/run_1.py` | L25-L38 |
| ResidualBlock | `example_papers/dual_expert_denoiser/run_1.py` | L41-L48 |
| MLPDenoiser | `example_papers/dual_expert_denoiser/run_1.py` | L51-L95 |
| NoiseScheduler | `example_papers/dual_expert_denoiser/run_1.py` | L98-L182 |
| SinusoidalEmbedding | `example_papers/dual_expert_denoiser/run_2.py` | L25-L38 |
| ResidualBlock | `example_papers/dual_expert_denoiser/run_2.py` | L41-L48 |
| MLPDenoiser | `example_papers/dual_expert_denoiser/run_2.py` | L51-L97 |
| NoiseScheduler | `example_papers/dual_expert_denoiser/run_2.py` | L100-L184 |
| SinusoidalEmbedding | `example_papers/dual_expert_denoiser/run_3.py` | L25-L38 |
| ResidualBlock | `example_papers/dual_expert_denoiser/run_3.py` | L41-L48 |
| MLPDenoiser | `example_papers/dual_expert_denoiser/run_3.py` | L51-L101 |
| NoiseScheduler | `example_papers/dual_expert_denoiser/run_3.py` | L104-L188 |
| SinusoidalEmbedding | `example_papers/dual_expert_denoiser/run_4.py` | L25-L38 |
| ResidualBlock | `example_papers/dual_expert_denoiser/run_4.py` | L41-L48 |
| MLPDenoiser | `example_papers/dual_expert_denoiser/run_4.py` | L51-L101 |
| NoiseScheduler | `example_papers/dual_expert_denoiser/run_4.py` | L104-L188 |
| SinusoidalEmbedding | `example_papers/dual_expert_denoiser/run_5.py` | L25-L38 |
| ResidualBlock | `example_papers/dual_expert_denoiser/run_5.py` | L41-L48 |
| MLPDenoiser | `example_papers/dual_expert_denoiser/run_5.py` | L51-L101 |
| NoiseScheduler | `example_papers/dual_expert_denoiser/run_5.py` | L104-L188 |
| Discriminator | `example_papers/gan_diffusion/discriminator.py` | L4-L15 |
| EMA | `example_papers/gan_diffusion/ema_pytorch.py` | L31-L286 |
| SinusoidalEmbedding | `example_papers/gan_diffusion/experiment.py` | L26-L39 |
| ResidualBlock | `example_papers/gan_diffusion/experiment.py` | L42-L49 |
| MLPDenoiser | `example_papers/gan_diffusion/experiment.py` | L52-L77 |
| NoiseScheduler | `example_papers/gan_diffusion/experiment.py` | L80-L164 |
| SinusoidalEmbedding | `example_papers/gan_diffusion/run_1.py` | L26-L39 |
| ResidualBlock | `example_papers/gan_diffusion/run_1.py` | L42-L49 |
| MLPDenoiser | `example_papers/gan_diffusion/run_1.py` | L52-L77 |
| NoiseScheduler | `example_papers/gan_diffusion/run_1.py` | L80-L164 |
| SinusoidalEmbedding | `example_papers/gan_diffusion/run_2.py` | L26-L39 |
| ResidualBlock | `example_papers/gan_diffusion/run_2.py` | L42-L49 |
| MLPDenoiser | `example_papers/gan_diffusion/run_2.py` | L52-L77 |
| NoiseScheduler | `example_papers/gan_diffusion/run_2.py` | L80-L164 |
| SinusoidalEmbedding | `example_papers/gan_diffusion/run_3.py` | L26-L39 |
| ResidualBlock | `example_papers/gan_diffusion/run_3.py` | L42-L49 |
| MLPDenoiser | `example_papers/gan_diffusion/run_3.py` | L52-L77 |
| NoiseScheduler | `example_papers/gan_diffusion/run_3.py` | L80-L164 |
| SinusoidalEmbedding | `example_papers/gan_diffusion/run_4.py` | L26-L39 |
| ResidualBlock | `example_papers/gan_diffusion/run_4.py` | L42-L49 |
| MLPDenoiser | `example_papers/gan_diffusion/run_4.py` | L52-L77 |
| NoiseScheduler | `example_papers/gan_diffusion/run_4.py` | L80-L164 |
| SinusoidalEmbedding | `example_papers/gan_diffusion/run_5.py` | L26-L39 |
| ResidualBlock | `example_papers/gan_diffusion/run_5.py` | L42-L49 |
| MLPDenoiser | `example_papers/gan_diffusion/run_5.py` | L52-L77 |
| NoiseScheduler | `example_papers/gan_diffusion/run_5.py` | L80-L164 |
| EMA | `example_papers/grid_based_noise_adaptation/ema_pytorch.py` | L31-L286 |
| SinusoidalEmbedding | `example_papers/grid_based_noise_adaptation/experiment.py` | L37-L50 |
| ResidualBlock | `example_papers/grid_based_noise_adaptation/experiment.py` | L53-L60 |
| MLPDenoiser | `example_papers/grid_based_noise_adaptation/experiment.py` | L63-L88 |
| NoiseScheduler | `example_papers/grid_based_noise_adaptation/experiment.py` | L91-L195 |
| SinusoidalEmbedding | `example_papers/grid_based_noise_adaptation/run_1.py` | L37-L50 |
| ResidualBlock | `example_papers/grid_based_noise_adaptation/run_1.py` | L53-L60 |
| MLPDenoiser | `example_papers/grid_based_noise_adaptation/run_1.py` | L63-L88 |
| NoiseScheduler | `example_papers/grid_based_noise_adaptation/run_1.py` | L91-L186 |
| SinusoidalEmbedding | `example_papers/grid_based_noise_adaptation/run_2.py` | L37-L50 |
| ResidualBlock | `example_papers/grid_based_noise_adaptation/run_2.py` | L53-L60 |
| MLPDenoiser | `example_papers/grid_based_noise_adaptation/run_2.py` | L63-L88 |
| NoiseScheduler | `example_papers/grid_based_noise_adaptation/run_2.py` | L91-L186 |
| SinusoidalEmbedding | `example_papers/grid_based_noise_adaptation/run_3.py` | L37-L50 |
| ResidualBlock | `example_papers/grid_based_noise_adaptation/run_3.py` | L53-L60 |
| MLPDenoiser | `example_papers/grid_based_noise_adaptation/run_3.py` | L63-L88 |
| NoiseScheduler | `example_papers/grid_based_noise_adaptation/run_3.py` | L91-L195 |
| SinusoidalEmbedding | `example_papers/grid_based_noise_adaptation/run_4.py` | L37-L50 |
| ResidualBlock | `example_papers/grid_based_noise_adaptation/run_4.py` | L53-L60 |
| MLPDenoiser | `example_papers/grid_based_noise_adaptation/run_4.py` | L63-L88 |
| NoiseScheduler | `example_papers/grid_based_noise_adaptation/run_4.py` | L91-L195 |
| SinusoidalEmbedding | `example_papers/grid_based_noise_adaptation/run_5.py` | L37-L50 |
| ResidualBlock | `example_papers/grid_based_noise_adaptation/run_5.py` | L53-L60 |
| MLPDenoiser | `example_papers/grid_based_noise_adaptation/run_5.py` | L63-L88 |
| NoiseScheduler | `example_papers/grid_based_noise_adaptation/run_5.py` | L91-L195 |
| AbstractDataset | `example_papers/layerwise_lr_grokking/experiment.py` | L15-L59 |
| ModSumDataset | `example_papers/layerwise_lr_grokking/experiment.py` | L62-L68 |
| ModSubtractDataset | `example_papers/layerwise_lr_grokking/experiment.py` | L71-L79 |
| ModDivisonDataset | `example_papers/layerwise_lr_grokking/experiment.py` | L82-L90 |
| PermutationGroup | `example_papers/layerwise_lr_grokking/experiment.py` | L93-L100 |
| GroupDataset | `example_papers/layerwise_lr_grokking/experiment.py` | L103-L122 |
| DecoderBlock | `example_papers/layerwise_lr_grokking/experiment.py` | L155-L179 |
| Transformer | `example_papers/layerwise_lr_grokking/experiment.py` | L182-L216 |
| AbstractDataset | `example_papers/layerwise_lr_grokking/run_1.py` | L15-L59 |
| ModSumDataset | `example_papers/layerwise_lr_grokking/run_1.py` | L62-L68 |
| ModSubtractDataset | `example_papers/layerwise_lr_grokking/run_1.py` | L71-L79 |
| ModDivisonDataset | `example_papers/layerwise_lr_grokking/run_1.py` | L82-L90 |
| PermutationGroup | `example_papers/layerwise_lr_grokking/run_1.py` | L93-L100 |
| GroupDataset | `example_papers/layerwise_lr_grokking/run_1.py` | L103-L122 |
| DecoderBlock | `example_papers/layerwise_lr_grokking/run_1.py` | L155-L179 |
| Transformer | `example_papers/layerwise_lr_grokking/run_1.py` | L182-L216 |
| AbstractDataset | `example_papers/layerwise_lr_grokking/run_2.py` | L15-L59 |
| ModSumDataset | `example_papers/layerwise_lr_grokking/run_2.py` | L62-L68 |
| ModSubtractDataset | `example_papers/layerwise_lr_grokking/run_2.py` | L71-L79 |
| ModDivisonDataset | `example_papers/layerwise_lr_grokking/run_2.py` | L82-L90 |
| PermutationGroup | `example_papers/layerwise_lr_grokking/run_2.py` | L93-L100 |
| GroupDataset | `example_papers/layerwise_lr_grokking/run_2.py` | L103-L122 |
| DecoderBlock | `example_papers/layerwise_lr_grokking/run_2.py` | L155-L179 |
| Transformer | `example_papers/layerwise_lr_grokking/run_2.py` | L182-L216 |
| AbstractDataset | `example_papers/layerwise_lr_grokking/run_3.py` | L15-L59 |
| ModSumDataset | `example_papers/layerwise_lr_grokking/run_3.py` | L62-L68 |
| ModSubtractDataset | `example_papers/layerwise_lr_grokking/run_3.py` | L71-L79 |
| ModDivisonDataset | `example_papers/layerwise_lr_grokking/run_3.py` | L82-L90 |
| PermutationGroup | `example_papers/layerwise_lr_grokking/run_3.py` | L93-L100 |
| GroupDataset | `example_papers/layerwise_lr_grokking/run_3.py` | L103-L122 |
| DecoderBlock | `example_papers/layerwise_lr_grokking/run_3.py` | L155-L179 |
| Transformer | `example_papers/layerwise_lr_grokking/run_3.py` | L182-L216 |
| AbstractDataset | `example_papers/layerwise_lr_grokking/run_4.py` | L15-L59 |
| ModSumDataset | `example_papers/layerwise_lr_grokking/run_4.py` | L62-L68 |
| ModSubtractDataset | `example_papers/layerwise_lr_grokking/run_4.py` | L71-L79 |
| ModDivisonDataset | `example_papers/layerwise_lr_grokking/run_4.py` | L82-L90 |
| PermutationGroup | `example_papers/layerwise_lr_grokking/run_4.py` | L93-L100 |
| GroupDataset | `example_papers/layerwise_lr_grokking/run_4.py` | L103-L122 |
| DecoderBlock | `example_papers/layerwise_lr_grokking/run_4.py` | L155-L179 |
| Transformer | `example_papers/layerwise_lr_grokking/run_4.py` | L182-L216 |
| AbstractDataset | `example_papers/mdl_grokking_correlation/experiment.py` | L16-L60 |
| ModSumDataset | `example_papers/mdl_grokking_correlation/experiment.py` | L63-L69 |
| ModSubtractDataset | `example_papers/mdl_grokking_correlation/experiment.py` | L72-L80 |
| ModDivisonDataset | `example_papers/mdl_grokking_correlation/experiment.py` | L83-L91 |
| PermutationGroup | `example_papers/mdl_grokking_correlation/experiment.py` | L94-L101 |
| GroupDataset | `example_papers/mdl_grokking_correlation/experiment.py` | L104-L123 |
| DecoderBlock | `example_papers/mdl_grokking_correlation/experiment.py` | L156-L180 |
| Transformer | `example_papers/mdl_grokking_correlation/experiment.py` | L183-L217 |
| AbstractDataset | `example_papers/mdl_grokking_correlation/run_1.py` | L16-L60 |
| ModSumDataset | `example_papers/mdl_grokking_correlation/run_1.py` | L63-L69 |
| ModSubtractDataset | `example_papers/mdl_grokking_correlation/run_1.py` | L72-L80 |
| ModDivisonDataset | `example_papers/mdl_grokking_correlation/run_1.py` | L83-L91 |
| PermutationGroup | `example_papers/mdl_grokking_correlation/run_1.py` | L94-L101 |
| GroupDataset | `example_papers/mdl_grokking_correlation/run_1.py` | L104-L123 |
| DecoderBlock | `example_papers/mdl_grokking_correlation/run_1.py` | L156-L180 |
| Transformer | `example_papers/mdl_grokking_correlation/run_1.py` | L183-L217 |
| AbstractDataset | `example_papers/mdl_grokking_correlation/run_2.py` | L16-L60 |
| ModSumDataset | `example_papers/mdl_grokking_correlation/run_2.py` | L63-L69 |
| ModSubtractDataset | `example_papers/mdl_grokking_correlation/run_2.py` | L72-L80 |
| ModDivisonDataset | `example_papers/mdl_grokking_correlation/run_2.py` | L83-L91 |
| PermutationGroup | `example_papers/mdl_grokking_correlation/run_2.py` | L94-L101 |
| GroupDataset | `example_papers/mdl_grokking_correlation/run_2.py` | L104-L123 |
| DecoderBlock | `example_papers/mdl_grokking_correlation/run_2.py` | L156-L180 |
| Transformer | `example_papers/mdl_grokking_correlation/run_2.py` | L183-L217 |
| AbstractDataset | `example_papers/mdl_grokking_correlation/run_3.py` | L16-L60 |
| ModSumDataset | `example_papers/mdl_grokking_correlation/run_3.py` | L63-L69 |
| ModSubtractDataset | `example_papers/mdl_grokking_correlation/run_3.py` | L72-L80 |
| ModDivisonDataset | `example_papers/mdl_grokking_correlation/run_3.py` | L83-L91 |
| PermutationGroup | `example_papers/mdl_grokking_correlation/run_3.py` | L94-L101 |
| GroupDataset | `example_papers/mdl_grokking_correlation/run_3.py` | L104-L123 |
| DecoderBlock | `example_papers/mdl_grokking_correlation/run_3.py` | L156-L180 |
| Transformer | `example_papers/mdl_grokking_correlation/run_3.py` | L183-L217 |
| AbstractDataset | `example_papers/mdl_grokking_correlation/run_4.py` | L16-L60 |
| ModSumDataset | `example_papers/mdl_grokking_correlation/run_4.py` | L63-L69 |
| ModSubtractDataset | `example_papers/mdl_grokking_correlation/run_4.py` | L72-L80 |
| ModDivisonDataset | `example_papers/mdl_grokking_correlation/run_4.py` | L83-L91 |
| PermutationGroup | `example_papers/mdl_grokking_correlation/run_4.py` | L94-L101 |
| GroupDataset | `example_papers/mdl_grokking_correlation/run_4.py` | L104-L123 |
| DecoderBlock | `example_papers/mdl_grokking_correlation/run_4.py` | L156-L180 |
| Transformer | `example_papers/mdl_grokking_correlation/run_4.py` | L183-L217 |
| AbstractDataset | `example_papers/mdl_grokking_correlation/run_5.py` | L16-L60 |
| ModSumDataset | `example_papers/mdl_grokking_correlation/run_5.py` | L63-L69 |
| ModSubtractDataset | `example_papers/mdl_grokking_correlation/run_5.py` | L72-L80 |
| ModDivisonDataset | `example_papers/mdl_grokking_correlation/run_5.py` | L83-L91 |
| PermutationGroup | `example_papers/mdl_grokking_correlation/run_5.py` | L94-L101 |
| GroupDataset | `example_papers/mdl_grokking_correlation/run_5.py` | L104-L123 |
| DecoderBlock | `example_papers/mdl_grokking_correlation/run_5.py` | L156-L180 |
| Transformer | `example_papers/mdl_grokking_correlation/run_5.py` | L183-L217 |
| LayerNorm | `example_papers/multi_style_adapter/experiment.py` | L22-L31 |
| CausalSelfAttention | `example_papers/multi_style_adapter/experiment.py` | L34-L104 |
| MLP | `example_papers/multi_style_adapter/experiment.py` | L107-L121 |
| StyleAdapter | `example_papers/multi_style_adapter/experiment.py` | L124-L130 |
| Block | `example_papers/multi_style_adapter/experiment.py` | L132-L144 |
| GPTConfig | `example_papers/multi_style_adapter/experiment.py` | L148-L161 |
| GPT | `example_papers/multi_style_adapter/experiment.py` | L164-L345 |
| LayerNorm | `example_papers/multi_style_adapter/run_1.py` | L16-L25 |
| CausalSelfAttention | `example_papers/multi_style_adapter/run_1.py` | L28-L98 |
| MLP | `example_papers/multi_style_adapter/run_1.py` | L101-L115 |
| StyleAdapter | `example_papers/multi_style_adapter/run_1.py` | L118-L124 |
| Block | `example_papers/multi_style_adapter/run_1.py` | L126-L138 |
| GPTConfig | `example_papers/multi_style_adapter/run_1.py` | L142-L155 |
| GPT | `example_papers/multi_style_adapter/run_1.py` | L158-L340 |
| LayerNorm | `example_papers/multi_style_adapter/run_2.py` | L16-L25 |
| CausalSelfAttention | `example_papers/multi_style_adapter/run_2.py` | L28-L98 |
| MLP | `example_papers/multi_style_adapter/run_2.py` | L101-L115 |
| StyleAdapter | `example_papers/multi_style_adapter/run_2.py` | L118-L124 |
| Block | `example_papers/multi_style_adapter/run_2.py` | L126-L138 |
| GPTConfig | `example_papers/multi_style_adapter/run_2.py` | L142-L155 |
| GPT | `example_papers/multi_style_adapter/run_2.py` | L158-L340 |
| LayerNorm | `example_papers/multi_style_adapter/run_3.py` | L16-L25 |
| CausalSelfAttention | `example_papers/multi_style_adapter/run_3.py` | L28-L98 |
| MLP | `example_papers/multi_style_adapter/run_3.py` | L101-L115 |
| StyleAdapter | `example_papers/multi_style_adapter/run_3.py` | L118-L124 |
| Block | `example_papers/multi_style_adapter/run_3.py` | L126-L138 |
| GPTConfig | `example_papers/multi_style_adapter/run_3.py` | L142-L155 |
| GPT | `example_papers/multi_style_adapter/run_3.py` | L158-L339 |
| LayerNorm | `example_papers/multi_style_adapter/run_4.py` | L19-L28 |
| CausalSelfAttention | `example_papers/multi_style_adapter/run_4.py` | L31-L101 |
| MLP | `example_papers/multi_style_adapter/run_4.py` | L104-L118 |
| StyleAdapter | `example_papers/multi_style_adapter/run_4.py` | L121-L127 |
| Block | `example_papers/multi_style_adapter/run_4.py` | L129-L141 |
| GPTConfig | `example_papers/multi_style_adapter/run_4.py` | L145-L158 |
| GPT | `example_papers/multi_style_adapter/run_4.py` | L161-L342 |
| LayerNorm | `example_papers/multi_style_adapter/run_5.py` | L22-L31 |
| CausalSelfAttention | `example_papers/multi_style_adapter/run_5.py` | L34-L104 |
| MLP | `example_papers/multi_style_adapter/run_5.py` | L107-L121 |
| StyleAdapter | `example_papers/multi_style_adapter/run_5.py` | L124-L130 |
| Block | `example_papers/multi_style_adapter/run_5.py` | L132-L144 |
| GPTConfig | `example_papers/multi_style_adapter/run_5.py` | L148-L161 |
| GPT | `example_papers/multi_style_adapter/run_5.py` | L164-L345 |
| LayerNorm | `example_papers/rl_lr_adaptation/experiment.py` | L17-L26 |
| CausalSelfAttention | `example_papers/rl_lr_adaptation/experiment.py` | L29-L99 |
| MLP | `example_papers/rl_lr_adaptation/experiment.py` | L102-L116 |
| Block | `example_papers/rl_lr_adaptation/experiment.py` | L119-L131 |
| GPTConfig | `example_papers/rl_lr_adaptation/experiment.py` | L135-L146 |
| GPT | `example_papers/rl_lr_adaptation/experiment.py` | L149-L312 |
| QLearningAgent | `example_papers/rl_lr_adaptation/q_learning_agent.py` | L3-L31 |
| LayerNorm | `example_papers/rl_lr_adaptation/run_1.py` | L17-L26 |
| CausalSelfAttention | `example_papers/rl_lr_adaptation/run_1.py` | L29-L99 |
| MLP | `example_papers/rl_lr_adaptation/run_1.py` | L102-L116 |
| Block | `example_papers/rl_lr_adaptation/run_1.py` | L119-L131 |
| GPTConfig | `example_papers/rl_lr_adaptation/run_1.py` | L135-L146 |
| GPT | `example_papers/rl_lr_adaptation/run_1.py` | L149-L312 |
| LayerNorm | `example_papers/rl_lr_adaptation/run_2.py` | L17-L26 |
| CausalSelfAttention | `example_papers/rl_lr_adaptation/run_2.py` | L29-L99 |
| MLP | `example_papers/rl_lr_adaptation/run_2.py` | L102-L116 |
| Block | `example_papers/rl_lr_adaptation/run_2.py` | L119-L131 |
| GPTConfig | `example_papers/rl_lr_adaptation/run_2.py` | L135-L146 |
| GPT | `example_papers/rl_lr_adaptation/run_2.py` | L149-L312 |
| LayerNorm | `example_papers/rl_lr_adaptation/run_3.py` | L17-L26 |
| CausalSelfAttention | `example_papers/rl_lr_adaptation/run_3.py` | L29-L99 |
| MLP | `example_papers/rl_lr_adaptation/run_3.py` | L102-L116 |
| Block | `example_papers/rl_lr_adaptation/run_3.py` | L119-L131 |
| GPTConfig | `example_papers/rl_lr_adaptation/run_3.py` | L135-L146 |
| GPT | `example_papers/rl_lr_adaptation/run_3.py` | L149-L312 |
| LayerNorm | `example_papers/rl_lr_adaptation/run_4.py` | L17-L26 |
| CausalSelfAttention | `example_papers/rl_lr_adaptation/run_4.py` | L29-L99 |
| MLP | `example_papers/rl_lr_adaptation/run_4.py` | L102-L116 |
| Block | `example_papers/rl_lr_adaptation/run_4.py` | L119-L131 |
| GPTConfig | `example_papers/rl_lr_adaptation/run_4.py` | L135-L146 |
| GPT | `example_papers/rl_lr_adaptation/run_4.py` | L149-L312 |
| LayerNorm | `example_papers/rl_lr_adaptation/run_5.py` | L17-L26 |
| CausalSelfAttention | `example_papers/rl_lr_adaptation/run_5.py` | L29-L99 |
| MLP | `example_papers/rl_lr_adaptation/run_5.py` | L102-L116 |
| Block | `example_papers/rl_lr_adaptation/run_5.py` | L119-L131 |
| GPTConfig | `example_papers/rl_lr_adaptation/run_5.py` | L135-L146 |
| GPT | `example_papers/rl_lr_adaptation/run_5.py` | L149-L312 |
| AbstractDataset | `example_papers/weight_initialization_grokking/experiment.py` | L15-L59 |
| ModSumDataset | `example_papers/weight_initialization_grokking/experiment.py` | L62-L68 |
| ModSubtractDataset | `example_papers/weight_initialization_grokking/experiment.py` | L71-L79 |
| ModDivisonDataset | `example_papers/weight_initialization_grokking/experiment.py` | L82-L90 |
| PermutationGroup | `example_papers/weight_initialization_grokking/experiment.py` | L93-L100 |
| GroupDataset | `example_papers/weight_initialization_grokking/experiment.py` | L103-L122 |
| DecoderBlock | `example_papers/weight_initialization_grokking/experiment.py` | L155-L179 |
| Transformer | `example_papers/weight_initialization_grokking/experiment.py` | L182-L228 |
| AbstractDataset | `example_papers/weight_initialization_grokking/run_1.py` | L15-L59 |
| ModSumDataset | `example_papers/weight_initialization_grokking/run_1.py` | L62-L68 |
| ModSubtractDataset | `example_papers/weight_initialization_grokking/run_1.py` | L71-L79 |
| ModDivisonDataset | `example_papers/weight_initialization_grokking/run_1.py` | L82-L90 |
| PermutationGroup | `example_papers/weight_initialization_grokking/run_1.py` | L93-L100 |
| GroupDataset | `example_papers/weight_initialization_grokking/run_1.py` | L103-L122 |
| DecoderBlock | `example_papers/weight_initialization_grokking/run_1.py` | L155-L179 |
| Transformer | `example_papers/weight_initialization_grokking/run_1.py` | L182-L226 |
| AbstractDataset | `example_papers/weight_initialization_grokking/run_2.py` | L15-L59 |
| ModSumDataset | `example_papers/weight_initialization_grokking/run_2.py` | L62-L68 |
| ModSubtractDataset | `example_papers/weight_initialization_grokking/run_2.py` | L71-L79 |
| ModDivisonDataset | `example_papers/weight_initialization_grokking/run_2.py` | L82-L90 |
| PermutationGroup | `example_papers/weight_initialization_grokking/run_2.py` | L93-L100 |
| GroupDataset | `example_papers/weight_initialization_grokking/run_2.py` | L103-L122 |
| DecoderBlock | `example_papers/weight_initialization_grokking/run_2.py` | L155-L179 |
| Transformer | `example_papers/weight_initialization_grokking/run_2.py` | L182-L228 |
| AbstractDataset | `example_papers/weight_initialization_grokking/run_3.py` | L15-L59 |
| ModSumDataset | `example_papers/weight_initialization_grokking/run_3.py` | L62-L68 |
| ModSubtractDataset | `example_papers/weight_initialization_grokking/run_3.py` | L71-L79 |
| ModDivisonDataset | `example_papers/weight_initialization_grokking/run_3.py` | L82-L90 |
| PermutationGroup | `example_papers/weight_initialization_grokking/run_3.py` | L93-L100 |
| GroupDataset | `example_papers/weight_initialization_grokking/run_3.py` | L103-L122 |
| DecoderBlock | `example_papers/weight_initialization_grokking/run_3.py` | L155-L179 |
| Transformer | `example_papers/weight_initialization_grokking/run_3.py` | L182-L228 |
| AbstractDataset | `example_papers/weight_initialization_grokking/run_4.py` | L15-L59 |
| ModSumDataset | `example_papers/weight_initialization_grokking/run_4.py` | L62-L68 |
| ModSubtractDataset | `example_papers/weight_initialization_grokking/run_4.py` | L71-L79 |
| ModDivisonDataset | `example_papers/weight_initialization_grokking/run_4.py` | L82-L90 |
| PermutationGroup | `example_papers/weight_initialization_grokking/run_4.py` | L93-L100 |
| GroupDataset | `example_papers/weight_initialization_grokking/run_4.py` | L103-L122 |
| DecoderBlock | `example_papers/weight_initialization_grokking/run_4.py` | L155-L179 |
| Transformer | `example_papers/weight_initialization_grokking/run_4.py` | L182-L228 |
| AbstractDataset | `example_papers/weight_initialization_grokking/run_5.py` | L15-L59 |
| ModSumDataset | `example_papers/weight_initialization_grokking/run_5.py` | L62-L68 |
| ModSubtractDataset | `example_papers/weight_initialization_grokking/run_5.py` | L71-L79 |
| ModDivisonDataset | `example_papers/weight_initialization_grokking/run_5.py` | L82-L90 |
| PermutationGroup | `example_papers/weight_initialization_grokking/run_5.py` | L93-L100 |
| GroupDataset | `example_papers/weight_initialization_grokking/run_5.py` | L103-L122 |
| DecoderBlock | `example_papers/weight_initialization_grokking/run_5.py` | L155-L179 |
| Transformer | `example_papers/weight_initialization_grokking/run_5.py` | L182-L228 |
| EMA | `templates/2d_diffusion/ema_pytorch.py` | L30-L285 |
| SinusoidalEmbedding | `templates/2d_diffusion/experiment.py` | L25-L38 |
| ResidualBlock | `templates/2d_diffusion/experiment.py` | L41-L48 |
| MLPDenoiser | `templates/2d_diffusion/experiment.py` | L51-L76 |
| NoiseScheduler | `templates/2d_diffusion/experiment.py` | L79-L163 |
| ConvBlock | `templates/earthquake-prediction/experiment.py` | L31-L43 |
| LSTMCell | `templates/earthquake-prediction/experiment.py` | L46-L122 |
| Dataset_RNN_Train | `templates/earthquake-prediction/experiment.py` | L125-L147 |
| Dataset_RNN_Test | `templates/earthquake-prediction/experiment.py` | L150-L170 |
| Trainer | `templates/earthquake-prediction/experiment.py` | L173-L322 |
| Evaluator | `templates/earthquake-prediction/experiment.py` | L325-L366 |
| AbstractDataset | `templates/grokking/experiment.py` | L16-L60 |
| ModSumDataset | `templates/grokking/experiment.py` | L63-L69 |
| ModSubtractDataset | `templates/grokking/experiment.py` | L72-L80 |
| ModDivisonDataset | `templates/grokking/experiment.py` | L83-L91 |
| PermutationGroup | `templates/grokking/experiment.py` | L94-L101 |
| GroupDataset | `templates/grokking/experiment.py` | L104-L123 |
| DecoderBlock | `templates/grokking/experiment.py` | L156-L180 |
| Transformer | `templates/grokking/experiment.py` | L183-L217 |
| SqueezeExcitation | `templates/mobilenetV3/experiment.py` | L33-L58 |
| ConvNormActivation | `templates/mobilenetV3/experiment.py` | L62-L104 |
| InvertedResidualConfig | `templates/mobilenetV3/experiment.py` | L108-L132 |
| InvertedResidual | `templates/mobilenetV3/experiment.py` | L136-L209 |
| MobileNetV3Small | `templates/mobilenetV3/experiment.py` | L213-L313 |
| Config | `templates/mobilenetV3/experiment.py` | L346-L368 |
| LayerNorm | `templates/nanoGPT/experiment.py` | L18-L27 |
| CausalSelfAttention | `templates/nanoGPT/experiment.py` | L30-L100 |
| MLP | `templates/nanoGPT/experiment.py` | L103-L117 |
| Block | `templates/nanoGPT/experiment.py` | L120-L132 |
| GPTConfig | `templates/nanoGPT/experiment.py` | L136-L147 |
| GPT | `templates/nanoGPT/experiment.py` | L150-L313 |
| LayerNorm | `templates/nanoGPT_lite/experiment.py` | L18-L27 |
| CausalSelfAttention | `templates/nanoGPT_lite/experiment.py` | L30-L100 |
| MLP | `templates/nanoGPT_lite/experiment.py` | L103-L117 |
| Block | `templates/nanoGPT_lite/experiment.py` | L120-L132 |
| GPTConfig | `templates/nanoGPT_lite/experiment.py` | L136-L147 |
| GPT | `templates/nanoGPT_lite/experiment.py` | L150-L313 |
| State | `templates/sketch_rnn/experiment.py` | L21-L29 |
| EncoderRNN | `templates/sketch_rnn/experiment.py` | L91-L128 |
| DecoderRNN | `templates/sketch_rnn/experiment.py` | L131-L184 |
| Model | `templates/sketch_rnn/experiment.py` | L187-L307 |
| BlenderDataset | `templates/tensorf/dataLoader/blender.py` | L12-L122 |
| LLFFDataset | `templates/tensorf/dataLoader/llff.py` | L122-L240 |
| NSVF | `templates/tensorf/dataLoader/nsvf.py` | L37-L159 |
| TanksTempleDataset | `templates/tensorf/dataLoader/tankstemple.py` | L87-L211 |
| YourOwnDataset | `templates/tensorf/dataLoader/your_own_data.py` | L12-L123 |
| SimpleSampler | `templates/tensorf/experiment.py` | L20-L32 |
| TensorVM | `templates/tensorf/models/tensoRF.py` | L4-L127 |
| TensorVMSplit | `templates/tensorf/models/tensoRF.py` | L130-L283 |
| TensorCP | `templates/tensorf/models/tensoRF.py` | L286-L406 |
| AlphaGridMask | `templates/tensorf/models/tensorBase.py` | L39-L57 |
| MLPRender_Fea | `templates/tensorf/models/tensorBase.py` | L60-L84 |
| MLPRender_PE | `templates/tensorf/models/tensorBase.py` | L87-L111 |
| MLPRender | `templates/tensorf/models/tensorBase.py` | L114-L136 |
| TensorBase | `templates/tensorf/models/tensorBase.py` | L139-L454 |
| TVLoss | `templates/tensorf/utils.py` | L148-L165 |

## 依赖关系

共 1100 条 import 关系。

### 目录间依赖

- `experimental` → `ai_scientist` (5 条)
- `.` → `ai_scientist` (5 条)
- `review_iclr_bench` → `ai_scientist` (1 条)

## Git 热点文件

| 文件 | 变更次数 | 风险 |
|------|---------|------|
| `README.md` | 1 | low |
| `LICENSE` | 1 | low |
