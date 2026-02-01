import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

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
  }

  create(): void {
    // Create graphics for game elements (no external assets needed)
    this.createPlayerTexture();
    this.createPlatformTexture();
    this.createGoalTexture();
    this.createSpikeTexture();
    this.createLaserTexture();
    this.createCrushingBlockTexture();
    this.createTeleportTexture();
    this.createGravityZoneTexture();
    this.createParticleTexture();

    // Show loading complete and transition
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'JUNIE GLITCH RUN', {
      fontSize: '48px',
      color: '#e94560',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Loading...', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    });
    subtitle.setOrigin(0.5);

    this.time.delayedCall(500, () => {
      this.scene.start('NameEntryScene');
    });
  }

  private createPlayerTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    graphics.fillStyle(0x00ff88, 0.3);
    graphics.fillRoundedRect(-2, -2, 28, 28, 4);
    // Main body
    graphics.fillStyle(0x00ff88, 1);
    graphics.fillRoundedRect(0, 0, 24, 24, 3);
    // Inner highlight
    graphics.fillStyle(0x50ffa8, 1);
    graphics.fillRoundedRect(3, 3, 10, 10, 2);
    // Eyes
    graphics.fillStyle(0x1a1a2e, 1);
    graphics.fillRect(6, 8, 4, 4);
    graphics.fillRect(14, 8, 4, 4);
    graphics.generateTexture('player', 28, 28);
    graphics.destroy();
  }

  private createPlatformTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Main platform with gradient effect
    graphics.fillStyle(0x3d3d5c, 1);
    graphics.fillRect(0, 0, 32, 32);
    // Top highlight
    graphics.fillStyle(0x5a5a8a, 1);
    graphics.fillRect(0, 0, 32, 4);
    // Bottom shadow
    graphics.fillStyle(0x2a2a3a, 1);
    graphics.fillRect(0, 28, 32, 4);
    // Side highlights
    graphics.fillStyle(0x4a4a6a, 1);
    graphics.fillRect(0, 4, 2, 24);
    // Grid pattern
    graphics.lineStyle(1, 0x4a4a6a, 0.5);
    graphics.strokeRect(4, 4, 24, 24);
    graphics.generateTexture('platform', 32, 32);
    graphics.destroy();

    // Collapsing platform (warning colors)
    const collapsingGraphics = this.make.graphics({ x: 0, y: 0 });
    collapsingGraphics.fillStyle(0x8b4513, 1);
    collapsingGraphics.fillRect(0, 0, 32, 32);
    // Cracks pattern
    collapsingGraphics.lineStyle(2, 0x654321, 1);
    collapsingGraphics.beginPath();
    collapsingGraphics.moveTo(8, 0);
    collapsingGraphics.lineTo(12, 16);
    collapsingGraphics.lineTo(6, 32);
    collapsingGraphics.stroke();
    collapsingGraphics.beginPath();
    collapsingGraphics.moveTo(24, 0);
    collapsingGraphics.lineTo(20, 12);
    collapsingGraphics.lineTo(26, 32);
    collapsingGraphics.stroke();
    // Warning stripes
    collapsingGraphics.fillStyle(0xffaa00, 0.3);
    for (let i = 0; i < 4; i++) {
      collapsingGraphics.fillRect(i * 10, 0, 5, 32);
    }
    collapsingGraphics.generateTexture('collapsing-platform', 32, 32);
    collapsingGraphics.destroy();

    // Fake wall texture (looks identical to platform)
    const fakeWallGraphics = this.make.graphics({ x: 0, y: 0 });
    fakeWallGraphics.fillStyle(0x3d3d5c, 1);
    fakeWallGraphics.fillRect(0, 0, 32, 32);
    fakeWallGraphics.fillStyle(0x5a5a8a, 1);
    fakeWallGraphics.fillRect(0, 0, 32, 4);
    fakeWallGraphics.fillStyle(0x2a2a3a, 1);
    fakeWallGraphics.fillRect(0, 28, 32, 4);
    fakeWallGraphics.lineStyle(1, 0x4a4a6a, 0.5);
    fakeWallGraphics.strokeRect(4, 4, 24, 24);
    fakeWallGraphics.generateTexture('fake-wall', 32, 32);
    fakeWallGraphics.destroy();
  }

  private createGoalTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Door frame
    graphics.fillStyle(0x8b7355, 1);
    graphics.fillRect(0, 0, 32, 48);
    // Door
    graphics.fillStyle(0xffd700, 1);
    graphics.fillRect(4, 4, 24, 40);
    // Door shine
    graphics.fillStyle(0xffec8b, 1);
    graphics.fillRect(6, 6, 8, 36);
    // Door handle
    graphics.fillStyle(0xdaa520, 1);
    graphics.fillCircle(22, 26, 3);
    // Glow effect
    graphics.fillStyle(0xffd700, 0.3);
    graphics.fillRect(-4, -4, 40, 56);
    graphics.generateTexture('goal', 40, 56);
    graphics.destroy();
  }

  private createSpikeTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Spike with metallic look
    graphics.fillStyle(0xc0c0c0, 1);
    graphics.beginPath();
    graphics.moveTo(16, 2);
    graphics.lineTo(30, 32);
    graphics.lineTo(2, 32);
    graphics.closePath();
    graphics.fillPath();
    // Highlight
    graphics.fillStyle(0xe8e8e8, 1);
    graphics.beginPath();
    graphics.moveTo(16, 4);
    graphics.lineTo(10, 32);
    graphics.lineTo(6, 32);
    graphics.closePath();
    graphics.fillPath();
    // Red tip
    graphics.fillStyle(0xe94560, 1);
    graphics.beginPath();
    graphics.moveTo(16, 2);
    graphics.lineTo(20, 12);
    graphics.lineTo(12, 12);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture('spike', 32, 32);
    graphics.destroy();

    // Spike down (ceiling spike)
    const downGraphics = this.make.graphics({ x: 0, y: 0 });
    downGraphics.fillStyle(0xc0c0c0, 1);
    downGraphics.beginPath();
    downGraphics.moveTo(16, 30);
    downGraphics.lineTo(30, 0);
    downGraphics.lineTo(2, 0);
    downGraphics.closePath();
    downGraphics.fillPath();
    downGraphics.fillStyle(0xe8e8e8, 1);
    downGraphics.beginPath();
    downGraphics.moveTo(16, 28);
    downGraphics.lineTo(10, 0);
    downGraphics.lineTo(6, 0);
    downGraphics.closePath();
    downGraphics.fillPath();
    downGraphics.fillStyle(0xe94560, 1);
    downGraphics.beginPath();
    downGraphics.moveTo(16, 30);
    downGraphics.lineTo(20, 20);
    downGraphics.lineTo(12, 20);
    downGraphics.closePath();
    downGraphics.fillPath();
    downGraphics.generateTexture('spike-down', 32, 32);
    downGraphics.destroy();
  }

  private createLaserTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRect(0, 0, 4, 32);
    graphics.generateTexture('laser', 4, 32);
    graphics.destroy();

    // Laser emitter with tech look
    const emitterGraphics = this.make.graphics({ x: 0, y: 0 });
    emitterGraphics.fillStyle(0x2a2a3a, 1);
    emitterGraphics.fillRect(0, 0, 20, 32);
    emitterGraphics.fillStyle(0x3a3a4a, 1);
    emitterGraphics.fillRect(2, 2, 16, 28);
    // Lens
    emitterGraphics.fillStyle(0x330000, 1);
    emitterGraphics.fillCircle(10, 16, 6);
    emitterGraphics.fillStyle(0xff0000, 0.8);
    emitterGraphics.fillCircle(10, 16, 4);
    emitterGraphics.fillStyle(0xff6666, 1);
    emitterGraphics.fillCircle(8, 14, 2);
    emitterGraphics.generateTexture('laser-emitter', 20, 32);
    emitterGraphics.destroy();
  }

  private createCrushingBlockTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Main block
    graphics.fillStyle(0x4a4a5a, 1);
    graphics.fillRect(0, 0, 64, 32);
    // 3D effect top
    graphics.fillStyle(0x6a6a7a, 1);
    graphics.fillRect(0, 0, 64, 6);
    // 3D effect bottom
    graphics.fillStyle(0x2a2a3a, 1);
    graphics.fillRect(0, 26, 64, 6);
    // Danger stripes
    graphics.fillStyle(0xe94560, 1);
    for (let i = 0; i < 4; i++) {
      graphics.fillRect(i * 16 + 4, 8, 8, 16);
    }
    // Exactly 3 spikes at bottom, evenly spaced
    graphics.fillStyle(0xc0c0c0, 1);
    const spikePositions = [10, 32, 54]; // 3 evenly spaced spikes
    for (const xPos of spikePositions) {
      graphics.beginPath();
      graphics.moveTo(xPos - 8, 32);
      graphics.lineTo(xPos, 48);
      graphics.lineTo(xPos + 8, 32);
      graphics.closePath();
      graphics.fillPath();
    }
    graphics.generateTexture('crushing-block', 64, 48);
    graphics.destroy();
  }

  private createTeleportTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Outer ring
    graphics.fillStyle(0x9400d3, 0.4);
    graphics.fillCircle(16, 16, 16);
    // Middle ring
    graphics.fillStyle(0xba55d3, 0.6);
    graphics.fillCircle(16, 16, 12);
    // Inner swirl
    graphics.fillStyle(0xda70d6, 0.8);
    graphics.fillCircle(16, 16, 8);
    // Center
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 16, 3);
    graphics.generateTexture('teleport', 32, 32);
    graphics.destroy();
  }

  private createGravityZoneTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Background
    graphics.fillStyle(0x00bfff, 0.2);
    graphics.fillRect(0, 0, 64, 64);
    // Border
    graphics.lineStyle(3, 0x00bfff, 0.6);
    graphics.strokeRect(2, 2, 60, 60);
    // Multiple arrows pointing up
    graphics.fillStyle(0x00bfff, 0.8);
    for (let i = 0; i < 3; i++) {
      const offsetY = i * 20;
      graphics.beginPath();
      graphics.moveTo(32, 8 + offsetY);
      graphics.lineTo(42, 18 + offsetY);
      graphics.lineTo(22, 18 + offsetY);
      graphics.closePath();
      graphics.fillPath();
    }
    graphics.generateTexture('gravity-zone', 64, 64);
    graphics.destroy();
  }

  private createParticleTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    // Glowing particle
    graphics.fillStyle(0x00ff88, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.fillStyle(0x80ffbb, 1);
    graphics.fillCircle(3, 3, 2);
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();

    // Death sparkle (bright)
    const sparkleGraphics = this.make.graphics({ x: 0, y: 0 });
    sparkleGraphics.fillStyle(0x00ff88, 1);
    sparkleGraphics.fillRect(2, 0, 2, 6);
    sparkleGraphics.fillRect(0, 2, 6, 2);
    sparkleGraphics.generateTexture('sparkle', 6, 6);
    sparkleGraphics.destroy();
  }
}
