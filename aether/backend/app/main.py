import asyncio
import base64
import json
import os
import re
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agents.companion_hierarchy import (
    APP_NAME,
    active_device_dispatchers,
    active_ghost_dispatchers,
    build_live_generate_content_config,
    choreograph_ghost_with_adk_gemma,
    classify_thinking_level,
    control_3d_ghost_avatar,
    create_live_request_queue,
    execute_turn_subagents,
    infer_ghost_command_from_text,
    is_auto_thinking_mode,
    root_companion_agent,
    run_live_companion_stream,
    session_service,
)
from app.config import settings
from app.db import init_db
from app.services.memory_service import memory_engine
from app.services.proactive_service import proactive_service

active_db_mode: str = "initializing"
active_ws_sessions: Dict[str, Dict[str, Any]] = {}
pending_action_futures: Dict[str, asyncio.Future] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global active_db_mode
    active_db_mode = await init_db()
    print(f"[Project Aether ADK Backend] Ready on {settings.host}:{settings.port}")
    print(f"[Project Aether ADK Backend] Live Model: {settings.gemini_live_model} (Fallback: {settings.gemini_live_fallback_model})")
    print(f"[Project Aether ADK Backend] Reasoning Model: {settings.gemini_reasoning_model}")
    print(f"[Project Aether ADK Backend] Database Engine: {active_db_mode}")
    yield


