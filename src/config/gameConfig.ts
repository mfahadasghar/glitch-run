import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { NameEntryScene } from '../scenes/NameEntryScene';
import { GameScene } from '../scenes/GameScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { LeaderboardScene } from '../scenes/LeaderboardScene';
import { LevelEditorScene } from '../scenes/LevelEditorScene';

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

import { GAME_WIDTH, GAME_HEIGHT, PLAYER_CONFIG } from './constants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: PLAYER_CONFIG.gravity },
      debug: false,
    },
  },
  scene: [BootScene, NameEntryScene, GameScene, GameOverScene, LeaderboardScene, LevelEditorScene],
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
