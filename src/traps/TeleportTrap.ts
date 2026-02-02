import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { SIZE, sz } from '../config/gameConfig';

export interface TeleportTrapConfig extends TrapConfig {
  targetX: number;
  targetY: number;
}

export class TeleportTrap extends BaseTrap {
  private portal: Phaser.GameObjects.Container;
  private targetX: number;
  private targetY: number;
  private cooldown: boolean = false;
  private targetMarker: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, config: TeleportTrapConfig) {
    super(scene, config);

    this.targetX = config.targetX;
    this.targetY = config.targetY;

    // Create portal visual - entry portal
    this.portal = scene.add.container(0, 0);

    // Outer ring
    const outerRadius = sz(SIZE.TELEPORT_OUTER);
    const outerRing = scene.add.circle(0, 0, outerRadius, 0x9400d3, 0.6);
    outerRing.setStrokeStyle(2, 0xba55d3);
    this.portal.add(outerRing);

    // Inner glow
    const innerRadius = sz(SIZE.TELEPORT_INNER);
    const innerGlow = scene.add.circle(0, 0, innerRadius, 0xda70d6, 0.8);
    this.portal.add(innerGlow);

    // Center
    const centerRadius = sz(SIZE.TELEPORT_CENTER);
    const center = scene.add.circle(0, 0, centerRadius, 0xffffff, 1);
    this.portal.add(center);

    this.add(this.portal);

    // Pulsing animation
    scene.tweens.add({
      targets: [outerRing, innerGlow],
      scale: 1.1,
      alpha: 0.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Create target marker (exit point) - smaller indicator
    this.targetMarker = scene.add.container(this.targetX, this.targetY);
    const exitOuterRadius = sz(SIZE.TELEPORT_EXIT_OUTER);
    const exitRing = scene.add.circle(0, 0, exitOuterRadius, 0x9400d3, 0.4);
    exitRing.setStrokeStyle(2, 0xba55d3);
    const exitCenterRadius = sz(SIZE.TELEPORT_EXIT_CENTER);
    const exitCenter = scene.add.circle(0, 0, exitCenterRadius, 0xda70d6, 0.6);
    this.targetMarker.add(exitRing);
    this.targetMarker.add(exitCenter);
    this.targetMarker.setDepth(1);

    // Pulse the exit marker
    scene.tweens.add({
      targets: exitRing,
      scale: 1.2,
      alpha: 0.2,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Create hitbox
    const hitboxRadius = sz(SIZE.TELEPORT_HITBOX);
    this.hitbox = scene.physics.add.sprite(config.x, config.y, 'teleport');
    this.hitbox.setVisible(false);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setCircle(hitboxRadius);
  }

  trigger(player: Player): void {
    if (!this.isActive() || this.cooldown) return;

    this.isTriggered = true;
    this.cooldown = true;

    // Visual effect at current position
    const flashRadius = sz(SIZE.TELEPORT_FLASH);
    const flashOut = this.trapScene.add.circle(player.x, player.y, flashRadius, 0x9400d3, 0.9);
    this.trapScene.tweens.add({
      targets: flashOut,
      scale: 2.5,
      alpha: 0,
      duration: 250,
      onComplete: () => flashOut.destroy(),
    });

    // Teleport player to specific target
    player.teleportTo(this.targetX, this.targetY);

    // Visual effect at destination
    const flashInRadius = sz(SIZE.TELEPORT_FLASH_IN);
    const flashIn = this.trapScene.add.circle(this.targetX, this.targetY, flashInRadius, 0x9400d3, 0.9);
    flashIn.setScale(2);
    this.trapScene.tweens.add({
      targets: flashIn,
      scale: 0.5,
      alpha: 0,
      duration: 250,
      onComplete: () => flashIn.destroy(),
    });

    // Cooldown before can trigger again
    this.trapScene.time.delayedCall(1500, () => {
      this.cooldown = false;
      this.isTriggered = false;
    });
  }

  reset(): void {
    // Kill any active tweens
    this.trapScene.tweens.killTweensOf(this.portal);
    if (this.targetMarker) {
      this.trapScene.tweens.killTweensOf(this.targetMarker);
    }

    this.isTriggered = false;
    this.cooldown = false;
  }

  destroy(fromScene?: boolean): void {
    if (this.targetMarker) {
      this.targetMarker.destroy();
    }
    super.destroy(fromScene);
  }
}
