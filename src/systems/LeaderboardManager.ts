import { supabaseService, LeaderboardEntry } from '../services/SupabaseService';

export type { LeaderboardEntry };

const MAX_ENTRIES = 10;

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];
  private loaded: boolean = false;

  constructor() {
    // Don't auto-load - call load() explicitly
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      this.entries = await supabaseService.getLeaderboard(MAX_ENTRIES);
      this.loaded = true;
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
      this.entries = [];
    }
  }

  async addEntry(entry: Omit<LeaderboardEntry, 'date'>): Promise<number> {
    const result = await supabaseService.addLeaderboardEntry(entry);

    if (result.success) {
      // Reload to get updated list
      this.loaded = false;
      await this.load();
      return result.rank || -1;
    }

    return -1;
  }

  getEntries(): LeaderboardEntry[] {
    return [...this.entries];
  }

  getTopEntries(count: number = MAX_ENTRIES): LeaderboardEntry[] {
    return this.entries.slice(0, count);
  }

  async getRank(score: number): Promise<number> {
    // Check against loaded entries first
    for (let i = 0; i < this.entries.length; i++) {
      if (score > this.entries[i].score) {
        return i + 1;
      }
    }

    if (this.entries.length < MAX_ENTRIES) {
      return this.entries.length + 1;
    }

    return -1;
  }

  async isHighScore(score: number): Promise<boolean> {
    return await supabaseService.isHighScore(score);
  }

  async getHighestScore(): Promise<number> {
    if (this.entries.length > 0) {
      return this.entries[0].score;
    }
    return await supabaseService.getHighestScore();
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
