import Phaser from 'phaser';
import { BaseTrap, TrapConfig } from './BaseTrap';
import { Player } from '../entities/Player';
import { TILE_SIZE } from '../config/gameConfig';

export interface LaserBeamConfig extends TrapConfig {
  onDuration?: number;
  offDuration?: number;
  height?: number;
  endX?: number;
  endY?: number;
}

export class LaserBeam extends BaseTrap {
  private emitter!: Phaser.GameObjects.Rectangle;
  private endEmitter: Phaser.GameObjects.Rectangle | null = null;
  private beam!: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics;
  private isOn: boolean = false;
  private onDuration: number;
  private offDuration: number;
  private timer: Phaser.Time.TimerEvent | null = null;
  private hasTwoPoints: boolean = false;
  private endX: number = 0;
  private endY: number = 0;

  constructor(scene: Phaser.Scene, config: LaserBeamConfig) {
    super(scene, config);

    this.onDuration = config.onDuration || 1200;
    this.offDuration = config.offDuration || 800;
    this.hasTwoPoints = config.endX !== undefined && config.endY !== undefined;

    if (this.hasTwoPoints) {
      this.endX = config.endX!;
      this.endY = config.endY!;
      this.createTwoPointLaser(scene, config);
    } else {
      this.createVerticalLaser(scene, config);
    }

    // Start the cycle
    this.startCycle();
  }

  private createTwoPointLaser(scene: Phaser.Scene, config: LaserBeamConfig): void {
    // Calculate beam properties
    const dx = this.endX - config.x;
    const dy = this.endY - config.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Start emitter base
    this.emitter = scene.add.rectangle(0, 0, 20, 12, 0x444466);
    this.emitter.setStrokeStyle(2, 0x666688);
    this.add(this.emitter);

    // Start lens/light indicator
    const startLens = scene.add.rectangle(0, 0, 10, 6, 0x330000);
    this.add(startLens);

    // End emitter base (positioned relative to container)
    this.endEmitter = scene.add.rectangle(dx, dy, 20, 12, 0x444466);
    this.endEmitter.setStrokeStyle(2, 0x666688);
    this.add(this.endEmitter);

    // End lens/light indicator
    const endLens = scene.add.rectangle(dx, dy, 10, 6, 0x330000);
    this.add(endLens);

    // Beam as graphics (line between points)
    const beamGraphics = scene.add.graphics();
    beamGraphics.lineStyle(6, 0xff0000, 0);
    beamGraphics.lineBetween(0, 0, dx, dy);
    this.beam = beamGraphics;
    this.add(beamGraphics);

    // Create hitbox along the beam
    const midX = config.x + dx / 2;
    const midY = config.y + dy / 2;
    this.hitbox = scene.physics.add.sprite(midX, midY, 'laser');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(length, 10);
    this.hitbox.setRotation(angle);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.enable = false;
  }

  private createVerticalLaser(scene: Phaser.Scene, config: LaserBeamConfig): void {
    const laserHeight = config.height || TILE_SIZE * 5;

    // Emitter base on the ground
    this.emitter = scene.add.rectangle(0, 0, 20, 12, 0x444466);
    this.emitter.setStrokeStyle(2, 0x666688);
    this.add(this.emitter);

    // Lens/light indicator
    const lens = scene.add.rectangle(0, -4, 10, 6, 0x330000);
    this.add(lens);

    // Vertical beam going upward (initially off)
    this.beam = scene.add.rectangle(0, -laserHeight / 2 - 6, 6, laserHeight, 0xff0000);
    (this.beam as Phaser.GameObjects.Rectangle).setAlpha(0);
    this.add(this.beam);

    // Create hitbox for the beam (vertical)
    this.hitbox = scene.physics.add.sprite(config.x, config.y - laserHeight / 2, 'laser');
    this.hitbox.setVisible(false);
    this.hitbox.setSize(8, laserHeight);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.enable = false;
  }

  private startCycle(): void {
    this.turnOff();

    this.timer = this.trapScene.time.addEvent({
      delay: this.offDuration,
      callback: () => {
        if (!this.active) return;
        this.turnOn();

        this.trapScene.time.delayedCall(this.onDuration, () => {
          if (!this.active) return;
          this.turnOff();
        });
      },
      loop: true,
    });
  }

  private turnOn(): void {
    if (!this.active) return;
    this.isOn = true;

    // Warning flash
    this.emitter.setFillStyle(0xffff00);
    if (this.endEmitter) this.endEmitter.setFillStyle(0xffff00);

    if (this.hasTwoPoints) {
      // Two-point laser beam
      const beamGraphics = this.beam as Phaser.GameObjects.Graphics;
      beamGraphics.clear();
      beamGraphics.lineStyle(6, 0xffff00, 0.5);
      beamGraphics.lineBetween(0, 0, this.endX - this.x, this.endY - this.y);
    } else {
      (this.beam as Phaser.GameObjects.Rectangle).setAlpha(0.3);
      (this.beam as Phaser.GameObjects.Rectangle).setFillStyle(0xffff00);
    }

    this.trapScene.time.delayedCall(150, () => {
      if (!this.active) return;
      // Full power
      this.emitter.setFillStyle(0xff0000);
      if (this.endEmitter) this.endEmitter.setFillStyle(0xff0000);

      if (this.hasTwoPoints) {
        const beamGraphics = this.beam as Phaser.GameObjects.Graphics;
        beamGraphics.clear();
        beamGraphics.lineStyle(6, 0xff0000, 0.9);
        beamGraphics.lineBetween(0, 0, this.endX - this.x, this.endY - this.y);
      } else {
        (this.beam as Phaser.GameObjects.Rectangle).setAlpha(0.9);
        (this.beam as Phaser.GameObjects.Rectangle).setFillStyle(0xff0000);
      }

      if (this.hitbox?.body) {
        const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
        body.enable = true;
      }
    });
  }

  private turnOff(): void {
    this.isOn = false;
    if (!this.active) return;

    this.emitter.setFillStyle(0x444466);
    if (this.endEmitter) this.endEmitter.setFillStyle(0x444466);

    if (this.hasTwoPoints) {
      const beamGraphics = this.beam as Phaser.GameObjects.Graphics;
      beamGraphics.clear();
      beamGraphics.lineStyle(6, 0xff0000, 0);
      beamGraphics.lineBetween(0, 0, this.endX - this.x, this.endY - this.y);
    } else {
      (this.beam as Phaser.GameObjects.Rectangle).setAlpha(0);
    }

    if (this.hitbox?.body) {
      const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
      body.enable = false;
    }
  }

  trigger(_player: Player): void {
    // Laser is timer-based, not proximity triggered
    // Player dies on contact when laser is on (handled by collision)
  }

  reset(): void {
    if (this.timer) {
      this.timer.destroy();
    }
    this.turnOff();
    this.startCycle();
  }

  destroy(fromScene?: boolean): void {
    if (this.timer) {
      this.timer.destroy();
    }
    super.destroy(fromScene);
  }

  isLaserOn(): boolean {
    return this.isOn;
  }
}
