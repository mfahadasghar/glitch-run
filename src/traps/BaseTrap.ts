import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface TrapConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: number;
}

export abstract class BaseTrap extends Phaser.GameObjects.Container {
  protected isArmed: boolean = true;
  protected isTriggered: boolean = false;
  protected warningDuration: number = 100; // 0.1s warning flash
  protected trapScene: Phaser.Scene;
  protected hitbox: Phaser.Physics.Arcade.Sprite | null = null;

  constructor(scene: Phaser.Scene, config: TrapConfig) {
    super(scene, config.x, config.y);
    this.trapScene = scene;
    scene.add.existing(this);
  }

  abstract trigger(player: Player): void;
  abstract reset(): void;

  arm(): void {
    this.isArmed = true;
  }

  disarm(): void {
    this.isArmed = false;
  }

  isActive(): boolean {
    return this.isArmed && !this.isTriggered;
  }

  protected showWarning(): void {
    // Flash warning before activation
    this.trapScene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: this.warningDuration / 2,
      yoyo: true,
      repeat: 1,
    });
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite | null {
    return this.hitbox;
  }

  destroy(fromScene?: boolean): void {
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
