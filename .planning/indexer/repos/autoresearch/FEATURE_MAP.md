# autoresearch — 功能地图

> generated_by: refindex-v2
> generated_at: 2026-03-15

共 7 个功能模块。

## Tokenizer

> 类 Tokenizer (L209-L245)，6 个方法，关键方法: from_directory, get_vocab_size, get_bos_token_id, encode, decode

| 节点 | 类型 | 路径 |
|------|------|------|
| Tokenizer | class | `prepare.py` |
| __init__ | function | `prepare.py` |
| from_directory | function | `prepare.py` |
| get_vocab_size | function | `prepare.py` |
| get_bos_token_id | function | `prepare.py` |
| encode | function | `prepare.py` |
| decode | function | `prepare.py` |

## download_* 系列

> prepare 模块的 2 个 download_* 函数，包含: download_single_shard, download_data

| 节点 | 类型 | 路径 |
|------|------|------|
| download_single_shard | function | `prepare.py` |
| download_data | function | `prepare.py` |

## Prepare 工具函数

> prepare 模块的 8 个顶层函数（python），包含: list_parquet_files, text_iterator, train_tokenizer, get_token_bytes, make_dataloader

| 节点 | 类型 | 路径 |
|------|------|------|
| list_parquet_files | function | `prepare.py` |
| text_iterator | function | `prepare.py` |
| train_tokenizer | function | `prepare.py` |
| get_token_bytes | function | `prepare.py` |
| _document_batches | function | `prepare.py` |
| make_dataloader | function | `prepare.py` |
| refill_buffer | function | `prepare.py` |
| evaluate_bpb | function | `prepare.py` |

## GPT

> 含组件 Block, forward；含组件 MLP, forward；含组件 CausalSelfAttention, forward；含组件 GPTConfig；类 GPT (L124-L291)，8 个方法，关键方法: init_weights, estimate_flops, num_scaling_params, setup_optimizer, forward

| 节点 | 类型 | 路径 |
|------|------|------|
| GPTConfig | class | `train.py` |
| CausalSelfAttention | class | `train.py` |
| __init__ | function | `train.py` |
| forward | function | `train.py` |
| MLP | class | `train.py` |
| __init__ | function | `train.py` |
| forward | function | `train.py` |
| Block | class | `train.py` |
| __init__ | function | `train.py` |
| forward | function | `train.py` |
| GPT | class | `train.py` |
| __init__ | function | `train.py` |
| init_weights | function | `train.py` |
| _precompute_rotary_embeddings | function | `train.py` |
| _compute_window_sizes | function | `train.py` |
| estimate_flops | function | `train.py` |
| num_scaling_params | function | `train.py` |
| setup_optimizer | function | `train.py` |
| forward | function | `train.py` |

## MuonAdamW

> 类 MuonAdamW (L356-L426)，4 个方法，关键方法: step

| 节点 | 类型 | 路径 |
|------|------|------|
| MuonAdamW | class | `train.py` |
| __init__ | function | `train.py` |
| _step_adamw | function | `train.py` |
| _step_muon | function | `train.py` |
| step | function | `train.py` |

## get_* 系列

> train 模块的 3 个 get_* 函数，包含: get_lr_multiplier, get_muon_momentum, get_weight_decay

| 节点 | 类型 | 路径 |
|------|------|------|
| get_lr_multiplier | function | `train.py` |
| get_muon_momentum | function | `train.py` |
| get_weight_decay | function | `train.py` |

## Train 工具函数

> train 模块的 6 个顶层函数（python），包含: norm, has_ve, apply_rotary_emb, adamw_step_fused, muon_step_fused

| 节点 | 类型 | 路径 |
|------|------|------|
| norm | function | `train.py` |
| has_ve | function | `train.py` |
| apply_rotary_emb | function | `train.py` |
| adamw_step_fused | function | `train.py` |
| muon_step_fused | function | `train.py` |
| build_model_config | function | `train.py` |
