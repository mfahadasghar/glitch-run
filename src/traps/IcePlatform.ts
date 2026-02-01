import Phaser from 'phaser';
import { TILE_SIZE } from '../config/gameConfig';

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
    const shine1 = scene.add.rectangle(0, -4, this.platformWidth * 0.6, 4, 0xffffff, 0.5);
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

    // Check if player is standing on this platform
    return playerBody.blocked.down &&
      player.x >= this.x - this.platformWidth / 2 - 10 &&
      player.x <= this.x + this.platformWidth / 2 + 10 &&
      Math.abs(player.y + playerBody.height / 2 - (this.y - TILE_SIZE / 2)) < 10;
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
