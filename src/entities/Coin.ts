import Phaser from 'phaser';

export class Coin extends Phaser.GameObjects.Container {
  private coinGraphic: Phaser.GameObjects.Arc;
  private glowGraphic: Phaser.GameObjects.Arc;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private collected: boolean = false;
  private coinScene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.coinScene = scene;

    scene.add.existing(this);

    // Glow effect
    this.glowGraphic = scene.add.circle(0, 0, 12, 0xffd700, 0.3);
    this.add(this.glowGraphic);

    // Main coin
    this.coinGraphic = scene.add.circle(0, 0, 8, 0xffd700);
    this.coinGraphic.setStrokeStyle(2, 0xffaa00);
    this.add(this.coinGraphic);

    // Inner shine (added to coinGraphic so it rotates together)
    const shine = scene.add.circle(-2, -2, 3, 0xffff88, 0.8);
    this.add(shine);

    // Group coin and shine for rotation
    const coinGroup = [this.coinGraphic, shine];

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(x, y, 'coin');
    this.hitbox.setVisible(false);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(10);

    // Floating animation
    scene.tweens.add({
      targets: this,
      y: y - 5,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Glow pulse
    scene.tweens.add({
      targets: this.glowGraphic,
      scale: 1.3,
      alpha: 0.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Rotation (includes coin and shine)
    scene.tweens.add({
      targets: coinGroup,
      scaleX: 0.3,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.setDepth(5);
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  collect(): number {
    if (this.collected) return 0;

    this.collected = true;

    // Play collect sound
    if (this.coinScene.cache.audio.exists('collect')) {
      this.coinScene.sound.play('collect', { volume: 0.5 });
    }

    // Collection animation
    this.coinScene.tweens.add({
      targets: this,
      y: this.y - 30,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });

    // Sparkle effect
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const sparkle = this.coinScene.add.circle(
        this.x + Math.cos(angle) * 5,
        this.y + Math.sin(angle) * 5,
        3,
        0xffd700
      );

      this.coinScene.tweens.add({
        targets: sparkle,
        x: this.x + Math.cos(angle) * 30,
        y: this.y + Math.sin(angle) * 30,
        alpha: 0,
        scale: 0,
        duration: 300,
        onComplete: () => sparkle.destroy(),
      });
    }

    return 100; // Coin value
  }

  isCollected(): boolean {
    return this.collected;
  }

  destroy(fromScene?: boolean): void {
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
