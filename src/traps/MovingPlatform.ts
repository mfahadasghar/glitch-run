import Phaser from 'phaser';
import { TILE_SIZE } from '../config/gameConfig';

export interface MovingPlatformConfig {
  x: number;
  y: number;
  endX: number;
  endY: number;
  width?: number;
  speed?: number;
  color?: number;
  id?: number;
}

export class MovingPlatform extends Phaser.GameObjects.Container {
  private platform: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private startX: number;
  private startY: number;
  private endX: number;
  private endY: number;
  private speed: number;
  private gameScene: Phaser.Scene;
  private movingToEnd: boolean = true;
  private platformWidth: number;
  private platformHeight: number;
  public platformId: number;

  // Track previous position for calculating delta movement
  private prevX: number;
  private prevY: number;

  constructor(scene: Phaser.Scene, config: MovingPlatformConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    this.startX = config.x;
    this.startY = config.y;
    this.endX = config.endX;
    this.endY = config.endY;
    this.speed = config.speed || 80;
    this.prevX = config.x;
    this.prevY = config.y;
    this.platformId = config.id || 0;

    scene.add.existing(this);

    this.platformWidth = config.width || TILE_SIZE * 2;
    this.platformHeight = TILE_SIZE;
    const color = config.color || 0x4a6a4a;

    // Platform visual
    this.platform = scene.add.rectangle(0, 0, this.platformWidth, this.platformHeight, color);
    this.platform.setStrokeStyle(2, 0x3a5a3a);
    this.add(this.platform);

    // Create physics hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'platform');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(this.platformWidth, this.platformHeight);
    this.hitbox.setImmovable(true);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setDepth(2);
  }

  update(): void {
    // Store previous position
    this.prevX = this.x;
    this.prevY = this.y;

    // Calculate direction to target
    const targetX = this.movingToEnd ? this.endX : this.startX;
    const targetY = this.movingToEnd ? this.endY : this.startY;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2) {
      // Reached target, switch direction
      this.movingToEnd = !this.movingToEnd;
      return;
    }

    // Normalize and apply speed
    const moveX = (dx / distance) * this.speed * (1 / 60); // Assuming 60 FPS
    const moveY = (dy / distance) * this.speed * (1 / 60);

    // Move platform
    this.x += moveX;
    this.y += moveY;
    this.hitbox.x = this.x;
    this.hitbox.y = this.y;
  }

  // Get delta movement since last frame (for carrying player/objects)
  getDeltaMovement(): { x: number; y: number } {
    return {
      x: this.x - this.prevX,
      y: this.y - this.prevY,
    };
  }

  // Check if a game object is standing on this platform
  isObjectOnPlatform(obj: Phaser.GameObjects.GameObject & { x: number; y: number; body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null }): boolean {
    if (!obj.body) return false;

    const objBody = obj.body as Phaser.Physics.Arcade.Body;
    const platTop = this.y - this.platformHeight / 2;
    const platLeft = this.x - this.platformWidth / 2;
    const platRight = this.x + this.platformWidth / 2;

    // Check if object is on top of platform
    const objBottom = obj.y + objBody.height / 2;
    const objLeft = obj.x - objBody.width / 2;
    const objRight = obj.x + objBody.width / 2;

    const verticallyAligned = Math.abs(objBottom - platTop) < 10;
    const horizontallyOverlapping = objRight > platLeft && objLeft < platRight;
    const movingDownOrStatic = objBody.velocity.y >= 0;

    return verticallyAligned && horizontallyOverlapping && movingDownOrStatic;
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  getPlatformBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x,
      y: this.y,
      width: this.platformWidth,
      height: this.platformHeight,
    };
  }

  destroy(fromScene?: boolean): void {
    this.gameScene.tweens.killTweensOf(this);
    this.gameScene.tweens.killTweensOf(this.hitbox);
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
