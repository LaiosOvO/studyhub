"""Temporal activity definitions for workflows.

Placeholder activities for Phase 1. Real implementations
are added in Phase 5 (Deep Research) and Phase 6 (Experiments).
"""

from temporalio import activity


@activity.defn
async def placeholder_search(research_direction: str) -> dict:
    """Placeholder search activity for Phase 1.

    Returns a stub result. Real implementation in Phase 5 will
    call paper search APIs (OpenAlex, Semantic Scholar, etc.).

    Args:
        research_direction: The research topic to search for.

    Returns:
        Dict with status and direction echo.
    """
    return {"status": "placeholder", "direction": research_direction}
