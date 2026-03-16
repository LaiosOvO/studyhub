"""LLM-powered match explanation generator.

Uses Haiku model via llm_completion for cost-efficient
natural language explanations of researcher match scores.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.match import MatchSignalBreakdown
from app.schemas.profile import ResearcherProfilePublic
from app.services.llm_service import llm_completion

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-20250514"


async def generate_explanation(
    session: AsyncSession,
    user_id: str,
    profile_a: ResearcherProfilePublic,
    profile_b: ResearcherProfilePublic,
    breakdown: MatchSignalBreakdown,
) -> str:
    """Generate a natural language explanation for why two researchers match.

    Uses Haiku model for cost efficiency. Falls back to a generic message
    on any error.
    """
    prompt = (
        f"Given two researchers:\n"
        f"Researcher A: {profile_a.display_name}"
        f" ({profile_a.institution or 'unknown institution'}), "
        f"fields: {', '.join(profile_a.research_directions)}, "
        f"expertise: {', '.join(profile_a.expertise_tags)}\n"
        f"Researcher B: {profile_b.display_name}"
        f" ({profile_b.institution or 'unknown institution'}), "
        f"fields: {', '.join(profile_b.research_directions)}, "
        f"expertise: {', '.join(profile_b.expertise_tags)}\n\n"
        f"Match scores: complementarity={breakdown.complementarity:.2f}, "
        f"co-citation={breakdown.co_citation:.2f}, "
        f"adjacency={breakdown.adjacency:.2f}, "
        f"institutional={breakdown.institutional:.2f}\n\n"
        f"In 2-3 sentences, explain why they would be good collaborators. "
        f"Respond in the user's preferred language (Chinese if names appear Chinese, "
        f"English otherwise)."
    )

    try:
        response = await llm_completion(
            session=session,
            user_id=user_id,
            messages=[{"role": "user", "content": prompt}],
            model=HAIKU_MODEL,
            max_tokens=256,
            request_type="match_explanation",
        )
        return response.content
    except Exception as exc:
        logger.warning("Match explanation generation failed: %s", exc)
        return "These researchers have complementary expertise that could lead to productive collaboration."
