import Phaser from 'phaser';
import { TILE_SIZE } from '../config/gameConfig';

export interface BouncePadConfig {
  x: number;
  y: number;
  bouncePower?: number;
}

export class BouncePad extends Phaser.GameObjects.Container {
  private pad: Phaser.GameObjects.Rectangle;
  private spring: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private bouncePower: number;
  private gameScene: Phaser.Scene;
  private isCompressed: boolean = false;

  constructor(scene: Phaser.Scene, config: BouncePadConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    this.bouncePower = config.bouncePower || -700;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Base
    const base = scene.add.rectangle(0, 8, TILE_SIZE * 0.9, 8, 0x666666);
    this.add(base);

    // Spring coils
    this.spring = scene.add.rectangle(0, 2, TILE_SIZE * 0.5, 12, 0xffaa00);
    this.spring.setStrokeStyle(2, 0xff8800);
    this.add(this.spring);

    // Top pad
    this.pad = scene.add.rectangle(0, -6, TILE_SIZE * 0.8, 6, 0xff6600);
    this.pad.setStrokeStyle(1, 0xff4400);
    this.add(this.pad);

    // Chevron arrows on pad
    const arrow1 = scene.add.triangle(0, -8, -6, 4, 6, 4, 0, -2, 0xffff00);
    this.add(arrow1);

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y - 4, 'bounce');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(TILE_SIZE * 0.8, 16);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setDepth(3);
  }

  trigger(player: Phaser.Physics.Arcade.Sprite): void {
    if (this.isCompressed) return;

    this.isCompressed = true;

    // Launch player upward
    player.setVelocityY(this.bouncePower);

    // Compress animation
    this.gameScene.tweens.add({
      targets: [this.spring, this.pad],
      scaleY: 0.3,
      y: '+=8',
      duration: 80,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.isCompressed = false;
      },
    });

    // Play bounce sound
    if (this.gameScene.cache.audio.exists('jump')) {
      this.gameScene.sound.play('jump', { volume: 0.7, rate: 1.5 });
    }

    // Particle effect
    for (let i = 0; i < 6; i++) {
      const particle = this.gameScene.add.circle(
        this.x + (Math.random() - 0.5) * 20,
        this.y - 10,
        3,
        0xffaa00
      );
      this.gameScene.tweens.add({
        targets: particle,
        y: particle.y - 30 - Math.random() * 20,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy(),
      });
    }
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
