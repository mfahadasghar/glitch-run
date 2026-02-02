import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SIZE, sz } from '../config/gameConfig';

export interface WallOfDeathConfig {
  speed?: number;
  delay?: number;
}

export class WallOfDeath extends Phaser.GameObjects.Container {
  private wall: Phaser.GameObjects.Rectangle;
  private edgeLine: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private gameScene: Phaser.Scene;
  private speed: number;
  private delay: number;
  private isActive: boolean = false;
  private startTimer: Phaser.Time.TimerEvent | null = null;
  private edgeX: number = -10; // The deadly edge position

  constructor(scene: Phaser.Scene, config: WallOfDeathConfig = {}) {
    super(scene, 0, 0);

    this.gameScene = scene;
    this.speed = config.speed || 60;
    this.delay = config.delay || 2000;

    scene.add.existing(this);

    // Create the black wipe - very wide to cover everything behind the edge
    this.wall = scene.add.rectangle(
      -GAME_WIDTH, // Start off-screen
      GAME_HEIGHT / 2,
      GAME_WIDTH * 2, // Very wide
      GAME_HEIGHT + 100,
      0x000000
    );
    this.wall.setOrigin(1, 0.5); // Origin on right edge so it wipes from left
    this.add(this.wall);

    // Red glowing edge line (the deadly front)
    const edgeWidth = sz(SIZE.WALL_EDGE_WIDTH);
    this.edgeLine = scene.add.rectangle(
      -10,
      GAME_HEIGHT / 2,
      edgeWidth,
      GAME_HEIGHT + 100,
      0xff0000,
      0.8
    );
    this.add(this.edgeLine);

    // Pulsing glow effect on edge
    scene.tweens.add({
      targets: this.edgeLine,
      alpha: 0.3,
      scaleX: 1.5,
      duration: 200,
      yoyo: true,
      repeat: -1,
    });

    // Create hitbox at the edge
    this.hitbox = scene.physics.add.sprite(-10, GAME_HEIGHT / 2, 'platform');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(20, GAME_HEIGHT + 100);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setDepth(100);
    this.setAlpha(0);
  }

  start(): void {
    if (this.isActive) return;

    // Start after delay (no warning text)
    this.startTimer = this.gameScene.time.delayedCall(this.delay, () => {
      this.isActive = true;
      this.setAlpha(1);
      this.edgeX = -10;
    });
  }

  update(): void {
    if (!this.isActive) return;

    // Move edge to the right
    this.edgeX += this.speed * (1 / 60);

    // Update wall position (right edge follows edgeX)
    this.wall.setX(this.edgeX);
    this.edgeLine.setX(this.edgeX);
    this.hitbox.x = this.edgeX;

    // Check if wipe has completed
    if (this.edgeX > GAME_WIDTH + 50) {
      this.isActive = false;
    }
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  reset(): void {
    if (this.startTimer) {
      this.startTimer.remove();
      this.startTimer = null;
    }

    this.isActive = false;
    this.edgeX = -10;
    this.wall.setX(-10);
    this.edgeLine.setX(-10);
    this.hitbox.x = -10;
    this.setAlpha(0);
  }

  destroy(fromScene?: boolean): void {
    if (this.startTimer) {
      this.startTimer.remove();
    }
    this.gameScene.tweens.killTweensOf(this.edgeLine);
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
