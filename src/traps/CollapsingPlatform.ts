import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { TILE_SIZE, SIZE, sz } from '../config/gameConfig';

export class CollapsingPlatform extends BaseTrap {
  private platform: Phaser.GameObjects.Rectangle;
  private collapseDelay: number = 300; // 0.3s
  private originalY: number;
  private inCooldown: boolean = false;
  private cooldownTimer: Phaser.Time.TimerEvent | null = null;
  private collapseTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: TrapConfig) {
    super(scene, config);

    this.originalY = config.y;

    // Create platform that looks exactly like a normal tile (no stroke)
    const platformColor = config.color ?? 0x4a4a6a;
    this.platform = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, platformColor);
    this.add(this.platform);

    // Create physics hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'platform');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(TILE_SIZE, TILE_SIZE);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  trigger(): void {
    if (!this.isActive() || this.inCooldown) return;

    this.isTriggered = true;

    // Warning shake - platform vibrates
    const shakeAmount = sz(SIZE.SHAKE_AMOUNT);
    this.trapScene.tweens.add({
      targets: this.platform,
      x: shakeAmount,
      duration: 40,
      yoyo: true,
      repeat: 4,
    });

    // Collapse after delay
    this.collapseTimer = this.trapScene.time.delayedCall(this.collapseDelay, () => {
      if (!this.active) return;

      // Disable collision
      if (this.hitbox?.body) {
        const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
        body.enable = false;
      }

      // Fall animation
      this.trapScene.tweens.add({
        targets: [this, this.hitbox],
        y: this.y + 300,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (this.active) this.setVisible(false);
        },
      });
    });
  }

  reset(): void {
    // Cancel pending timers
    if (this.collapseTimer) {
      this.collapseTimer.remove();
      this.collapseTimer = null;
    }
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
      this.cooldownTimer = null;
    }

    // Kill any active tweens first
    this.trapScene.tweens.killTweensOf(this);
    this.trapScene.tweens.killTweensOf(this.platform);
    if (this.hitbox) {
      this.trapScene.tweens.killTweensOf(this.hitbox);
    }

    this.isTriggered = false;
    this.inCooldown = true;
    if (!this.active) return;

    this.setPosition(this.x, this.originalY);
    this.setAlpha(1);
    this.setVisible(true);
    this.platform.setX(0); // Reset shake offset

    if (this.hitbox?.body) {
      this.hitbox.setPosition(this.x, this.originalY);
      this.hitbox.setAlpha(1);
      const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
    }

    // End cooldown after 500ms
    this.cooldownTimer = this.trapScene.time.delayedCall(500, () => {
      this.inCooldown = false;
    });
  }

  getPlatformBody(): Phaser.Physics.Arcade.Sprite | null {
    return this.hitbox;
  }
}
