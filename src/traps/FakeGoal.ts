import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { TILE_SIZE } from '../config/gameConfig';

export class FakeGoal extends BaseTrap {
  private goalSprite: Phaser.GameObjects.Sprite;
  private inCooldown: boolean = false;
  private cooldownTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: TrapConfig) {
    super(scene, config);

    // Use the same 'goal' texture as the real Goal
    // Apply Y offset to match real Goal positioning (real Goal uses -TILE_SIZE/2 offset)
    this.goalSprite = scene.add.sprite(0, -TILE_SIZE / 2, 'goal');
    this.add(this.goalSprite);

    // Same pulsing animation as the real Goal
    scene.tweens.add({
      targets: this.goalSprite,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Create hitbox matching the goal sprite size (with same Y offset)
    this.hitbox = scene.physics.add.sprite(config.x, config.y - TILE_SIZE / 2, 'goal');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(TILE_SIZE - 4, TILE_SIZE * 1.5 - 4);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    this.setDepth(5);
  }

  trigger(): void {
    // Don't trigger during cooldown or if already triggered
    if (!this.isActive() || this.isTriggered || this.inCooldown) return;

    this.isTriggered = true;

    // Reveal it's fake with a red flash
    this.trapScene.cameras.main.flash(200, 255, 0, 0);

    // Hide the fake goal instantly
    this.goalSprite.setAlpha(0);
  }

  reset(): void {
    // Cancel any existing cooldown timer
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
      this.cooldownTimer = null;
    }

    // Kill animation tween
    this.trapScene.tweens.killTweensOf(this.goalSprite);

    this.isTriggered = false;
    this.inCooldown = true; // Start cooldown to prevent immediate re-trigger

    // Restore the sprite to full visibility
    this.goalSprite.setAlpha(1);
    this.goalSprite.setVisible(true);

    // Restart pulsing animation (same as real Goal)
    this.trapScene.tweens.add({
      targets: this.goalSprite,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // End cooldown after 500ms (gives player time to move away)
    this.cooldownTimer = this.trapScene.time.delayedCall(500, () => {
      this.inCooldown = false;
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
    }
    this.trapScene.tweens.killTweensOf(this.goalSprite);
    super.destroy(fromScene);
  }
}