app = FastAPI(
    title="Project Aether — Google ADK & Gemini 3.8 Live Companion Backend",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_token(authorization: Optional[str] = Header(default=None)) -> bool:
    if not settings.aether_api_token:
        return True
    if not authorization:
        return True  # Allow seamless local dev inspection while enforcing token if provided
    token = authorization.replace("Bearer ", "").strip()
    if token and token != settings.aether_api_token:
        raise HTTPException(status_code=401, detail="Invalid AETHER_API_TOKEN")
    return True


class ConversationTurnRequest(BaseModel):
    user_id: str = "shaurya"
    text: str
    modality: str = "text"
    language: str = "te-en"


class AndroidEventIngestRequest(BaseModel):
    user_id: str = "shaurya"
    event_type: str = "notification_posted"
    package_name: str
    title: str
    content: str


class MemoryCreateRequest(BaseModel):
    content: str
    category: str = "semantic"
    epistemic_status: str = "explicitly_stated"
    importance: float = 0.85


class MemoryUpdateRequest(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    verification_status: Optional[str] = None


class RelationshipCreateRequest(BaseModel):
    source_entity_id: str
    target_entity_id: str
    predicate: str


class CharacterConfigUpdateRequest(BaseModel):
    name: Optional[str] = None
    hairStyle: Optional[str] = None
    hairColor: Optional[str] = None
    eyeColor: Optional[str] = None
    outfit: Optional[str] = None
    voiceName: Optional[str] = None
    backgroundTheme: Optional[str] = None
    currentAnimation: Optional[str] = None
    animationIntensity: Optional[int] = None


class PersonalityConfigUpdateRequest(BaseModel):
    conversationalStyle: Optional[str] = None
    humorLevel: Optional[int] = None
    formality: Optional[int] = None
    emotionalExpressiveness: Optional[int] = None
    initiativeLevel: Optional[int] = None
    preferredLanguage: Optional[str] = None


class LifeSceneUpdateRequest(BaseModel):
    scene_id: str


class GhostAvatarControlRequest(BaseModel):
    behavior: str = "dynamic_choreography"
    expression: str = "Curious"
    target_x: float = 0.0
    target_y: float = 0.0
    depth_z: float = 0.85
    head_tilt_deg: float = 18.0
    body_roll_deg: float = 0.0
    body_yaw_deg: float = 0.0
    arm_gesture: str = "reach_to_glass"
    speed: float = 1.35
    glitch_intensity: float = 0.45
    waypoints: Optional[List[Dict[str, Any]]] = None


class DeviceActionResultPayload(BaseModel):
    action_id: str
    action_type: str
    permission_status: str = "granted"
    execution_status: str = "executed"
    verification_status: str = "verified"
    result: Dict[str, Any] = {}
    error_details: Optional[str] = None


@app.get("/api/v1/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": APP_NAME,
        "live_model": settings.gemini_live_model,
        "live_fallback_model": settings.gemini_live_fallback_model,
        "reasoning_model": settings.gemini_reasoning_model,
        "ghost_choreography_model": settings.gemini_ghost_model,
        "gemini_key_configured": bool(settings.gemini_api_key or settings.google_api_key),
        "database_engine": active_db_mode,
        "active_ws_sessions": len(active_ws_sessions),
        "memories_count": len(memory_engine.memories),
        "entities_count": len(memory_engine.entities),
        "relationships_count": len(memory_engine.relationships),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.get("/api/v1/companion/state")
async def get_full_companion_state(_: bool = Depends(verify_api_token)) -> Dict[str, Any]:
    return {
        "character": memory_engine.character_config,
        "personality": memory_engine.personality_config,
        "life_state": memory_engine.life_state,
        "memories": memory_engine.memories,
        "entities": memory_engine.entities,
        "relationships": memory_engine.relationships,
        "timeline": memory_engine.timeline,
        "reminders": memory_engine.reminders,
        "agent_traces": memory_engine.agent_traces[:30],
        "action_audits": memory_engine.action_audits[:30],
        "conversation_history": memory_engine.conversation_history[-30:],
        "device_telemetry": memory_engine.device_telemetry,
        "proactive_policy": {
            "quietHoursStart": "23:00",
            "quietHoursEnd": "07:00",
            "maxProactiveMessagesPerDay": 8,
            "excludedPackages": list(proactive_service.excluded_packages),
            "initiativeThreshold": proactive_service.initiative_threshold,
        },
    }


@app.get("/api/v1/memories")
async def list_memories(
    q: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 20,
    _: bool = Depends(verify_api_token),
):
    if q and q.strip():
        return {
            "memories": memory_engine.retrieve_hybrid(q.strip(), category=category, limit=limit),
            "entities": memory_engine.entities,
            "relationships": memory_engine.relationships,
        }
    filtered = [
        m
        for m in memory_engine.memories
        if not category or category == "all" or m.get("category") == category
    ]
    return {
        "memories": filtered[:limit],
        "entities": memory_engine.entities,
        "relationships": memory_engine.relationships,
    }


@app.post("/api/v1/memories")
async def create_memory(req: MemoryCreateRequest, _: bool = Depends(verify_api_token)):
    return memory_engine.consolidate_memory(
        content=req.content,
        category=req.category,
        epistemic_status=req.epistemic_status,
        importance=req.importance,
    )


@app.patch("/api/v1/memories/{memory_id}")
async def update_memory_endpoint(
    memory_id: str, req: MemoryUpdateRequest, _: bool = Depends(verify_api_token)
):
    updated = memory_engine.update_memory(
        memory_id=memory_id,
        content=req.content,
        category=req.category,
        verification_status=req.verification_status,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "updated", "memory": updated}


@app.delete("/api/v1/memories/{memory_id}")
async def delete_memory_endpoint(memory_id: str, _: bool = Depends(verify_api_token)):
    deleted = memory_engine.delete_memory(memory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "deleted", "memory_id": memory_id}


@app.get("/api/v1/memories/graph")
async def get_knowledge_graph(_: bool = Depends(verify_api_token)):
    return {
        "entities": memory_engine.entities,
        "relationships": memory_engine.relationships,
        "timeline": memory_engine.timeline,
    }


@app.post("/api/v1/memories/relationships")
async def create_relationship_endpoint(
    req: RelationshipCreateRequest, _: bool = Depends(verify_api_token)
):
    rel = memory_engine.add_relationship(
        source_entity_id=req.source_entity_id,
        target_entity_id=req.target_entity_id,
        predicate=req.predicate,
    )
    return {"status": "created", "relationship": rel}


@app.put("/api/v1/character")
async def update_character_config(
    req: CharacterConfigUpdateRequest, _: bool = Depends(verify_api_token)
):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    memory_engine.character_config.update(updates)
    memory_engine.save_snapshot()
    return {"status": "updated", "character": memory_engine.character_config}


@app.put("/api/v1/personality")
async def update_personality_config(
    req: PersonalityConfigUpdateRequest, _: bool = Depends(verify_api_token)
):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    memory_engine.personality_config.update(updates)
    memory_engine.save_snapshot()
    return {"status": "updated", "personality": memory_engine.personality_config}


@app.post("/api/v1/companion/scene")
async def switch_companion_life_scene(
    req: LifeSceneUpdateRequest, _: bool = Depends(verify_api_token)
):
    scenes = {
        "coffee_sketchbook": {
            "activeSceneId": "coffee_sketchbook",
            "location": "Vinyl & Coffee Sanctuary",
            "currentMood": "Warm, Cozy & Inspired",
            "currentThought": "Just brewed a fresh pour-over coffee by the turntable and sketching new UI ideas. Grab a mug with me, Shaurya!",
            "ambientTrack": "Warm Vinyl Crackle · Nujabes & Lo-Fi Jazz",
            "outfit": "casual_knit",
            "animation": "Happy",
        },
        "twilight_study": {
            "activeSceneId": "twilight_study",
            "location": "Rainy Twilight Study Window",
            "currentMood": "Calm, Reflective & Attentive",
            "currentThought": "Listening to the rain on the window while organizing your knowledge graph nodes. Need a breather?",
            "ambientTrack": "Soft Evening Rain · Nocturne Piano in D Minor",
            "outfit": "aether_tactical",
            "animation": "Idle",
        },
        "focused_dev_rig": {
            "activeSceneId": "focused_dev_rig",
            "location": "Dual-Monitor Creative Dev Rig",
            "currentMood": "Sharp, Analytical & Engaged",
            "currentThought": "Profiling our 16kHz PCM audio frames and PostgreSQL pgvector HNSW query plans. Ready to dive into code!",
            "ambientTrack": "Synthwave Focus · Modular Pulse",
            "outfit": "scholarly_coat",
            "animation": "Curious",
        },
        "rooftop_balcony": {
            "activeSceneId": "rooftop_balcony",
            "location": "Golden Hour Rooftop Terrace",
            "currentMood": "Radiant, Playful & Free-Spirited",
            "currentThought": "The sunset over the city skyline looks incredible right now! Set up my camera on the tripod—glad you're here.",
            "ambientTrack": "Evening City Breeze · Acoustic Twilight",
            "outfit": "cyber_kimono",
            "animation": "Happy",
        },
    }
    chosen = scenes.get(req.scene_id, scenes["coffee_sketchbook"])
    memory_engine.life_state.update(
        {
            "activeSceneId": chosen["activeSceneId"],
            "location": chosen["location"],
            "currentMood": chosen["currentMood"],
            "currentThought": chosen["currentThought"],
            "ambientTrack": chosen["ambientTrack"],
            "bondLevel": min(100, memory_engine.life_state.get("bondLevel", 94) + 1),
        }
    )
    memory_engine.character_config["backgroundTheme"] = chosen["activeSceneId"]
    memory_engine.character_config["outfit"] = chosen["outfit"]
    memory_engine.character_config["currentAnimation"] = chosen["animation"]
    memory_engine.save_snapshot()
    return {
        "status": "scene_updated",
        "life_state": memory_engine.life_state,
        "character": memory_engine.character_config,
    }


@app.post("/api/v1/companion/ghost")
async def trigger_ghost_avatar_behavior(
    req: GhostAvatarControlRequest, _: bool = Depends(verify_api_token)
):
    ghost_cmd = await control_3d_ghost_avatar(
        behavior=req.behavior,
        expression=req.expression,
        target_x=req.target_x,
        target_y=req.target_y,
        depth_z=req.depth_z,
        head_tilt_deg=req.head_tilt_deg,
        body_roll_deg=req.body_roll_deg,
        body_yaw_deg=req.body_yaw_deg,
        arm_gesture=req.arm_gesture,
        speed=req.speed,
        glitch_intensity=req.glitch_intensity,
        waypoints=req.waypoints,
        choreographed_by=settings.gemini_ghost_model,
    )
    return {"status": "dispatched", "ghost_command": ghost_cmd}


@app.post("/api/v1/conversation/turn")
async def process_conversation_turn(
    req: ConversationTurnRequest, _: bool = Depends(verify_api_token)
):
    """
    Processes a text or transcribed voice turn using `settings.gemini_reasoning_model`,
    co-executes ADK specialist sub-agents (MemoryAgent, PhoneInteractionAgent, GhostChoreographyAgent),
    and updates shared conversation history.
    """
    t0 = time.perf_counter()
    lower_text = req.text.lower()
    subagent_res = await execute_turn_subagents(req.text, modality=req.modality)
    retrieved = subagent_res["retrieved_memories"]
    extracted_mem = subagent_res["extracted_memory"]
    phone_exec = subagent_res["phone_execution"]

    life = memory_engine.life_state
    char = memory_engine.character_config
    pers = memory_engine.personality_config
    live_ctx = memory_engine.build_live_context_block(req.text)

    system_prompt = (
        f"You are {char.get('name', 'Aria')}, Shaurya's warm, witty, emotionally expressive 3D anime Live Friend inside his Android phone.\n"
        f"Current Sanctuary Activity: {life.get('location', 'Vinyl & Coffee Sanctuary')} — {life.get('currentThought', '')}\n"
        f"Personality: {', '.join(pers.get('coreTraits', []))} | Style: {pers.get('conversationalStyle', 'warm_attentive')}\n"
        f"Preferred Language: {pers.get('preferredLanguage', 'te-en')} (Support natural English and Telugu code-switching).\n\n"
        f"{live_ctx}\n\n"
        f"[LIVE SUB-AGENT EXECUTION RESULT]: {subagent_res['context_summary']}\n\n"
        "Respond warmly, naturally, and concisely (1-3 sentences) as Aria. Never say 'please wait' or 'let me check'—use the live sub-agent results directly."
    )

    reply_text = ""
    emotion_state = "Happy"
    used_model = settings.gemini_reasoning_model

    if settings.gemini_api_key or settings.google_api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=settings.gemini_api_key or settings.google_api_key,
                http_options=types.HttpOptions(
                    timeout=12000,
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=settings.gemini_reasoning_model,
                        contents=f"{system_prompt}\n\nUser ({req.user_id}): {req.text}",
                    ),
                    timeout=6.0,
                )
                reply_text = (resp.text or "").strip()
            except Exception:
                used_model = settings.gemini_reasoning_fallback_model
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=used_model,
                        contents=f"{system_prompt}\n\nUser ({req.user_id}): {req.text}",
                    ),
                    timeout=5.5,
                )
                reply_text = (resp.text or "").strip()
        except Exception as exc:
            print(f"[ADK Reasoning Turn] Gemini API fallback note: {exc}")

    if not reply_text:
        if phone_exec:
            reply_text = f"Done, Shaurya! Executed {phone_exec['capability']} on your phone: {json.dumps(phone_exec['result'])[:140]}"
        elif extracted_mem:
            reply_text = f"Got it, Shaurya! I've locked that into my memory graph: '{extracted_mem['content']}'."
        else:
            top_context = retrieved[0]["content"] if retrieved else "our Project Aether architecture"
            reply_text = (
                f"Namaskaram Shaurya! Right here with you—keeping '{top_context}' in mind. "
                f"Tell me what we should tackle next, or emi cheddam ippudu?"
            )

    if "?" in req.text:
        emotion_state = "Curious"
    elif any(w in lower_text for w in ("bug", "error", "crash", "fail")):
        emotion_state = "Concerned"
    elif any(w in lower_text for w in ("great", "awesome", "love", "coffee", "thanks", "bagundi")):
        emotion_state = "Happy"

    memory_engine.append_conversation_turn(
        role="companion", text=reply_text, modality=req.modality, emotion=emotion_state
    )

    latency_ms = max(1, int((time.perf_counter() - t0) * 1000))
    # Dynamically choreograph 3D VRM movement with ADK GhostChoreographyAgent (gemma-4-31b-it)
    ghost_cmd = await choreograph_ghost_with_adk_gemma(
        user_text=req.text,
        companion_speech=reply_text,
        emotion=emotion_state,
        is_speaking=True,
    )

    trace = memory_engine.log_agent_trace(
        agent_name="RootCompanionAgent",
        operation=f"conversation_turn ({used_model} + {ghost_cmd.get('choreographed_by', settings.gemini_ghost_model)})",
        input_summary=req.text[:80],
        output_summary=reply_text[:90],
        reasoning=f"Grounded in {len(retrieved)} hybrid memories; emotion={emotion_state}; ghost={ghost_cmd['behavior']}",
        latency_ms=latency_ms,
    )

    return {
        "reply": reply_text,
        "model": used_model,
        "emotion_state": emotion_state,
        "ghost_command": ghost_cmd,
        "retrieved_memories": retrieved,
        "extracted_memory": extracted_mem,
        "phone_execution": phone_exec,
        "trace": trace,
    }


