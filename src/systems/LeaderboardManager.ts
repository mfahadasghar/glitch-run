export interface LeaderboardEntry {
  name: string;
  score: number;
  levels: number;
  deaths: number;
  time: number;
  date: string;
}

const STORAGE_KEY = 'junie-glitch-run-leaderboard';
const MAX_ENTRIES = 10;

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.entries = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
      this.entries = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch (e) {
      console.warn('Failed to save leaderboard:', e);
    }
  }

  addEntry(entry: Omit<LeaderboardEntry, 'date'>): number {
    const newEntry: LeaderboardEntry = {
      ...entry,
      date: new Date().toISOString(),
    };

    this.entries.push(newEntry);

    // Sort by score (higher is better)
    this.entries.sort((a, b) => b.score - a.score);

    // Keep only top entries
    this.entries = this.entries.slice(0, MAX_ENTRIES);

    this.save();

    // Return rank (1-indexed, -1 if not in top 10)
    const rank = this.entries.findIndex(
      (e) => e.date === newEntry.date && e.name === newEntry.name && e.score === newEntry.score
    );

    return rank >= 0 ? rank + 1 : -1;
  }

  getEntries(): LeaderboardEntry[] {
    return [...this.entries];
  }

  getTopEntries(count: number = MAX_ENTRIES): LeaderboardEntry[] {
    return this.entries.slice(0, count);
  }

  getRank(score: number): number {
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

  isHighScore(score: number): boolean {
    return this.getRank(score) !== -1;
  }

  clear(): void {
    this.entries = [];
    this.save();
  }

  getHighestScore(): number {
    return this.entries.length > 0 ? this.entries[0].score : 0;
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
