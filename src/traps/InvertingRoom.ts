import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/gameConfig';

export interface InvertingRoomConfig {
  triggerX?: number; // X position that triggers the flip (default: center)
  flipDuration?: number; // How long the flip animation takes
}

/**
 * InvertingRoom - When player reaches the middle of the room,
 * the entire screen flips 180 degrees (visual flip, not gravity).
 * This creates disorientation as controls feel reversed.
 */
export class InvertingRoom {
  private gameScene: Phaser.Scene;
  private triggerX: number;
  private flipDuration: number;
  private isFlipped: boolean = false;
  private isFlipping: boolean = false;
  private hasTriggered: boolean = false;
  private triggerZone: Phaser.GameObjects.Rectangle;
  private warningLine: Phaser.GameObjects.Rectangle;
  private inCooldown: boolean = false;
  private cooldownTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: InvertingRoomConfig = {}) {
    this.gameScene = scene;
    this.triggerX = config.triggerX || GAME_WIDTH / 2;
    this.flipDuration = config.flipDuration || 500;

    // Create subtle warning line at trigger point
    this.warningLine = scene.add.rectangle(
      this.triggerX,
      GAME_HEIGHT / 2,
      4,
      GAME_HEIGHT,
      0xff00ff,
      0.1
    );
    this.warningLine.setDepth(1);

    // Pulsing effect on warning line
    scene.tweens.add({
      targets: this.warningLine,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // Invisible trigger zone
    this.triggerZone = scene.add.rectangle(
      this.triggerX,
      GAME_HEIGHT / 2,
      TILE_SIZE,
      GAME_HEIGHT,
      0xff00ff,
      0
    );
  }

  update(player: Player): void {
    if (this.isFlipping || this.inCooldown) return;

    // Check if player crossed the trigger line
    const playerCrossed = Math.abs(player.x - this.triggerX) < TILE_SIZE / 2;

    if (playerCrossed && !this.hasTriggered) {
      this.triggerFlip();
    }
  }

  private triggerFlip(): void {
    this.hasTriggered = true;
    this.isFlipping = true;

    // Warning flash
    this.gameScene.cameras.main.flash(100, 255, 0, 255, false);

    // Screen shake before flip
    this.gameScene.cameras.main.shake(200, 0.02);

    // Flip the camera
    const targetRotation = this.isFlipped ? 0 : 180;

    this.gameScene.tweens.add({
      targets: this.gameScene.cameras.main,
      rotation: Phaser.Math.DegToRad(targetRotation),
      duration: this.flipDuration,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.isFlipped = !this.isFlipped;
        this.isFlipping = false;
        this.hasTriggered = false; // Allow re-triggering when crossing again

        // Brief disorientation effect
        this.gameScene.cameras.main.flash(50, 255, 255, 255, false);
      },
    });

    // Show flip text
    const flipText = this.gameScene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      this.isFlipped ? 'RIGHT SIDE UP!' : 'FLIPPED!',
      {
        fontSize: '32px',
        color: '#ff00ff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }
    );
    flipText.setOrigin(0.5);
    flipText.setDepth(200);
    flipText.setScrollFactor(0); // Fixed to camera

    // If camera is flipped, counter-rotate text so it's readable
    if (!this.isFlipped) {
      flipText.setRotation(Math.PI); // 180 degrees
    }

    this.gameScene.tweens.add({
      targets: flipText,
      alpha: 0,
      scale: 2,
      duration: 800,
      onComplete: () => flipText.destroy(),
    });
  }

  isRoomFlipped(): boolean {
    return this.isFlipped;
  }

  reset(): void {
    // Cancel any cooldown timer
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
      this.cooldownTimer = null;
    }

    // Kill camera tweens
    this.gameScene.tweens.killTweensOf(this.gameScene.cameras.main);

    this.isFlipping = false;
    this.hasTriggered = false;
    this.inCooldown = true;

    // Reset camera rotation
    this.gameScene.cameras.main.setRotation(0);
    this.isFlipped = false;

    // End cooldown after 500ms
    this.cooldownTimer = this.gameScene.time.delayedCall(500, () => {
      this.inCooldown = false;
    });
  }

  destroy(): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.remove();
    }
    this.gameScene.tweens.killTweensOf(this.gameScene.cameras.main);
    this.gameScene.tweens.killTweensOf(this.warningLine);
    if (this.warningLine) {
      this.warningLine.destroy();
    }
    if (this.triggerZone) {
      this.triggerZone.destroy();
    }
    // Make sure camera is reset
    this.gameScene.cameras.main.setRotation(0);
  }
}
