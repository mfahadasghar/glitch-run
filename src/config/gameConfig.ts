import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { NameEntryScene } from '../scenes/NameEntryScene';
import { GameScene } from '../scenes/GameScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { LeaderboardScene } from '../scenes/LeaderboardScene';
import { LevelEditorScene } from '../scenes/LevelEditorScene';
import { LevelLibraryScene } from '../scenes/LevelLibraryScene';

// Re-export constants for backward compatibility
export {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  PLAYER_CONFIG,
  SCORE_CONFIG,
  SESSION_TIME,
} from './constants';

import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, PLAYER_CONFIG } from './constants';

// Trap element ratios (multiply by TILE_SIZE)
export const SIZE = {
  // Spikes
  SPIKE_WIDTH: 0.083,
  SPIKE_HEIGHT: 0.167,
  SPIKE_SPACING: 0.117,
  SPIKE_BASE_HEIGHT: 0.067,

  // MirrorEnemy
  ENEMY_BODY: 0.6,
  ENEMY_EYE: 0.1,
  ENEMY_EYE_OFFSET: 0.125,
  ENEMY_GLOW: 0.75,
  ENEMY_HITBOX: 0.5,

  // TeleportTrap
  TELEPORT_OUTER: 0.23,
  TELEPORT_INNER: 0.13,
  TELEPORT_CENTER: 0.05,
  TELEPORT_HITBOX: 0.2,
  TELEPORT_EXIT_OUTER: 0.17,
  TELEPORT_EXIT_CENTER: 0.067,
  TELEPORT_FLASH: 0.27,
  TELEPORT_FLASH_IN: 0.4,

  // CrushingBlock
  CRUSH_STRIPE_WIDTH: 0.13,
  CRUSH_STRIPE_SPACING: 0.33,
  CRUSH_SPIKE_HEIGHT: 0.2,
  CRUSH_SPIKE_WIDTH: 0.1,

  // Goals
  GOAL_PADDING: 0.13,
  GOAL_SHINE_WIDTH: 0.13,
  GOAL_HANDLE_RADIUS: 0.05,
  GOAL_SHINE_OFFSET: 0.1,
  GOAL_HANDLE_OFFSET_X: 0.13,
  GOAL_HANDLE_OFFSET_Y: 0.067,

  // LaserBeam
  LASER_EMITTER_W: 0.33,
  LASER_EMITTER_H: 0.2,
  LASER_BEAM_WIDTH: 0.1,
  LASER_LENS_W: 0.167,
  LASER_LENS_H: 0.1,

  // WallOfDeath
  WALL_EDGE_WIDTH: 0.1,

  // RisingLava
  LAVA_HEIGHT: 3.33,
  LAVA_SURFACE_HEIGHT: 0.167,
  LAVA_BUBBLE_MIN: 0.05,
  LAVA_BUBBLE_MAX: 0.083,

  // Sawblade
  SAW_TOOTH_INSET: 0.033,

  // BouncePad
  COMPRESSION: 0.13,

  // CollapsingPlatform
  SHAKE_AMOUNT: 0.033,

  // Player
  DASH_TRAIL: 0.58,
  DUST_OFFSET: 0.3,

  // IcePlatform
  ICE_SHINE_OFFSET: 0.067,
  ICE_SHINE_HEIGHT: 0.067,
  COLLISION_MARGIN: 0.17,
};

// Font ratios (multiply by GAME_HEIGHT)
export const FONT = {
  TITLE_LG: 0.035,    // ~64px
  TITLE_MD: 0.039,    // ~42px
  HEADING: 0.020,     // ~28px
  BODY: 0.019,        // ~21px
  BODY_LG: 0.022,     // ~24px
  CAPTION: 0.014,     // ~15px
  SMALL: 0.017,       // ~18px
  SCORE_LG: 0.05,     // ~54px
  LEVEL_INTRO: 0.059, // ~64px
  TIME_UP: 0.067,     // ~72px
};

// Helper functions
export const sz = (ratio: number): number => Math.round(TILE_SIZE * ratio);
export const font = (ratio: number): string => `${Math.round(GAME_HEIGHT * ratio)}px`;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#3b1fad',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PLAYER_CONFIG.gravity },
      debug: false,
    },
  },
  scene: [BootScene, NameEntryScene, GameScene, GameOverScene, LeaderboardScene, LevelEditorScene, LevelLibraryScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: {
      width: 640,
      height: 360,
    },
    max: {
      width: 1920,
      height: 1080,
    },
  },
};
