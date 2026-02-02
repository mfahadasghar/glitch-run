// Pure constants with no scene imports to avoid circular dependencies
export const TILE_SIZE = 60; // Larger tiles for better visibility
export const GRID_WIDTH = 32; // 1920 / 60 = 32
export const GRID_HEIGHT = 18; // 1080 / 60 = 18
export const GAME_WIDTH = GRID_WIDTH * TILE_SIZE;   // 1920
export const GAME_HEIGHT = GRID_HEIGHT * TILE_SIZE; // 1080

export const PLAYER_CONFIG = {
  gravity: 1200,
  jumpVelocity: -620,
  moveSpeed: 380,
  size: 48,
};

export const SCORE_CONFIG = {
  baseScore: 10000,
  deathPenalty: 500,
  timePenalty: 10,
  levelBonus: 1000,
};

export const SESSION_TIME = 60; // 1 minute in seconds
