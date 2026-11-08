from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MemoryRecordORM(Base):
    __tablename__ = "memory_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    epistemic_status: Mapped[str] = mapped_column(String(32), default="explicitly_stated")
    confidence: Mapped[float] = mapped_column(Float, default=0.95)
    importance: Mapped[float] = mapped_column(Float, default=0.80)
    sensitivity: Mapped[str] = mapped_column(String(32), default="personal")
    verification_status: Mapped[str] = mapped_column(String(32), default="verified")
    source_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    related_entity_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    versions_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)
    embedding_json: Mapped[List[float]] = mapped_column(JSON, default=list)
    contradicts_memory_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expiration_policy: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, default=1)
    event_timestamp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MemorySourceORM(Base):
    __tablename__ = "memory_sources"

    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    memory_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(128), default="")
    excerpt: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MemoryEmbeddingORM(Base):
    __tablename__ = "memory_embeddings"

    memory_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    model_name: Mapped[str] = mapped_column(String(64), default="gemini-embedding-001")
    dimensions: Mapped[int] = mapped_column(Integer, default=32)
    vector_json: Mapped[List[float]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MemoryVersionORM(Base):
    __tablename__ = "memory_versions"

    version_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    memory_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="Updated")
    confidence: Mapped[float] = mapped_column(Float, default=0.95)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class KnowledgeEntityORM(Base):
    __tablename__ = "knowledge_entities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    name: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    attributes_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    mention_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class KnowledgeRelationshipORM(Base):
    __tablename__ = "knowledge_relationships"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    source_entity_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    target_entity_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    predicate: Mapped[str] = mapped_column(String(128), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.95)
    evidence_memory_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    temporal_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EventORM(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    package_name: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(255), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    relevance_score: Mapped[int] = mapped_column(Integer, default=0)
    decision: Mapped[str] = mapped_column(String(64), default="logged")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ConversationORM(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    title: Mapped[str] = mapped_column(String(255), default="Live Companion Session")
    language: Mapped[str] = mapped_column(String(32), default="te-en")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ConversationMessageORM(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    modality: Mapped[str] = mapped_column(String(32), default="voice")
    language: Mapped[str] = mapped_column(String(32), default="te-en")
    emotion_state: Mapped[str] = mapped_column(String(32), default="Happy")
    extracted_memory_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    triggered_action_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserPreferenceORM(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    key: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    value_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ProjectORM(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(64), default="active")
    technologies_json: Mapped[List[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PersonORM(Base):
    __tablename__ = "persons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    role_or_relation: Mapped[str] = mapped_column(String(128), default="Collaborator")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LocationORM(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    region: Mapped[str] = mapped_column(String(128), default="")
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TaskORM(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    project_tag: Mapped[str] = mapped_column(String(128), default="Project Aether")
    due_at: Mapped[str] = mapped_column(String(64), default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(String(32), default="companion")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TimelineEntryORM(Base):
    __tablename__ = "timeline_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    timestamp_iso: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="episodic")
    memory_id: Mapped[str] = mapped_column(String(64), default="")
    entity_ids_json: Mapped[List[str]] = mapped_column(JSON, default=list)
    source_type: Mapped[str] = mapped_column(String(64), default="conversation")


class DeviceActionAuditORM(Base):
    __tablename__ = "device_action_audits"

    action_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True, default="shaurya")
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    parameters_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    permission_status: Mapped[str] = mapped_column(String(32), default="granted")
    execution_status: Mapped[str] = mapped_column(String(32), default="executed")
    verification_status: Mapped[str] = mapped_column(String(32), default="verified")
    risk_level: Mapped[str] = mapped_column(String(16), default="low")
    result_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