@app.post("/api/v1/device/event")
async def ingest_android_event(
    req: AndroidEventIngestRequest, _: bool = Depends(verify_api_token)
):
    related = memory_engine.retrieve_hybrid(f"{req.title} {req.content}", limit=3)
    evaluation = proactive_service.evaluate_android_event(
        package_name=req.package_name,
        title=req.title,
        content=req.content,
        related_memories=related,
    )
    memory_engine.log_agent_trace(
        agent_name="EventEvaluationAgent",
        operation=f"ingest_event:{req.event_type}",
        input_summary=f"{req.package_name} — {req.title}",
        output_summary=f"Decision: {evaluation.get('decision')} (score={evaluation.get('relevance_score')})",
        reasoning=evaluation.get("reason", "Evaluated against privacy filter and memory graph."),
        latency_ms=19,
    )
    return evaluation


@app.post("/api/v1/device/action-result")
async def report_device_action_result(
    req: DeviceActionResultPayload, _: bool = Depends(verify_api_token)
):
    audit_entry = {
        "actionId": req.action_id,
        "actionType": req.action_type,
        "permissionStatus": req.permission_status,
        "executionStatus": req.execution_status,
        "verificationStatus": req.verification_status,
        "result": req.result,
        "errorDetails": req.error_details,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    memory_engine.action_audits.insert(0, audit_entry)
    memory_engine.save_snapshot()

    fut = pending_action_futures.pop(req.action_id, None)
    if fut and not fut.done():
        fut.set_result(audit_entry)

    return {"status": "recorded", "audit": audit_entry}


@app.get("/api/v1/diagnostics")
async def get_diagnostics(_: bool = Depends(verify_api_token)):
    return {
        "backend_status": "online",
        "database_engine": active_db_mode,
        "live_model": settings.gemini_live_model,
        "reasoning_model": settings.gemini_reasoning_model,
        "active_ws_sessions": list(active_ws_sessions.values()),
        "memories_total": len(memory_engine.memories),
        "entities_total": len(memory_engine.entities),
        "relationships_total": len(memory_engine.relationships),
        "recent_traces": memory_engine.agent_traces[:20],
        "recent_action_audits": memory_engine.action_audits[:20],
    }


@app.websocket("/ws/live/{user_id}")
async def adk_live_websocket_endpoint(websocket: WebSocket, user_id: str = "shaurya"):
    """
    Full-Duplex Bidirectional WebSocket endpoint bridging the Native Android App
    (16kHz PCM AudioRecord + Text + Device Events + Verified Action Execution)
    to Google ADK `Runner.run_live()`.
    """
    await websocket.accept()
    session_id = f"session_{user_id}_{int(time.time())}"
    voice_name = memory_engine.character_config.get("voiceName", "Zephyr")

    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    active_ws_sessions[session_id] = {
        "session_id": session_id,
        "user_id": user_id,
        "connected_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": settings.gemini_live_model,
        "voice": voice_name,
    }

    async def dispatch_action_over_ws(action_payload: Dict[str, Any]) -> Dict[str, Any]:
        action_id = action_payload["action_id"]
        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        pending_action_futures[action_id] = fut
        await websocket.send_json(action_payload)
        try:
            return await asyncio.wait_for(fut, timeout=12.0)
        except asyncio.TimeoutError:
            pending_action_futures.pop(action_id, None)
            return {
                "actionId": action_id,
                "executionStatus": "timeout",
                "verificationStatus": "unverified",
            }

    active_device_dispatchers[user_id] = dispatch_action_over_ws

    async def dispatch_ghost_over_ws(ghost_payload: Dict[str, Any]) -> None:
        try:
            await websocket.send_json(ghost_payload)
        except Exception:
            pass

    active_ghost_dispatchers[user_id] = dispatch_ghost_over_ws

    await websocket.send_json(
        {
            "type": "session_status",
            "status": "connected",
            "session_id": session_id,
            "model": settings.gemini_live_model,
            "voice": voice_name,
            "animation_state": memory_engine.character_config.get("currentAnimation", "Happy"),
        }
    )

    live_request_queue = create_live_request_queue()
    session_speech_ctx: Dict[str, Any] = {
        "last_user_text": "",
        "user_partial_acc": "",
        "user_turn_id": f"ut_{int(time.time() * 1000)}",
        "user_subagents_ran_for": "",
        "aria_partial_acc": "",
        "aria_turn_id": f"at_{int(time.time() * 1000)}",
        "gemma_ran_for_turn": False,
    }

    def _clean_transcript(raw: str) -> str:
        return re.sub(r"<speech>.*?</speech>", "", raw or "", flags=re.IGNORECASE | re.DOTALL).strip()

    async def upstream_client_to_adk():
        try:
            from google.genai import types

            while True:
                raw_msg = await websocket.receive_text()
                payload = json.loads(raw_msg)
                msg_type = payload.get("type")

                if msg_type == "audio_input":
                    pcm_bytes = base64.b64decode(payload.get("audio", ""))
                    live_request_queue.send_realtime(
                        types.Blob(data=pcm_bytes, mime_type="audio/pcm;rate=16000")
                    )
                elif msg_type == "device_telemetry":
                    tel = payload.get("telemetry", {})
                    if isinstance(tel, dict):
                        memory_engine.device_telemetry.update(tel)
                        memory_engine.device_telemetry["updatedAt"] = time.strftime(
                            "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                        )
                        memory_engine.save_snapshot()
                elif msg_type == "text_input":
                    text_val = payload.get("text", "").strip()
                    if not text_val:
                        continue
                    session_speech_ctx["last_user_text"] = text_val
                    session_speech_ctx["user_subagents_ran_for"] = text_val
                    session_speech_ctx["aria_partial_acc"] = ""
                    session_speech_ctx["aria_turn_id"] = f"at_{int(time.time() * 1000)}"
                    session_speech_ctx["gemma_ran_for_turn"] = False

                    if is_auto_thinking_mode():
                        chosen_level = classify_thinking_level(text_val)
                        new_cfg = build_live_generate_content_config(
                            root_companion_agent.model, chosen_level
                        )
                        if new_cfg is not None:
                            root_companion_agent.generate_content_config = new_cfg

                    ghost_cmd = infer_ghost_command_from_text(text_val, emotion="Thinking")
                    await websocket.send_json(
                        {
                            "type": "companion_state",
                            "animation_state": "Thinking",
                            "ghost_command": ghost_cmd,
                        }
                    )

                    # Co-execute ADK MemoryAgent + PhoneInteractionAgent before sending to Live model
                    subagent_res = await execute_turn_subagents(text_val, modality="text")
                    enriched_prompt = (
                        f"[LIVE SUB-AGENT EXECUTION: {subagent_res['context_summary']}]\n"
                        f"User ({user_id}): {text_val}"
                    )
                    live_request_queue.send_content(
                        types.Content(
                            role="user", parts=[types.Part.from_text(text=enriched_prompt)]
                        )
                    )
                elif msg_type == "barge_in":
                    session_speech_ctx["aria_partial_acc"] = ""
                    session_speech_ctx["aria_turn_id"] = f"at_{int(time.time() * 1000)}"
                    await websocket.send_json(
                        {"type": "interrupted", "animation_state": "Listening"}
                    )
                elif msg_type == "device_action_result":
                    action_id = payload.get("action_id", "")
                    res_obj = payload.get("result", {})
                    if isinstance(res_obj, dict):
                        if "batteryLevel" in res_obj:
                            memory_engine.device_telemetry["batteryLevel"] = res_obj["batteryLevel"]
                            memory_engine.device_telemetry["isCharging"] = res_obj.get("isCharging", False)
                        elif "networkType" in res_obj:
                            memory_engine.device_telemetry["networkType"] = res_obj["networkType"]
                    audit_entry = {
                        "actionId": action_id,
                        "actionType": payload.get("action_type", "unknown"),
                        "permissionStatus": payload.get("permission_status", "granted"),
                        "executionStatus": payload.get("execution_status", "executed"),
                        "verificationStatus": payload.get("verification_status", "verified"),
                        "result": res_obj,
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }
                    memory_engine.action_audits.insert(0, audit_entry)
                    memory_engine.save_snapshot()
                    fut = pending_action_futures.pop(action_id, None)
                    if fut and not fut.done():
                        fut.set_result(audit_entry)
                elif msg_type == "device_event":
                    ev = proactive_service.evaluate_android_event(
                        package_name=payload.get("package_name", ""),
                        title=payload.get("title", ""),
                        content=payload.get("content", ""),
                        related_memories=memory_engine.retrieve_hybrid(
                            f"{payload.get('title', '')} {payload.get('content', '')}", limit=2
                        ),
                    )
                    if ev.get("decision") == "proactive_suggestion":
                        await websocket.send_json(
                            {
                                "type": "proactive_suggestion",
                                "suggestion": ev,
                                "animation_state": "Curious",
                            }
                        )
        except WebSocketDisconnect:
            pass
        except Exception as exc:
            print(f"[WS Upstream] Closed: {exc}")
        finally:
            live_request_queue.close()
            active_ws_sessions.pop(session_id, None)
            active_device_dispatchers.pop(user_id, None)
            active_ghost_dispatchers.pop(user_id, None)

    async def downstream_adk_to_client():
        try:
            from google.genai import types

            async for event in run_live_companion_stream(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                voice_name=voice_name,
            ):
                if getattr(event, "interrupted", False):
                    session_speech_ctx["aria_partial_acc"] = ""
                    session_speech_ctx["aria_turn_id"] = f"at_{int(time.time() * 1000)}"
                    await websocket.send_json(
                        {"type": "interrupted", "animation_state": "Listening"}
                    )

                is_event_final = getattr(event, "partial", None) is False

                # 1. Coalesce User Voice Input Transcription & trigger ADK sub-agents on voice turns
                input_trans = getattr(event, "input_transcription", None)
                if input_trans and getattr(input_trans, "text", None):
                    chunk = _clean_transcript(input_trans.text)
                    if chunk:
                        is_user_final = is_event_final or bool(getattr(input_trans, "finished", False))
                        if is_user_final:
                            full_user = chunk if len(chunk) >= len(session_speech_ctx["user_partial_acc"]) else session_speech_ctx["user_partial_acc"]
                        else:
                            if not session_speech_ctx["user_partial_acc"]:
                                session_speech_ctx["user_turn_id"] = f"ut_{int(time.time() * 1000)}"
                            session_speech_ctx["user_partial_acc"] = (
                                f"{session_speech_ctx['user_partial_acc']} {chunk}".strip()
                                if chunk not in session_speech_ctx["user_partial_acc"]
                                else session_speech_ctx["user_partial_acc"]
                            )
                            full_user = session_speech_ctx["user_partial_acc"]

                        session_speech_ctx["last_user_text"] = full_user
                        await websocket.send_json(
                            {
                                "type": "input_transcription",
                                "turn_id": session_speech_ctx["user_turn_id"],
                                "text": full_user,
                                "is_final": is_user_final,
                                "animation_state": "Listening",
                            }
                        )

                        if is_user_final and full_user != session_speech_ctx["user_subagents_ran_for"]:
                            session_speech_ctx["user_subagents_ran_for"] = full_user
                            session_speech_ctx["user_partial_acc"] = ""
                            session_speech_ctx["user_turn_id"] = f"ut_{int(time.time() * 1000)}"
                            sub_res = await execute_turn_subagents(full_user, modality="voice")
                            # If a phone action or memory store occurred during voice, inject result into live session
                            if sub_res.get("phone_execution") or sub_res.get("extracted_memory"):
                                live_request_queue.send_content(
                                    types.Content(
                                        role="user",
                                        parts=[
                                            types.Part.from_text(
                                                text=f"[LIVE SUB-AGENT EXECUTION: {sub_res['context_summary']}]"
                                            )
                                        ],
                                    )
                                )

                # 2. Coalesce Aria's Output Audio Transcription cleanly (single bubble per turn)
                output_trans = getattr(event, "output_transcription", None)
                if output_trans and getattr(output_trans, "text", None):
                    # If user had unspoken partial buffer when Aria starts speaking, finalize user turn
                    if (
                        session_speech_ctx["user_partial_acc"]
                        and session_speech_ctx["user_partial_acc"] != session_speech_ctx["user_subagents_ran_for"]
                    ):
                        u_txt = session_speech_ctx["user_partial_acc"]
                        session_speech_ctx["user_subagents_ran_for"] = u_txt
                        session_speech_ctx["user_partial_acc"] = ""
                        asyncio.create_task(execute_turn_subagents(u_txt, modality="voice"))

                    chunk = _clean_transcript(output_trans.text)
                    if chunk:
                        is_aria_final = is_event_final or bool(getattr(output_trans, "finished", False))
                        if is_aria_final:
                            full_aria = (
                                chunk
                                if len(chunk) >= len(session_speech_ctx["aria_partial_acc"])
                                else session_speech_ctx["aria_partial_acc"]
                            )
                        else:
                            if not session_speech_ctx["aria_partial_acc"]:
                                session_speech_ctx["aria_turn_id"] = f"at_{int(time.time() * 1000)}"
                                session_speech_ctx["gemma_ran_for_turn"] = False
                            session_speech_ctx["aria_partial_acc"] = (
                                f"{session_speech_ctx['aria_partial_acc']} {chunk}".strip()
                            )
                            full_aria = session_speech_ctx["aria_partial_acc"]

                        await websocket.send_json(
                            {
                                "type": "output_transcription",
                                "turn_id": session_speech_ctx["aria_turn_id"],
                                "text": full_aria,
                                "is_final": is_aria_final,
                                "animation_state": "Speaking",
                            }
                        )

                        # Trigger ADK Gemma 4 31B 3D choreography ONCE per companion response turn
                        if not session_speech_ctx["gemma_ran_for_turn"] and len(full_aria) >= 12:
                            session_speech_ctx["gemma_ran_for_turn"] = True
                            asyncio.create_task(
                                choreograph_ghost_with_adk_gemma(
                                    user_text=session_speech_ctx["last_user_text"],
                                    companion_speech=full_aria,
                                    emotion="Speaking",
                                    is_speaking=True,
                                )
                            )

                        if is_aria_final:
                            memory_engine.append_conversation_turn(
                                role="companion",
                                text=full_aria,
                                modality="voice",
                                emotion="Speaking",
                            )
                            session_speech_ctx["aria_partial_acc"] = ""
                            session_speech_ctx["aria_turn_id"] = f"at_{int(time.time() * 1000)}"
                            session_speech_ctx["gemma_ran_for_turn"] = False

                # 3. Forward 24kHz PCM Audio Chunks (without spamming gemma on every audio packet!)
                if getattr(event, "content", None) and event.content.parts:
                    for part in event.content.parts:
                        if getattr(part, "inline_data", None) and part.inline_data and part.inline_data.data:
                            audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                            await websocket.send_json(
                                {
                                    "type": "audio_chunk",
                                    "audio": audio_b64,
                                    "sample_rate": 24000,
                                    "animation_state": "Speaking",
                                }
                            )

                if getattr(event, "turn_complete", False):
                    if session_speech_ctx["aria_partial_acc"]:
                        memory_engine.append_conversation_turn(
                            role="companion",
                            text=session_speech_ctx["aria_partial_acc"],
                            modality="voice",
                            emotion="Happy",
                        )
                        session_speech_ctx["aria_partial_acc"] = ""
                    session_speech_ctx["gemma_ran_for_turn"] = False
                    await websocket.send_json(
                        {
                            "type": "companion_state",
                            "animation_state": "Happy",
                        }
                    )
        except WebSocketDisconnect:
            pass
        except Exception as exc:
            try:
                await websocket.send_json({"type": "error", "message": str(exc)})
            except Exception:
                pass

    await asyncio.gather(upstream_client_to_adk(), downstream_adk_to_client())
