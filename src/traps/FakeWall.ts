import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';

export class FakeWall extends BaseTrap {
  private wall: Phaser.GameObjects.Sprite;
  private revealed: boolean = false;

  constructor(scene: Phaser.Scene, config: TrapConfig) {
    super(scene, config);

    // Create fake wall that looks solid
    this.wall = scene.add.sprite(0, 0, 'fake-wall');
    this.add(this.wall);

    // No physical hitbox - player passes through
    // We use overlap detection in the game scene
  }

  trigger(): void {
    if (this.revealed) return;

    this.revealed = true;

    // Fade out effect to show it's fake
    this.trapScene.tweens.add({
      targets: this.wall,
      alpha: 0.3,
      duration: 200,
    });
  }

  reset(): void {
    // Kill any active tweens
    this.trapScene.tweens.killTweensOf(this.wall);

    this.revealed = false;
    this.wall.setAlpha(1);
  }

  isRevealed(): boolean {
    return this.revealed;
  }
}
