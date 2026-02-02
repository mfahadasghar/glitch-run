import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { TILE_SIZE, GAME_HEIGHT, SIZE, sz } from '../config/gameConfig';

export interface CrushingBlockConfig extends TrapConfig {
  triggerWidth?: number;
}

export class CrushingBlock extends BaseTrap {
  private block: Phaser.GameObjects.Container;
  private originalY: number;
  private triggerWidth: number;
  private crushState: 'hidden' | 'warning' | 'falling' | 'fallen' | 'cooldown' | 'initializing' = 'initializing';
  private fallTimer: Phaser.Time.TimerEvent | null = null;
  private cooldownTimer: Phaser.Time.TimerEvent | null = null;
  private initTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: CrushingBlockConfig) {
    super(scene, config);

    this.originalY = config.y;
    this.triggerWidth = config.triggerWidth || TILE_SIZE * 2;

    // Create crushing block container
    this.block = scene.add.container(0, 0);

    // Main block body
    const body = scene.add.rectangle(0, 0, TILE_SIZE * 2, TILE_SIZE * 1.5, 0x4a4a5a);
    body.setStrokeStyle(2, 0x3a3a4a);
    this.block.add(body);

    // Danger stripes
    const stripeWidth = sz(SIZE.CRUSH_STRIPE_WIDTH);
    const stripeSpacing = sz(SIZE.CRUSH_STRIPE_SPACING);
    for (let i = 0; i < 3; i++) {
      const stripe = scene.add.rectangle(-stripeSpacing + i * stripeSpacing, 0, stripeWidth, TILE_SIZE * 1.2, 0xe94560);
      this.block.add(stripe);
    }

    // Spikes at bottom (pointing downward, centered) using Graphics for precise control
    const spikeGraphics = scene.add.graphics();
    spikeGraphics.fillStyle(0xc0c0c0, 1);
    const blockHalfWidth = TILE_SIZE;
    const spikeSpacing2 = blockHalfWidth * 2 / 4;
    const spikeY = TILE_SIZE * 0.75; // Bottom of block body
    const spikeHeight = sz(SIZE.CRUSH_SPIKE_HEIGHT);
    const spikeHalfWidth = sz(SIZE.CRUSH_SPIKE_WIDTH);

    // 3 evenly spaced spikes: at -spikeSpacing2, 0, +spikeSpacing2
    for (let i = -1; i <= 1; i++) {
      const xPos = i * spikeSpacing2;
      spikeGraphics.fillTriangle(
        xPos, spikeY + spikeHeight,     // bottom tip (pointing down)
        xPos - spikeHalfWidth, spikeY,  // top left
        xPos + spikeHalfWidth, spikeY   // top right
      );
    }
    this.block.add(spikeGraphics);

    this.add(this.block);

    // Start hidden (in ceiling)
    this.setAlpha(0);

    // Create hitbox
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'platform');
    this.hitbox.setVisible(false);
    const hitboxBody = this.hitbox.body as Phaser.Physics.Arcade.Body;
    hitboxBody.setAllowGravity(false);
    hitboxBody.setImmovable(true);
    hitboxBody.setSize(TILE_SIZE * 2, TILE_SIZE * 1.5 + 16);

    // Brief initialization delay before block can be triggered
    this.initTimer = scene.time.delayedCall(500, () => {
      if (this.crushState === 'initializing') {
        this.crushState = 'hidden';
      }
    });
  }

  update(player: Player): void {
    // Only trigger when hidden and active (not during initialization or other states)
    if (!this.isActive() || this.crushState !== 'hidden') return;
    if (!player || !player.active) return;

    // Check if player is below
    const withinXRange = Math.abs(player.x - this.x) < this.triggerWidth;
    const playerBelow = player.y > this.y + TILE_SIZE;

    if (withinXRange && playerBelow) {
      this.trigger();
    }
  }

  trigger(): void {
    // Only trigger from hidden state
    if (!this.isActive() || this.crushState !== 'hidden') return;

    this.isTriggered = true;
    this.crushState = 'warning';

    // Reveal the block quickly
    this.trapScene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 100,
    });

    // Brief shake warning
    this.trapScene.tweens.add({
      targets: this.block,
      x: 3,
      duration: 40,
      yoyo: true,
      repeat: 2,
    });

    // Fall after brief warning (store timer so we can cancel on reset)
    this.fallTimer = this.trapScene.time.delayedCall(150, () => {
      // Double-check we're still in warning state (not reset)
      if (!this.active || this.crushState !== 'warning') return;

      this.crushState = 'falling';

      // Fast fall (one-time only until reset)
      this.trapScene.tweens.add({
        targets: [this, this.hitbox],
        y: GAME_HEIGHT + 50,
        duration: 350,
        ease: 'Quad.easeIn',
        onComplete: () => {
          if (this.crushState === 'falling') {
            this.crushState = 'fallen';
            // Disable hitbox after fallen
            if (this.hitbox?.body) {
              (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
            }
          }
        },
      });
    });
  }

  reset(): void {
    // Cancel pending timers
    if (this.fallTimer) {
      this.fallTimer.remove();
      this.fallTimer = null;
    }
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
      this.cooldownTimer = null;
    }
    if (this.initTimer) {
      this.initTimer.remove();
      this.initTimer = null;
    }

    // Kill any active tweens
    this.trapScene.tweens.killTweensOf(this);
    this.trapScene.tweens.killTweensOf(this.block);
    if (this.hitbox) {
      this.trapScene.tweens.killTweensOf(this.hitbox);
    }

    // Reset state with cooldown to prevent immediate re-trigger
    this.isTriggered = false;
    this.crushState = 'cooldown';

    // Restore position to original
    this.setPosition(this.x, this.originalY);
    this.setAlpha(0); // Hidden again
    this.block.setX(0); // Reset shake offset

    if (this.hitbox) {
      this.hitbox.setPosition(this.x, this.originalY);
      // Re-enable hitbox physics body
      if (this.hitbox.body) {
        (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = true;
      }
    }

    // Longer cooldown (2 seconds) after player respawns before block can trigger again
    this.cooldownTimer = this.trapScene.time.delayedCall(2000, () => {
      if (this.crushState === 'cooldown') {
        this.crushState = 'hidden';
      }
    });
  }
}
