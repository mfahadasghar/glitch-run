import { TILE_SIZE } from '../config/gameConfig';
import { TrapPlacement } from '../generation/TrapPlacer';

export interface LevelJSON {
  name: string;
  platforms: number[][]; // [x, y] grid coordinates
  traps: Array<{
    type: string;
    x: number;
    y: number;
    config?: Record<string, unknown>;
  }>;
  start: { x: number; y: number };
  goal: { x: number; y: number };
  coins: number[][]; // [x, y] grid coordinates
}

export interface LoadedLevel {
  name: string;
  platforms: Array<{ x: number; y: number; width: number; height: number }>;
  traps: TrapPlacement[];
  startX: number;
  startY: number;
  goalX: number;
  goalY: number;
  coins: Array<{ x: number; y: number }>;
}

interface LevelManifest {
  totalLevels: number;
  levels: string[];
}

export class LevelLoader {
  private manifest: LevelManifest | null = null;
  private playedLevels: Set<number> = new Set();
  private currentLevelIndex: number = -1;
  private levelsCompleted: number = 0;
  private isTestMode: boolean = false;
  private testLevel: LevelJSON | null = null;

  /**
   * Initialize the loader by fetching the manifest
   */
  async init(): Promise<void> {
    try {
      const response = await fetch('/levels/manifest.json');
      this.manifest = await response.json();
    } catch (error) {
      console.error('Failed to load level manifest:', error);
      this.manifest = { totalLevels: 0, levels: [] };
    }
  }

  /**
   * Set test mode with a single level
   */
  setTestMode(level: LevelJSON): void {
    this.isTestMode = true;
    this.testLevel = level;
  }

  /**
   * Get total number of levels
   */
  getLevelCount(): number {
    if (this.isTestMode) return 1;
    return this.manifest?.totalLevels || 0;
  }

  /**
   * Get current level number (for display)
   */
  getCurrentLevelNumber(): number {
    return this.levelsCompleted + 1;
  }

  /**
   * Get number of levels completed
   */
  getLevelsCompleted(): number {
    return this.levelsCompleted;
  }

  /**
   * Load a random level that hasn't been played yet
   */
  async getNextLevel(): Promise<LoadedLevel | null> {
    // Test mode - return the test level
    if (this.isTestMode && this.testLevel) {
      if (this.levelsCompleted === 0) {
        this.levelsCompleted++;
        return this.parseLevel(this.testLevel);
      }
      return null;
    }

    if (!this.manifest || this.manifest.totalLevels === 0) {
      return null;
    }

    // If all levels have been played, reset
    if (this.playedLevels.size >= this.manifest.totalLevels) {
      this.playedLevels.clear();
    }

    // Pick a random level that hasn't been played
    const availableLevels: number[] = [];
    for (let i = 0; i < this.manifest.totalLevels; i++) {
      if (!this.playedLevels.has(i)) {
        availableLevels.push(i);
      }
    }

    if (availableLevels.length === 0) {
      return null;
    }

    // Pick random from available
    const randomIndex = Math.floor(Math.random() * availableLevels.length);
    this.currentLevelIndex = availableLevels[randomIndex];
    this.playedLevels.add(this.currentLevelIndex);

    // Load the level
    const level = await this.loadLevelByIndex(this.currentLevelIndex);
    if (level) {
      this.levelsCompleted++;
    }
    return level;
  }

  /**
   * Load a specific level by index
   */
  private async loadLevelByIndex(index: number): Promise<LoadedLevel | null> {
    if (!this.manifest || index < 0 || index >= this.manifest.levels.length) {
      return null;
    }

    try {
      const filename = this.manifest.levels[index];
      const response = await fetch(`/levels/${filename}`);
      const levelData: LevelJSON = await response.json();
      return this.parseLevel(levelData);
    } catch (error) {
      console.error(`Failed to load level ${index}:`, error);
      return null;
    }
  }

  /**
   * Check if there are more levels to play
   */
  hasMoreLevels(): boolean {
    if (this.isTestMode) {
      return this.levelsCompleted === 0;
    }
    // Always has more levels (random selection loops)
    return this.manifest !== null && this.manifest.totalLevels > 0;
  }

  /**
   * Reset the loader
   */
  reset(): void {
    this.playedLevels.clear();
    this.currentLevelIndex = -1;
    this.levelsCompleted = 0;
    this.isTestMode = false;
    this.testLevel = null;
  }

  /**
   * Parse a LevelJSON into LoadedLevel format
   */
  private parseLevel(data: LevelJSON): LoadedLevel {
    // Convert grid platforms to world coordinates
    const platforms = this.groupPlatforms(data.platforms);

    // Convert traps
    const traps: TrapPlacement[] = data.traps.map((trap) => ({
      type: trap.type as TrapPlacement['type'],
      gridX: trap.x,
      gridY: trap.y,
      config: trap.config,
    }));

    // Convert coins
    const coins = data.coins.map(([x, y]) => ({
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
    }));

    return {
      name: data.name,
      platforms,
      traps,
      startX: data.start.x * TILE_SIZE + TILE_SIZE / 2,
      startY: data.start.y * TILE_SIZE + TILE_SIZE / 2,
      goalX: data.goal.x * TILE_SIZE + TILE_SIZE / 2,
      goalY: data.goal.y * TILE_SIZE + TILE_SIZE / 2,
      coins,
    };
  }

  /**
   * Group adjacent platform tiles into rectangles
   */
  private groupPlatforms(tiles: number[][]): Array<{ x: number; y: number; width: number; height: number }> {
    const platforms: Array<{ x: number; y: number; width: number; height: number }> = [];

    // Create a set for quick lookup
    const tileSet = new Set<string>();
    for (const [x, y] of tiles) {
      tileSet.add(`${x},${y}`);
    }

    // Track processed tiles
    const processed = new Set<string>();

    for (const [startX, startY] of tiles) {
      const key = `${startX},${startY}`;
      if (processed.has(key)) continue;

      // Try to expand horizontally
      let width = 1;
      while (tileSet.has(`${startX + width},${startY}`) && !processed.has(`${startX + width},${startY}`)) {
        width++;
      }

      // Mark tiles as processed
      for (let dx = 0; dx < width; dx++) {
        processed.add(`${startX + dx},${startY}`);
      }

      platforms.push({
        x: startX * TILE_SIZE,
        y: startY * TILE_SIZE,
        width: width * TILE_SIZE,
        height: TILE_SIZE,
      });
    }

    return platforms;
  }

  /**
   * Parse a single level directly (for test mode)
   */
  static parseSingleLevel(data: LevelJSON): LoadedLevel {
    const loader = new LevelLoader();
    return loader.parseLevel(data);
  }
}

// Keep for backwards compatibility but mark as deprecated
export const BUNDLED_LEVELS: LevelJSON[] = [];
