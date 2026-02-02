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
    const hitboxBody = this.hitbox.body as Phaser.Physics.Arcade.Body;

    if (!playerBody || !hitboxBody) return false;

    // Player must not be jumping up through the platform
    if (playerBody.velocity.y < -50) {
      return false;
    }

    // Calculate bounds directly from body properties
    const playerLeft = playerBody.x;
    const playerRight = playerBody.x + playerBody.width;
    const playerBottom = playerBody.y + playerBody.height;

    const hitboxLeft = hitboxBody.x;
    const hitboxRight = hitboxBody.x + hitboxBody.width;
    const hitboxTop = hitboxBody.y;

    // Check horizontal overlap
    const horizontalOverlap = playerRight > hitboxLeft && playerLeft < hitboxRight;

    if (!horizontalOverlap) return false;

    // Check if player's bottom is near the platform's top
    const verticalDistance = playerBottom - hitboxTop;

    // Player must be on top of platform:
    // - Small negative distance: player feet slightly above platform (approaching)
    // - Small positive distance: player feet slightly inside platform (standing)
    return verticalDistance >= -5 && verticalDistance <= 20;
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
