import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GAME_WIDTH, SIZE, sz } from '../config/gameConfig';

export interface MirrorEnemyConfig {
  x: number;
  y: number;
  delay?: number;
}

export class MirrorEnemy extends Phaser.GameObjects.Container {
  private shadow: Phaser.GameObjects.Container;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private gameScene: Phaser.Scene;
  private player: Player | null = null;
  private isActive: boolean = false;
  private delay: number;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private positionHistory: Array<{ x: number; y: number }> = [];
  private historyDelay: number = 30; // frames of delay

  constructor(scene: Phaser.Scene, config: MirrorEnemyConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    this.delay = config.delay || 1500;

    scene.add.existing(this);

    // Create shadow container
    this.shadow = scene.add.container(0, 0);

    // Shadow body (dark version of player)
    const bodySize = sz(SIZE.ENEMY_BODY);
    const body = scene.add.rectangle(0, 0, bodySize, bodySize, 0x000000, 0.8);
    body.setStrokeStyle(2, 0xff0000);
    this.shadow.add(body);

    // Evil eyes
    const eyeSize = sz(SIZE.ENEMY_EYE);
    const eyeOffset = sz(SIZE.ENEMY_EYE_OFFSET);
    const leftEye = scene.add.rectangle(-eyeOffset, -eyeSize / 2, eyeSize, eyeSize, 0xff0000);
    const rightEye = scene.add.rectangle(eyeOffset, -eyeSize / 2, eyeSize, eyeSize, 0xff0000);
    this.shadow.add(leftEye);
    this.shadow.add(rightEye);

    // Glowing effect
    const glowSize = sz(SIZE.ENEMY_GLOW);
    const glow = scene.add.rectangle(0, 0, glowSize, glowSize, 0xff0000, 0.3);
    this.shadow.add(glow);

    scene.tweens.add({
      targets: glow,
      alpha: 0.1,
      scale: 1.2,
      duration: 400,
      yoyo: true,
      repeat: -1,
    });

    this.add(this.shadow);

    // Create hitbox
    const hitboxSize = sz(SIZE.ENEMY_HITBOX);
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'player');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(hitboxSize, hitboxSize);
    const physBody = this.hitbox.body as Phaser.Physics.Arcade.Body;
    physBody.setAllowGravity(false);
    physBody.setImmovable(true);

    this.setDepth(50);
    this.setAlpha(0);
  }

  setPlayer(player: Player): void {
    this.player = player;
  }

  start(): void {
    if (this.isActive || !this.player) return;

    // Initialize position history with current player position
    this.positionHistory = [];
    for (let i = 0; i < this.historyDelay; i++) {
      this.positionHistory.push({ x: this.player.x, y: this.player.y });
    }

    // Spawn after delay (no warning)
    this.spawnTimer = this.gameScene.time.delayedCall(this.delay, () => {
      this.isActive = true;

      // Dramatic spawn effect
      this.setAlpha(1);
      this.setScale(0);
      this.gameScene.tweens.add({
        targets: this,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });

      // Spawn sound/effect
      this.gameScene.cameras.main.shake(100, 0.01);
    });
  }

  update(): void {
    if (!this.isActive || !this.player) return;

    // Record player position
    this.positionHistory.push({ x: this.player.x, y: this.player.y });

    // Get delayed position (mirror follows player with delay)
    if (this.positionHistory.length > this.historyDelay) {
      const delayedPos = this.positionHistory.shift()!;

      // Mirror horizontally - shadow is on opposite side of screen center
      const mirroredX = GAME_WIDTH - delayedPos.x;

      this.x = mirroredX;
      this.y = delayedPos.y;

      this.hitbox.x = this.x;
      this.hitbox.y = this.y;
    }
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  reset(): void {
    if (this.spawnTimer) {
      this.spawnTimer.remove();
      this.spawnTimer = null;
    }

    this.gameScene.tweens.killTweensOf(this);

    this.isActive = false;
    this.positionHistory = [];
    this.setAlpha(0);
    this.setScale(1);

    // Move off screen
    this.x = -100;
    this.y = -100;
    this.hitbox.x = -100;
    this.hitbox.y = -100;
  }

  destroy(fromScene?: boolean): void {
    if (this.spawnTimer) {
      this.spawnTimer.remove();
    }
    this.gameScene.tweens.killTweensOf(this);
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
