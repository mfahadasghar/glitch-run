import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { TILE_SIZE, SIZE, sz } from '../config/gameConfig';

export class FakeGoal extends BaseTrap {
  private door: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Rectangle;
  private doorBody: Phaser.GameObjects.Rectangle;
  private shine: Phaser.GameObjects.Rectangle;
  private handle: Phaser.GameObjects.Arc;
  private glow: Phaser.GameObjects.Rectangle;
  private inCooldown: boolean = false;
  private cooldownTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: TrapConfig) {
    super(scene, config);

    // Create door container
    this.door = scene.add.container(0, 0);

    // Door frame (looks identical to real goal)
    const padding = sz(SIZE.GOAL_PADDING);
    this.frame = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE * 1.5, 0x8b7355);
    this.frame.setStrokeStyle(2, 0x6b5335);
    this.door.add(this.frame);

    // Door body (golden like real goal)
    this.doorBody = scene.add.rectangle(0, 0, TILE_SIZE - padding, TILE_SIZE * 1.5 - padding, 0xffd700);
    this.door.add(this.doorBody);

    // Door shine
    const shineWidth = sz(SIZE.GOAL_SHINE_WIDTH);
    const shineOffset = sz(SIZE.GOAL_SHINE_OFFSET);
    this.shine = scene.add.rectangle(-shineOffset, 0, shineWidth, TILE_SIZE * 1.2, 0xffec8b);
    this.door.add(this.shine);

    // Door handle
    const handleOffsetX = sz(SIZE.GOAL_HANDLE_OFFSET_X);
    const handleOffsetY = sz(SIZE.GOAL_HANDLE_OFFSET_Y);
    const handleRadius = sz(SIZE.GOAL_HANDLE_RADIUS);
    this.handle = scene.add.circle(handleOffsetX, handleOffsetY, handleRadius, 0xdaa520);
    this.door.add(this.handle);

    // Glow effect (same as real goal)
    this.glow = scene.add.rectangle(0, 0, TILE_SIZE + padding, TILE_SIZE * 1.5 + padding, 0xffd700, 0.3);
    this.door.add(this.glow);

    // Pulsing glow (same as real goal)
    scene.tweens.add({
      targets: this.glow,
      alpha: 0.1,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.add(this.door);

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'goal');
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

    // Hide door instantly (no tween to avoid timing issues with reset)
    this.frame.setAlpha(0);
    this.doorBody.setAlpha(0);
    this.shine.setAlpha(0);
    this.handle.setAlpha(0);
    this.glow.setAlpha(0);
  }

  reset(): void {
    // Cancel any existing cooldown timer
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
      this.cooldownTimer = null;
    }

    // Kill glow animation tween
    this.trapScene.tweens.killTweensOf(this.glow);

    this.isTriggered = false;
    this.inCooldown = true; // Start cooldown to prevent immediate re-trigger

    // Restore all door elements to full visibility
    this.frame.setAlpha(1);
    this.frame.setVisible(true);
    this.doorBody.setAlpha(1);
    this.doorBody.setVisible(true);
    this.shine.setAlpha(1);
    this.shine.setVisible(true);
    this.handle.setAlpha(1);
    this.handle.setVisible(true);

    // Glow should be slightly transparent
    this.glow.setAlpha(0.3);
    this.glow.setScale(1);

    // Restart glow animation
    this.trapScene.tweens.add({
      targets: this.glow,
      alpha: 0.1,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // End cooldown after 500ms (gives player time to move away)
    this.cooldownTimer = this.trapScene.time.delayedCall(500, () => {
      this.inCooldown = false;
    });
  }
}
