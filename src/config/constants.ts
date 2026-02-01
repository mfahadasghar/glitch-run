// Pure constants with no scene imports to avoid circular dependencies
export const TILE_SIZE = 32;
export const GRID_WIDTH = 40;
export const GRID_HEIGHT = 23;
export const GAME_WIDTH = GRID_WIDTH * TILE_SIZE;   // 1280
export const GAME_HEIGHT = GRID_HEIGHT * TILE_SIZE; // 736

export const PLAYER_CONFIG = {
  gravity: 1000,
  jumpVelocity: -500, // Increased for better platforming (can jump ~4 tiles)
  moveSpeed: 250, // Slightly faster
  size: 24,
};

export const SCORE_CONFIG = {
  baseScore: 10000,
  deathPenalty: 500,
  timePenalty: 10,
  levelBonus: 1000,
};

export const SESSION_TIME = 60; // 1 minute in seconds
