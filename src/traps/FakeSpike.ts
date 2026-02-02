import Phaser from 'phaser';
import { SIZE, FONT, TILE_SIZE, sz, font } from '../config/gameConfig';

export interface FakeSpikeConfig {
  x: number;
  y: number;
  direction?: 'up' | 'down';
}

/**
 * FakeSpike - Looks exactly like deadly spikes but is completely harmless.
 * Psychological trap that makes players avoid the safe path.
 */
export class FakeSpike extends Phaser.GameObjects.Container {
  private spikesContainer: Phaser.GameObjects.Container;
  private gameScene: Phaser.Scene;
  private revealed: boolean = false;

  constructor(scene: Phaser.Scene, config: FakeSpikeConfig) {
    super(scene, config.x, config.y);

    this.gameScene = scene;
    scene.add.existing(this);

    const direction = config.direction || 'up';

    // Create container for spikes
    this.spikesContainer = scene.add.container(0, 0);

    // Create 4 small spikes (looks identical to real SuddenSpike)
    const numSpikes = 4;
    const spikeWidth = sz(SIZE.SPIKE_WIDTH);
    const spikeHeight = sz(SIZE.SPIKE_HEIGHT);
    const spacing = sz(SIZE.SPIKE_SPACING);
    const totalWidth = (numSpikes - 1) * spacing + spikeWidth;
    const startX = -totalWidth / 2 + spikeWidth / 2;

    // Small platform base
    const baseWidth = totalWidth + sz(SIZE.SPIKE_BASE_HEIGHT) * 1.5;
    const baseHeight = sz(SIZE.SPIKE_BASE_HEIGHT);
    const baseY = direction === 'up' ? spikeHeight / 2 + baseHeight / 2 : -spikeHeight / 2 - baseHeight / 2;
    const base = scene.add.rectangle(0, baseY, baseWidth, baseHeight, 0x333333);
    this.spikesContainer.add(base);

    for (let i = 0; i < numSpikes; i++) {
      const x = startX + i * spacing;
      let spike: Phaser.GameObjects.Triangle;

      if (direction === 'up') {
        // Triangle pointing up - black spikes (looks deadly)
        spike = scene.add.triangle(x, 0, 0, spikeHeight, spikeWidth / 2, 0, spikeWidth, spikeHeight, 0x000000);
      } else {
        // Triangle pointing down
        spike = scene.add.triangle(x, 0, 0, 0, spikeWidth / 2, spikeHeight, spikeWidth, 0, 0x000000);
      }
      this.spikesContainer.add(spike);
    }

    // Position spikes at bottom/top of tile (same as SuddenSpike's extendedY)
    if (direction === 'up') {
      this.spikesContainer.setY(TILE_SIZE / 2 - spikeHeight / 2 - baseHeight);
    } else {
      this.spikesContainer.setY(-TILE_SIZE / 2 + spikeHeight / 2 + baseHeight);
    }

    this.add(this.spikesContainer);
    this.setDepth(3);

    // NO hitbox - player can pass through safely!
  }

  /**
   * Called when player touches the fake spike - reveals it's harmless
   */
  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;

    // Flash green to show it's safe
    this.gameScene.cameras.main.flash(100, 0, 255, 0, false);

    // Fade to show it's fake
    this.gameScene.tweens.add({
      targets: this.spikesContainer,
      alpha: 0.3,
      duration: 300,
    });

    // Add "FAKE!" text briefly
    const fakeText = this.gameScene.add.text(this.x, this.y - sz(0.33), 'FAKE!', {
      fontSize: font(FONT.CAPTION),
      color: '#00ff00',
      fontStyle: 'bold',
    });
    fakeText.setOrigin(0.5);
    fakeText.setDepth(100);

    this.gameScene.tweens.add({
      targets: fakeText,
      y: fakeText.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => fakeText.destroy(),
    });
  }

  isRevealed(): boolean {
    return this.revealed;
  }

  reset(): void {
    this.gameScene.tweens.killTweensOf(this.spikesContainer);
    this.revealed = false;
    this.spikesContainer.setAlpha(1);
  }

  destroy(fromScene?: boolean): void {
    this.gameScene.tweens.killTweensOf(this.spikesContainer);
    super.destroy(fromScene);
  }
}
