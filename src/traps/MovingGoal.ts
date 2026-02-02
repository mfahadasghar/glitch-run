import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT, SIZE, FONT, sz, font } from '../config/gameConfig';

export interface MovingGoalConfig {
  x: number;
  y: number;
  escapeDistance?: number; // How far it moves when player approaches
  triggerDistance?: number; // How close player needs to be to trigger movement
  maxMoves?: number; // How many times it can move before staying put
}

/**
 * MovingGoal - Looks like the real goal but moves away when player approaches.
 * After a set number of escapes, it finally stays still and can be reached.
 */
export class MovingGoal extends Phaser.GameObjects.Container {
  private door: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Rectangle;
  private doorBody: Phaser.GameObjects.Rectangle;
  private shine: Phaser.GameObjects.Rectangle;
  private handle: Phaser.GameObjects.Arc;
  private glow: Phaser.GameObjects.Rectangle;
  private hitbox: Phaser.Physics.Arcade.Sprite;
  private gameScene: Phaser.Scene;

  private escapeDistance: number;
  private triggerDistance: number;
  private maxMoves: number;
  private moveCount: number = 0;
  private isMoving: boolean = false;
  private isExhausted: boolean = false; // True when it can't move anymore
  private originalX: number;
  private originalY: number;

  constructor(scene: Phaser.Scene, config: MovingGoalConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    this.escapeDistance = config.escapeDistance || TILE_SIZE * 3;
    this.triggerDistance = config.triggerDistance || TILE_SIZE * 2;
    this.maxMoves = config.maxMoves || 3;
    this.originalX = config.x;
    this.originalY = config.y;

    scene.add.existing(this);

    // Create door container (looks identical to real goal)
    this.door = scene.add.container(0, 0);

    // Door frame
    const padding = sz(SIZE.GOAL_PADDING);
    this.frame = scene.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE * 1.5, 0x8b7355);
    this.frame.setStrokeStyle(2, 0x6b5335);
    this.door.add(this.frame);

    // Door body (golden)
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

    // Glow effect
    this.glow = scene.add.rectangle(0, 0, TILE_SIZE + padding, TILE_SIZE * 1.5 + padding, 0xffd700, 0.3);
    this.door.add(this.glow);

    // Pulsing glow
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

  update(player: Player): void {
    if (this.isMoving || this.isExhausted) return;

    // Check if player is close enough to trigger escape
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance < this.triggerDistance) {
      this.escapeFromPlayer(player);
    }
  }

  private escapeFromPlayer(player: Player): void {
    if (this.moveCount >= this.maxMoves) {
      // Can't escape anymore - show exhaustion
      this.showExhausted();
      return;
    }

    this.isMoving = true;
    this.moveCount++;

    // Calculate escape direction (away from player)
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const angle = Math.atan2(dy, dx);

    // Calculate new position
    let newX = this.x + Math.cos(angle) * this.escapeDistance;
    let newY = this.y + Math.sin(angle) * this.escapeDistance;

    // Keep within bounds
    const margin = TILE_SIZE * 2;
    newX = Phaser.Math.Clamp(newX, margin, GAME_WIDTH - margin);
    newY = Phaser.Math.Clamp(newY, margin, GAME_HEIGHT - margin);

    // Taunt effect - door shakes before moving
    this.gameScene.tweens.add({
      targets: this.door,
      x: 3,
      duration: 50,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        // Quick escape movement
        this.gameScene.tweens.add({
          targets: [this, this.hitbox],
          x: newX,
          y: newY,
          duration: 200,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.isMoving = false;
            this.door.setX(0);
          },
        });

        // Leave a ghost image
        this.createGhostImage();
      },
    });

    // Taunting laugh effect (screen shake)
    this.gameScene.cameras.main.shake(100, 0.005);
  }

  private createGhostImage(): void {
    // Create fading ghost at old position
    const ghost = this.gameScene.add.rectangle(
      0, 0, TILE_SIZE, TILE_SIZE * 1.5, 0xffd700, 0.5
    );
    ghost.setPosition(this.x, this.y);
    ghost.setDepth(4);

    this.gameScene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 1.5,
      duration: 400,
      onComplete: () => ghost.destroy(),
    });
  }

  private showExhausted(): void {
    this.isExhausted = true;

    // Door "gives up" - slight droop and color change
    this.gameScene.tweens.add({
      targets: this.door,
      angle: 2,
      duration: 200,
    });

    // Change glow to indicate it's catchable now
    this.glow.setFillStyle(0x00ff00, 0.3);

    // Show "..." text
    const dots = this.gameScene.add.text(this.x, this.y - TILE_SIZE, '...', {
      fontSize: font(FONT.CAPTION),
      color: '#ffffff',
    });
    dots.setOrigin(0.5);
    dots.setDepth(100);

    this.gameScene.tweens.add({
      targets: dots,
      y: dots.y - 20,
      alpha: 0,
      duration: 1000,
      onComplete: () => dots.destroy(),
    });
  }

  getHitbox(): Phaser.Physics.Arcade.Sprite {
    return this.hitbox;
  }

  /**
   * Returns true if the goal can be collected (exhausted or player caught it)
   */
  canBeCollected(): boolean {
    return this.isExhausted || this.moveCount >= this.maxMoves;
  }

  reset(): void {
    this.gameScene.tweens.killTweensOf(this);
    this.gameScene.tweens.killTweensOf(this.door);
    this.gameScene.tweens.killTweensOf(this.hitbox);
    this.gameScene.tweens.killTweensOf(this.glow);

    this.moveCount = 0;
    this.isMoving = false;
    this.isExhausted = false;

    // Reset position
    this.setPosition(this.originalX, this.originalY);
    this.hitbox.setPosition(this.originalX, this.originalY);

    // Reset visuals
    this.door.setAngle(0);
    this.door.setX(0);
    this.glow.setFillStyle(0xffd700, 0.3);

    // Restart glow animation
    this.gameScene.tweens.add({
      targets: this.glow,
      alpha: 0.1,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  destroy(fromScene?: boolean): void {
    this.gameScene.tweens.killTweensOf(this);
    this.gameScene.tweens.killTweensOf(this.door);
    this.gameScene.tweens.killTweensOf(this.glow);
    if (this.hitbox) {
      this.hitbox.destroy();
    }
    super.destroy(fromScene);
  }
}
