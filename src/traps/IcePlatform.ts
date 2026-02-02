import Phaser from 'phaser';
import { TILE_SIZE, SIZE, sz } from '../config/gameConfig';

export interface IcePlatformConfig {
  x: number;
  y: number;
  width?: number;
}

export class IcePlatform extends Phaser.GameObjects.Container {
  private platform: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private platformWidth: number;

  constructor(scene: Phaser.Scene, config: IcePlatformConfig) {
    super(scene, config.x, config.y);

    this.platformWidth = config.width || TILE_SIZE;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Ice platform with glossy look
    this.platform = scene.add.rectangle(0, 0, this.platformWidth, TILE_SIZE, 0x88ddff);
    this.platform.setStrokeStyle(2, 0x66bbdd);
    this.add(this.platform);

    // Shine effect
    const shineOffset = sz(SIZE.ICE_SHINE_OFFSET);
    const shineHeight = sz(SIZE.ICE_SHINE_HEIGHT);
    const shine1 = scene.add.rectangle(0, -shineOffset, this.platformWidth * 0.6, shineHeight, 0xffffff, 0.5);
    this.add(shine1);

    // Create physics hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'ice');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(this.platformWidth, TILE_SIZE);
    this.hitbox.setImmovable(true);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    // Subtle shimmer animation
    scene.tweens.add({
      targets: shine1,
      alpha: 0.2,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    this.setDepth(2);
  }

  isPlayerOnPlatform(player: Phaser.Physics.Arcade.Sprite): boolean {
    const playerBody = player.body as Phaser.Physics.Arcade.Body;

    // Check if player is blocked below (standing on something)
    if (!playerBody.blocked.down && !playerBody.touching.down) {
      return false;
    }

    // Check horizontal overlap with platform
    const platformLeft = this.x - this.platformWidth / 2;
    const platformRight = this.x + this.platformWidth / 2;
    const playerLeft = player.x - playerBody.width / 2;
    const playerRight = player.x + playerBody.width / 2;

    const horizontalOverlap = playerRight > platformLeft && playerLeft < platformRight;
    if (!horizontalOverlap) {
      return false;
    }

    // Check if player's feet are near the platform top
    // Platform top is at this.y - TILE_SIZE / 2
    // Player bottom is at player.y + playerBody.halfHeight
    const platformTop = this.y - TILE_SIZE / 2;
    const playerBottom = player.y + playerBody.halfHeight;
    const verticalDistance = Math.abs(playerBottom - platformTop);

    // Allow generous margin for detection
    return verticalDistance < 20;
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
