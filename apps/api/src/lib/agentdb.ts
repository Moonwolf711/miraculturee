/**
 * MiraCulture AgentDB Integration
 *
 * Wraps the AgentDB memory system for semantic search across artist profiles,
 * agent profiles, chat context, and learned patterns. Uses the 'balanced' recipe
 * for production (scalar quantization, HNSW M=16, ef=100).
 *
 * All methods are fire-and-forget safe -- failures are logged but never propagate
 * to callers, so search index issues never break core CRUD functionality.
 */

import { AgentDB } from 'agentdb';
import type { ReasoningPattern } from 'agentdb';

// ─── Configuration ───

const RECIPES = {
  balanced: {
    dimension: 768,
    maxElements: 100_000,
  },
} as const;

const DB_PATH = '.agentdb/mira.db';

// ─── Internal state ───

let memoryInstance: MiraCultureMemory | null = null;
let initPromise: Promise<MiraCultureMemory> | null = null;

// ─── MiraCultureMemory class ───

export class MiraCultureMemory {
  private db: AgentDB;
  private reasoning: ReturnType<AgentDB['getController']>;

  constructor(db: AgentDB) {
    this.db = db;
    this.reasoning = db.getController('reasoning');
  }

  /**
   * Index a local artist profile for semantic search.
   * Builds a rich text representation of the artist for embedding.
   */
  async indexArtist(
    artistId: string,
    profile: {
      stageName: string;
      city: string;
      state: string;
      bio: string;
      genres: string[];
      professionalType: string;
    },
  ): Promise<void> {
    try {
      const text = [
        `Artist: ${profile.stageName}`,
        `Location: ${profile.city}, ${profile.state}`,
        `Type: ${profile.professionalType || 'musician'}`,
        profile.genres.length > 0 ? `Genres: ${profile.genres.join(', ')}` : '',
        profile.bio || '',
      ]
        .filter(Boolean)
        .join('. ');

      await this.reasoning.storePattern({
        taskType: `artist:${artistId}`,
        approach: text,
        successRate: 1.0,
        tags: ['artist', profile.state, ...profile.genres],
        metadata: { entityId: artistId, entityType: 'artist', ...profile },
      } as ReasoningPattern);
    } catch (err) {
      console.error('[AgentDB] Failed to index artist:', artistId, err);
    }
  }

  /**
   * Semantic search for local artists. Returns ranked artist IDs with scores.
   */
  async searchArtists(
    query: string,
    limit = 10,
  ): Promise<{ id: string; score: number }[]> {
    try {
      const results = await this.reasoning.searchPatterns({
        task: query,
        k: limit * 2, // over-fetch, then filter to artist type
      });

      return (results as ReasoningPattern[])
        .filter(
          (r) =>
            r.taskType?.startsWith('artist:') ||
            (r.tags && r.tags.includes('artist')),
        )
        .slice(0, limit)
        .map((r) => ({
          id: r.taskType?.replace('artist:', '') ?? '',
          score: r.similarity ?? r.successRate ?? 0,
        }))
        .filter((r) => r.id !== '');
    } catch (err) {
      console.error('[AgentDB] Artist search failed:', err);
      return [];
    }
  }

  /**
   * Index a promoter agent profile for semantic search.
   */
  async indexAgent(
    agentId: string,
    profile: {
      displayName: string;
      city: string;
      state: string;
      bio: string;
      genres: string[];
      skills: string[];
    },
  ): Promise<void> {
    try {
      const text = [
        `Agent: ${profile.displayName}`,
        `Location: ${profile.city}, ${profile.state}`,
        profile.skills.length > 0 ? `Skills: ${profile.skills.join(', ')}` : '',
        profile.genres.length > 0 ? `Genres: ${profile.genres.join(', ')}` : '',
        profile.bio || '',
      ]
        .filter(Boolean)
        .join('. ');

      await this.reasoning.storePattern({
        taskType: `agent:${agentId}`,
        approach: text,
        successRate: 1.0,
        tags: ['agent', profile.state, ...profile.genres, ...profile.skills],
        metadata: { entityId: agentId, entityType: 'agent', ...profile },
      } as ReasoningPattern);
    } catch (err) {
      console.error('[AgentDB] Failed to index agent:', agentId, err);
    }
  }

