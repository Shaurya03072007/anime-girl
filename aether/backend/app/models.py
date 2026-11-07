from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
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
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(32), nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
