-- Project Aether: PostgreSQL + pgvector Hybrid Knowledge Graph Schema
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS entities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    mention_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memories (
    id VARCHAR(64) PRIMARY KEY,
    content TEXT NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('episodic', 'semantic', 'relational', 'procedural', 'temporal')),
    epistemic_status VARCHAR(32) NOT NULL CHECK (epistemic_status IN ('explicitly_stated', 'observed_event', 'model_inference', 'unverified_assumption')),
    confidence REAL NOT NULL DEFAULT 0.9,
    importance REAL NOT NULL DEFAULT 0.75,
    sensitivity VARCHAR(32) NOT NULL DEFAULT 'personal',
    verification_status VARCHAR(32) NOT NULL DEFAULT 'verified',
    source_type VARCHAR(64) NOT NULL,
    source_reference VARCHAR(128) NOT NULL,
    source_excerpt TEXT NOT NULL DEFAULT '',
    embedding vector(768),
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    contradicts_memory_id VARCHAR(64) REFERENCES memories(id) ON DELETE SET NULL,
    access_count INTEGER NOT NULL DEFAULT 1,
    event_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw
    ON memories USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_memories_tsv
    ON memories USING gin (tsv);

CREATE TABLE IF NOT EXISTS memory_entities (
    memory_id VARCHAR(64) NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    PRIMARY KEY (memory_id, entity_id)
);

CREATE TABLE IF NOT EXISTS relationships (
    id VARCHAR(64) PRIMARY KEY,
    source_entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id VARCHAR(64) NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    predicate VARCHAR(128) NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.9,
    evidence_memory_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    temporal_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_versions (
    version_id VARCHAR(64) PRIMARY KEY,
    memory_id VARCHAR(64) NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
