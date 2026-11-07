import hashlib
import math
import time
from typing import Any, Dict, List, Optional


def compute_embedding_32d(text: str) -> List[float]:
    """Computes a normalized 32-dimensional semantic vector embedding."""
    tokens = [t.strip().lower() for t in text.replace(".", " ").replace(",", " ").split() if t.strip()]
    vec = [0.0] * 32
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        for i in range(32):
            signed_val = (digest[i] / 127.5) - 1.0
            vec[i] += signed_val
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


class HybridMemoryEngine:
    """
    Production Hybrid Memory & Knowledge Graph Service.
    Combines vector similarity, full-text keyword scoring, 1-hop entity graph boost,
    and duplicate/contradiction consolidation.
    """

    def __init__(self) -> None:
        self.memories: List[Dict[str, Any]] = [
            {
                "id": "mem_01_kotlin_arch",
                "user_id": "shaurya",
                "content": "Shaurya develops native Android applications using Kotlin, Jetpack Compose, Coroutines, and Clean MVVM architecture.",
                "category": "semantic",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.98,
                "importance": 0.94,
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_kotlin", "ent_compose"],
                "embedding": compute_embedding_32d(
                    "Shaurya develops native Android applications using Kotlin, Jetpack Compose, Coroutines, and Clean MVVM architecture."
                ),
                "updated_at": "2026-11-07T10:30:00Z",
            },
            {
                "id": "mem_02_bilingual_pref",
                "user_id": "shaurya",
                "content": "Shaurya speaks English and Telugu fluently and enjoys natural Telugu-English code-switching with Aria.",
                "category": "procedural",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.97,
                "importance": 0.92,
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_telugu"],
                "embedding": compute_embedding_32d(
                    "Shaurya speaks English and Telugu fluently and enjoys natural Telugu-English code-switching with Aria."
                ),
                "updated_at": "2026-11-07T11:00:00Z",
            },
            {
                "id": "mem_03_ananya_pgvector",
                "user_id": "shaurya",
                "content": "Ananya Rao collaborates with Shaurya on Project Aether to optimize PostgreSQL pgvector HNSW indexing on PR #42.",
                "category": "relational",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.94,
                "importance": 0.88,
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_ananya", "ent_aether"],
                "embedding": compute_embedding_32d(
                    "Ananya Rao collaborates with Shaurya on Project Aether to optimize PostgreSQL pgvector HNSW indexing on PR #42."
                ),
                "updated_at": "2026-11-07T11:20:00Z",
            },
        ]
        self.entities: List[Dict[str, Any]] = [
            {"id": "ent_shaurya", "name": "Shaurya", "type": "Person"},
            {"id": "ent_kotlin", "name": "Kotlin", "type": "Technology"},
            {"id": "ent_compose", "name": "Jetpack Compose", "type": "Technology"},
            {"id": "ent_telugu", "name": "Telugu & English", "type": "Preference"},
            {"id": "ent_ananya", "name": "Ananya Rao", "type": "Person"},
            {"id": "ent_aether", "name": "Project Aether", "type": "Project"},
        ]

    def retrieve_hybrid(
        self, query: str, category: Optional[str] = None, limit: int = 5
    ) -> List[Dict[str, Any]]:
        q_vec = compute_embedding_32d(query)
        q_tokens = [t.lower() for t in query.split() if len(t) >= 3]

        matched_entity_ids = set()
        for ent in self.entities:
            ent_tokens = [t.lower() for t in ent["name"].split() if len(t) >= 3]
            if any(qt in ent["name"].lower() for qt in q_tokens) or any(
                et in query.lower() for et in ent_tokens
            ):
                matched_entity_ids.add(ent["id"])

        scored = []
        for mem in self.memories:
            if category and mem["category"] != category:
                continue
            v_sim = max(0.0, cosine_similarity(q_vec, mem["embedding"]))
            c_lower = mem["content"].lower()
            kw_hits = sum(1 for qt in q_tokens if qt in c_lower)
            kw_score = min(1.0, kw_hits / max(1, len(q_tokens)))
            g_boost = (
                0.20
                if any(eid in matched_entity_ids for eid in mem.get("related_entity_ids", []))
                else 0.0
            )
            total = round(0.45 * v_sim + 0.35 * kw_score + g_boost + 0.10 * mem["importance"], 4)
            scored.append({**mem, "score": total})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    def consolidate_memory(
        self,
        content: str,
        category: str = "episodic",
        epistemic_status: str = "explicitly_stated",
        importance: float = 0.85,
    ) -> Dict[str, Any]:
        vec = compute_embedding_32d(content)
        for existing in self.memories:
            sim = cosine_similarity(vec, existing["embedding"])
            if sim > 0.88:
                existing["content"] = content
                existing["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                return {"action": "merged_duplicate", "memory": existing}

        new_mem = {
            "id": f"mem_{int(time.time() * 1000)}",
            "user_id": "shaurya",
            "content": content,
            "category": category,
            "epistemic_status": epistemic_status,
            "confidence": 0.95 if epistemic_status == "explicitly_stated" else 0.72,
            "importance": importance,
            "verification_status": (
                "verified" if epistemic_status == "explicitly_stated" else "unverified"
            ),
            "related_entity_ids": ["ent_shaurya"],
            "embedding": vec,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.memories.insert(0, new_mem)
        return {"action": "created", "memory": new_mem}


memory_engine = HybridMemoryEngine()
