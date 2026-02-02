import Phaser from 'phaser';
import { TILE_SIZE, SIZE, sz } from '../config/gameConfig';

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

    // Position everything relative to bottom of cell
    // Cell center is at y=0, bottom is at y=TILE_SIZE/2
    const bottomY = TILE_SIZE / 2;

    const baseWidth = TILE_SIZE * 0.9;
    const baseHeight = TILE_SIZE * 0.15;
    const springWidth = TILE_SIZE * 0.4;
    const springHeight = TILE_SIZE * 0.3;
    const padWidth = TILE_SIZE * 0.8;
    const padHeight = TILE_SIZE * 0.15;

    // Base at bottom of cell
    const baseY = bottomY - baseHeight / 2;
    const base = scene.add.rectangle(0, baseY, baseWidth, baseHeight, 0x666666);
    this.add(base);

    // Spring above base
    const springY = baseY - baseHeight / 2 - springHeight / 2;
    this.spring = scene.add.rectangle(0, springY, springWidth, springHeight, 0xffaa00);
    this.spring.setStrokeStyle(2, 0xff8800);
    this.add(this.spring);

    // Top pad above spring
    const padY = springY - springHeight / 2 - padHeight / 2;
    this.pad = scene.add.rectangle(0, padY, padWidth, padHeight, 0xff6600);
    this.pad.setStrokeStyle(2, 0xff4400);
    this.add(this.pad);

    // Chevron arrow on pad
    const arrowSize = TILE_SIZE * 0.12;
    const arrow = scene.add.triangle(
      0, padY - padHeight / 2 - arrowSize * 0.3,
      -arrowSize, arrowSize,
      arrowSize, arrowSize,
      0, 0,
      0xffff00
    );
    this.add(arrow);

    // Create hitbox at pad position
    this.hitbox = scene.physics.add.sprite(config.x, config.y + padY, 'bounce');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(padWidth, padHeight + TILE_SIZE * 0.1);
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
    const compression = sz(SIZE.COMPRESSION);
    this.gameScene.tweens.add({
      targets: [this.spring, this.pad],
      scaleY: 0.5,
      y: `+=${compression}`,
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
        this.x + (Math.random() - 0.5) * TILE_SIZE * 0.4,
        this.y - TILE_SIZE * 0.2,
        TILE_SIZE * 0.06,
        0xffaa00
      );
      this.gameScene.tweens.add({
        targets: particle,
        y: particle.y - TILE_SIZE * 0.5 - Math.random() * TILE_SIZE * 0.3,
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
