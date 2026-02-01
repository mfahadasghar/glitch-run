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

export class LevelLoader {
  private levels: LevelJSON[] = [];
  private currentIndex: number = 0;

  /**
   * Load levels from an array of level data (for bundled levels)
   */
  loadFromArray(levelsData: LevelJSON[]): void {
    this.levels = levelsData;
    this.currentIndex = 0;
  }

  /**
   * Add a single level
   */
  addLevel(level: LevelJSON): void {
    this.levels.push(level);
  }

  /**
   * Get total number of levels
   */
  getLevelCount(): number {
    return this.levels.length;
  }

  /**
   * Get current level index (1-based for display)
   */
  getCurrentLevelNumber(): number {
    return this.currentIndex + 1;
  }

  /**
   * Load and parse a specific level by index
   */
  getLevel(index: number): LoadedLevel | null {
    if (index < 0 || index >= this.levels.length) {
      return null;
    }

    const levelData = this.levels[index];
    return this.parseLevel(levelData);
  }

  /**
   * Get current level and advance to next
   */
  getNextLevel(): LoadedLevel | null {
    const level = this.getLevel(this.currentIndex);
    if (level) {
      this.currentIndex++;
    }
    return level;
  }

  /**
   * Check if there are more levels
   */
  hasMoreLevels(): boolean {
    return this.currentIndex < this.levels.length;
  }

  /**
   * Reset to first level
   */
  reset(): void {
    this.currentIndex = 0;
  }

  /**
   * Parse a LevelJSON into LoadedLevel format
   */
  private parseLevel(data: LevelJSON): LoadedLevel {
    // Convert grid platforms to world coordinates
    // Group adjacent platforms into larger rectangles for efficiency
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
    // For simplicity, create individual tile platforms
    // A more advanced implementation could merge adjacent tiles
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
   * Load level directly from a LevelJSON object (for test mode)
   */
  static parseSingleLevel(data: LevelJSON): LoadedLevel {
    const loader = new LevelLoader();
    return loader.parseLevel(data);
  }
}

// Bundled levels - these are the default levels
export const BUNDLED_LEVELS: LevelJSON[] = [
  // Level 1: Tutorial - Basic movement
  {
    name: "Welcome to Hell",
    platforms: [
      // Starting platform
      [2,11], [3,11], [4,11], [5,11], [6,11], [7,11],
      // Middle platforms
      [12,11], [13,11], [14,11], [15,11],
      [20,9], [21,9], [22,9],
      [27,11], [28,11], [29,11], [30,11],
      // End platform
      [35,11], [36,11], [37,11], [38,11], [39,11], [40,11],
    ],
    traps: [
      // Simple spikes to introduce danger
      { type: "spike", x: 14, y: 10, config: { direction: "up" } },
      { type: "spike", x: 28, y: 10, config: { direction: "up" } },
    ],
    start: { x: 3, y: 10 },
    goal: { x: 38, y: 10 },
    coins: [[10, 10], [25, 8], [33, 10]],
  },

  // Level 2: Gravity Trap
  {
    name: "Look Up!",
    platforms: [
      // Floor sections
      [2,11], [3,11], [4,11], [5,11], [6,11],
      [10,11], [11,11], [12,11], [13,11], [14,11], [15,11],
      [20,11], [21,11], [22,11], [23,11],
      [30,11], [31,11], [32,11], [33,11], [34,11], [35,11],
    ],
    traps: [
      // Gravity zone with ceiling spike - classic gotcha!
      { type: "gravity", x: 12, y: 10 },
      { type: "gravity", x: 13, y: 10 },
      { type: "spike", x: 12, y: 2, config: { direction: "down" } },
      { type: "spike", x: 13, y: 2, config: { direction: "down" } },
      // Another spike for variety
      { type: "spike", x: 21, y: 10, config: { direction: "up" } },
    ],
    start: { x: 3, y: 10 },
    goal: { x: 33, y: 10 },
    coins: [[8, 10], [18, 10], [28, 10]],
  },

  // Level 3: Fake Floor Introduction
  {
    name: "Trust Issues",
    platforms: [
      // Start
      [2,11], [3,11], [4,11], [5,11],
      // Long platform with fake sections
      [8,11], [9,11], [10,11], [11,11], [12,11], [13,11], [14,11], [15,11],
      [16,11], [17,11], [18,11], [19,11], [20,11], [21,11],
      // End
      [25,11], [26,11], [27,11], [28,11], [29,11],
    ],
    traps: [
      // Fake floors in the middle - look safe but aren't!
      { type: "fakefloor", x: 11, y: 11 },
      { type: "fakefloor", x: 17, y: 11 },
      // Spikes below fake floors
      { type: "spike", x: 11, y: 13, config: { direction: "up" } },
      { type: "spike", x: 17, y: 13, config: { direction: "up" } },
    ],
    start: { x: 3, y: 10 },
    goal: { x: 27, y: 10 },
    coins: [[7, 10], [14, 10], [23, 10]],
  },

  // Level 4: The Safe Spot
  {
    name: "The Safe Spot",
    platforms: [
      // Start
      [2,11], [3,11], [4,11], [5,11],
      // Platform with spike trap
      [10,11], [11,11], [12,11], [13,11], [14,11], [15,11], [16,11],
      // End
      [22,11], [23,11], [24,11], [25,11], [26,11],
    ],
    traps: [
      // Two spikes with "safe" middle that's fake!
      { type: "spike", x: 11, y: 10, config: { direction: "up" } },
      { type: "spike", x: 15, y: 10, config: { direction: "up" } },
      { type: "fakefloor", x: 13, y: 11 }, // The "safe" spot is a trap!
    ],
    start: { x: 3, y: 10 },
    goal: { x: 24, y: 10 },
    coins: [[8, 10], [19, 10]],
  },

  // Level 5: Bounce Trap
  {
    name: "Spring Loaded Surprise",
    platforms: [
      // Start
      [2,11], [3,11], [4,11], [5,11], [6,11],
      // Middle
      [12,11], [13,11], [14,11], [15,11],
      // End
      [25,11], [26,11], [27,11], [28,11], [29,11],
    ],
    traps: [
      // Bounce pad that sends you into ceiling spikes
      { type: "bounce", x: 13, y: 10 },
      { type: "spike", x: 13, y: 2, config: { direction: "down" } },
      { type: "spike", x: 14, y: 2, config: { direction: "down" } },
      // Crushing block for extra fun
      { type: "crushing", x: 20, y: 2 },
    ],
    start: { x: 3, y: 10 },
    goal: { x: 27, y: 10 },
    coins: [[9, 10], [22, 10]],
  },
];
