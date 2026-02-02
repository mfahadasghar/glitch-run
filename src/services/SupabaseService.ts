// Supabase Service for Level Management

const SUPABASE_URL = 'https://rfecycusuvmjyxennmls.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWN5Y3VzdXZtanl4ZW5ubWxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTAwMzksImV4cCI6MjA4NTYyNjAzOX0.pQ_V-H55Cfvi4P9yd8VdFgYdIAbiK5g_Y83yB3jmB-8';

export interface LevelRecord {
  id: string;
  name: string;
  creator_name: string;
  level_data: LevelData;
  created_at: string;
  plays: number;
  completions: number;
  total_deaths: number;
  is_approved: boolean;
}

export interface LevelData {
  name: string;
  platforms: number[][];
  traps: Array<{
    type: string;
    x: number;
    y: number;
    config?: Record<string, unknown>;
  }>;
  start: { x: number; y: number };
  goal: { x: number; y: number };
  coins: number[][];
}

export interface PlayStats {
  level_id: string;
  player_name: string;
  completed: boolean;
  deaths: number;
  time_seconds: number;
}

class SupabaseService {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/rest/v1`;
    this.headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  }

  // Validate level JSON structure
  private validateLevel(data: unknown): data is LevelData {
    if (!data || typeof data !== 'object') return false;

    const level = data as Record<string, unknown>;

    // Check required fields
    if (typeof level.name !== 'string') return false;
    if (!Array.isArray(level.platforms)) return false;
    if (!Array.isArray(level.traps)) return false;
    if (!level.start || typeof level.start !== 'object') return false;
    if (!level.goal || typeof level.goal !== 'object') return false;
    if (!Array.isArray(level.coins)) return false;

    // Check start/goal have x, y
    const start = level.start as Record<string, unknown>;
    const goal = level.goal as Record<string, unknown>;
    if (typeof start.x !== 'number' || typeof start.y !== 'number') return false;
    if (typeof goal.x !== 'number' || typeof goal.y !== 'number') return false;

    // Check platforms are valid
    for (const plat of level.platforms) {
      if (!Array.isArray(plat) || plat.length !== 2) return false;
      if (typeof plat[0] !== 'number' || typeof plat[1] !== 'number') return false;
    }

    // Check traps have required fields
    for (const trap of level.traps as Array<Record<string, unknown>>) {
      if (typeof trap.type !== 'string') return false;
      if (typeof trap.x !== 'number' || typeof trap.y !== 'number') return false;
    }

    return true;
  }

  // Publish a new level
  async publishLevel(levelData: LevelData, creatorName: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validate level structure
      if (!this.validateLevel(levelData)) {
        return { success: false, error: 'Invalid level structure' };
      }

      // Check level has minimum content
      if (levelData.platforms.length < 5) {
        return { success: false, error: 'Level must have at least 5 platforms' };
      }

      const body = JSON.stringify({
        name: levelData.name,
        creator_name: creatorName || 'Anonymous',
        level_data: levelData,
      });

      console.log('Publishing to:', `${this.baseUrl}/levels`);
      console.log('Request body:', body);

      const response = await fetch(`${this.baseUrl}/levels`, {
        method: 'POST',
        headers: this.headers,
        body,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error('Publish error response:', error);
        return { success: false, error: `Failed to publish: ${response.status} - ${error}` };
      }

      const result = await response.json();
      return { success: true, id: result[0]?.id };
    } catch (error) {
      console.error('Publish error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get all levels with stats
  async getLevels(orderBy: 'plays' | 'created_at' | 'completions' = 'plays', limit: number = 50): Promise<LevelRecord[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/levels?select=*&order=${orderBy}.desc&limit=${limit}`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch levels');
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Fetch levels error:', error);
      return [];
    }
  }

  // Get a single level by ID
  async getLevel(id: string): Promise<LevelRecord | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/levels?id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) {
        return null;
      }

      const results = await response.json();
      return results[0] || null;
    } catch (error) {
      console.error('Fetch level error:', error);
      return null;
    }
  }

  // Get random levels for normal mode
  async getRandomLevels(count: number = 10): Promise<LevelRecord[]> {
    try {
      // Get all approved levels
      const response = await fetch(
        `${this.baseUrl}/levels?is_approved=eq.true&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) {
        return [];
      }

      const levels: LevelRecord[] = await response.json();

      // Shuffle and return requested count
      const shuffled = levels.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    } catch (error) {
      console.error('Fetch random levels error:', error);
      return [];
    }
  }

  // Record a play attempt
  async recordPlay(stats: PlayStats): Promise<boolean> {
    try {
      // Insert play stats
      const response = await fetch(`${this.baseUrl}/play_stats`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(stats),
      });

      if (!response.ok) {
        console.error('Failed to record play');
        return false;
      }

      // Update level stats
      const level = await this.getLevel(stats.level_id);
      if (level) {
        await fetch(`${this.baseUrl}/levels?id=eq.${stats.level_id}`, {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            plays: level.plays + 1,
            completions: level.completions + (stats.completed ? 1 : 0),
            total_deaths: level.total_deaths + stats.deaths,
          }),
        });
      }

      return true;
    } catch (error) {
      console.error('Record play error:', error);
      return false;
    }
  }

  // Calculate win rate
  getWinRate(level: LevelRecord): number {
    if (level.plays === 0) return 0;
    return Math.round((level.completions / level.plays) * 100);
  }

  // Calculate average deaths
  getAvgDeaths(level: LevelRecord): number {
    if (level.plays === 0) return 0;
    return Math.round(level.total_deaths / level.plays * 10) / 10;
  }

  // ==================== LEADERBOARD ====================

  // Get top leaderboard entries
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/leaderboard?select=*&order=score.desc&limit=${limit}`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch leaderboard');
        return [];
      }

      const data = await response.json();
      return data.map((row: LeaderboardRow) => ({
        name: row.name,
        score: row.score,
        levels: row.levels,
        deaths: row.deaths,
        time: row.time,
        date: row.created_at,
      }));
    } catch (error) {
      console.error('Fetch leaderboard error:', error);
      return [];
    }
  }

  // Add a new leaderboard entry
  async addLeaderboardEntry(entry: Omit<LeaderboardEntry, 'date'>): Promise<{ success: boolean; rank?: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/leaderboard`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: entry.name,
          score: entry.score,
          levels: entry.levels,
          deaths: entry.deaths,
          time: entry.time,
        }),
      });

      if (!response.ok) {
        console.error('Failed to add leaderboard entry');
        return { success: false };
      }

      // Get rank by counting entries with higher score
      const rankResponse = await fetch(
        `${this.baseUrl}/leaderboard?select=id&score=gt.${entry.score}`,
        {
          method: 'GET',
          headers: { ...this.headers, 'Prefer': 'count=exact' },
        }
      );

      let rank = -1;
      if (rankResponse.ok) {
        const countHeader = rankResponse.headers.get('content-range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)/);
          rank = match ? parseInt(match[1]) + 1 : -1;
        }
      }

      return { success: true, rank: rank <= 10 ? rank : -1 };
    } catch (error) {
      console.error('Add leaderboard entry error:', error);
      return { success: false };
    }
  }

  // Check if score qualifies for leaderboard
  async isHighScore(score: number): Promise<boolean> {
    try {
      // Get 10th place score
      const response = await fetch(
        `${this.baseUrl}/leaderboard?select=score&order=score.desc&limit=1&offset=9`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) return true; // Assume qualifies if can't check

      const data = await response.json();
      if (data.length === 0) return true; // Less than 10 entries

      return score > data[0].score;
    } catch (error) {
      console.error('Check high score error:', error);
      return true;
    }
  }

  // Get the current highest score
  async getHighestScore(): Promise<number> {
    try {
      const response = await fetch(
        `${this.baseUrl}/leaderboard?select=score&order=score.desc&limit=1`,
        {
          method: 'GET',
          headers: this.headers,
        }
      );

      if (!response.ok) return 0;

      const data = await response.json();
      return data.length > 0 ? data[0].score : 0;
    } catch (error) {
      console.error('Get highest score error:', error);
      return 0;
    }
  }
}

// Leaderboard types
export interface LeaderboardEntry {
  name: string;
  score: number;
  levels: number;
  deaths: number;
  time: number;
  date: string;
}

interface LeaderboardRow {
  id: string;
  name: string;
  score: number;
  levels: number;
  deaths: number;
  time: number;
  created_at: string;
}

export const supabaseService = new SupabaseService();
