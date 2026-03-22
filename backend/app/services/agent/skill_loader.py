"""Skill loader — reads markdown skill definitions.

Skills are markdown files with YAML frontmatter that define agent workflows.
Inspired by Kuse Cowork's bundled-skills and LabClaw's SKILL.md format.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).parent / "skills"


@dataclass
class Skill:
    """A loaded skill definition."""

    name: str
    display_name: str
    description: str
    output_format: str  # md | docx | pdf
    system_prompt: str  # The full skill prompt
    tools: list[str] = field(default_factory=list)  # required tools
    input_schema: dict = field(default_factory=dict)  # expected input fields


def load_skill(skill_name: str) -> Skill | None:
    """Load a skill from the skills directory.

    Args:
        skill_name: The skill filename stem, e.g., "literature_review"

    Returns:
        Parsed Skill or None if not found.
    """
    skill_path = SKILLS_DIR / f"{skill_name}.skill.md"
    if not skill_path.exists():
        logger.warning("Skill not found: %s (looked at %s)", skill_name, skill_path)
        return None

    content = skill_path.read_text(encoding="utf-8")
    return _parse_skill(skill_name, content)


def list_skills() -> list[Skill]:
    """List all available skills."""
    skills = []
    for path in sorted(SKILLS_DIR.glob("*.skill.md")):
        skill = load_skill(path.stem.replace(".skill", ""))
        if skill:
            skills.append(skill)
    return skills


def _parse_skill(name: str, content: str) -> Skill:
    """Parse a skill markdown file with YAML frontmatter."""
    frontmatter: dict = {}
    body = content

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            try:
                frontmatter = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError:
                logger.warning("Invalid YAML frontmatter in skill: %s", name)
            body = parts[2].strip()

    return Skill(
        name=name,
        display_name=frontmatter.get("display_name", name.replace("_", " ").title()),
        description=frontmatter.get("description", ""),
        output_format=frontmatter.get("output_format", "md"),
        system_prompt=body,
        tools=frontmatter.get("tools", []),
        input_schema=frontmatter.get("input_schema", {}),
    )
