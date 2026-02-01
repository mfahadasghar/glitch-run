import Phaser from 'phaser';
import { PLAYER_CONFIG, GAME_HEIGHT } from '../config/gameConfig';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private isDead: boolean = false;
  private respawnPoint: { x: number; y: number };
  private gravityFlipped: boolean = false;
  private canMove: boolean = true;
  private onIce: boolean = false;
  private iceVelocity: number = 0;

  // Coyote time - allows jump shortly after leaving platform
  private coyoteTime: number = 100; // ms
  private coyoteTimer: number = 0;
  private wasOnGround: boolean = false;

  // Jump buffering - registers jump input before landing
  private jumpBufferTime: number = 100; // ms
  private jumpBufferTimer: number = 0;

  // Dash ability
  private dashSpeed: number = 600;
  private dashDuration: number = 150; // ms
  private dashCooldown: number = 800; // ms
  private canDash: boolean = true;
  private isDashing: boolean = false;
  private dashDirection: number = 1;

  // Particles
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.respawnPoint = { x, y };

    this.setCollideWorldBounds(false);
    this.setBounce(0);
    this.setSize(PLAYER_CONFIG.size, PLAYER_CONFIG.size);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Create dust particle emitter
    this.createDustEmitter();
  }

  private createDustEmitter(): void {
    this.dustEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      gravityY: 100,
      emitting: false,
    });
    this.dustEmitter.setDepth(1);
  }

  private emitDust(count: number = 5): void {
    if (this.dustEmitter) {
      const groundY = this.gravityFlipped ? this.y - 12 : this.y + 12;
      this.dustEmitter.setPosition(this.x, groundY);
      this.dustEmitter.explode(count);
    }
  }

  update(): void {
    if (this.isDead || !this.canMove) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const delta = this.scene.game.loop.delta;

    // Track ground state for coyote time
    const onGround = this.gravityFlipped ? body.blocked.up : body.blocked.down;

    // Landing detection - emit dust when landing
    if (onGround && !this.wasOnGround) {
      this.emitDust(8);
    }

    // Update coyote timer
    if (onGround) {
      this.coyoteTimer = this.coyoteTime;
    } else {
      this.coyoteTimer -= delta;
    }

    // Update jump buffer timer
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.jumpBufferTimer = this.jumpBufferTime;
    } else {
      this.jumpBufferTimer -= delta;
    }

    this.wasOnGround = onGround;

    // Don't allow movement control during dash
    if (!this.isDashing) {
      // Horizontal movement
      if (this.onIce && onGround) {
        // Ice physics: reduced control, maintain momentum
        const iceAcceleration = 15;
        const iceDeceleration = 0.98; // Slow decay when no input
        const maxIceSpeed = 400;

        if (this.cursors.left.isDown) {
          this.iceVelocity -= iceAcceleration;
          this.dashDirection = -1;
        } else if (this.cursors.right.isDown) {
          this.iceVelocity += iceAcceleration;
          this.dashDirection = 1;
        } else {
          // Slowly decelerate on ice
          this.iceVelocity *= iceDeceleration;
        }

        // Clamp ice velocity
        this.iceVelocity = Phaser.Math.Clamp(this.iceVelocity, -maxIceSpeed, maxIceSpeed);

        // Stop if very slow
        if (Math.abs(this.iceVelocity) < 5) {
          this.iceVelocity = 0;
        }

        this.setVelocityX(this.iceVelocity);
      } else {
        // Normal movement
        if (this.cursors.left.isDown) {
          this.setVelocityX(-PLAYER_CONFIG.moveSpeed);
          this.dashDirection = -1;
          this.iceVelocity = -PLAYER_CONFIG.moveSpeed; // Sync ice velocity
        } else if (this.cursors.right.isDown) {
          this.setVelocityX(PLAYER_CONFIG.moveSpeed);
          this.dashDirection = 1;
          this.iceVelocity = PLAYER_CONFIG.moveSpeed; // Sync ice velocity
        } else {
          this.setVelocityX(0);
          this.iceVelocity = 0;
        }
      }

      // Jumping with coyote time and jump buffering
      const canJump = onGround || this.coyoteTimer > 0;
      const wantsToJump = this.jumpBufferTimer > 0;

      if (canJump && wantsToJump) {
        const jumpVel = this.gravityFlipped ? -PLAYER_CONFIG.jumpVelocity : PLAYER_CONFIG.jumpVelocity;
        this.setVelocityY(jumpVel);
        this.coyoteTimer = 0; // Consume coyote time
        this.jumpBufferTimer = 0; // Consume jump buffer
        this.emitDust(5);
        if (this.scene.cache.audio.exists('jump')) this.scene.sound.play('jump', { volume: 0.5 });
      }

      // Dash ability (spacebar)
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.canDash) {
        this.dash();
      }
    }

    // Check if fallen out of bounds
    if (this.y > GAME_HEIGHT + 50 || this.y < -50) {
      this.die();
    }
  }

  private dash(): void {
    if (!this.canDash || this.isDashing) return;

    this.isDashing = true;
    this.canDash = false;

    // Set dash velocity
    this.setVelocityX(this.dashSpeed * this.dashDirection);
    this.setVelocityY(0);

    // Visual effect - tint and scale
    this.setTint(0x00ffff);
    this.setScale(1.2, 0.8);

    // Create dash trail
    this.createDashTrail();

    // End dash after duration
    this.scene.time.delayedCall(this.dashDuration, () => {
      this.isDashing = false;
      this.clearTint();
      this.setScale(1, 1);
    });

    // Cooldown
    this.scene.time.delayedCall(this.dashCooldown, () => {
      this.canDash = true;
    });
  }

  private createDashTrail(): void {
    // Create 3 ghost images behind player
    for (let i = 1; i <= 3; i++) {
      const ghost = this.scene.add.rectangle(
        this.x - (this.dashDirection * i * 15),
        this.y,
        PLAYER_CONFIG.size,
        PLAYER_CONFIG.size,
        0x00ffff,
        0.5 - i * 0.15
      );
      ghost.setDepth(0);

      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 200,
        onComplete: () => ghost.destroy(),
      });
    }
  }

  die(): void {
    if (this.isDead) return;

    this.isDead = true;
    this.canMove = false;
    this.isDashing = false;
    this.clearTint();
    this.setScale(1, 1);
    this.setAlpha(0);

    // Death sound and effect
    if (this.scene.cache.audio.exists('death')) this.scene.sound.play('death', { volume: 0.6 });
    this.scene.cameras.main.shake(150, 0.03);

    // Notify scene of death with position for sparkles
    this.scene.events.emit('playerDeath', { x: this.x, y: this.y });

    // Respawn after delay
    this.scene.time.delayedCall(800, () => {
      this.respawn();
    });
  }

  respawn(): void {
    this.setPosition(this.respawnPoint.x, this.respawnPoint.y);
    this.setVelocity(0, 0);
    this.isDead = false;
    this.canMove = true;
    this.isDashing = false;
    this.canDash = true;
    this.gravityFlipped = false;
    this.onIce = false;
    this.iceVelocity = 0;
    this.setGravityY(0);
    this.setFlipY(false);
    this.setAlpha(1);
    this.clearTint();
    this.setScale(1, 1);
    if (this.scene.cache.audio.exists('spawn')) this.scene.sound.play('spawn', { volume: 0.5 });
  }

  setRespawnPoint(x: number, y: number): void {
    this.respawnPoint = { x, y };
  }

  flipGravity(duration: number = 2000): void {
    if (this.gravityFlipped) return;

    this.gravityFlipped = true;
    this.setGravityY(-PLAYER_CONFIG.gravity * 2);
    this.setFlipY(true);

    this.scene.time.delayedCall(duration, () => {
      this.gravityFlipped = false;
      this.setGravityY(0);
      this.setFlipY(false);
    });
  }

  teleportTo(x: number, y: number): void {
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    if (this.scene.cache.audio.exists('teleport')) this.scene.sound.play('teleport', { volume: 0.5 });

    // Brief stun
    this.canMove = false;
    this.scene.time.delayedCall(200, () => {
      this.canMove = true;
    });
  }

  isAlive(): boolean {
    return !this.isDead;
  }

  isGravityFlipped(): boolean {
    return this.gravityFlipped;
  }

  setOnIce(value: boolean): void {
    this.onIce = value;
  }

  freeze(): void {
    this.canMove = false;
    this.setVelocity(0, 0);
  }

  unfreeze(): void {
    this.canMove = true;
  }

  destroy(fromScene?: boolean): void {
    if (this.dustEmitter) {
      this.dustEmitter.destroy();
    }
    super.destroy(fromScene);
  }
}
