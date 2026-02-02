import Phaser from 'phaser';
import { TILE_SIZE, SIZE, sz } from '../config/gameConfig';

export interface SawbladeConfig {
  x: number;
  y: number;
  radius?: number;
  pathPoints: Array<{ x: number; y: number }>;
  speed?: number;
}

export class Sawblade extends Phaser.GameObjects.Container {
  private blade: Phaser.GameObjects.Container;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private pathPoints: Array<{ x: number; y: number }>;
  private currentPointIndex: number = 0;
  private speed: number;
  private gameScene: Phaser.Scene;
  private radius: number;

  constructor(scene: Phaser.Scene, config: SawbladeConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    this.pathPoints = config.pathPoints;
    this.speed = config.speed || 100;
    this.radius = config.radius || TILE_SIZE * 0.4;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Blade container for rotation (created without adding to scene)
    this.blade = new Phaser.GameObjects.Container(scene, 0, 0);

    // Outer circle - use Graphics for reliable rendering
    const outerGraphics = new Phaser.GameObjects.Graphics(scene);
    outerGraphics.fillStyle(0x888888, 1);
    outerGraphics.fillCircle(0, 0, this.radius);
    outerGraphics.lineStyle(2, 0x666666, 1);
    outerGraphics.strokeCircle(0, 0, this.radius);
    this.blade.add(outerGraphics);

    // Inner circle
    const innerGraphics = new Phaser.GameObjects.Graphics(scene);
    innerGraphics.fillStyle(0x444444, 1);
    innerGraphics.fillCircle(0, 0, this.radius * 0.3);
    this.blade.add(innerGraphics);

    // Teeth (8 triangular teeth)
    const teethGraphics = new Phaser.GameObjects.Graphics(scene);
    teethGraphics.fillStyle(0xaaaaaa, 1);
    const numTeeth = 8;
    const toothExtend = this.radius * 0.35;
    const toothInset = sz(SIZE.SAW_TOOTH_INSET);
    for (let i = 0; i < numTeeth; i++) {
      const angle = (i / numTeeth) * Math.PI * 2;

      // Draw tooth as triangle pointing outward
      const tipX = Math.cos(angle) * (this.radius + toothExtend);
      const tipY = Math.sin(angle) * (this.radius + toothExtend);
      const leftX = Math.cos(angle - 0.3) * (this.radius - toothInset);
      const leftY = Math.sin(angle - 0.3) * (this.radius - toothInset);
      const rightX = Math.cos(angle + 0.3) * (this.radius - toothInset);
      const rightY = Math.sin(angle + 0.3) * (this.radius - toothInset);

      teethGraphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    }
    this.blade.add(teethGraphics);

    this.add(this.blade);

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'sawblade');
    this.hitbox.setVisible(false);
    this.hitbox.setCircle(this.radius - toothInset);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    // Continuous rotation animation
    scene.tweens.add({
      targets: this.blade,
      angle: 360,
      duration: 500,
      repeat: -1,
      ease: 'Linear',
    });

    this.setDepth(4);

    // Start moving along path
    this.moveToNextPoint();
  }

  private moveToNextPoint(): void {
    if (this.pathPoints.length < 2) return;

    const targetPoint = this.pathPoints[this.currentPointIndex];
    const distance = Phaser.Math.Distance.Between(
      this.x, this.y,
      targetPoint.x, targetPoint.y
    );
    const duration = (distance / this.speed) * 1000;

    this.gameScene.tweens.add({
      targets: [this, this.hitbox],
      x: targetPoint.x,
      y: targetPoint.y,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.currentPointIndex = (this.currentPointIndex + 1) % this.pathPoints.length;
        this.moveToNextPoint();
      },
    });
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  destroy(fromScene?: boolean): void {
    this.gameScene.tweens.killTweensOf(this);
    this.gameScene.tweens.killTweensOf(this.hitbox);
    this.gameScene.tweens.killTweensOf(this.blade);
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
