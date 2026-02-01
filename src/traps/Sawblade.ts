import Phaser from 'phaser';

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
    this.radius = config.radius || 16;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Blade container for rotation
    this.blade = scene.add.container(0, 0);

    // Outer circle
    const outer = scene.add.circle(0, 0, this.radius, 0x888888);
    outer.setStrokeStyle(2, 0x666666);
    this.blade.add(outer);

    // Inner circle
    const inner = scene.add.circle(0, 0, this.radius * 0.3, 0x444444);
    this.blade.add(inner);

    // Teeth (8 triangular teeth)
    const numTeeth = 8;
    for (let i = 0; i < numTeeth; i++) {
      const angle = (i / numTeeth) * Math.PI * 2;
      const toothX = Math.cos(angle) * this.radius;
      const toothY = Math.sin(angle) * this.radius;

      const tooth = scene.add.triangle(
        toothX,
        toothY,
        0, -6,
        -4, 4,
        4, 4,
        0xaaaaaa
      );
      tooth.setRotation(angle + Math.PI / 2);
      this.blade.add(tooth);
    }

    this.add(this.blade);

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'sawblade');
    this.hitbox.setVisible(false);
    this.hitbox.setCircle(this.radius - 2);
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
