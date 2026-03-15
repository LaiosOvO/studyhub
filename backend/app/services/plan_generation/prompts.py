"""LLM prompt templates for the plan generation pipeline.

All builders return list[dict] in OpenAI message format.
Prompts are bilingual-aware (direction may be in Chinese).
All prompts end with strict JSON-only output instruction.

Reference: AI-Scientist generate_ideas.py prompt structure.
"""


def build_sota_prompt(
    direction: str,
    paper_count: int,
    top_methods: str,
    best_metrics: str,
    hf_benchmarks: str,
) -> list[dict]:
    """Build prompt for SOTA method identification.

    Instructs LLM to identify current SOTA methods, standard baselines,
    evaluation metrics, and benchmark datasets for a research direction.
    """
    system = (
        "You are a research analyst specializing in identifying state-of-the-art "
        "methods and benchmarks. You analyze paper corpora to determine current "
        "best-performing approaches. The research direction may be in Chinese or "
        "English -- respond in English for structured data."
    )
    user = (
        f"Research direction: {direction}\n\n"
        f"Corpus size: {paper_count} papers analyzed.\n\n"
        f"Top methods found in corpus:\n{top_methods}\n\n"
        f"Best metrics reported:\n{best_metrics}\n\n"
        f"External benchmark datasets (HuggingFace Hub):\n{hf_benchmarks}\n\n"
        "Based on the corpus data and external benchmarks, identify:\n"
        "1. sota_methods: Current SOTA methods with their best metric values. "
        "Each entry: {method, metric, value, paper_title, confidence}. "
        "confidence is 'high', 'medium', or 'low'.\n"
        "2. standard_baselines: Common baseline methods for comparison. "
        "Each entry: {name, description}.\n"
        "3. evaluation_metrics: Standard metrics used to evaluate progress.\n"
        "4. benchmark_datasets: Standard datasets for evaluation. "
        "Each entry: {name, description, url (if known)}.\n\n"
        "Return ONLY valid JSON, no additional text."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_improvement_prompt(
    direction: str,
    sota_summary: str,
    gaps_summary: str,
    entry_context: str,
) -> list[dict]:
    """Build prompt for improvement opportunity analysis.

    Maps identified gaps + SOTA data to actionable improvement opportunities.
    """
    system = (
        "You are a research strategist who identifies concrete improvement "
        "opportunities by analyzing gaps in current research and SOTA methods. "
        "The research direction may be in Chinese or English."
    )
    user = (
        f"Research direction: {direction}\n\n"
        f"Current SOTA:\n{sota_summary}\n\n"
        f"Identified gaps:\n{gaps_summary}\n\n"
        f"Entry context:\n{entry_context}\n\n"
        "For each gap, identify a concrete improvement opportunity:\n"
        "- gap_description: Which gap this addresses\n"
        "- improvement_type: One of 'methodological', 'architectural', "
        "'data_augmentation', 'evaluation', 'efficiency', 'combination'\n"
        "- suggested_approach: Specific technical approach to try\n"
        "- estimated_difficulty: 1 (easy) to 5 (very hard)\n"
        "- related_gap_index: Index of the gap in the gaps list (0-based), "
        "or null if it spans multiple gaps\n\n"
        "Return ONLY valid JSON array of improvement objects, no additional text."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_plan_generation_prompt(
    direction: str,
    sota_summary: str,
    gaps_summary: str,
    improvements_summary: str,
    entry_context: str,
) -> list[dict]:
    """Build prompt for experiment plan generation.

    Generates a complete experiment plan with hypothesis, methodology,
    baselines, metrics, datasets, and technical roadmap.

    Reference: AI-Scientist idea_first_prompt structure.
    """
    system = (
        "You are an AI research scientist designing rigorous experiment plans. "
        "Your plans must be specific, feasible, and grounded in the current "
        "SOTA and identified gaps. The research direction may be in Chinese -- "
        "generate the plan in the same language as the direction."
    )
    user = (
        f"Research direction: {direction}\n\n"
        f"Current SOTA:\n{sota_summary}\n\n"
        f"Identified gaps:\n{gaps_summary}\n\n"
        f"Improvement opportunities:\n{improvements_summary}\n\n"
        f"Entry context:\n{entry_context}\n\n"
        "Generate an experiment plan with the following fields:\n"
        "- title: A concise descriptive title\n"
        "- hypothesis: Clear, testable hypothesis\n"
        "- method_description: Detailed methodology (2-4 paragraphs)\n"
        "- baselines: List of {name, paper_id (if known), metrics} to compare against\n"
        "- metrics: List of evaluation metric names\n"
        "- datasets: List of {name, url, size, license} to use\n"
        "- technical_roadmap: Ordered list of {step, description} for implementation\n"
        "- interestingness: Rating 1-10\n"
        "- feasibility: Rating 1-10\n"
        "- novelty: Rating 1-10\n\n"
        "Return ONLY valid JSON, no additional text."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_reflection_prompt(
    plan_draft_json: str,
    round_num: int,
    total_rounds: int,
) -> list[dict]:
    """Build prompt for AI-Scientist-style reflection on a plan draft.

    Asks the LLM to critique and improve the plan. If the plan is
    already good enough, instructs to return 'I am done'.

    Reference: AI-Scientist idea_reflection_prompt.
    """
    system = (
        "You are a senior research reviewer improving experiment plans. "
        "Critique the plan for clarity, feasibility, novelty, and rigor. "
        "The plan may be in Chinese or English."
    )
    user = (
        f"Round {round_num}/{total_rounds}.\n\n"
        f"Current plan draft:\n{plan_draft_json}\n\n"
        "Carefully evaluate:\n"
        "1. Is the hypothesis clear and testable?\n"
        "2. Is the methodology sound and detailed enough?\n"
        "3. Are the baselines appropriate and sufficient?\n"
        "4. Are the datasets accessible and relevant?\n"
        "5. Is the technical roadmap realistic?\n"
        "6. Are the interestingness, feasibility, and novelty ratings accurate?\n\n"
        "If you can improve the plan, return the improved version as valid JSON "
        "in the same format.\n"
        "If the plan is already good and needs no changes, include "
        '"I am done" at the start of your response, then repeat the JSON.\n\n'
        "Return ONLY valid JSON (optionally preceded by 'I am done'), "
        "no additional text."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build_feasibility_prompt(
    plan_summary: str,
    direction: str,
) -> list[dict]:
    """Build prompt for feasibility scoring (uses Haiku for cost efficiency).

    Scores across four dimensions: compute, data availability,
    expected improvement, and difficulty.
    """
    system = (
        "You are a pragmatic research advisor assessing experiment feasibility. "
        "Score conservatively -- overconfident plans waste resources. "
        "The plan may be in Chinese or English."
    )
    user = (
        f"Research direction: {direction}\n\n"
        f"Experiment plan summary:\n{plan_summary}\n\n"
        "Score the plan on four dimensions (1 = lowest/easiest, 5 = highest/hardest):\n"
        "- compute_requirements: How much compute is needed? "
        "(1=laptop, 2=single GPU, 3=multi-GPU, 4=cluster, 5=massive cluster)\n"
        "- data_availability: How available is the required data? "
        "(1=not available, 2=hard to get, 3=obtainable, 4=public, 5=readily available)\n"
        "- expected_improvement: How much improvement over SOTA is expected? "
        "(1=marginal, 2=small, 3=moderate, 4=significant, 5=breakthrough)\n"
        "- difficulty: Overall technical difficulty? "
        "(1=trivial, 2=easy, 3=moderate, 4=hard, 5=very hard)\n"
        "- overall: Weighted average as float (higher = more feasible). "
        "Formula: (6-compute + data + expected_improvement + 6-difficulty) / 4\n"
        "- explanation: Brief justification (2-3 sentences)\n\n"
        "Return ONLY valid JSON, no additional text."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]
