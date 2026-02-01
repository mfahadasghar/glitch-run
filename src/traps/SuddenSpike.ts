import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { TILE_SIZE } from '../config/gameConfig';

export interface SuddenSpikeConfig extends TrapConfig {
  direction?: 'up' | 'down';
  triggerDistance?: number;
}

export class SuddenSpike extends BaseTrap {
  private spikesContainer: Phaser.GameObjects.Container;
  private spikes: Phaser.GameObjects.Triangle[] = [];
  private direction: 'up' | 'down';
  private triggerDistance: number;
  private isExtended: boolean = false;
  private reactionWindow: number = 150; // 0.15s
  private hiddenY: number;
  private extendedY: number;

  constructor(scene: Phaser.Scene, config: SuddenSpikeConfig) {
    super(scene, config);

    this.direction = config.direction || 'up';
    this.triggerDistance = config.triggerDistance || TILE_SIZE * 2.5;

    // Create container for multiple small spikes
    this.spikesContainer = scene.add.container(0, 0);

    // Create 4 small spikes
    const numSpikes = 4;
    const spikeWidth = 5;
    const spikeHeight = 10;
    const spacing = 7;
    const totalWidth = (numSpikes - 1) * spacing + spikeWidth;
    const startX = -totalWidth / 2 + spikeWidth / 2;

    // Small platform base at the bottom
    const baseWidth = totalWidth + 6;
    const baseHeight = 4;
    const baseY = this.direction === 'up' ? spikeHeight / 2 + baseHeight / 2 : -spikeHeight / 2 - baseHeight / 2;
    const base = scene.add.rectangle(0, baseY, baseWidth, baseHeight, 0x333333);
    this.spikesContainer.add(base);

    for (let i = 0; i < numSpikes; i++) {
      const x = startX + i * spacing;
      let spike: Phaser.GameObjects.Triangle;

      if (this.direction === 'up') {
        // Triangle pointing up - black spikes
        spike = scene.add.triangle(x, 0, 0, spikeHeight, spikeWidth / 2, 0, spikeWidth, spikeHeight, 0x000000);
      } else {
        // Triangle pointing down - black spikes
        spike = scene.add.triangle(x, 0, 0, 0, spikeWidth / 2, spikeHeight, spikeWidth, 0, 0x000000);
      }
      this.spikes.push(spike);
      this.spikesContainer.add(spike);
    }

    // Position spikes - extendedY places base on the ground (bottom of tile)
    if (this.direction === 'up') {
      this.hiddenY = TILE_SIZE; // Hidden below
      this.extendedY = TILE_SIZE / 2 - spikeHeight / 2 - baseHeight; // Base sits on ground
    } else {
      this.hiddenY = -TILE_SIZE; // Hidden above
      this.extendedY = -TILE_SIZE / 2 + spikeHeight / 2 + baseHeight;
    }

    this.spikesContainer.setY(this.hiddenY);
    this.spikesContainer.setAlpha(0); // Completely hidden until triggered
    this.add(this.spikesContainer);

    // Create hitbox (initially disabled)
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'spike');
    this.hitbox.setVisible(false);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(totalWidth + spikeWidth, spikeHeight);
    body.enable = false;
  }

  update(player: Player): void {
    if (!this.isActive() || this.isExtended) return;

    // Check proximity (horizontal distance matters more)
    const distanceX = Math.abs(this.x - player.x);
    const distanceY = Math.abs(this.y - player.y);

    if (distanceX < this.triggerDistance && distanceY < TILE_SIZE * 3) {
      this.trigger();
    }
  }

  trigger(): void {
    if (!this.isActive() || this.isExtended) return;

    this.isTriggered = true;
    this.isExtended = true;

    // Warning shake
    this.trapScene.tweens.add({
      targets: this.spikesContainer,
      x: 2,
      duration: 30,
      yoyo: true,
      repeat: 3,
    });

    // Rise from ground after reaction window
    this.trapScene.time.delayedCall(this.reactionWindow, () => {
      if (!this.active) return;
      // Rise animation
      this.trapScene.tweens.add({
        targets: this.spikesContainer,
        y: this.extendedY,
        alpha: 1,
        duration: 80,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Enable hitbox - stays visible permanently
          if (this.hitbox?.body) {
            const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
            body.enable = true;
          }
        },
      });
    });
  }

  reset(): void {
    this.isTriggered = false;
    this.isExtended = false;
    if (!this.active) return;

    this.spikesContainer.setY(this.hiddenY);
    this.spikesContainer.setAlpha(0); // Hidden until triggered again
    this.spikesContainer.setX(0);

    if (this.hitbox?.body) {
      const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
    }
  }
}
