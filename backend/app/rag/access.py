"""Turns an authenticated user into a vector-DB filter.

This is the single place that decides what a search may see. Every search
goes through `scope_filter`; tool arguments from the LLM can only NARROW
the result (type, year, language), never widen it.

Rules (from schema v1.4):
  * visibility = 'global'  -> every student can see it.
  * visibility = 'private' -> only owner_user_id may see it.
  * upload_type = 'working' is never indexed (handwritten answers are not
    a knowledge source), and admins get no default access to private files.
"""
from __future__ import annotations

from qdrant_client import models as qm

from .types import AccessScope


def scope_filter(scope: AccessScope, *, narrow: list[qm.Condition] | None = None) -> qm.Filter:
    global_cond = qm.FieldCondition(key="visibility", match=qm.MatchValue(value="global"))

    if scope.include_private and scope.role == "student":
        own_private = qm.Filter(
            must=[
                qm.FieldCondition(key="visibility", match=qm.MatchValue(value="private")),
                qm.FieldCondition(key="owner_user_id", match=qm.MatchValue(value=scope.user_id)),
            ]
        )
        visibility_clause = qm.Filter(should=[global_cond, own_private])
    else:
        # Admins (and students with private search off) see global content only.
        visibility_clause = qm.Filter(must=[global_cond])

    must: list[qm.Condition] = [visibility_clause]
    must.extend(narrow or [])
    # Defence in depth: never return handwritten working, even if it was indexed by mistake.
    must_not = [qm.FieldCondition(key="upload_type", match=qm.MatchValue(value="working"))]
    return qm.Filter(must=must, must_not=must_not)
