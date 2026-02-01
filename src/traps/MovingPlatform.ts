import Phaser from 'phaser';
import { TILE_SIZE } from '../config/gameConfig';

export interface MovingPlatformConfig {
  x: number;
  y: number;
  width?: number;
  direction: 'horizontal' | 'vertical';
  distance: number;
  speed?: number;
  color?: number;
}

export class MovingPlatform extends Phaser.GameObjects.Container {
  private platform: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private startX: number;
  private startY: number;
  private direction: 'horizontal' | 'vertical';
  private distance: number;
  private speed: number;
  private movingForward: boolean = true;

  constructor(scene: Phaser.Scene, config: MovingPlatformConfig) {
    super(scene, config.x, config.y);

    this.startX = config.x;
    this.startY = config.y;
    this.direction = config.direction;
    this.distance = config.distance;
    this.speed = config.speed || 80;

    scene.add.existing(this);

    const width = config.width || TILE_SIZE * 3;
    const height = TILE_SIZE;
    const color = config.color || 0x4a6a4a;

    // Platform visual
    this.platform = scene.add.rectangle(0, 0, width, height, color);
    this.platform.setStrokeStyle(2, 0x3a5a3a);
    this.add(this.platform);

    // Arrow indicators
    if (this.direction === 'horizontal') {
      const arrowLeft = scene.add.triangle(-width/2 + 10, 0, 0, 0, 8, -5, 8, 5, 0x2a4a2a);
      const arrowRight = scene.add.triangle(width/2 - 10, 0, 0, -5, 0, 5, 8, 0, 0x2a4a2a);
      this.add(arrowLeft);
      this.add(arrowRight);
    } else {
      const arrowUp = scene.add.triangle(0, -height/2 + 8, -5, 0, 5, 0, 0, -8, 0x2a4a2a);
      const arrowDown = scene.add.triangle(0, height/2 - 8, -5, 0, 5, 0, 0, 8, 0x2a4a2a);
      this.add(arrowUp);
      this.add(arrowDown);
    }

    // Create physics hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'platform');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(width, height);
    this.hitbox.setImmovable(true);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.setDepth(2);
  }

  update(): void {
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;

    if (this.direction === 'horizontal') {
      if (this.movingForward) {
        body.setVelocityX(this.speed);
        if (this.hitbox.x >= this.startX + this.distance) {
          this.movingForward = false;
        }
      } else {
        body.setVelocityX(-this.speed);
        if (this.hitbox.x <= this.startX) {
          this.movingForward = true;
        }
      }
    } else {
      if (this.movingForward) {
        body.setVelocityY(this.speed);
        if (this.hitbox.y >= this.startY + this.distance) {
          this.movingForward = false;
        }
      } else {
        body.setVelocityY(-this.speed);
        if (this.hitbox.y <= this.startY) {
          this.movingForward = true;
        }
      }
    }

    // Sync visual with hitbox
    this.setPosition(this.hitbox.x, this.hitbox.y);
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  destroy(fromScene?: boolean): void {
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
