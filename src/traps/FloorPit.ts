import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { TILE_SIZE } from '../config/gameConfig';

export interface FloorPitConfig extends TrapConfig {
  width?: number; // Width in tiles
}

export class FloorPit extends BaseTrap {
  private cover: Phaser.GameObjects.Rectangle;
  private pitWidth: number;
  private isOpen: boolean = false;
  private triggerDistance: number = TILE_SIZE * 2;

  constructor(scene: Phaser.Scene, config: FloorPitConfig) {
    super(scene, config);

    this.pitWidth = (config.width || 2) * TILE_SIZE;

    // Create the floor cover (looks like normal floor)
    this.cover = scene.add.rectangle(0, 0, this.pitWidth, TILE_SIZE, 0x4a4a6a);
    this.cover.setStrokeStyle(2, 0x3d3d5c);
    this.add(this.cover);

    // Warning cracks
    const cracks = scene.add.graphics();
    cracks.lineStyle(1, 0x2a2a3a, 0.5);
    cracks.beginPath();
    cracks.moveTo(-this.pitWidth / 4, -TILE_SIZE / 2);
    cracks.lineTo(-this.pitWidth / 6, TILE_SIZE / 2);
    cracks.moveTo(this.pitWidth / 4, -TILE_SIZE / 2);
    cracks.lineTo(this.pitWidth / 3, TILE_SIZE / 2);
    cracks.stroke();
    this.add(cracks);

    // No hitbox initially - pit is covered
    this.hitbox = null;
  }

  update(player: Player): void {
    if (!this.isActive() || this.isOpen) return;

    const distanceX = Math.abs(this.x - player.x);
    const distanceY = Math.abs(this.y - player.y);

    if (distanceX < this.triggerDistance && distanceY < TILE_SIZE * 2) {
      this.trigger();
    }
  }

  trigger(): void {
    if (!this.isActive() || this.isOpen || this.isTriggered) return;

    this.isTriggered = true;

    // Warning shake
    this.trapScene.tweens.add({
      targets: this.cover,
      y: 2,
      duration: 30,
      yoyo: true,
      repeat: 3,
    });

    // Open the pit after warning
    this.trapScene.time.delayedCall(150, () => {
      if (!this.active) return;

      // Split and fall animation
      this.trapScene.tweens.add({
        targets: this.cover,
        scaleY: 0,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          // Only set isOpen after floor has visually opened
          this.isOpen = true;
        },
      });
    });

    // Close after a while
    this.trapScene.time.delayedCall(3000, () => {
      if (!this.active) return;
      this.closePit();
    });
  }

  private closePit(): void {
    this.trapScene.tweens.add({
      targets: this.cover,
      scaleY: 1,
      alpha: 1,
      duration: 300,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.isOpen = false;
        this.isTriggered = false;
      },
    });
  }

  reset(): void {
    this.isTriggered = false;
    this.isOpen = false;
    if (!this.active) return;

    this.cover.setScale(1);
    this.cover.setAlpha(1);
  }

  isOpenPit(): boolean {
    return this.isOpen;
  }

  getPitBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x - this.pitWidth / 2,
      y: this.y,
      width: this.pitWidth,
      height: TILE_SIZE * 10, // Deep pit
    };
  }
}
