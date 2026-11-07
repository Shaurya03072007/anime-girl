import asyncio
import base64
import json
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.db import init_db
from app.services.memory_service import memory_engine
from app.services.proactive_service import proactive_service
from app.agents.companion_hierarchy import (
    APP_NAME,
    create_live_request_queue,
    run_live_companion_stream,
    session_service,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print(f"[Project Aether ADK Backend] Ready on {settings.host}:{settings.port}")
    print(f"[Project Aether ADK Backend] Live Model: {settings.gemini_live_model}")
    yield


app = FastAPI(
    title="Project Aether — Google ADK & Gemini Live Companion Backend",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    importance: float = 0.85


@app.get("/api/v1/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": APP_NAME,
        "live_model": settings.gemini_live_model,
        "reasoning_model": settings.gemini_reasoning_model,
        "gemini_key_configured": bool(settings.gemini_api_key),
        "memories_count": len(memory_engine.memories),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@app.get("/api/v1/memories")
async def list_memories(q: Optional[str] = None, category: Optional[str] = None):
    if q:
        return {"memories": memory_engine.retrieve_hybrid(q, category=category, limit=10)}
    return {"memories": memory_engine.memories}


@app.post("/api/v1/memories")
async def create_memory(req: MemoryCreateRequest):
    outcome = memory_engine.consolidate_memory(
        content=req.content,
        category=req.category,
        epistemic_status="explicitly_stated",
        importance=req.importance,
    )
    return outcome


@app.post("/api/v1/conversation/turn")
async def process_conversation_turn(req: ConversationTurnRequest):
    retrieved = memory_engine.retrieve_hybrid(req.text, limit=3)
    if any(k in req.text.lower() for k in ("remember", "prefer", "always", "working on")):
        memory_engine.consolidate_memory(req.text, category="episodic")

    top_context = retrieved[0]["content"] if retrieved else "No prior memory matched."
    reply = (
        f"Namaskaram Shaurya! Grounded in our shared memory ({top_context}), "
        f"I'm right here with you. Emi cheddam ippudu?"
    )
    return {
        "reply": reply,
        "emotion_state": "Happy",
        "retrieved_memories": retrieved,
    }


@app.post("/api/v1/device/event")
async def ingest_android_event(req: AndroidEventIngestRequest):
    related = memory_engine.retrieve_hybrid(f"{req.title} {req.content}", limit=3)
    evaluation = proactive_service.evaluate_android_event(
        package_name=req.package_name,
        title=req.title,
        content=req.content,
        related_memories=related,
    )
    return evaluation


@app.websocket("/ws/live/{user_id}")
async def adk_live_websocket_endpoint(websocket: WebSocket, user_id: str = "shaurya"):
    """
    Full-Duplex Bidirectional WebSocket endpoint bridging the Native Android App
    (16kHz PCM AudioRecord + Device Events) to Google ADK `Runner.run_live()`.
    """
    await websocket.accept()
    session_id = f"session_{user_id}_{int(time.time())}"
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    await websocket.send_json(
        {
            "type": "session_status",
            "status": "connected",
            "session_id": session_id,
            "model": settings.gemini_live_model,
            "voice": "Zephyr",
        }
    )

    live_request_queue = create_live_request_queue()

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
                elif msg_type == "text_input":
                    text_val = payload.get("text", "")
                    live_request_queue.send_content(
                        types.Content(
                            role="user", parts=[types.Part.from_text(text=text_val)]
                        )
                    )
                elif msg_type == "barge_in":
                    await websocket.send_json(
                        {"type": "interrupted", "animation_state": "Listening"}
                    )
        except WebSocketDisconnect:
            pass
        finally:
            live_request_queue.close()

    async def downstream_adk_to_client():
        try:
            async for event in run_live_companion_stream(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                voice_name="Zephyr",
            ):
                if getattr(event, "interrupted", False):
                    await websocket.send_json(
                        {"type": "interrupted", "animation_state": "Listening"}
                    )
                if getattr(event, "content", None) and event.content.parts:
                    for part in event.content.parts:
                        if getattr(part, "inline_data", None) and part.inline_data:
                            audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                            await websocket.send_json(
                                {
                                    "type": "audio_chunk",
                                    "audio": audio_b64,
                                    "sample_rate": 24000,
                                    "animation_state": "Speaking",
                                }
                            )
                        elif getattr(part, "text", None) and part.text:
                            await websocket.send_json(
                                {
                                    "type": "output_transcription",
                                    "text": part.text,
                                    "animation_state": "Speaking",
                                }
                            )
        except Exception as exc:
            await websocket.send_json({"type": "error", "message": str(exc)})

    await asyncio.gather(upstream_client_to_adk(), downstream_adk_to_client())
