import Phaser from 'phaser';
import { PLAYER_CONFIG, GAME_HEIGHT, SIZE, sz } from '../config/gameConfig';

// Platform color for particles
const PLATFORM_COLOR = 0x0a032f;

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
  private deathParticles: Phaser.GameObjects.Rectangle[] = [];
  private particleCollider: Phaser.Physics.Arcade.Collider | null = null;

  // Animation state
  private currentAnim: string = 'kodee-idle';
  private readonly SPRITE_SCALE = 0.38; // Scale sprite to ~60px for larger tiles

  // Reference to platforms for particle collisions
  private platformsGroup: Phaser.Physics.Arcade.StaticGroup | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Use kodee-walk spritesheet as base texture
    super(scene, x, y, 'kodee-walk');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.respawnPoint = { x, y };

    this.setCollideWorldBounds(false);
    this.setBounce(0);

    // Scale down the sprite and set hitbox
    this.setScale(this.SPRITE_SCALE);
    this.setSize(90, 152); // Hitbox size before scaling
    this.setOffset(20, 0); // Center hitbox properly

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Create dust particle emitter
    this.createDustEmitter();

    // Initial spawn effect - start invisible and gather particles
    this.setAlpha(0);
    this.canMove = false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) body.enable = false;

    this.gatherParticles(x, y, () => {
      this.setAlpha(1);
      this.canMove = true;
      if (body) body.enable = true;
      this.play('kodee-idle');
    });
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

  setPlatforms(platforms: Phaser.Physics.Arcade.StaticGroup): void {
    this.platformsGroup = platforms;
  }

  private explodeParticles(fromX: number, fromY: number): void {
    // Clear any existing particles
    this.clearDeathParticles();

    const particleCount = 20;
    const particleSize = sz(0.15);

    const physicsParticles: Phaser.GameObjects.Rectangle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.rectangle(fromX, fromY, particleSize, particleSize, PLATFORM_COLOR);
      particle.setDepth(50);

      // Add physics to the particle
      this.scene.physics.add.existing(particle);
      const body = particle.body as Phaser.Physics.Arcade.Body;

      // Random explosion direction
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 200 + Math.random() * 200;
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed - 250; // Bias upward

      body.setVelocity(velocityX, velocityY);
      body.setBounce(0.6, 0.4);
      body.setGravityY(800);
      body.setDrag(20, 0);
      body.setAngularVelocity(Phaser.Math.Between(-400, 400));

      this.deathParticles.push(particle);
      physicsParticles.push(particle);
    }

    // Set up collision with platforms
    if (this.platformsGroup && physicsParticles.length > 0) {
      this.particleCollider = this.scene.physics.add.collider(physicsParticles, this.platformsGroup);
    }
  }

  private gatherParticles(toX: number, toY: number, onComplete: () => void): void {
    // Destroy collider first
    if (this.particleCollider) {
      this.particleCollider.destroy();
      this.particleCollider = null;
    }

    // Gather existing particles
    if (this.deathParticles.length > 0) {
      let completedCount = 0;
      const particleCount = this.deathParticles.length;

      for (let i = 0; i < particleCount; i++) {
        const particle = this.deathParticles[i];

        // Disable physics
        const body = particle.body as Phaser.Physics.Arcade.Body;
        if (body) {
          body.enable = false;
        }

        // Tween to target
        this.scene.tweens.add({
          targets: particle,
          x: toX,
          y: toY,
          scale: 0,
          rotation: 0,
          duration: 300,
          delay: i * 15,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            particle.destroy();
            completedCount++;
            if (completedCount >= particleCount) {
              this.deathParticles = [];
              onComplete();
            }
          },
        });
      }
    } else {
      // Create new particles for initial spawn
      this.createAndGatherParticles(toX, toY, onComplete);
    }
  }

  private createAndGatherParticles(toX: number, toY: number, onComplete: () => void): void {
    const particleCount = 20;
    const particleSize = sz(0.2); // Bigger particles
    let completedCount = 0;

    for (let i = 0; i < particleCount; i++) {
      // Start particles scattered around the target
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 60 + Math.random() * 40;
      const startX = toX + Math.cos(angle) * distance;
      const startY = toY + Math.sin(angle) * distance;

      const particle = this.scene.add.rectangle(startX, startY, particleSize, particleSize, PLATFORM_COLOR);
      particle.setDepth(50);
      particle.setScale(1);

      this.deathParticles.push(particle);

      // Move to target and shrink
      this.scene.tweens.add({
        targets: particle,
        x: toX,
        y: toY,
        scale: 0,
        duration: 350,
        delay: i * 12,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          particle.destroy();
          completedCount++;
          if (completedCount >= particleCount) {
            this.deathParticles = [];
            onComplete();
          }
        },
      });
    }
  }

  private clearDeathParticles(): void {
    // Destroy collider first
    if (this.particleCollider) {
      this.particleCollider.destroy();
      this.particleCollider = null;
    }

    for (const particle of this.deathParticles) {
      this.scene.tweens.killTweensOf(particle);
      particle.destroy();
    }
    this.deathParticles = [];
  }

  private emitDust(count: number = 5): void {
    if (this.dustEmitter) {
      const dustOffset = sz(SIZE.DUST_OFFSET);
      const groundY = this.gravityFlipped ? this.y - dustOffset : this.y + dustOffset;
      this.dustEmitter.setPosition(this.x, groundY);
      this.dustEmitter.explode(count);
    }
  }

  private updateAnimation(onGround: boolean, velocityX: number, velocityY: number): void {
    if (this.isDashing) return; // Don't change animation during dash

    let newAnim = this.currentAnim;

    if (!onGround) {
      // In the air
      if (velocityY < 0) {
        // Going up (jumping) - note: in Phaser, negative Y is up
        newAnim = this.gravityFlipped ? 'kodee-fall' : 'kodee-jump';
      } else {
        // Going down (falling)
        newAnim = this.gravityFlipped ? 'kodee-jump' : 'kodee-fall';
      }
    } else {
      // On ground
      if (Math.abs(velocityX) > 10) {
        newAnim = 'kodee-walk';
      } else {
        newAnim = 'kodee-idle';
      }
    }

    // Only change animation if different
    if (newAnim !== this.currentAnim) {
      this.currentAnim = newAnim;
      this.play(newAnim, true);
    }

    // Flip sprite based on direction
    if (velocityX < -10) {
      this.setFlipX(true);
    } else if (velocityX > 10) {
      this.setFlipX(false);
    }
  }

  update(): void {
    if (this.isDead || !this.canMove) return;
    if (!this.scene || !this.scene.game) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

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

    // Update animation based on current state
    this.updateAnimation(onGround, body.velocity.x, body.velocity.y);

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

    // Visual effect - tint and scale (Kotlin orange)
    this.setTint(0xF88909);
    this.setScale(this.SPRITE_SCALE * 1.3, this.SPRITE_SCALE * 0.8);

    // Create dash trail
    this.createDashTrail();

    // End dash after duration
    this.scene.time.delayedCall(this.dashDuration, () => {
      this.isDashing = false;
      this.clearTint();
      this.setScale(this.SPRITE_SCALE);
    });

    // Cooldown
    this.scene.time.delayedCall(this.dashCooldown, () => {
      this.canDash = true;
    });
  }

  private createDashTrail(): void {
    // Create 3 ghost images behind player (Kotlin gradient)
    const trailColors = [0xF88909, 0xE24462, 0xB125EA];
    const trailSize = sz(SIZE.DASH_TRAIL);
    const trailSpacing = sz(0.33);
    for (let i = 1; i <= 3; i++) {
      const ghost = this.scene.add.rectangle(
        this.x - (this.dashDirection * i * trailSpacing),
        this.y,
        trailSize,
        trailSize,
        trailColors[i - 1],
        0.5 - i * 0.12
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

    const deathX = this.x;
    const deathY = this.y;

    this.isDead = true;
    this.canMove = false;
    this.isDashing = false;
    this.clearTint();
    this.setScale(this.SPRITE_SCALE);
    this.setAlpha(0);

    // Disable physics body to prevent collisions while dead
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.enable = false;
    }

    // Create explosion particles
    this.explodeParticles(deathX, deathY);

    // Death sound and effect
    if (this.scene.cache.audio.exists('death')) this.scene.sound.play('death', { volume: 0.6 });
    this.scene.cameras.main.shake(150, 0.03);

    // Notify scene of death with position for sparkles
    this.scene.events.emit('playerDeath', { x: deathX, y: deathY });

    // Respawn after delay - particles will gather
    this.scene.time.delayedCall(800, () => {
      this.respawn();
    });
  }

  respawn(): void {
    // Move player to respawn point (still invisible)
    this.setPosition(this.respawnPoint.x, this.respawnPoint.y);
    this.setVelocity(0, 0);
    this.setAlpha(0);

    // Reset state but keep player inactive until particles gather
    this.isDashing = false;
    this.canDash = true;
    this.gravityFlipped = false;
    this.onIce = false;
    this.iceVelocity = 0;
    this.setGravityY(0);
    this.setFlipY(false);
    this.setFlipX(false);
    this.clearTint();
    this.setScale(this.SPRITE_SCALE);
    this.currentAnim = 'kodee-idle';

    // Gather particles to respawn point, then show player
    this.gatherParticles(this.respawnPoint.x, this.respawnPoint.y, () => {
      this.isDead = false;
      this.canMove = true;
      this.setAlpha(1);
      this.play('kodee-idle');

      // Re-enable physics body
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body) {
        body.enable = true;
      }

      if (this.scene.cache.audio.exists('spawn')) this.scene.sound.play('spawn', { volume: 0.5 });
    });
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
    this.play('kodee-idle');
  }

  unfreeze(): void {
    this.canMove = true;
  }

  destroy(fromScene?: boolean): void {
    if (this.dustEmitter) {
      this.dustEmitter.destroy();
    }
    this.clearDeathParticles();
    super.destroy(fromScene);
  }
}
