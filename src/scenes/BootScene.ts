import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FONT, font } from '../config/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load sound effects
    this.load.audio('bgMusic', 'sounds/background.mp3');
    this.load.audio('jump', 'sounds/jump.mp3');
    this.load.audio('death', 'sounds/death.mp3');
    this.load.audio('teleport', 'sounds/game-teleport-90735.mp3');
    this.load.audio('spawn', 'sounds/spawn.mp3');
    this.load.audio('collect', 'sounds/bag_Collect.mp3');
    this.load.audio('levelComplete', 'sounds/portal_close.mp3');
    this.load.audio('button', 'sounds/switch-button-106349.mp3');

    // Load Kodee character sprite sheets
    this.load.spritesheet('kodee-walk', 'animations/walking-kodee.png', {
      frameWidth: 160,
      frameHeight: 160,
    });
    this.load.spritesheet('kodee-jump', 'animations/jump-kodee.png', {
      frameWidth: 160,
      frameHeight: 160,
    });
  }

  create(): void {
    // Create graphics for game elements (no external assets needed)
    this.createPlayerTexture(); // Fallback texture
    this.createPlatformTexture();
    this.createGoalTexture();
    this.createSpikeTexture();
    this.createLaserTexture();
    this.createCrushingBlockTexture();
    this.createTeleportTexture();
    this.createGravityZoneTexture();
    this.createParticleTexture();
    this.createSawbladeTexture();
    this.createIceTexture();

    // Create Kodee animations
    this.createKodeeAnimations();

    const JBMONO = '"JetBrains Mono", monospace';

    // Purple background (Cloud9 theme)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x3b1fad);

    // Show loading complete and transition
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'GLITCH RUN', {
      fontSize: font(FONT.TITLE_MD),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Loading...', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    subtitle.setOrigin(0.5);

    this.time.delayedCall(500, () => {
      this.scene.start('NameEntryScene');
    });
  }

  private createPlayerTexture(): void {
    const size = TILE_SIZE;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow - Kotlin purple
    graphics.fillStyle(0x7F52FF, 0.4);
    graphics.fillRoundedRect(-2, -2, size + 4, size + 4, 6);
    // Main body - Kotlin purple
    graphics.fillStyle(0x7F52FF, 1);
    graphics.fillRoundedRect(0, 0, size, size, 5);
    // Inner highlight - Kotlin pink gradient
    graphics.fillStyle(0xB125EA, 1);
    graphics.fillRoundedRect(4, 4, size * 0.4, size * 0.4, 3);
    // Eyes - bright orange for contrast
    graphics.fillStyle(0xF88909, 1);
    graphics.fillRect(size * 0.2, size * 0.3, size * 0.15, size * 0.15);
    graphics.fillRect(size * 0.55, size * 0.3, size * 0.15, size * 0.15);
    graphics.generateTexture('player', size + 4, size + 4);
    graphics.destroy();
  }

  private createPlatformTexture(): void {
    const size = TILE_SIZE;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Clean white platform
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, size, size);
    // Subtle shadow
    graphics.fillStyle(0xe8e8e8, 1);
    graphics.fillRect(0, size - 6, size, 6);
    graphics.generateTexture('platform', size, size);
    graphics.destroy();

    // Collapsing platform - white with crack lines
    const collapsingGraphics = this.make.graphics({ x: 0, y: 0 });
    collapsingGraphics.fillStyle(0xffffff, 1);
    collapsingGraphics.fillRect(0, 0, size, size);
    // Crack lines - light gray
    collapsingGraphics.lineStyle(3, 0xcccccc, 1);
    collapsingGraphics.beginPath();
    collapsingGraphics.moveTo(size * 0.25, 0);
    collapsingGraphics.lineTo(size * 0.35, size / 2);
    collapsingGraphics.lineTo(size * 0.2, size);
    collapsingGraphics.stroke();
    collapsingGraphics.beginPath();
    collapsingGraphics.moveTo(size * 0.75, 0);
    collapsingGraphics.lineTo(size * 0.65, size * 0.4);
    collapsingGraphics.lineTo(size * 0.8, size);
    collapsingGraphics.stroke();
    collapsingGraphics.generateTexture('collapsing-platform', size, size);
    collapsingGraphics.destroy();

    // Fake wall texture (looks identical to platform)
    const fakeWallGraphics = this.make.graphics({ x: 0, y: 0 });
    fakeWallGraphics.fillStyle(0xffffff, 1);
    fakeWallGraphics.fillRect(0, 0, size, size);
    fakeWallGraphics.fillStyle(0xe8e8e8, 1);
    fakeWallGraphics.fillRect(0, size - 6, size, 6);
    fakeWallGraphics.generateTexture('fake-wall', size, size);
    fakeWallGraphics.destroy();
  }

  private createGoalTexture(): void {
    const size = TILE_SIZE;
    const width = size;
    const height = size * 1.5;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Door frame
    graphics.fillStyle(0x8b7355, 1);
    graphics.fillRect(4, 0, width - 8, height);
    // Door
    graphics.fillStyle(0xffd700, 1);
    graphics.fillRect(8, 4, width - 16, height - 8);
    // Door shine
    graphics.fillStyle(0xffec8b, 1);
    graphics.fillRect(10, 6, width * 0.25, height - 12);
    // Door handle
    graphics.fillStyle(0xdaa520, 1);
    graphics.fillCircle(width * 0.7, height / 2, 5);
    // Glow effect
    graphics.fillStyle(0xffd700, 0.3);
    graphics.fillRect(0, -4, width, height + 8);
    graphics.generateTexture('goal', width, height + 4);
    graphics.destroy();
  }

  private createSpikeTexture(): void {
    const size = TILE_SIZE;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White spike with blue accent
    graphics.fillStyle(0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(size / 2, 3);
    graphics.lineTo(size - 3, size);
    graphics.lineTo(3, size);
    graphics.closePath();
    graphics.fillPath();
    // Blue edge
    graphics.lineStyle(3, 0x00C6F2, 0.5);
    graphics.beginPath();
    graphics.moveTo(size / 2, 3);
    graphics.lineTo(size - 3, size);
    graphics.stroke();
    graphics.generateTexture('spike', size, size);
    graphics.destroy();

    // Spike down (ceiling spike)
    const downGraphics = this.make.graphics({ x: 0, y: 0 });
    downGraphics.fillStyle(0xffffff, 1);
    downGraphics.beginPath();
    downGraphics.moveTo(size / 2, size - 3);
    downGraphics.lineTo(size - 3, 0);
    downGraphics.lineTo(3, 0);
    downGraphics.closePath();
    downGraphics.fillPath();
    // Blue edge
    downGraphics.lineStyle(3, 0x00C6F2, 0.5);
    downGraphics.beginPath();
    downGraphics.moveTo(size / 2, size - 3);
    downGraphics.lineTo(size - 3, 0);
    downGraphics.stroke();
    downGraphics.generateTexture('spike-down', size, size);
    downGraphics.destroy();
  }

  private createLaserTexture(): void {
    const size = TILE_SIZE;
    // White laser with blue glow
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 6, size);
    graphics.generateTexture('laser', 6, size);
    graphics.destroy();

    // White emitter
    const emitterGraphics = this.make.graphics({ x: 0, y: 0 });
    emitterGraphics.fillStyle(0xffffff, 1);
    emitterGraphics.fillRect(0, 0, size * 0.5, size);
    // Blue accent
    emitterGraphics.lineStyle(3, 0x00C6F2, 0.5);
    emitterGraphics.strokeRect(0, 0, size * 0.5, size);
    // White lens with blue tint
    emitterGraphics.fillStyle(0x00C6F2, 0.3);
    emitterGraphics.fillCircle(size * 0.25, size / 2, 8);
    emitterGraphics.fillStyle(0xffffff, 1);
    emitterGraphics.fillCircle(size * 0.25, size / 2, 5);
    emitterGraphics.generateTexture('laser-emitter', size * 0.5, size);
    emitterGraphics.destroy();
  }

  private createCrushingBlockTexture(): void {
    const size = TILE_SIZE;
    const width = size * 2;
    const height = size * 1.5;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White crushing block
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, width, size);
    // Subtle shadow
    graphics.fillStyle(0xe8e8e8, 1);
    graphics.fillRect(0, size - 8, width, 8);
    // White spikes
    const spikeWidth = size * 0.3;
    const spikePositions = [width * 0.2, width * 0.5, width * 0.8];
    for (const xPos of spikePositions) {
      graphics.fillStyle(0xffffff, 1);
      graphics.beginPath();
      graphics.moveTo(xPos - spikeWidth / 2, size);
      graphics.lineTo(xPos, height);
      graphics.lineTo(xPos + spikeWidth / 2, size);
      graphics.closePath();
      graphics.fillPath();
    }
    graphics.generateTexture('crushing-block', width, height);
    graphics.destroy();
  }

  private createTeleportTexture(): void {
    const size = TILE_SIZE;
    const center = size / 2;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White teleport with blue glow
    graphics.fillStyle(0xffffff, 0.4);
    graphics.fillCircle(center, center, size / 2);
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillCircle(center, center, size * 0.4);
    graphics.lineStyle(3, 0x00C6F2, 0.5);
    graphics.strokeCircle(center, center, size * 0.35);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(center, center, size * 0.2);
    graphics.generateTexture('teleport', size, size);
    graphics.destroy();
  }

  private createGravityZoneTexture(): void {
    const size = TILE_SIZE;
    const center = size / 2;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White gravity zone with blue accents
    graphics.fillStyle(0xffffff, 0.2);
    graphics.fillRect(0, 0, size, size);
    // White border
    graphics.lineStyle(4, 0xffffff, 0.8);
    graphics.strokeRect(3, 3, size - 6, size - 6);
    // Circles
    graphics.lineStyle(3, 0xffffff, 0.4);
    graphics.strokeCircle(center, center, size * 0.38);
    graphics.strokeCircle(center, center, size * 0.25);
    // White arrows pointing up
    graphics.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 3; i++) {
      const offsetY = i * (size * 0.3);
      graphics.beginPath();
      graphics.moveTo(center, size * 0.15 + offsetY);
      graphics.lineTo(center + size * 0.15, size * 0.3 + offsetY);
      graphics.lineTo(center - size * 0.15, size * 0.3 + offsetY);
      graphics.closePath();
      graphics.fillPath();
    }
    graphics.generateTexture('gravity-zone', size, size);
    graphics.destroy();
  }

  private createParticleTexture(): void {
    const particleSize = TILE_SIZE * 0.2;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White particle
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(particleSize / 2, particleSize / 2, particleSize / 2);
    graphics.generateTexture('particle', particleSize, particleSize);
    graphics.destroy();

    // Death sparkle - white
    const sparkleSize = TILE_SIZE * 0.15;
    const sparkleGraphics = this.make.graphics({ x: 0, y: 0 });
    sparkleGraphics.fillStyle(0xffffff, 1);
    sparkleGraphics.fillRect(sparkleSize * 0.33, 0, sparkleSize * 0.33, sparkleSize);
    sparkleGraphics.fillRect(0, sparkleSize * 0.33, sparkleSize, sparkleSize * 0.33);
    sparkleGraphics.generateTexture('sparkle', sparkleSize, sparkleSize);
    sparkleGraphics.destroy();
  }

  private createSawbladeTexture(): void {
    const size = TILE_SIZE;
    const center = size / 2;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White sawblade
    graphics.fillStyle(0xffffff, 0.5);
    graphics.fillCircle(center, center, size / 2);
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.strokeCircle(center, center, size * 0.45);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(center, center, size * 0.2);
    graphics.generateTexture('sawblade', size, size);
    graphics.destroy();
  }

  private createIceTexture(): void {
    const size = TILE_SIZE;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // White ice/slow zone
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillRect(0, 0, size, size);
    graphics.lineStyle(2, 0xffffff, 0.5);
    graphics.strokeRect(3, 3, size - 6, size - 6);
    graphics.generateTexture('ice', size, size);
    graphics.destroy();
  }

  private createKodeeAnimations(): void {
    // Walking animation (4x4 grid = 16 frames from walking spritesheet)
    this.anims.create({
      key: 'kodee-walk',
      frames: this.anims.generateFrameNumbers('kodee-walk', { start: 0, end: 22 }),
      frameRate: 64,
      repeat: -1,
    });

    // Idle animation (use first frame of jump)
    this.anims.create({
      key: 'kodee-idle',
      frames: this.anims.generateFrameNumbers('kodee-jump', { start: 0, end: 0 }),
      frameRate: 1,
      repeat: 0,
    });

    // Jump animation (5x4 grid, using frames 0-16)
    this.anims.create({
      key: 'kodee-jump',
      frames: this.anims.generateFrameNumbers('kodee-jump', { start: 0, end: 16 }),
      frameRate: 16,
      repeat: 0,
    });

    // Fall animation (use latter part of jump)
    this.anims.create({
      key: 'kodee-fall',
      frames: this.anims.generateFrameNumbers('kodee-jump', { start: 10, end: 16 }),
      frameRate: 10,
      repeat: -1,
    });
  }
}
