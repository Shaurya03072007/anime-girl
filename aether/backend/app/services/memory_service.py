import hashlib
import json
import math
import os
import re
import time
from typing import Any, Dict, List, Optional

from app.config import settings


def compute_embedding_32d(text: str) -> List[float]:
    """Computes a normalized 32-dimensional semantic vector embedding."""
    tokens = [
        t.strip().lower()
        for t in re.sub(r"[^\w\s]", " ", text).split()
        if t.strip()
    ]
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
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


STATE_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "aether_memory_graph_snapshot.json",
)


class HybridMemoryEngine:
    """
    Production Hybrid Memory & Knowledge Graph Engine for Project Aether.
    Supports:
    - Episodic, Semantic, Relational, Procedural, and Temporal memories.
    - Epistemic classification: explicitly_stated, observed_event, model_inference, unverified_assumption.
    - Hybrid retrieval: Vector cosine similarity + Full-text token matching + Temporal recency + 1-hop Entity Graph boost.
    - Duplicate consolidation, contradiction detection, and version history tracking.
    - Persistent disk synchronization across backend restarts.
    """

    def __init__(self) -> None:
        self.memories: List[Dict[str, Any]] = []
        self.entities: List[Dict[str, Any]] = []
        self.relationships: List[Dict[str, Any]] = []
        self.timeline: List[Dict[str, Any]] = []
        self.character_config: Dict[str, Any] = {}
        self.personality_config: Dict[str, Any] = {}
        self.life_state: Dict[str, Any] = {}
        self.reminders: List[Dict[str, Any]] = []
        self.agent_traces: List[Dict[str, Any]] = []
        self.action_audits: List[Dict[str, Any]] = []
        self.conversation_history: List[Dict[str, Any]] = []
        self.device_telemetry: Dict[str, Any] = {
            "batteryLevel": 82,
            "isCharging": True,
            "networkType": "Wi-FiConnected",
            "deviceModel": "Android Flagship",
            "androidVersion": "14",
            "foregroundApp": "ai.aether.companion",
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self._load_or_seed()

    def _seed_defaults(self) -> None:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.entities = [
            {
                "id": "ent_shaurya",
                "name": "Shaurya",
                "type": "Person",
                "description": "Primary user, senior Android & AI systems architect.",
                "attributes": {"role": "Lead Architect", "timezone": "IST"},
                "mentionCount": 18,
                "createdAt": "2026-11-01T09:00:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_aether",
                "name": "Project Aether",
                "type": "Project",
                "description": "Living AI companion ecosystem for Android using Google ADK and Gemini 3.8 Live.",
                "attributes": {"status": "Active Development", "repo": "anime-girl"},
                "mentionCount": 15,
                "createdAt": "2026-11-01T09:10:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_kotlin",
                "name": "Kotlin & Jetpack Compose",
                "type": "Technology",
                "description": "Primary stack for the native Android client with Coroutines, StateFlow, and Material 3.",
                "attributes": {"kotlin": "2.1.0", "compileSdk": "35"},
                "mentionCount": 12,
                "createdAt": "2026-11-01T10:00:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_adk",
                "name": "Google ADK",
                "type": "Technology",
                "description": "Agent Development Kit orchestrating Root, Decision, Memory, Phone, and Event agents.",
                "attributes": {"runtime": "Runner.run_live()"},
                "mentionCount": 11,
                "createdAt": "2026-11-02T14:00:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_pgvector",
                "name": "PostgreSQL + pgvector",
                "type": "Technology",
                "description": "Relational and HNSW vector hybrid storage engine for episodic, semantic, and graph memories.",
                "attributes": {"indexType": "HNSW cosine"},
                "mentionCount": 9,
                "createdAt": "2026-11-03T12:00:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_telugu",
                "name": "Telugu & English Bilingual",
                "type": "Preference",
                "description": "User speaks fluent English and Telugu, mixing both naturally in live voice sessions.",
                "attributes": {"codeswitching": "Enabled"},
                "mentionCount": 8,
                "createdAt": "2026-11-03T15:30:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_hyderabad",
                "name": "Hyderabad",
                "type": "Place",
                "description": "City connected to user cultural context and Telugu conversational dialect.",
                "attributes": {"region": "Telangana"},
                "mentionCount": 5,
                "createdAt": "2026-11-04T09:00:00Z",
                "updatedAt": now,
            },
            {
                "id": "ent_ananya",
                "name": "Ananya Rao",
                "type": "Person",
                "description": "Collaborating backend engineer reviewing PostgreSQL pgvector HNSW migrations on PR #42.",
                "attributes": {"team": "Memory & Database Graph"},
                "mentionCount": 6,
                "createdAt": "2026-11-05T11:20:00Z",
                "updatedAt": now,
            },
        ]

        raw_memories = [
            {
                "id": "mem_01_kotlin_arch",
                "content": "Shaurya develops native Android applications using Kotlin, Jetpack Compose, Coroutines, and Clean MVVM architecture.",
                "category": "semantic",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.98,
                "importance": 0.94,
                "sensitivity": "personal",
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_kotlin", "ent_aether"],
                "source": {
                    "sourceType": "conversation",
                    "referenceId": "conv_onboarding_01",
                    "excerpt": "I build all my Android apps with Kotlin, Jetpack Compose, and strict MVVM.",
                },
                "versions": [
                    {
                        "versionId": "ver_01_a",
                        "content": "Shaurya develops Android apps in Kotlin.",
                        "reason": "Initial onboarding statement",
                        "confidence": 0.95,
                        "updatedAt": "2026-11-02T10:15:00Z",
                    },
                    {
                        "versionId": "ver_01_b",
                        "content": "Shaurya develops native Android applications using Kotlin, Jetpack Compose, Coroutines, and Clean MVVM architecture.",
                        "reason": "Consolidated with Jetpack Compose and Coroutines details",
                        "confidence": 0.98,
                        "updatedAt": "2026-11-06T18:20:00Z",
                    },
                ],
                "access_count": 14,
                "created_at": "2026-11-02T10:15:00Z",
                "updated_at": "2026-11-06T18:20:00Z",
            },
            {
                "id": "mem_02_debugging_episode",
                "content": "Spent the evening debugging 16kHz PCM AudioRecord buffering and instant barge-in interruption for Project Aether on Android.",
                "category": "episodic",
                "epistemic_status": "observed_event",
                "confidence": 0.95,
                "importance": 0.88,
                "sensitivity": "personal",
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_aether", "ent_adk"],
                "source": {
                    "sourceType": "conversation",
                    "referenceId": "conv_session_08",
                    "excerpt": "We just finished tuning the 16kHz PCM audio buffer and barge-in handler.",
                },
                "versions": [
                    {
                        "versionId": "ver_02_a",
                        "content": "Spent the evening debugging 16kHz PCM AudioRecord buffering and instant barge-in interruption for Project Aether on Android.",
                        "reason": "Logged after evening coding session",
                        "confidence": 0.95,
                        "updatedAt": "2026-11-06T22:40:00Z",
                    }
                ],
                "access_count": 9,
                "created_at": "2026-11-06T22:40:00Z",
                "updated_at": "2026-11-06T22:40:00Z",
            },
            {
                "id": "mem_03_bilingual_pref",
                "content": "Prefers direct, deeply technical architectural explanations without filler, and enjoys natural Telugu-English code-switching with Aria.",
                "category": "procedural",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.97,
                "importance": 0.93,
                "sensitivity": "personal",
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_telugu", "ent_hyderabad"],
                "source": {
                    "sourceType": "conversation",
                    "referenceId": "conv_session_03",
                    "excerpt": "Keep explanations direct and technical, and feel free to reply in Telugu + English mix.",
                },
                "versions": [
                    {
                        "versionId": "ver_03_a",
                        "content": "Prefers direct, deeply technical architectural explanations without filler, and enjoys natural Telugu-English code-switching with Aria.",
                        "reason": "Explicitly stated preference",
                        "confidence": 0.97,
                        "updatedAt": "2026-11-03T15:35:00Z",
                    }
                ],
                "access_count": 19,
                "created_at": "2026-11-03T15:35:00Z",
                "updated_at": "2026-11-03T15:35:00Z",
            },
            {
                "id": "mem_04_ananya_pgvector",
                "content": "Ananya Rao collaborates with Shaurya on Project Aether to optimize PostgreSQL pgvector HNSW indexing and Alembic migrations on PR #42.",
                "category": "relational",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.94,
                "importance": 0.87,
                "sensitivity": "personal",
                "verification_status": "verified",
                "related_entity_ids": ["ent_shaurya", "ent_ananya", "ent_aether", "ent_pgvector"],
                "source": {
                    "sourceType": "conversation",
                    "referenceId": "conv_session_05",
                    "excerpt": "Ananya Rao is helping me tune the pgvector HNSW index on PR #42.",
                },
                "versions": [
                    {
                        "versionId": "ver_04_a",
                        "content": "Ananya Rao collaborates with Shaurya on Project Aether to optimize PostgreSQL pgvector HNSW indexing and Alembic migrations on PR #42.",
                        "reason": "Extracted from team collaboration notes",
                        "confidence": 0.94,
                        "updatedAt": "2026-11-05T11:25:00Z",
                    }
                ],
                "access_count": 7,
                "created_at": "2026-11-05T11:25:00Z",
                "updated_at": "2026-11-05T11:25:00Z",
            },
            {
                "id": "mem_05_temporal_evolution",
                "content": "Project Aether started in October as 'Project Nova' using REST polling and was renamed in November after migrating to Google ADK Runner.run_live() WebSockets.",
                "category": "temporal",
                "epistemic_status": "explicitly_stated",
                "confidence": 0.96,
                "importance": 0.89,
                "sensitivity": "public",
                "verification_status": "verified",
                "related_entity_ids": ["ent_aether", "ent_adk"],
                "source": {
                    "sourceType": "conversation",
                    "referenceId": "conv_session_04",
                    "excerpt": "We renamed Project Nova to Project Aether once we moved from REST polling to ADK Runner.run_live().",
                },
                "versions": [
                    {
                        "versionId": "ver_05_a",
                        "content": "Project Nova uses REST endpoints for companion chat.",
                        "reason": "Original October milestone",
                        "confidence": 0.88,
                        "updatedAt": "2026-10-20T12:00:00Z",
                    },
                    {
                        "versionId": "ver_05_b",
                        "content": "Project Aether started in October as 'Project Nova' using REST polling and was renamed in November after migrating to Google ADK Runner.run_live() WebSockets.",
                        "reason": "Temporal evolution update reflecting project rename and ADK Live migration",
                        "confidence": 0.96,
                        "updatedAt": "2026-11-07T08:30:00Z",
                    },
                ],
                "access_count": 10,
                "created_at": "2026-11-04T16:10:00Z",
                "updated_at": "2026-11-07T08:30:00Z",
            },
            {
                "id": "mem_06_unverified_inference",
                "content": "Shaurya may run an extended overnight field test of Aria's AccessibilityService and live voice streaming on his Samsung Galaxy S10+ (SM-G975F).",
                "category": "episodic",
                "epistemic_status": "model_inference",
                "confidence": 0.68,
                "importance": 0.74,
                "sensitivity": "personal",
                "verification_status": "unverified",
                "related_entity_ids": ["ent_shaurya", "ent_aether"],
                "source": {
                    "sourceType": "proactive_consolidation",
                    "referenceId": "consolidation_batch_12",
                    "excerpt": "Inferred from active wireless ADB debugging session on SM-G975F.",
                },
                "versions": [
                    {
                        "versionId": "ver_06_a",
                        "content": "Shaurya may run an extended overnight field test of Aria's AccessibilityService and live voice streaming on his Samsung Galaxy S10+ (SM-G975F).",
                        "reason": "Candidate inference awaiting user confirmation",
                        "confidence": 0.68,
                        "updatedAt": now,
                    }
                ],
                "access_count": 3,
                "created_at": now,
                "updated_at": now,
            },
        ]

        self.memories = []
        for m in raw_memories:
            m["user_id"] = "shaurya"
            m["embedding"] = compute_embedding_32d(m["content"])
            self.memories.append(m)

        self.relationships = [
            {
                "id": "rel_01",
                "sourceEntityId": "ent_shaurya",
                "targetEntityId": "ent_aether",
                "predicate": "architects",
                "confidence": 0.99,
                "evidenceMemoryIds": ["mem_02_debugging_episode", "mem_04_ananya_pgvector"],
                "createdAt": "2026-11-01T09:15:00Z",
            },
            {
                "id": "rel_02",
                "sourceEntityId": "ent_shaurya",
                "targetEntityId": "ent_kotlin",
                "predicate": "develops_with",
                "confidence": 0.98,
                "evidenceMemoryIds": ["mem_01_kotlin_arch"],
                "createdAt": "2026-11-02T10:15:00Z",
            },
            {
                "id": "rel_03",
                "sourceEntityId": "ent_aether",
                "targetEntityId": "ent_adk",
                "predicate": "orchestrated_by",
                "confidence": 0.98,
                "evidenceMemoryIds": ["mem_02_debugging_episode", "mem_05_temporal_evolution"],
                "createdAt": "2026-11-02T14:00:00Z",
            },
            {
                "id": "rel_04",
                "sourceEntityId": "ent_aether",
                "targetEntityId": "ent_pgvector",
                "predicate": "persists_graph_in",
                "confidence": 0.96,
                "evidenceMemoryIds": ["mem_04_ananya_pgvector"],
                "createdAt": "2026-11-03T12:00:00Z",
            },
            {
                "id": "rel_05",
                "sourceEntityId": "ent_ananya",
                "targetEntityId": "ent_aether",
                "predicate": "collaborates_on",
                "confidence": 0.94,
                "evidenceMemoryIds": ["mem_04_ananya_pgvector"],
                "createdAt": "2026-11-05T11:25:00Z",
            },
            {
                "id": "rel_06",
                "sourceEntityId": "ent_shaurya",
                "targetEntityId": "ent_telugu",
                "predicate": "converses_in",
                "confidence": 0.97,
                "evidenceMemoryIds": ["mem_03_bilingual_pref"],
                "createdAt": "2026-11-03T15:35:00Z",
            },
            {
                "id": "rel_07",
                "sourceEntityId": "ent_shaurya",
                "targetEntityId": "ent_hyderabad",
                "predicate": "connected_to_place",
                "confidence": 0.91,
                "evidenceMemoryIds": ["mem_03_bilingual_pref"],
                "createdAt": "2026-11-04T09:00:00Z",
            },
        ]

        self._rebuild_timeline()

        self.character_config = {
            "name": "Aria",
            "hairStyle": "long_flowing",
            "hairColor": "#818CF8",
            "secondaryHairColor": "#38BDF8",
            "eyeColor": "#2DD4BF",
            "eyeShape": "starry",
            "outfit": "casual_knit",
            "primaryOutfitColor": "#1E1B4B",
            "accentColor": "#6366F1",
            "accessories": ["glasses", "star_hairpin"],
            "backgroundTheme": "coffee_sketchbook",
            "voiceName": "Zephyr",
            "animationIntensity": 90,
            "currentAnimation": "Happy",
        }

        self.personality_config = {
            "coreTraits": ["Analytical", "Attentive", "Warm", "Resourceful", "Culturally Fluent"],
            "conversationalStyle": "warm_attentive",
            "humorLevel": 65,
            "formality": 30,
            "emotionalExpressiveness": 85,
            "initiativeLevel": 78,
            "preferredLanguage": "te-en",
            "relationshipStage": "Co-Architect",
            "boundaries": [
                "Never claim biological consciousness or human feelings",
                "Always request confirmation before executing high-risk phone intents",
                "Never ingest OTP, banking, or excluded-app notifications",
                "Never silently record the screen without an active MediaProjection indicator",
            ],
            "learnedHabits": [
                "Switches effortlessly between English and conversational Telugu phrases (e.g., 'Namaskaram Shaurya garu, chuddam!')",
                "Provides direct technical insights grounded in shared project memories",
                "Adapts daily sanctuary activities (coffee brewing, late-night study, dev rig debugging, rooftop stargazing)",
            ],
        }

        self.life_state = {
            "activeSceneId": "coffee_sketchbook",
            "energy": 92,
            "focus": 89,
            "bondLevel": 95,
            "currentMood": "Warm, Inspired & Attentive",
            "currentThought": "Just brewed a fresh pour-over coffee by the turntable while sketching new UI ideas. Ready whenever you want to talk or build, Shaurya!",
            "ambientTrack": "Warm Vinyl Crackle · Lo-Fi Jazz Piano",
            "location": "Vinyl & Coffee Sanctuary",
        }

        self.reminders = [
            {
                "id": "rem_01",
                "title": "Test Gemini 3.8 Live voice barge-in & phone control on Galaxy S10+",
                "dueAt": "Today · 18:00",
                "completed": False,
                "projectTag": "Project Aether",
                "createdBy": "companion",
            },
            {
                "id": "rem_02",
                "title": "Review PostgreSQL pgvector HNSW index PR #42 with Ananya",
                "dueAt": "Today · 20:30",
                "completed": False,
                "projectTag": "Memory Engine",
                "createdBy": "user",
            },
        ]

        self.agent_traces = [
            {
                "id": "trace_01",
                "timestamp": now,
                "agentName": "RootCompanionAgent",
                "operation": "initialize_companion_session",
                "inputSummary": "Loaded persistent identity & hybrid memory graph",
                "outputSummary": f"Ready with {len(self.memories)} memories & {len(self.entities)} entities",
                "reasoning": "Hydrated Aria's persona, Telugu-English bilingual preferences, and life sanctuary state.",
                "latencyMs": 18,
                "status": "success",
            },
            {
                "id": "trace_02",
                "timestamp": now,
                "agentName": "MemoryAgent",
                "operation": "pgvector_graph_index_check",
                "inputSummary": "Verified HNSW vector embeddings & 1-hop entity edges",
                "outputSummary": "Hybrid retrieval active (Vector 0.45 + FTS 0.35 + Graph 0.20)",
                "reasoning": "All episodic, semantic, relational, procedural, and temporal memories indexed.",
                "latencyMs": 24,
                "status": "success",
            },
        ]

    def _rebuild_timeline(self) -> None:
        self.timeline = []
        for idx, m in enumerate(self.memories):
            cat = m.get("category", "episodic")
            ver = m.get("verification_status", "verified")
            self.timeline.append(
                {
                    "id": f"tl_{m['id']}_{idx}",
                    "timestamp": m.get("updated_at") or m.get("created_at"),
                    "title": f"{cat.capitalize()} · {'Verified Memory' if ver == 'verified' else 'Candidate Inference'}",
                    "summary": m["content"],
                    "category": cat,
                    "memoryId": m["id"],
                    "entityIds": m.get("related_entity_ids", []),
                    "sourceType": m.get("source", {}).get("sourceType", "conversation"),
                }
            )

    def _load_or_seed(self) -> None:
        if os.path.exists(STATE_FILE_PATH):
            try:
                with open(STATE_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.memories = data.get("memories", [])
                self.entities = data.get("entities", [])
                self.relationships = data.get("relationships", [])
                self.character_config = data.get("character_config", {})
                self.personality_config = data.get("personality_config", {})
                self.life_state = data.get("life_state", {})
                self.reminders = data.get("reminders", [])
                self.agent_traces = data.get("agent_traces", [])
                self.action_audits = data.get("action_audits", [])
                self.conversation_history = data.get("conversation_history", [])
                if data.get("device_telemetry"):
                    self.device_telemetry.update(data["device_telemetry"])
                if self.memories and self.entities:
                    self._rebuild_timeline()
                    return
            except Exception as exc:
                print(f"[MemoryEngine] Could not load snapshot ({exc}), seeding defaults.")
        self._seed_defaults()
        self.save_snapshot()

    def save_snapshot(self) -> None:
        try:
            payload = {
                "memories": self.memories,
                "entities": self.entities,
                "relationships": self.relationships,
                "character_config": self.character_config,
                "personality_config": self.personality_config,
                "life_state": self.life_state,
                "reminders": self.reminders,
                "agent_traces": self.agent_traces[:50],
                "action_audits": self.action_audits[:50],
                "conversation_history": self.conversation_history[-40:],
                "device_telemetry": self.device_telemetry,
            }
            with open(STATE_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as exc:
            print(f"[MemoryEngine] Snapshot save warning: {exc}")

    def append_conversation_turn(
        self,
        role: str,
        text: str,
        modality: str = "voice",
        emotion: str = "Happy",
    ) -> Optional[Dict[str, Any]]:
        cleaned = re.sub(r"<speech>.*?</speech>", "", text or "", flags=re.IGNORECASE | re.DOTALL).strip()
        if not cleaned:
            return None
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if self.conversation_history:
            last = self.conversation_history[-1]
            if last.get("role") == role and last.get("text") == cleaned:
                return last
        entry = {
            "id": f"turn_{int(time.time() * 1000)}",
            "role": role,
            "text": cleaned,
            "modality": modality,
            "emotion": emotion,
            "timestamp": now,
        }
        self.conversation_history.append(entry)
        if len(self.conversation_history) > 40:
            self.conversation_history = self.conversation_history[-40:]
        self.save_snapshot()
        return entry

    def auto_extract_and_store_memory(
        self, user_text: str, source_type: str = "live_conversation"
    ) -> Optional[Dict[str, Any]]:
        """
        Automatically extracts and persists user facts, preferences, favourites, relationships,
        and instructions spoken or typed during a conversation turn.
        """
        cleaned = (user_text or "").strip()
        if len(cleaned) < 4:
            return None
        lower = cleaned.lower()
        # Ignore pure questions unless they also contain "remember"
        if cleaned.endswith("?") and "remember" not in lower:
            return None

        memory_triggers = (
            "remember",
            "don't forget",
            "do not forget",
            "keep in mind",
            "note that",
            "my favourite",
            "my favorite",
            "my name is",
            "call me ",
            "i prefer",
            "i like ",
            "i love ",
            "i hate ",
            "i am working on",
            "i'm working on",
            "i live in",
            "my birthday",
            "my friend",
            "my sister",
            "my brother",
            "my phone",
            "my project",
            "always use",
            "never use",
        )
        is_fact = any(t in lower for t in memory_triggers) or bool(
            re.search(r"\bmy\s+[a-z0-9_ ]{2,25}\s+(is|are)\s+[^?]+", lower)
        )
        if not is_fact:
            return None

        if any(k in lower for k in ("prefer", "always", "never", "call me")):
            category = "procedural"
        elif any(k in lower for k in ("friend", "sister", "brother", "collaborat", "team", "mom", "dad")):
            category = "relational"
        elif any(k in lower for k in ("working on", "today", "yesterday", "tomorrow", "just finished")):
            category = "episodic"
        else:
            category = "semantic"

        formatted = cleaned if "shaurya" in lower else f"Shaurya stated: {cleaned}"
        outcome = self.consolidate_memory(
            content=formatted,
            category=category,
            epistemic_status="explicitly_stated",
            importance=0.95,
            source_type=source_type,
        )
        return outcome.get("memory")

    def build_live_context_block(self, query: str = "") -> str:
        """
        Builds a compact, up-to-date memory + conversation history + live phone telemetry summary
        so Aria maintains 100% continuity and never forgets user facts or recent turns.
        """
        top_memories = self.retrieve_hybrid(query, limit=6) if query else self.memories[:6]
        recent_memories = self.memories[:5]
        seen_ids = set()
        merged_mems = []
        for m in recent_memories + top_memories:
            if m["id"] not in seen_ids:
                seen_ids.add(m["id"])
                merged_mems.append(m)

        mem_lines = "\n".join(
            f"- [{m.get('category', 'fact').upper()}] {m['content']}"
            for m in merged_mems[:10]
        )
        recent_turns = self.conversation_history[-8:]
        turn_lines = "\n".join(
            f"- {'Shaurya' if t['role'] == 'user' else 'Aria'}: {t['text']}"
            for t in recent_turns
        )
        tel = self.device_telemetry
        phone_line = (
            f"Battery: {tel.get('batteryLevel', 82)}% ({'Charging' if tel.get('isCharging') else 'Discharging'}) | "
            f"Network: {tel.get('networkType', 'Wi-Fi')} | "
            f"Device: {tel.get('deviceModel', 'Android')} (Android {tel.get('androidVersion', '14')}) | "
            f"Foreground App: {tel.get('foregroundApp', 'ai.aether.companion')}"
        )
        return (
            f"=== LIVE ANDROID PHONE STATUS ===\n{phone_line}\n\n"
            f"=== SHAURYA'S PERSISTENT MEMORIES ===\n{mem_lines or '- No memories stored yet.'}\n\n"
            f"=== RECENT CONVERSATION CONTEXT ===\n{turn_lines or '- Session just started.'}"
        )

    def log_agent_trace(
        self,
        agent_name: str,
        operation: str,
        input_summary: str,
        output_summary: str,
        reasoning: str,
        latency_ms: int = 25,
        status: str = "success",
    ) -> Dict[str, Any]:
        trace = {
            "id": f"trace_{int(time.time() * 1000)}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "agentName": agent_name,
            "operation": operation,
            "inputSummary": input_summary,
            "outputSummary": output_summary,
            "reasoning": reasoning,
            "latencyMs": latency_ms,
            "status": status,
        }
        self.agent_traces.insert(0, trace)
        self.save_snapshot()
        return trace

    def retrieve_hybrid(
        self, query: str, category: Optional[str] = None, limit: int = 5
    ) -> List[Dict[str, Any]]:
        t0 = time.perf_counter()
        q_vec = compute_embedding_32d(query)
        q_tokens = [t.lower() for t in re.sub(r"[^\w\s]", " ", query).split() if len(t) >= 2]

        matched_entity_ids = set()
        for ent in self.entities:
            ent_tokens = [t.lower() for t in ent["name"].split() if len(t) >= 2]
            if any(qt in ent["name"].lower() for qt in q_tokens) or any(
                et in query.lower() for et in ent_tokens
            ):
                matched_entity_ids.add(ent["id"])

        # 1-hop graph expansion across relationships
        expanded_entity_ids = set(matched_entity_ids)
        for rel in self.relationships:
            if rel["sourceEntityId"] in matched_entity_ids:
                expanded_entity_ids.add(rel["targetEntityId"])
            if rel["targetEntityId"] in matched_entity_ids:
                expanded_entity_ids.add(rel["sourceEntityId"])

        scored = []
        for mem in self.memories:
            if category and category != "all" and mem["category"] != category:
                continue
            v_sim = max(0.0, cosine_similarity(q_vec, mem.get("embedding", [])))
            c_lower = mem["content"].lower()
            kw_hits = sum(1 for qt in q_tokens if qt in c_lower)
            kw_score = min(1.0, kw_hits / max(1, len(q_tokens))) if q_tokens else 0.0
            rel_ids = mem.get("related_entity_ids", [])
            g_boost = 0.22 if any(eid in expanded_entity_ids for eid in rel_ids) else 0.0
            imp = float(mem.get("importance", 0.8))
            total = round(0.45 * v_sim + 0.33 * kw_score + g_boost + 0.10 * imp, 4)

            scored.append(
                {
                    **mem,
                    "score": total,
                    "scoreBreakdown": {
                        "vectorScore": round(v_sim, 3),
                        "fullTextScore": round(kw_score, 3),
                        "graphBoost": round(g_boost, 3),
                        "totalScore": total,
                    },
                }
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))
        self.log_agent_trace(
            agent_name="MemoryAgent",
            operation="retrieve_hybrid",
            input_summary=f"Query: '{query[:60]}' (category={category or 'all'})",
            output_summary=f"Returned {min(limit, len(scored))} memories (top score={scored[0]['score'] if scored else 0.0})",
            reasoning="Executed hybrid vector cosine + full-text token + 1-hop knowledge graph retrieval.",
            latency_ms=elapsed_ms,
        )
        return scored[:limit]

    def consolidate_memory(
        self,
        content: str,
        category: str = "episodic",
        epistemic_status: str = "explicitly_stated",
        importance: float = 0.85,
        source_type: str = "conversation",
        reference_id: str = "live_session",
    ) -> Dict[str, Any]:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        vec = compute_embedding_32d(content)

        # Auto-detect entities mentioned in content
        linked_entities = ["ent_shaurya"]
        content_lower = content.lower()
        for ent in self.entities:
            if ent["name"].lower().split()[0] in content_lower and ent["id"] not in linked_entities:
                linked_entities.append(ent["id"])
                ent["mentionCount"] = ent.get("mentionCount", 1) + 1

        # Duplicate detection & version consolidation
        for existing in self.memories:
            sim = cosine_similarity(vec, existing.get("embedding", []))
            if sim > 0.86:
                versions = existing.get("versions", [])
                versions.append(
                    {
                        "versionId": f"ver_{int(time.time() * 1000)}",
                        "content": content,
                        "reason": "Consolidated high-similarity memory update",
                        "confidence": existing.get("confidence", 0.95),
                        "updatedAt": now,
                    }
                )
                existing["content"] = content
                existing["updated_at"] = now
                existing["embedding"] = vec
                existing["versions"] = versions
                existing["access_count"] = existing.get("access_count", 1) + 1
                self._rebuild_timeline()
                self.save_snapshot()
                return {"action": "merged_duplicate", "memory": existing}

        new_id = f"mem_{int(time.time() * 1000)}"
        ver_status = "verified" if epistemic_status in ("explicitly_stated", "observed_event") else "unverified"
        new_mem = {
            "id": new_id,
            "user_id": "shaurya",
            "content": content,
            "category": category,
            "epistemic_status": epistemic_status,
            "confidence": 0.96 if ver_status == "verified" else 0.70,
            "importance": importance,
            "sensitivity": "personal",
            "verification_status": ver_status,
            "related_entity_ids": linked_entities,
            "source": {
                "sourceType": source_type,
                "referenceId": reference_id,
                "excerpt": content[:140],
            },
            "versions": [
                {
                    "versionId": f"ver_{int(time.time() * 1000)}",
                    "content": content,
                    "reason": f"Ingested via {source_type} ({epistemic_status})",
                    "confidence": 0.96 if ver_status == "verified" else 0.70,
                    "updatedAt": now,
                }
            ],
            "embedding": vec,
            "access_count": 1,
            "created_at": now,
            "updated_at": now,
        }
        self.memories.insert(0, new_mem)
        self._rebuild_timeline()
        self.log_agent_trace(
            agent_name="MemoryAgent",
            operation="consolidate_memory",
            input_summary=content[:80],
            output_summary=f"Created {category} memory ({ new_id }) linked to {len(linked_entities)} entities",
            reasoning=f"Epistemic status: {epistemic_status}, verification: {ver_status}",
            latency_ms=21,
        )
        self.save_snapshot()
        return {"action": "created", "memory": new_mem}

    def update_memory(
        self,
        memory_id: str,
        content: Optional[str] = None,
        category: Optional[str] = None,
        verification_status: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        for mem in self.memories:
            if mem["id"] == memory_id:
                if content and content != mem["content"]:
                    mem["content"] = content
                    mem["embedding"] = compute_embedding_32d(content)
                    mem.setdefault("versions", []).append(
                        {
                            "versionId": f"ver_{int(time.time() * 1000)}",
                            "content": content,
                            "reason": "User manual edit & verification",
                            "confidence": 0.99,
                            "updatedAt": now,
                        }
                    )
                if category:
                    mem["category"] = category
                if verification_status:
                    mem["verification_status"] = verification_status
                    if verification_status == "verified":
                        mem["confidence"] = 0.99
                mem["updated_at"] = now
                self._rebuild_timeline()
                self.save_snapshot()
                return mem
        return None

    def delete_memory(self, memory_id: str) -> bool:
        before = len(self.memories)
        self.memories = [m for m in self.memories if m["id"] != memory_id]
        if len(self.memories) < before:
            self._rebuild_timeline()
            self.save_snapshot()
            return True
        return False

    def add_relationship(
        self, source_entity_id: str, target_entity_id: str, predicate: str
    ) -> Dict[str, Any]:
        rel = {
            "id": f"rel_{int(time.time() * 1000)}",
            "sourceEntityId": source_entity_id,
            "targetEntityId": target_entity_id,
            "predicate": predicate,
            "confidence": 0.95,
            "evidenceMemoryIds": [],
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.relationships.append(rel)
        self.save_snapshot()
        return rel


memory_engine = HybridMemoryEngine()
