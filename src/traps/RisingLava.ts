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
  private surfaceY: number; // The deadly surface position (top of lava)

  constructor(scene: Phaser.Scene, config: RisingLavaConfig = {}) {
    super(scene, 0, 0);

    this.gameScene = scene;
    this.speed = config.speed || 30;
    this.delay = config.delay || 3000;
    this.maxHeight = config.maxHeight || GAME_HEIGHT * 0.7;
    this.surfaceY = GAME_HEIGHT + 50; // Start below screen

    scene.add.existing(this);

    // Create lava body - very tall, fills from surface down to below screen
    // Origin at top center so top edge is at surfaceY
    this.lava = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT + 50, // Start position
      GAME_WIDTH + 100,
      GAME_HEIGHT * 2, // Very tall to cover everything below
      0xff4500
    );
    this.lava.setOrigin(0.5, 0); // Origin at top center
    this.add(this.lava);

    // Lava surface with brighter color (the deadly top edge)
    const surfaceHeight = sz(SIZE.LAVA_SURFACE_HEIGHT);
    this.lavaSurface = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT + 50,
      GAME_WIDTH + 100,
      surfaceHeight,
      0xffff00,
      0.9
    );
    this.lavaSurface.setOrigin(0.5, 0.5);
    this.add(this.lavaSurface);

    // Add wave effect to surface
    scene.tweens.add({
      targets: this.lavaSurface,
      scaleX: 1.02,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Create bubbles for effect (positioned relative to surface)
    const bubbleMin = sz(SIZE.LAVA_BUBBLE_MIN);
    const bubbleRange = sz(SIZE.LAVA_BUBBLE_MAX);
    for (let i = 0; i < 15; i++) {
      const bubble = scene.add.circle(
        Math.random() * GAME_WIDTH,
        GAME_HEIGHT + 100, // Will be updated
        bubbleMin + Math.random() * bubbleRange,
        0xffff00,
        0.6
      );
      this.bubbles.push(bubble);
      this.add(bubble);
    }

    // Create hitbox at the surface (deadly edge)
    this.hitbox = scene.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT + 50, 'platform');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(GAME_WIDTH + 100, 30);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setDepth(90);
    this.setAlpha(0);
  }

  private animateBubble(bubble: Phaser.GameObjects.Arc): void {
    const startX = Math.random() * GAME_WIDTH;
    const startY = this.surfaceY + 30 + Math.random() * 100;
    bubble.setPosition(startX, startY);
    bubble.setAlpha(0.6);

    this.gameScene.tweens.add({
      targets: bubble,
      y: this.surfaceY - 30,
      alpha: 0,
      duration: 800 + Math.random() * 800,
      onComplete: () => {
        if (this.isActive) {
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

      // Start animating bubbles
      this.bubbles.forEach((bubble) => this.animateBubble(bubble));
    });
  }

  update(): void {
    if (!this.isActive) return;

    // Rise up - move surface toward top of screen
    const targetY = GAME_HEIGHT - this.maxHeight;
    if (this.surfaceY > targetY) {
      this.surfaceY -= this.speed * (1 / 60);

      // Update lava body position (top edge at surfaceY)
      this.lava.setY(this.surfaceY);

      // Update surface line position
      this.lavaSurface.setY(this.surfaceY);

      // Update hitbox position
      this.hitbox.y = this.surfaceY;
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
    this.surfaceY = GAME_HEIGHT + 50;
    this.lava.setY(this.surfaceY);
    this.lavaSurface.setY(this.surfaceY);
    this.hitbox.y = this.surfaceY;
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
