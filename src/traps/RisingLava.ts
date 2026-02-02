import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SIZE, sz } from '../config/gameConfig';

export interface RisingLavaConfig {
  speed?: number;
  delay?: number;
  maxHeight?: number;
}

export class RisingLava extends Phaser.GameObjects.Container {
  private lava: Phaser.GameObjects.Rectangle;
  private lavaSurface: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private gameScene: Phaser.Scene;
  private speed: number;
  private delay: number;
  private maxHeight: number;
  private isActive: boolean = false;
  private startTimer: Phaser.Time.TimerEvent | null = null;
  private bubbles: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene, config: RisingLavaConfig = {}) {
    super(scene, GAME_WIDTH / 2, GAME_HEIGHT + 100);

    this.gameScene = scene;
    this.speed = config.speed || 30;
    this.delay = config.delay || 3000;
    this.maxHeight = config.maxHeight || GAME_HEIGHT * 0.7;

    scene.add.existing(this);

    // Create lava body
    const lavaHeight = sz(SIZE.LAVA_HEIGHT);
    this.lava = scene.add.rectangle(0, 0, GAME_WIDTH + 100, lavaHeight, 0xff4500);
    this.add(this.lava);

    // Lava surface with brighter color
    const surfaceHeight = sz(SIZE.LAVA_SURFACE_HEIGHT);
    this.lavaSurface = scene.add.rectangle(0, -lavaHeight / 2, GAME_WIDTH + 100, surfaceHeight, 0xffff00, 0.8);
    this.add(this.lavaSurface);

    // Add wave effect to surface
    scene.tweens.add({
      targets: this.lavaSurface,
      scaleX: 1.02,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Create bubbles for effect
    const bubbleMin = sz(SIZE.LAVA_BUBBLE_MIN);
    const bubbleRange = sz(SIZE.LAVA_BUBBLE_MAX);
    for (let i = 0; i < 10; i++) {
      const bubble = scene.add.circle(
        (Math.random() - 0.5) * GAME_WIDTH,
        Math.random() * lavaHeight / 2 - lavaHeight / 4,
        bubbleMin + Math.random() * bubbleRange,
        0xffff00,
        0.6
      );
      this.bubbles.push(bubble);
      this.add(bubble);

      // Animate bubbles
      this.animateBubble(bubble);
    }

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT + 100, 'platform');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(GAME_WIDTH + 100, 180);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setDepth(90);
    this.setAlpha(0);
  }

  private animateBubble(bubble: Phaser.GameObjects.Arc): void {
    const startX = (Math.random() - 0.5) * GAME_WIDTH;
    bubble.setPosition(startX, 50);

    this.gameScene.tweens.add({
      targets: bubble,
      y: -120,
      alpha: 0,
      duration: 1000 + Math.random() * 1000,
      onComplete: () => {
        if (this.isActive) {
          bubble.setAlpha(0.6);
          this.animateBubble(bubble);
        }
      },
    });
  }

  start(): void {
    if (this.isActive) return;

    // Start after delay (no warning)
    this.startTimer = this.gameScene.time.delayedCall(this.delay, () => {
      this.isActive = true;
      this.setAlpha(1);

      // Re-animate bubbles
      this.bubbles.forEach((bubble) => this.animateBubble(bubble));
    });
  }

  update(): void {
    if (!this.isActive) return;

    // Rise up
    if (this.y > GAME_HEIGHT - this.maxHeight) {
      this.y -= this.speed * (1 / 60);
      this.hitbox.y = this.y;
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

    // Kill bubble tweens
    this.bubbles.forEach((bubble) => {
      this.gameScene.tweens.killTweensOf(bubble);
    });

    this.isActive = false;
    this.y = GAME_HEIGHT + 100;
    this.hitbox.y = GAME_HEIGHT + 100;
    this.setAlpha(0);
  }

  destroy(fromScene?: boolean): void {
    if (this.startTimer) {
      this.startTimer.remove();
    }
    this.bubbles.forEach((bubble) => {
      this.gameScene.tweens.killTweensOf(bubble);
    });
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