  /**
   * Find the best agents for a campaign by semantic match against description.
   */
  async matchAgentsForCampaign(
    description: string,
    limit = 10,
  ): Promise<{ id: string; score: number }[]> {
    try {
      const results = await this.reasoning.searchPatterns({
        task: description,
        k: limit * 2,
      });

      return (results as ReasoningPattern[])
        .filter(
          (r) =>
            r.taskType?.startsWith('agent:') ||
            (r.tags && r.tags.includes('agent')),
        )
        .slice(0, limit)
        .map((r) => ({
          id: r.taskType?.replace('agent:', '') ?? '',
          score: r.similarity ?? r.successRate ?? 0,
        }))
        .filter((r) => r.id !== '');
    } catch (err) {
      console.error('[AgentDB] Agent matching failed:', err);
      return [];
    }
  }

  /**
   * Store a chat message for context retrieval.
   */
  async storeChatMessage(
    sessionId: string,
    role: string,
    content: string,
  ): Promise<void> {
    try {
      await this.reasoning.storePattern({
        taskType: `chat:${sessionId}`,
        approach: `${role}: ${content}`,
        successRate: 1.0,
        tags: ['chat', role, sessionId],
        metadata: { sessionId, role, content, timestamp: Date.now() },
      } as ReasoningPattern);
    } catch (err) {
      console.error('[AgentDB] Failed to store chat message:', err);
    }
  }

  /**
   * Get relevant chat context by semantic search within a session.
   */
  async getChatContext(
    sessionId: string,
    query: string,
    limit = 10,
  ): Promise<ReasoningPattern[]> {
    try {
      const results = await this.reasoning.searchPatterns({
        task: query,
        k: limit * 2,
      });

      return (results as ReasoningPattern[])
        .filter((r) => r.taskType === `chat:${sessionId}`)
        .slice(0, limit);
    } catch (err) {
      console.error('[AgentDB] Chat context retrieval failed:', err);
      return [];
    }
  }

  /**
   * Store a learned pattern (e.g. successful booking, campaign outcome).
   */
  async learnPattern(
    trigger: string,
    outcome: string,
    success: boolean,
  ): Promise<void> {
    try {
      await this.reasoning.storePattern({
        taskType: 'learned_pattern',
        approach: `${trigger} -> ${outcome}`,
        successRate: success ? 0.9 : 0.3,
        tags: ['pattern', success ? 'success' : 'fail'],
        metadata: { trigger, outcome, success, timestamp: Date.now() },
      } as ReasoningPattern);
    } catch (err) {
      console.error('[AgentDB] Failed to learn pattern:', err);
    }
  }

  /**
   * Get memory system stats (cache, recipe, pattern counts).
   */
  async getStats(): Promise<Record<string, unknown>> {
    try {
      const stats = this.reasoning.getPatternStats();
      return {
        recipe: 'balanced',
        dbPath: DB_PATH,
        ...stats,
      };
    } catch (err) {
      console.error('[AgentDB] Stats retrieval failed:', err);
      return { recipe: 'balanced', dbPath: DB_PATH, error: 'stats unavailable' };
    }
  }

  /**
   * Gracefully close the database connection.
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (err) {
      console.error('[AgentDB] Close failed:', err);
    }
  }
}

// ─── Singleton accessor ───

/**
 * Returns a lazily initialized MiraCultureMemory singleton.
 * The first call triggers initialization; subsequent calls return the same instance.
 * If initialization fails, it logs the error and retries on next call.
 */
export async function getMemory(): Promise<MiraCultureMemory> {
  if (memoryInstance) return memoryInstance;

  if (!initPromise) {
    initPromise = (async () => {
      const config = RECIPES.balanced;

      const db = new AgentDB({
        dbPath: DB_PATH,
        dimension: config.dimension,
        maxElements: config.maxElements,
      });

      await db.initialize();
      console.log(
        `[AgentDB] Initialized: balanced recipe | dim=${config.dimension} | maxElements=${config.maxElements}`,
      );

      const instance = new MiraCultureMemory(db);
      memoryInstance = instance;
      return instance;
    })();

    // If initialization fails, clear the promise so it can be retried
    initPromise.catch((err) => {
      console.error('[AgentDB] Initialization failed:', err);
      initPromise = null;
    });
  }

  return initPromise;
}
