import {
  EntityType,
  EpistemicStatus,
  KnowledgeEntity,
  KnowledgeRelationship,
  MemoryCategory,
  MemoryRecord,
  MemorySource,
  RetrievedMemoryItem,
  SensitivityLevel,
  TimelineEntry,
} from '../types/aether';

/**
 * Computes a deterministic 32-dimensional normalized semantic vector embedding
 * using character n-gram and domain-concept projection so vector similarity works
 * deterministically offline and in unit tests, and can be paired with Gemini embeddings.
 */
export function computeDeterministicEmbedding(text: string): number[] {
  const dim = 32;
  const vec = new Array<number>(dim).fill(0);
  const normalized = text.toLowerCase().trim();
  if (!normalized) return vec;

  const domainBuckets: Record<string, number[]> = {
    kotlin: [0, 4, 12],
    android: [0, 1, 8],
    compose: [0, 2, 16],
    aether: [1, 5, 9],
    gemini: [2, 6, 10],
    adk: [2, 7, 11],
    memory: [3, 8, 14],
    postgres: [3, 15, 20],
    pgvector: [3, 15, 21],
    telugu: [13, 17, 25],
    hyderabad: [13, 18, 26],
    coffee: [19, 22, 28],
    debug: [4, 16, 24],
    architecture: [5, 11, 27],
    deadline: [6, 23, 29],
    notification: [7, 14, 30],
    voice: [10, 17, 31],
  };

  const tokens = normalized.split(/[^a-z0-9\u0C00-\u0C7F]+/).filter(Boolean);
  for (const token of tokens) {
    // Domain concept projection
    for (const [key, indices] of Object.entries(domainBuckets)) {
      if (token.includes(key)) {
        for (const idx of indices) {
          vec[idx] += 2.2;
        }
      }
    }
    // Trigram hashing
    const padded = `_${token}_`;
    for (let i = 0; i <= padded.length - 3; i++) {
      const trigram = padded.slice(i, i + 3);
      let hash = 2166136261;
      for (let c = 0; c < trigram.length; c++) {
        hash ^= trigram.charCodeAt(c);
        hash = Math.imul(hash, 16777619);
      }
      const bucket = Math.abs(hash) % dim;
      const sign = hash & 1 ? 1 : -1;
      vec[bucket] += sign * 0.65;
    }
  }

  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(5)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export function computeFullTextScore(query: string, content: string): number {
  const qTokens = query
    .toLowerCase()
    .split(/[^a-z0-9\u0C00-\u0C7F]+/)
    .filter((t) => t.length > 2);
  if (qTokens.length === 0) return 0;

  const target = content.toLowerCase();
  let matched = 0;
  for (const token of qTokens) {
    if (target.includes(token)) {
      matched += 1;
    }
  }
  return matched / qTokens.length;
}

export interface MemoryStateStore {
  memories: MemoryRecord[];
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  timeline: TimelineEntry[];
}

export interface CandidateExtractionResult {
  content: string;
  category: MemoryCategory;
  epistemicStatus: EpistemicStatus;
  confidence: number;
  importance: number;
  sensitivity: SensitivityLevel;
  entities: { name: string; type: EntityType; description: string }[];
  relationships: { sourceName: string; targetName: string; predicate: string }[];
}

/**
 * Extracts structured candidate memories, entities, and relationships from
 * raw conversation text or device events (rule-based deterministic extractor
 * that works immediately and can be augmented by Gemini 3.8 Flash).
 */
export function extractMemoryCandidatesFromText(
  rawText: string,
  sourceType: MemorySource['sourceType'] = 'conversation'
): CandidateExtractionResult[] {
  const trimmed = rawText.trim();
  if (trimmed.length < 6) return [];

  const lower = trimmed.toLowerCase();
  const candidates: CandidateExtractionResult[] = [];

  // Detect category
  let category: MemoryCategory = 'semantic';
  if (
    lower.includes('prefer') ||
    lower.includes('always ') ||
    lower.includes('never ') ||
    lower.includes('style') ||
    lower.includes('explain')
  ) {
    category = 'procedural';
  } else if (
    lower.includes('yesterday') ||
    lower.includes('evening') ||
    lower.includes('morning') ||
    lower.includes('spent') ||
    lower.includes('debugged') ||
    lower.includes('launched') ||
    sourceType === 'device_event'
  ) {
    category = 'episodic';
  } else if (
    lower.includes('renamed') ||
    lower.includes('started in') ||
    lower.includes('changed from') ||
    lower.includes('switched to') ||
    lower.includes('deadline')
  ) {
    category = 'temporal';
  } else if (
    lower.includes('works with') ||
    lower.includes('collaborates') ||
    lower.includes('associated with') ||
    lower.includes('part of')
  ) {
    category = 'relational';
  }

  // Detect epistemic status
  let epistemicStatus: EpistemicStatus = 'explicitly_stated';
  if (sourceType === 'device_event' || sourceType === 'screen_observation') {
    epistemicStatus = 'observed_event';
  } else if (lower.includes('maybe') || lower.includes('might') || lower.includes('probably')) {
    epistemicStatus = 'unverified_assumption';
  }

  // Extract entities
  const entities: { name: string; type: EntityType; description: string }[] = [
    { name: 'Shaurya', type: 'Person', description: 'Primary user and lead architect of Project Aether' },
  ];
  const relationships: { sourceName: string; targetName: string; predicate: string }[] = [];

  const knownPatterns: { pattern: RegExp; name: string; type: EntityType; desc: string; predicate: string }[] = [
    { pattern: /\baether\b/i, name: 'Project Aether', type: 'Project', desc: 'Living AI Companion ecosystem for Android', predicate: 'architects' },
    { pattern: /\bkotlin\b/i, name: 'Kotlin', type: 'Technology', desc: 'Modern statically typed language for Android', predicate: 'develops_with' },
    { pattern: /\bjetpack compose\b|\bcompose\b/i, name: 'Jetpack Compose', type: 'Technology', desc: 'Declarative Android UI toolkit', predicate: 'builds_ui_with' },
    { pattern: /\bpostgresql\b|\bpostgres\b|\bpgvector\b/i, name: 'PostgreSQL + pgvector', type: 'Technology', desc: 'Hybrid relational and vector memory database', predicate: 'stores_memories_in' },
    { pattern: /\bgemini\b/i, name: 'Gemini 3.8 Live', type: 'Technology', desc: 'Real-time bidirectional voice & reasoning model', predicate: 'integrates' },
    { pattern: /\badk\b|\bagent development kit\b/i, name: 'Google ADK', type: 'Technology', desc: 'Multi-agent orchestration framework', predicate: 'orchestrates_with' },
    { pattern: /\bandroid studio\b/i, name: 'Android Studio', type: 'Technology', desc: 'Official IDE for Android development', predicate: 'uses_tool' },
    { pattern: /\btelugu\b/i, name: 'Telugu', type: 'Concept', desc: 'Spoken language preference alongside English', predicate: 'speaks_language' },
    { pattern: /\bhyderabad\b/i, name: 'Hyderabad', type: 'Place', desc: 'City associated with user context', predicate: 'located_in' },
  ];

  for (const item of knownPatterns) {
    if (item.pattern.test(trimmed)) {
      entities.push({ name: item.name, type: item.type, description: item.desc });
      relationships.push({
        sourceName: 'Shaurya',
        targetName: item.name,
        predicate: item.predicate,
      });
    }
  }

  // Also detect capitalized project or person names like "Person X" or "Project Y"
  const projectMatch = trimmed.match(/Project\s+([A-Z][a-zA-Z0-9_-]+)/);
  if (projectMatch && projectMatch[1] !== 'Aether') {
    const pName = `Project ${projectMatch[1]}`;
    entities.push({ name: pName, type: 'Project', description: `User project referenced in conversation` });
    relationships.push({ sourceName: 'Shaurya', targetName: pName, predicate: 'works_on' });
  }

  const sensitivity: SensitivityLevel =
    lower.includes('password') || lower.includes('bank') || lower.includes('medical')
      ? 'restricted'
      : lower.includes('location') || lower.includes('phone')
      ? 'sensitive'
      : 'personal';

  candidates.push({
    content: trimmed,
    category,
    epistemicStatus,
    confidence: epistemicStatus === 'explicitly_stated' ? 0.94 : epistemicStatus === 'observed_event' ? 0.91 : 0.68,
    importance: lower.includes('important') || lower.includes('remember') || lower.includes('always') ? 0.92 : 0.76,
    sensitivity,
    entities,
    relationships,
  });

  return candidates;
}

/**
 * Ingests a candidate memory into the MemoryStateStore with duplicate detection,
 * contradiction detection, entity resolution, relationship linking, and timeline creation.
 */
export function ingestMemoryCandidate(
  store: MemoryStateStore,
  candidate: CandidateExtractionResult,
  source: MemorySource
): {
  store: MemoryStateStore;
  action: 'created' | 'merged_duplicate' | 'updated_contradiction';
  memory: MemoryRecord;
} {
  const now = new Date().toISOString();
  const embedding = computeDeterministicEmbedding(candidate.content);

  // 1. Resolve Entities
  const updatedEntities = [...store.entities];
  const resolvedEntityIds: string[] = [];
  const entityNameMap = new Map<string, string>();

  for (const existing of updatedEntities) {
    entityNameMap.set(existing.name.toLowerCase(), existing.id);
  }

  for (const ent of candidate.entities) {
    const key = ent.name.toLowerCase();
    const existingId = entityNameMap.get(key);
    if (existingId) {
      resolvedEntityIds.push(existingId);
      const idx = updatedEntities.findIndex((e) => e.id === existingId);
      if (idx !== -1) {
        updatedEntities[idx] = {
          ...updatedEntities[idx],
          mentionCount: updatedEntities[idx].mentionCount + 1,
          updatedAt: now,
        };
      }
    } else {
      const newId = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newEntity: KnowledgeEntity = {
        id: newId,
        name: ent.name,
        type: ent.type,
        description: ent.description,
        attributes: {},
        createdAt: now,
        updatedAt: now,
        mentionCount: 1,
      };
      updatedEntities.push(newEntity);
      entityNameMap.set(key, newId);
      resolvedEntityIds.push(newId);
    }
  }

  // 2. Check for Duplicates (high semantic similarity + high token overlap)
  let duplicateTarget: MemoryRecord | undefined;
  let contradictionTarget: MemoryRecord | undefined;

  const negationWords = ['not', 'never', 'no longer', 'stopped', 'instead of', 'renamed'];
  const candidateHasNegation = negationWords.some((w) => candidate.content.toLowerCase().includes(w));

  for (const existing of store.memories) {
    const sim = cosineSimilarity(embedding, existing.embedding);
    const textOverlap = computeFullTextScore(candidate.content, existing.content);

    if (
      existing.content.trim().toLowerCase() === candidate.content.trim().toLowerCase() ||
      (sim > 0.92 && textOverlap > 0.78 && !candidateHasNegation)
    ) {
      duplicateTarget = existing;
      break;
    }

    // Check for contradiction on the same category & overlapping entities
    const sharesEntities = existing.relatedEntityIds.some((id) => resolvedEntityIds.includes(id));
    if (
      sharesEntities &&
      existing.category === candidate.category &&
      textOverlap >= 0.4 &&
      candidateHasNegation &&
      existing.content.toLowerCase() !== candidate.content.toLowerCase()
    ) {
      contradictionTarget = existing;
    }
  }

  let resultMemory: MemoryRecord;
  let actionType: 'created' | 'merged_duplicate' | 'updated_contradiction' = 'created';
  const updatedMemories = [...store.memories];

  if (duplicateTarget) {
    actionType = 'merged_duplicate';
    const idx = updatedMemories.findIndex((m) => m.id === duplicateTarget!.id);
    const boostedConfidence = Math.min(0.99, Number((duplicateTarget.confidence + 0.03).toFixed(2)));
    resultMemory = {
      ...duplicateTarget,
      updatedAt: now,
      confidence: boostedConfidence,
      accessCount: duplicateTarget.accessCount + 1,
      relatedEntityIds: Array.from(new Set([...duplicateTarget.relatedEntityIds, ...resolvedEntityIds])),
      versions: [
        ...duplicateTarget.versions,
        {
          versionId: `ver_${Date.now()}`,
          content: candidate.content,
          updatedAt: now,
          reason: `Consolidated duplicate memory from ${source.sourceType}`,
          confidence: boostedConfidence,
        },
      ],
    };
    updatedMemories[idx] = resultMemory;
  } else {
    const newMemId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (contradictionTarget) {
      actionType = 'updated_contradiction';
      const cIdx = updatedMemories.findIndex((m) => m.id === contradictionTarget!.id);
      if (cIdx !== -1) {
        updatedMemories[cIdx] = {
          ...contradictionTarget,
          verificationStatus: 'contradicted',
          updatedAt: now,
          versions: [
            ...contradictionTarget.versions,
            {
              versionId: `ver_${Date.now()}_superseded`,
              content: contradictionTarget.content,
              updatedAt: now,
              reason: `Superseded by newer memory ${newMemId}`,
              confidence: contradictionTarget.confidence,
            },
          ],
        };
      }
    }

    resultMemory = {
      id: newMemId,
      content: candidate.content,
      category: candidate.category,
      epistemicStatus: candidate.epistemicStatus,
      createdAt: now,
      updatedAt: now,
      eventTimestamp: now,
      source,
      confidence: candidate.confidence,
      importance: candidate.importance,
      sensitivity: candidate.sensitivity,
      embedding,
      relatedEntityIds: Array.from(new Set(resolvedEntityIds)),
      verificationStatus:
        candidate.epistemicStatus === 'unverified_assumption' ? 'unverified' : 'verified',
      accessCount: 1,
      lastAccessedAt: now,
      contradictsMemoryId: contradictionTarget?.id,
      versions: [
        {
          versionId: `ver_${Date.now()}_init`,
          content: candidate.content,
          updatedAt: now,
          reason: `Initial creation via ${source.sourceType}`,
          confidence: candidate.confidence,
        },
      ],
    };
    updatedMemories.unshift(resultMemory);
  }

  // 3. Link Relationships
  const updatedRelationships = [...store.relationships];
  for (const rel of candidate.relationships) {
    const srcId = entityNameMap.get(rel.sourceName.toLowerCase());
    const tgtId = entityNameMap.get(rel.targetName.toLowerCase());
    if (srcId && tgtId && srcId !== tgtId) {
      const existingRelIdx = updatedRelationships.findIndex(
        (r) => r.sourceEntityId === srcId && r.targetEntityId === tgtId && r.predicate === rel.predicate
      );
      if (existingRelIdx !== -1) {
        const existingRel = updatedRelationships[existingRelIdx];
        updatedRelationships[existingRelIdx] = {
          ...existingRel,
          confidence: Math.min(0.99, Number((existingRel.confidence + 0.04).toFixed(2))),
          evidenceMemoryIds: Array.from(new Set([...existingRel.evidenceMemoryIds, resultMemory.id])),
          updatedAt: now,
        };
      } else {
        updatedRelationships.push({
          id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sourceEntityId: srcId,
          targetEntityId: tgtId,
          predicate: rel.predicate,
          confidence: candidate.confidence,
          evidenceMemoryIds: [resultMemory.id],
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // 4. Add Timeline Entry if newly created or contradiction update
  const updatedTimeline = [...store.timeline];
  if (actionType !== 'merged_duplicate') {
    updatedTimeline.unshift({
      id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      title:
        actionType === 'updated_contradiction'
          ? `Updated Knowledge (${candidate.category})`
          : `New ${candidate.category.charAt(0).toUpperCase() + candidate.category.slice(1)} Memory`,
      summary: candidate.content,
      category: candidate.category,
      memoryId: resultMemory.id,
      entityIds: resultMemory.relatedEntityIds,
      sourceType: source.sourceType,
    });
  }

  return {
    store: {
      memories: updatedMemories,
      entities: updatedEntities,
      relationships: updatedRelationships,
      timeline: updatedTimeline,
    },
    action: actionType,
    memory: resultMemory,
  };
}

export interface HybridQueryOptions {
  query: string;
  categoryFilter?: MemoryCategory | 'all';
  entityIdFilter?: string;
  includeUnverified?: boolean;
  limit?: number;
}

/**
 * Hybrid retrieval combining:
 * 1. Semantic vector similarity (pgvector cosine distance equivalent)
 * 2. PostgreSQL full-text token match
 * 3. Temporal recency score
 * 4. Knowledge graph 1-hop entity relationship boost
 */
export function retrieveHybridMemories(
  store: MemoryStateStore,
  options: HybridQueryOptions
): RetrievedMemoryItem[] {
  const {
    query,
    categoryFilter = 'all',
    entityIdFilter,
    includeUnverified = true,
    limit = 8,
  } = options;

  const qVec = computeDeterministicEmbedding(query);
  const nowMs = Date.now();

  // Identify entities directly matched by the query text or significant entity tokens
  const qLower = query.toLowerCase();
  const qTokens = new Set(
    qLower.split(/[^a-z0-9\u0C00-\u0C7F]+/).filter((t) => t.length >= 4)
  );
  const matchedEntityIds = new Set<string>();
  for (const ent of store.entities) {
    const entLower = ent.name.toLowerCase();
    const entTokens = entLower.split(/[^a-z0-9\u0C00-\u0C7F]+/).filter((t) => t.length >= 4);
    if (
      (qLower.length >= 3 && qLower.includes(entLower)) ||
      entTokens.some((tok) => qTokens.has(tok))
    ) {
      matchedEntityIds.add(ent.id);
    }
  }
  if (entityIdFilter) {
    matchedEntityIds.add(entityIdFilter);
  }

  // Expand 1-hop across knowledge graph relationships
  const oneHopEntityIds = new Set<string>(matchedEntityIds);
  for (const rel of store.relationships) {
    if (matchedEntityIds.has(rel.sourceEntityId)) {
      oneHopEntityIds.add(rel.targetEntityId);
    }
    if (matchedEntityIds.has(rel.targetEntityId)) {
      oneHopEntityIds.add(rel.sourceEntityId);
    }
  }

  const results: RetrievedMemoryItem[] = [];

  for (const mem of store.memories) {
    if (categoryFilter !== 'all' && mem.category !== categoryFilter) continue;
    if (!includeUnverified && mem.verificationStatus === 'unverified') continue;
    if (entityIdFilter && !mem.relatedEntityIds.includes(entityIdFilter)) continue;

    const vectorScore = query.trim() ? cosineSimilarity(qVec, mem.embedding) : 0.5;
    const fullTextScore = query.trim() ? computeFullTextScore(query, mem.content) : 0.5;

    const ageHours = Math.max(0, (nowMs - new Date(mem.updatedAt).getTime()) / (1000 * 3600));
    const temporalScore = Math.exp(-ageHours / (24 * 30)); // 30-day decay half-life

    let graphBoost = 0;
    for (const eId of mem.relatedEntityIds) {
      if (matchedEntityIds.has(eId)) {
        graphBoost = Math.max(graphBoost, 0.35);
      } else if (oneHopEntityIds.has(eId)) {
        graphBoost = Math.max(graphBoost, 0.18);
      }
    }

    const totalScore = Number(
      (
        vectorScore * 0.42 +
        fullTextScore * 0.30 +
        temporalScore * 0.13 +
        graphBoost * 0.15 +
        mem.importance * 0.08
      ).toFixed(4)
    );

    const connectedEntities = store.entities.filter((e) => mem.relatedEntityIds.includes(e.id));
    const connectedRelationships = store.relationships.filter(
      (r) =>
        r.evidenceMemoryIds.includes(mem.id) ||
        (mem.relatedEntityIds.includes(r.sourceEntityId) &&
          mem.relatedEntityIds.includes(r.targetEntityId))
    );

    results.push({
      memory: mem,
      connectedEntities,
      connectedRelationships,
      scoreBreakdown: {
        vectorScore: Number(vectorScore.toFixed(3)),
        fullTextScore: Number(fullTextScore.toFixed(3)),
        temporalScore: Number(temporalScore.toFixed(3)),
        graphBoost: Number(graphBoost.toFixed(3)),
        totalScore,
      },
    });
  }

  results.sort((a, b) => b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore);
  return results.slice(0, limit);
}
