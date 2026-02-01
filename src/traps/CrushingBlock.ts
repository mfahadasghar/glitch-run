import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { TILE_SIZE, GAME_HEIGHT } from '../config/gameConfig';

export interface CrushingBlockConfig extends TrapConfig {
  triggerWidth?: number;
}

export class CrushingBlock extends BaseTrap {
  private block: Phaser.GameObjects.Container;
  private originalY: number;
  private triggerWidth: number;
  private isFalling: boolean = false;
  private isRevealed: boolean = false;

  constructor(scene: Phaser.Scene, config: CrushingBlockConfig) {
    super(scene, config);

    this.originalY = config.y;
    this.triggerWidth = config.triggerWidth || TILE_SIZE * 2;

    // Create crushing block container
    this.block = scene.add.container(0, 0);

    // Main block body
    const body = scene.add.rectangle(0, 0, TILE_SIZE * 2, TILE_SIZE * 1.5, 0x4a4a5a);
    body.setStrokeStyle(2, 0x3a3a4a);
    this.block.add(body);

    // Danger stripes
    for (let i = 0; i < 3; i++) {
      const stripe = scene.add.rectangle(-20 + i * 20, 0, 8, TILE_SIZE * 1.2, 0xe94560);
      this.block.add(stripe);
    }

    // Spikes at bottom
    for (let i = 0; i < 3; i++) {
      const spike = scene.add.triangle(-20 + i * 20, TILE_SIZE * 0.75 + 8, 0, 0, -6, -12, 6, -12, 0xc0c0c0);
      spike.setRotation(Math.PI);
      this.block.add(spike);
    }

    this.add(this.block);

    // Start hidden (in ceiling)
    this.setAlpha(0);

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'platform');
    this.hitbox.setVisible(false);
    const hitboxBody = this.hitbox.body as Phaser.Physics.Arcade.Body;
    hitboxBody.setAllowGravity(false);
    hitboxBody.setImmovable(true);
    hitboxBody.setSize(TILE_SIZE * 2, TILE_SIZE * 1.5 + 16);
  }

  update(player: Player): void {
    if (!this.isActive() || this.isFalling) return;

    // Check if player is below
    const withinXRange = Math.abs(player.x - this.x) < this.triggerWidth;
    const playerBelow = player.y > this.y + TILE_SIZE;

    if (withinXRange && playerBelow && !this.isRevealed) {
      this.trigger();
    }
  }

  trigger(): void {
    if (!this.isActive() || this.isFalling) return;

    this.isTriggered = true;
    this.isRevealed = true;
    this.isFalling = true;

    // Reveal the block quickly
    this.trapScene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 100,
    });

    // Brief shake warning
    this.trapScene.tweens.add({
      targets: this.block,
      x: 3,
      duration: 40,
      yoyo: true,
      repeat: 2,
    });

    // Fall after brief warning
    this.trapScene.time.delayedCall(150, () => {
      if (!this.active) return;

      // Fast fall
      this.trapScene.tweens.add({
        targets: [this, this.hitbox],
        y: GAME_HEIGHT + 50,
        duration: 350,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // Reset after falling
          this.trapScene.time.delayedCall(1500, () => {
            if (!this.active) return;
            this.reset();
          });
        },
      });
    });
  }

  reset(): void {
    this.isTriggered = false;
    this.isFalling = false;
    this.isRevealed = false;
    if (!this.active) return;

    this.setPosition(this.x, this.originalY);
    this.setAlpha(0); // Hidden again
    this.block.setX(0); // Reset shake offset

    if (this.hitbox) {
      this.hitbox.setPosition(this.x, this.originalY);
    }
  }
}
