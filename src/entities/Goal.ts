import Phaser from 'phaser';

export class Goal extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'goal');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    // Pulsing animation
    scene.tweens.add({
      targets: this,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }
}
