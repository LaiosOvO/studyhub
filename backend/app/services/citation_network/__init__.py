"""Citation network services for graph expansion and quality scoring.

Provides Neo4j client, BFS expansion engine, similarity discovery,
and composite quality scoring.
"""

from app.services.citation_network.neo4j_client import Neo4jClient

__all__ = ["Neo4jClient"]
