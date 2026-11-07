import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Edit3,
  GitBranch,
  Clock,
  Layers,
} from 'lucide-react';
import {
  KnowledgeEntity,
  KnowledgeRelationship,
  MemoryCategory,
  MemoryRecord,
  VerificationStatus,
} from '../types/aether';
import { MemoryStateStore, retrieveHybridMemories } from '../engine/memoryEngine';

interface MemoriesViewProps {
  memoryStore: MemoryStateStore;
  onCreateMemory: (payload: {
    content: string;
    category: MemoryCategory;
    importance: number;
    entityNames: string[];
  }) => Promise<void>;
  onUpdateMemory: (
    id: string,
    payload: {
      content?: string;
      category?: MemoryCategory;
      verificationStatus?: VerificationStatus;
    }
  ) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onCreateRelationship: (payload: {
    sourceEntityName: string;
    targetEntityName: string;
    predicate: string;
  }) => Promise<void>;
}

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  memoryStore,
  onCreateMemory,
  onUpdateMemory,
  onDeleteMemory,
  onCreateRelationship,
}) => {
  const [subTab, setSubTab] = useState<'graph' | 'timeline' | 'explorer'>('graph');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('ent_aether');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(
    memoryStore.memories[0]?.id || null
  );

  // Graph zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // New Memory Form state
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('semantic');
  const [newEntitiesInput, setNewEntitiesInput] = useState('Project Aether, Kotlin');
  const [formError, setFormError] = useState('');

  // New Relationship Form state
  const [relSource, setRelSource] = useState('Shaurya');
  const [relPredicate, setRelPredicate] = useState('optimizes');
  const [relTarget, setRelTarget] = useState('PostgreSQL + pgvector');

  // Edit memory state
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Compute Hybrid Search Results
  const hybridResults = useMemo(() => {
    return retrieveHybridMemories(memoryStore, {
      query: searchQuery,
      categoryFilter,
      entityIdFilter: subTab === 'explorer' ? undefined : selectedEntityId || undefined,
      limit: 25,
    });
  }, [memoryStore, searchQuery, categoryFilter, selectedEntityId, subTab]);

  // Compute deterministic circular/radial node positions for Knowledge Graph
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const entities = memoryStore.entities;
    const cx = 420;
    const cy = 235;
    entities.forEach((ent, idx) => {
      if (idx === 0) {
        map.set(ent.id, { x: cx, y: cy });
      } else {
        const angle = ((idx - 1) / Math.max(1, entities.length - 1)) * Math.PI * 2 - Math.PI / 4;
        const radius = idx % 2 === 1 ? 168 : 198;
        map.set(ent.id, {
          x: Math.round(cx + Math.cos(angle) * radius),
          y: Math.round(cy + Math.sin(angle) * radius),
        });
      }
    });
    return map;
  }, [memoryStore.entities]);

  const selectedEntity: KnowledgeEntity | undefined = memoryStore.entities.find(
    (e) => e.id === selectedEntityId
  );

  const selectedMemory: MemoryRecord | undefined =
    memoryStore.memories.find((m) => m.id === selectedMemoryId) ||
    memoryStore.memories[0];

  const stats = useMemo(() => {
    const peopleCount = memoryStore.entities.filter((e) => e.type === 'Person').length;
    const projectCount = memoryStore.entities.filter((e) => e.type === 'Project').length;
    const unverifiedCount = memoryStore.memories.filter(
      (m) => m.verificationStatus === 'unverified' || m.verificationStatus === 'contradicted'
    ).length;
    return {
      totalMemories: memoryStore.memories.length,
      peopleCount,
      projectCount,
      entityCount: memoryStore.entities.length,
      relationshipCount: memoryStore.relationships.length,
      unverifiedCount,
    };
  }, [memoryStore]);

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newContent.trim().length < 5) {
      setFormError('Please enter at least 5 characters for the memory record.');
      return;
    }
    setFormError('');
    const entityNames = newEntitiesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await onCreateMemory({
      content: newContent.trim(),
      category: newCategory,
      importance: 0.88,
      entityNames,
    });
    setNewContent('');
  };

  const handleAddRelationshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relSource.trim() || !relTarget.trim() || !relPredicate.trim()) return;
    await onCreateRelationship({
      sourceEntityName: relSource.trim(),
      targetEntityName: relTarget.trim(),
      predicate: relPredicate.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Memory Dashboard Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Memories', value: stats.totalMemories },
          { label: 'Knowledge Entities', value: stats.entityCount },
          { label: 'Graph Relationships', value: stats.relationshipCount },
          { label: 'People Known', value: stats.peopleCount },
          { label: 'Active Projects', value: stats.projectCount },
          { label: 'Unverified / Review', value: stats.unverifiedCount },
        ].map((metric) => (
          <div
            key={metric.label}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Controls Bar: Mode Switcher, Hybrid Search & Category Filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {(
            [
              { id: 'graph', label: 'Knowledge Graph', icon: GitBranch },
              { id: 'timeline', label: 'Chronological Timeline', icon: Clock },
              { id: 'explorer', label: 'Hybrid Memory Table', icon: Layers },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                  subTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Hybrid Search & Category Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <label htmlFor="hybrid-memory-search" className="sr-only">
              Search memories by vector similarity or keyword
            </label>
            <input
              id="hybrid-memory-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hybrid vector + full-text query (e.g., 'pgvector Ananya')..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
            {(['all', 'episodic', 'semantic', 'relational', 'procedural', 'temporal'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Main Content Split: Graph / Timeline / Explorer on Left (7 cols), Inspector & Creation on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {subTab === 'graph' && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Interactive Entity & Relationship Graph
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any node to inspect its connected memories and 1-hop relationships
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Zoom In Graph"
                    onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom Out Graph"
                    onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Reset Graph View"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                      setSelectedEntityId(null);
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>All Nodes</span>
                  </button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 h-[440px]">
                <svg
                  viewBox="0 0 840 480"
                  className="w-full h-full select-none"
                  data-testid="knowledge-graph-svg"
                >
                  <g
                    transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                    style={{ transformOrigin: '420px 240px' }}
                  >
                    {/* Edges */}
                    {memoryStore.relationships.map((rel, idx) => {
                      const src = nodePositions.get(rel.sourceEntityId);
                      const tgt = nodePositions.get(rel.targetEntityId);
                      if (!src || !tgt) return null;
                      const isHighlighted =
                        selectedEntityId === rel.sourceEntityId ||
                        selectedEntityId === rel.targetEntityId;
                      const midX = src.x * 0.45 + tgt.x * 0.55;
                      const midY = src.y * 0.45 + tgt.y * 0.55 + (idx % 2 === 0 ? -9 : 11);
                      return (
                        <g key={rel.id}>
                          <line
                            x1={src.x}
                            y1={src.y}
                            x2={tgt.x}
                            y2={tgt.y}
                            stroke={isHighlighted ? '#818cf8' : '#334155'}
                            strokeWidth={isHighlighted ? 2.4 : 1.4}
                          />
                          <text
                            x={midX}
                            y={midY}
                            textAnchor="middle"
                            fill={isHighlighted ? '#c7d2fe' : '#64748b'}
                            fontSize="9.5"
                          >
                            {rel.predicate}
                          </text>
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {memoryStore.entities.map((ent) => {
                      const pos = nodePositions.get(ent.id);
                      if (!pos) return null;
                      const isSelected = selectedEntityId === ent.id;
                      const nodeColor =
                        ent.type === 'Person'
                          ? '#38bdf8'
                          : ent.type === 'Project'
                          ? '#818cf8'
                          : ent.type === 'Technology'
                          ? '#2dd4bf'
                          : '#f59e0b';
                      const initials = ent.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 3)
                        .toUpperCase();

                      return (
                        <g
                          key={ent.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          onClick={() => setSelectedEntityId(ent.id)}
                          className="cursor-pointer"
                        >
                          <circle
                            r={isSelected ? 22 : 18}
                            fill="#0f172a"
                            stroke={nodeColor}
                            strokeWidth={isSelected ? 3.5 : 2}
                          />
                          <text
                            y={4}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="10"
                            fontWeight="700"
                          >
                            {initials}
                          </text>
                          <text
                            y={33}
                            textAnchor="middle"
                            fill="#f1f5f9"
                            fontSize="10.5"
                            fontWeight="600"
                          >
                            {ent.name}
                          </text>
                          <text
                            y={45}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="9"
                          >
                            {ent.type}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>

              {/* Selected Entity Summary & Relationship Editor */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedEntity ? (
                    <>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Selected Node: {selectedEntity.name}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>Type: {selectedEntity.type}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>Mentions: {selectedEntity.mentionCount}</span>
                      <p className="mt-0.5 text-slate-500">{selectedEntity.description}</p>
                    </>
                  ) : (
                    <span>Showing all {memoryStore.entities.length} knowledge entities</span>
                  )}
                </div>
              </div>

              {/* Add Graph Relationship Form */}
              <form
                onSubmit={handleAddRelationshipSubmit}
                className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2"
              >
                <input
                  type="text"
                  aria-label="Source Entity Name"
                  value={relSource}
                  onChange={(e) => setRelSource(e.target.value)}
                  placeholder="Source Entity"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="text"
                  aria-label="Relationship Predicate"
                  value={relPredicate}
                  onChange={(e) => setRelPredicate(e.target.value)}
                  placeholder="Predicate (e.g., uses)"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="text"
                  aria-label="Target Entity Name"
                  value={relTarget}
                  onChange={(e) => setRelTarget(e.target.value)}
                  placeholder="Target Entity"
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-indigo-600 text-white hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
                >
                  Link Relationship
                </button>
              </form>
            </div>
          )}

          {subTab === 'timeline' && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Chronological Companion Memory Timeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ordered history of episodic experiences, semantic facts, and temporal updates
                </p>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {memoryStore.timeline
                  .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMemoryId(item.memoryId)}
                      className="w-full text-left py-3.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-900 dark:text-slate-200">
                          {item.title}
                        </span>
                        <span className="font-mono tabular-nums">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {item.summary}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span>Category: {item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Source: {item.sourceType}</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Hybrid Memory List (always visible below Graph or in Explorer tab) */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Retrieved Hybrid Memories ({hybridResults.length})
              </h3>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Ranked by Vector + Full-Text + Graph Boost
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {hybridResults.map((item) => {
                const mem = item.memory;
                const isSelected = selectedMemory?.id === mem.id;
                return (
                  <button
                    key={mem.id}
                    type="button"
                    onClick={() => setSelectedMemoryId(mem.id)}
                    className={`w-full text-left py-3.5 px-3 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {mem.content}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="capitalize">{mem.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Status: {mem.verificationStatus}</span>
                      <span aria-hidden="true">·</span>
                      <span>Origin: {mem.epistemicStatus.replace(/_/g, ' ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Score: {item.scoreBreakdown.totalScore.toFixed(3)} (vec{' '}
                        {item.scoreBreakdown.vectorScore.toFixed(2)}, graph{' '}
                        {item.scoreBreakdown.graphBoost.toFixed(2)})
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Memory Detail Inspector + Create New Memory */}
        <div className="lg:col-span-5 space-y-6">
          {/* Memory Detail Inspector */}
          {selectedMemory && (
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Memory Record Inspector
                  </h3>
                  <p className="text-xs font-mono text-slate-500">{selectedMemory.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedMemory.verificationStatus !== 'verified' && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateMemory(selectedMemory.id, { verificationStatus: 'verified' })
                      }
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-500 flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify Fact</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Edit Selected Memory"
                    onClick={() => {
                      setEditingMemoryId(selectedMemory.id);
                      setEditingText(selectedMemory.content);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete Selected Memory"
                    onClick={() => onDeleteMemory(selectedMemory.id)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editingMemoryId === selectedMemory.id ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateMemory(selectedMemory.id, { content: editingText });
                        setEditingMemoryId(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white"
                    >
                      Save Revision
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMemoryId(null)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedMemory.content}
                </p>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Category:</span>{' '}
                  <span className="font-medium capitalize text-slate-900 dark:text-slate-200">
                    {selectedMemory.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Epistemic Basis:</span>{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {selectedMemory.epistemicStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Confidence:</span>{' '}
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                    {Math.round(selectedMemory.confidence * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Importance:</span>{' '}
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                    {Math.round(selectedMemory.importance * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Sensitivity:</span>{' '}
                  <span className="font-medium capitalize text-slate-900 dark:text-slate-200">
                    {selectedMemory.sensitivity}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Access Count:</span>{' '}
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-200">
                    {selectedMemory.accessCount}
                  </span>
                </div>
              </div>

              {/* Provenance Source */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-slate-200">
                  Source Provenance ({selectedMemory.source.sourceType})
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  "{selectedMemory.source.excerpt}"
                </p>
              </div>

              {/* Version History */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-200">
                  Version History ({selectedMemory.versions.length})
                </p>
                {selectedMemory.versions.map((ver) => (
                  <div
                    key={ver.versionId}
                    className="text-slate-600 dark:text-slate-400 pb-1.5 last:pb-0"
                  >
                    <span className="font-mono tabular-nums text-slate-500">
                      {new Date(ver.updatedAt).toLocaleDateString()}
                    </span>{' '}
                    · {ver.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create Persistent Memory Form */}
          <form
            onSubmit={handleAddMemorySubmit}
            className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Ingest New Persistent Memory
              </h3>
            </div>

            <div>
              <label
                htmlFor="new-memory-content"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Memory Content
              </label>
              <textarea
                id="new-memory-content"
                rows={3}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Enter fact, episode, preference, or temporal milestone..."
                className="w-full p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              {formError && <p className="mt-1 text-xs text-rose-500">{formError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-memory-category"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Category
                </label>
                <select
                  id="new-memory-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="semantic">Semantic (Stable Fact)</option>
                  <option value="episodic">Episodic (Experience)</option>
                  <option value="relational">Relational (Connection)</option>
                  <option value="procedural">Procedural (User Preference)</option>
                  <option value="temporal">Temporal (Evolution)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-memory-entities"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Connected Entities (comma-separated)
                </label>
                <input
                  id="new-memory-entities"
                  type="text"
                  value={newEntitiesInput}
                  onChange={(e) => setNewEntitiesInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
            >
              Consolidate into Memory Graph
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
