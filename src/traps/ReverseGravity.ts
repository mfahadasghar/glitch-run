import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { TILE_SIZE } from '../config/gameConfig';

export interface ReverseGravityConfig extends TrapConfig {
  duration?: number;
}

export class ReverseGravity extends BaseTrap {
  private pad: Phaser.GameObjects.Container;
  private gravityDuration: number;
  private cooldown: boolean = false;
  private glowEffect: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, config: ReverseGravityConfig) {
    super(scene, config);

    this.gravityDuration = config.duration || 2000;

    // Create a small ground pad (sits on floor)
    this.pad = scene.add.container(0, 0);

    const baseHeight = TILE_SIZE * 0.15;
    const glowHeight = TILE_SIZE * 0.08;

    // Base pad - small rectangle on ground
    const base = scene.add.rectangle(0, 0, TILE_SIZE * 0.8, baseHeight, 0x1a1a3a);
    base.setStrokeStyle(2, 0x00bfff);
    this.pad.add(base);

    // Glowing top surface
    this.glowEffect = scene.add.rectangle(0, -baseHeight * 0.3, TILE_SIZE * 0.7, glowHeight, 0x00bfff, 0.6);
    this.pad.add(this.glowEffect);

    // Small arrow indicator
    const arrowSize = TILE_SIZE * 0.15;
    const arrow = scene.add.triangle(0, -TILE_SIZE * 0.2, 0, arrowSize, -arrowSize * 0.6, -arrowSize * 0.3, arrowSize * 0.6, -arrowSize * 0.3, 0x00bfff, 0.8);
    this.pad.add(arrow);

    this.add(this.pad);

    // Pulsing glow animation
    scene.tweens.add({
      targets: this.glowEffect,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Arrow bounce animation
    scene.tweens.add({
      targets: arrow,
      y: -TILE_SIZE * 0.28,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Create hitbox - small area on the pad
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'platform');
    this.hitbox.setVisible(false);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.3);
  }

  trigger(player: Player): void {
    if (!this.isActive() || this.cooldown) return;

    this.isTriggered = true;
    this.cooldown = true;

    // Visual feedback - bright flash
    this.glowEffect.setFillStyle(0x00ffff, 1);
    this.trapScene.time.delayedCall(200, () => {
      if (this.active) {
        this.glowEffect.setFillStyle(0x00bfff, 0.6);
      }
    });

    // Flip player's gravity
    player.flipGravity(this.gravityDuration);

    // Subtle screen effect
    this.trapScene.cameras.main.flash(80, 0, 191, 255, false);

    // Cooldown
    this.trapScene.time.delayedCall(this.gravityDuration + 500, () => {
      this.cooldown = false;
      this.isTriggered = false;
    });
  }

  reset(): void {
    // Kill any active tweens
    this.trapScene.tweens.killTweensOf(this.pad);
    this.trapScene.tweens.killTweensOf(this.glowEffect);

    this.isTriggered = false;
    this.cooldown = false;

    // Restore glow effect to default
    this.glowEffect.setFillStyle(0x00bfff, 0.6);
  }
}
