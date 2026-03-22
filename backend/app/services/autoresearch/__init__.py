"""AutoResearch execution engine.

Follows Karpathy's autoresearch pattern:
  LLM modifies code → git commit → subprocess run → extract metrics → keep/discard
"""
