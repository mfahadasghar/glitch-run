import Phaser from 'phaser';
import { TILE_SIZE } from '../config/gameConfig';

export interface FakeFloorConfig {
  x: number;
  y: number;
  color?: number;
}

export class FakeFloor extends Phaser.GameObjects.Container {
  private floor: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private triggered: boolean = false;
  private gameScene: Phaser.Scene;

  constructor(scene: Phaser.Scene, config: FakeFloorConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    const color = config.color || 0x4a4a6a;

    // Floor that looks exactly like normal platform
    this.floor = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, color);
    this.add(this.floor);

    // Very subtle hint - slightly different shade (barely noticeable)
    const hint = scene.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, color);
    hint.setAlpha(0.9);
    this.add(hint);

    // Create trigger hitbox (NOT a collider - player passes through)
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'fakefloor');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(TILE_SIZE, TILE_SIZE);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setDepth(1);
  }

  trigger(): void {
    if (this.triggered) return;
    this.triggered = true;

    // Floor crumbles away
    this.gameScene.tweens.add({
      targets: this.floor,
      alpha: 0.3,
      duration: 100,
    });

    // Create falling pieces
    for (let i = 0; i < 6; i++) {
      const piece = this.gameScene.add.rectangle(
        this.x + (Math.random() - 0.5) * TILE_SIZE,
        this.y + (Math.random() - 0.5) * TILE_SIZE,
        8 + Math.random() * 8,
        8 + Math.random() * 8,
        0x4a4a6a
      );

      this.gameScene.physics.add.existing(piece);
      const pieceBody = piece.body as Phaser.Physics.Arcade.Body;
      pieceBody.setVelocity(
        (Math.random() - 0.5) * 100,
        -50 + Math.random() * 50
      );

      this.gameScene.tweens.add({
        targets: piece,
        alpha: 0,
        angle: Math.random() * 360,
        duration: 800,
        onComplete: () => piece.destroy(),
      });
    }

    // Hide after a short delay
    this.gameScene.time.delayedCall(150, () => {
      this.setVisible(false);
    });
  }

  isTriggered(): boolean {
    return this.triggered;
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  reset(): void {
    this.triggered = false;
    this.setVisible(true);
    this.floor.setAlpha(1);
  }

  destroy(fromScene?: boolean): void {
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
