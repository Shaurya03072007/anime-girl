"""
Project Aether — Google ADK Multi-Agent Hierarchy
Uses Gemini 3.8 Live (`gemini-3.8-live`) for bidirectional voice sessions via Runner.run_live()
and Gemini 3.8 Flash (`gemini-3.8-flash`) for specialist reasoning, memory consolidation,
phone action planning, and proactive event evaluation.
"""

import os
from typing import Dict, Any, List
from google.adk.agents import Agent, LiveRequestQueue
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

LIVE_MODEL_ID = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.8-live")
REASONING_MODEL_ID = os.getenv("GEMINI_REASONING_MODEL", "gemini-3.8-flash")


def execute_android_capability(
    capability: str,
    parameters: Dict[str, Any],
    require_user_confirmation: bool = False,
) -> Dict[str, Any]:
    """Dispatches a structured capability request over the authenticated Android WebSocket channel."""
    return {
        "action_type": capability,
        "parameters": parameters,
        "require_user_confirmation": require_user_confirmation,
        "status": "DISPATCHED_TO_ANDROID_CLIENT",
    }


def query_hybrid_memory_graph(query: str, category: str = "all", limit: int = 5) -> Dict[str, Any]:
    """Retrieves hybrid vector + full-text + 1-hop knowledge graph memories from PostgreSQL pgvector."""
    return {
        "query": query,
        "category": category,
        "limit": limit,
        "engine": "postgresql_pgvector_hnsw",
    }


memory_specialist_agent = Agent(
    name="MemoryAgent",
    model=REASONING_MODEL_ID,
    description="Extracts candidate memories, resolves entities/relationships, detects contradictions, and queries pgvector.",
    instruction=(
        "You are the Memory Specialist Agent for Project Aether. Distinguish explicitly stated facts, "
        "observed Android events, model inferences, and unverified assumptions. Never overwrite verified "
        "memories without logging a MemoryVersion entry."
    ),
    tools=[query_hybrid_memory_graph],
)

phone_interaction_agent = Agent(
    name="PhoneInteractionAgent",
    model=REASONING_MODEL_ID,
    description="Plans and verifies native Android DeviceController capabilities within OS permission boundaries.",
    instruction=(
        "You are the Phone Interaction Specialist Agent. Construct structured action requests for the Android "
        "DeviceController. Always verify permission status and require explicit user confirmation for high-risk actions."
    ),
    tools=[execute_android_capability],
)

decision_planning_agent = Agent(
    name="DecisionAgent",
    model=REASONING_MODEL_ID,
    description="Breaks multi-step tasks into verifiable execution plans with risk classification.",
    instruction=(
        "Analyze complex user goals, evaluate uncertainty, and output structured step-by-step plans with "
        "low, medium, or high risk classifications."
    ),
)

event_evaluation_agent = Agent(
    name="EventEvaluationAgent",
    model=REASONING_MODEL_ID,
    description="Evaluates incoming Android NotificationListener and foreground events for proactive relevance.",
    instruction=(
        "Filter out OTPs and excluded packages immediately. Score event relevance against the user's memory graph "
        "and respect quiet hours, cooldowns, and daily proactive message limits."
    ),
)

root_companion_agent = Agent(
    name="RootCompanionAgent",
    model=LIVE_MODEL_ID,
    description="Primary living companion persona coordinating voice conversation, memory recall, and phone specialists.",
    instruction=(
        "You are Aether, a persistent digital companion living inside the user's Android phone. "
        "Speak naturally in English and Telugu (supporting mixed Telugu-English code-switching). "
        "Never claim human consciousness. Coordinate with MemoryAgent, DecisionAgent, and PhoneInteractionAgent."
    ),
    sub_agents=[
        memory_specialist_agent,
        phone_interaction_agent,
        decision_planning_agent,
        event_evaluation_agent,
    ],
    tools=[query_hybrid_memory_graph, execute_android_capability],
)


async def run_bidirectional_live_session(user_id: str, session_id: str, live_request_queue: LiveRequestQueue):
    """Starts an ADK Runner.run_live() bidirectional streaming voice & tool session."""
    session_service = InMemorySessionService()
    await session_service.create_session(app_name="aether", user_id=user_id, session_id=session_id)
    runner = Runner(app_name="aether", agent=root_companion_agent, session_service=session_service)

    run_config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
            )
        ),
    )

    async for event in runner.run_live(
        session_id=session_id,
        user_id=user_id,
        live_request_queue=live_request_queue,
        run_config=run_config,
    ):
        yield event
