import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/gameConfig';
import { Player } from '../entities/Player';
import { Goal } from '../entities/Goal';
import { Coin } from '../entities/Coin';
import { ScoreManager } from '../systems/ScoreManager';
import { TimerManager } from '../systems/TimerManager';
import { LevelLoader, BUNDLED_LEVELS, LevelJSON } from '../systems/LevelLoader';
import { TrapPlacement } from '../generation/TrapPlacer';
import { BaseTrap } from '../traps/BaseTrap';
import { CollapsingPlatform } from '../traps/CollapsingPlatform';
import { SuddenSpike } from '../traps/SuddenSpike';
import { CrushingBlock } from '../traps/CrushingBlock';
import { LaserBeam } from '../traps/LaserBeam';
import { TeleportTrap } from '../traps/TeleportTrap';
import { ReverseGravity } from '../traps/ReverseGravity';
import { MovingPlatform } from '../traps/MovingPlatform';
import { BouncePad } from '../traps/BouncePad';
import { FakeFloor } from '../traps/FakeFloor';
import { Sawblade } from '../traps/Sawblade';
import { IcePlatform } from '../traps/IcePlatform';

// Color themes
const THEMES = [
  { name: 'blue', bg: 0x1a2a3a, platform: 0x0d1520 },
  { name: 'purple', bg: 0x2a1a3a, platform: 0x150d20 },
  { name: 'green', bg: 0x1a3a2a, platform: 0x0d2015 },
  { name: 'red', bg: 0x3a1a1a, platform: 0x200d0d },
  { name: 'teal', bg: 0x1a3a3a, platform: 0x0d2020 },
  { name: 'orange', bg: 0x3a2a1a, platform: 0x20150d },
];

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private goal!: Goal;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private traps: BaseTrap[] = [];
  private collapsingPlatforms: CollapsingPlatform[] = [];
  private scoreManager!: ScoreManager;
  private timerManager!: TimerManager;
  private levelLoader!: LevelLoader;
  private playerName: string = 'PLAYER';
  private levelTransitioning: boolean = false;
  private isTestMode: boolean = false;

  // Theme
  private currentTheme: { name: string; bg: number; platform: number } = THEMES[0];

  // Coins
  private coins: Coin[] = [];

  // New trap tracking arrays
  private movingPlatforms: MovingPlatform[] = [];
  private bouncePads: BouncePad[] = [];
  private fakeFloors: FakeFloor[] = [];
  private sawblades: Sawblade[] = [];
  private icePlatforms: IcePlatform[] = [];

  // UI elements
  private timerText!: Phaser.GameObjects.Text;
  private deathText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private levelNameText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { playerName?: string; testMode?: boolean }): void {
    this.playerName = data.playerName || 'PLAYER';
    this.isTestMode = data.testMode || false;
    this.levelTransitioning = false;
  }

  create(): void {
    // Initialize managers
    this.scoreManager = new ScoreManager();
    this.timerManager = new TimerManager(this);
    this.levelLoader = new LevelLoader();

    // Load levels
    if (this.isTestMode) {
      // Test mode - load single level from registry
      const testLevel = this.registry.get('testLevel') as LevelJSON;
      if (testLevel) {
        this.levelLoader.addLevel(testLevel);
      }
    } else {
      // Normal mode - load bundled levels
      this.levelLoader.loadFromArray(BUNDLED_LEVELS);
    }

    // Create platform group
    this.platforms = this.physics.add.staticGroup();

    // Create UI
    this.createUI();

    // Start background music
    if (this.cache.audio.exists('bgMusic')) {
      const existingMusic = this.sound.get('bgMusic');
      if (!existingMusic || !existingMusic.isPlaying) {
        this.sound.play('bgMusic', { loop: true, volume: 0.3 });
      }
    }

    // Load first level
    this.loadNextLevel();

    // Start timer (only in non-test mode)
    if (!this.isTestMode) {
      this.timerManager.start(
        () => this.onTimeUp(),
        (remaining, elapsed) => this.onTimerTick(remaining, elapsed)
      );
    }

    // Listen for player death
    this.events.on('playerDeath', this.onPlayerDeath, this);

    // Back to editor shortcut in test mode
    if (this.isTestMode) {
      this.input.keyboard?.on('keydown-ESC', () => {
        this.scene.start('LevelEditorScene');
      });
    }

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private createUI(): void {
    const padding = 10;
    const fontSize = '16px';

    // Timer (top center) - hidden in test mode
    this.timerText = this.add.text(GAME_WIDTH / 2, padding, '1:00', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
    });
    this.timerText.setOrigin(0.5, 0);
    this.timerText.setScrollFactor(0);
    this.timerText.setDepth(100);
    if (this.isTestMode) {
      this.timerText.setText('TEST MODE');
      this.timerText.setColor('#ffaa00');
    }

    // Deaths (top left)
    this.deathText = this.add.text(padding, padding, 'Deaths: 0', {
      fontSize,
      color: '#e94560',
      fontFamily: 'Arial, sans-serif',
    });
    this.deathText.setScrollFactor(0);
    this.deathText.setDepth(100);

    // Level (top right)
    this.levelText = this.add.text(GAME_WIDTH - padding, padding, 'Level: 1', {
      fontSize,
      color: '#00ff88',
      fontFamily: 'Arial, sans-serif',
    });
    this.levelText.setOrigin(1, 0);
    this.levelText.setScrollFactor(0);
    this.levelText.setDepth(100);

    // Level name (below level number)
    this.levelNameText = this.add.text(GAME_WIDTH - padding, padding + 20, '', {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'Arial, sans-serif',
    });
    this.levelNameText.setOrigin(1, 0);
    this.levelNameText.setScrollFactor(0);
    this.levelNameText.setDepth(100);

    // Score (below timer)
    this.scoreText = this.add.text(GAME_WIDTH / 2, padding + 30, 'Score: 10000', {
      fontSize: '14px',
      color: '#ffd700',
      fontFamily: 'Arial, sans-serif',
    });
    this.scoreText.setOrigin(0.5, 0);
    this.scoreText.setScrollFactor(0);
    this.scoreText.setDepth(100);

    // Coins (below deaths)
    this.coinText = this.add.text(padding, padding + 22, 'Coins: 0', {
      fontSize: '14px',
      color: '#ffd700',
      fontFamily: 'Arial, sans-serif',
    });
    this.coinText.setScrollFactor(0);
    this.coinText.setDepth(100);

    // Combo (below coins)
    this.comboText = this.add.text(padding, padding + 40, '', {
      fontSize: '14px',
      color: '#00ffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    this.comboText.setScrollFactor(0);
    this.comboText.setDepth(100);

    // Test mode hint
    if (this.isTestMode) {
      const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Press ESC to return to editor', {
        fontSize: '12px',
        color: '#666666',
      });
      hint.setOrigin(0.5);
      hint.setDepth(100);
    }
  }

  private loadNextLevel(): void {
    // Reset transition flag
    this.levelTransitioning = false;

    // Clear existing level
    this.clearLevel();

    // Get next level
    const levelData = this.levelLoader.getNextLevel();

    if (!levelData) {
      // No more levels - game complete!
      if (this.isTestMode) {
        this.scene.start('LevelEditorScene');
      } else {
        this.endGame();
      }
      return;
    }

    // Pick a random theme
    this.currentTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    this.cameras.main.setBackgroundColor(this.currentTheme.bg);

    // Create platforms
    this.createPlatforms(levelData.platforms);

    // Create player
    this.player = new Player(this, levelData.startX, levelData.startY);
    this.player.setRespawnPoint(levelData.startX, levelData.startY);

    // Create goal
    this.goal = new Goal(this, levelData.goalX, levelData.goalY - TILE_SIZE / 2);

    // Create traps
    this.createTraps(levelData.traps);

    // Create coins
    this.createCoins(levelData.coins);

    // Set up collisions
    this.setupCollisions();

    // Update UI
    const levelNum = this.levelLoader.getCurrentLevelNumber();
    this.levelText.setText(`Level: ${levelNum}/${this.levelLoader.getLevelCount()}`);
    this.levelNameText.setText(levelData.name);

    // Show level intro
    this.showLevelIntro(levelData.name);
  }

  private showLevelIntro(levelName: string): void {
    const introText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, levelName, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    introText.setOrigin(0.5);
    introText.setDepth(200);
    introText.setAlpha(0);

    this.tweens.add({
      targets: introText,
      alpha: 1,
      duration: 300,
      yoyo: true,
      hold: 500,
      onComplete: () => introText.destroy(),
    });
  }

  private clearLevel(): void {
    // Destroy player
    if (this.player) {
      this.player.destroy();
    }

    // Destroy goal
    if (this.goal) {
      this.goal.destroy();
    }

    // Clear platforms
    this.platforms.clear(true, true);

    // Destroy traps
    for (const trap of this.traps) {
      trap.destroy();
    }
    this.traps = [];
    this.collapsingPlatforms = [];

    // Destroy moving platforms
    for (const movingPlat of this.movingPlatforms) {
      movingPlat.destroy();
    }
    this.movingPlatforms = [];

    // Destroy bounce pads
    for (const bouncePad of this.bouncePads) {
      bouncePad.destroy();
    }
    this.bouncePads = [];

    // Destroy fake floors
    for (const fakeFloor of this.fakeFloors) {
      fakeFloor.destroy();
    }
    this.fakeFloors = [];

    // Destroy sawblades
    for (const sawblade of this.sawblades) {
      sawblade.destroy();
    }
    this.sawblades = [];

    // Destroy ice platforms
    for (const icePlat of this.icePlatforms) {
      icePlat.destroy();
    }
    this.icePlatforms = [];

    // Destroy coins
    for (const coin of this.coins) {
      coin.destroy();
    }
    this.coins = [];
  }

  private createPlatforms(platforms: Array<{ x: number; y: number; width: number; height: number }>): void {
    for (const platform of platforms) {
      const plat = this.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        this.currentTheme.platform
      );
      this.platforms.add(plat);
    }
  }

  private createCoins(coinPositions: Array<{ x: number; y: number }>): void {
    for (const pos of coinPositions) {
      const coin = new Coin(this, pos.x, pos.y);
      this.coins.push(coin);
    }
  }

  private createTraps(trapPlacements: TrapPlacement[]): void {
    for (const placement of trapPlacements) {
      const worldPos = {
        x: placement.gridX * TILE_SIZE + TILE_SIZE / 2,
        y: placement.gridY * TILE_SIZE + TILE_SIZE / 2,
      };

      let trap: BaseTrap;

      switch (placement.type) {
        case 'collapsing':
          const collapsingTrap = new CollapsingPlatform(this, {
            x: worldPos.x,
            y: worldPos.y,
            color: this.currentTheme.platform,
          });
          this.collapsingPlatforms.push(collapsingTrap);
          trap = collapsingTrap;
          break;

        case 'spike':
          trap = new SuddenSpike(this, {
            x: worldPos.x,
            y: worldPos.y,
            direction: (placement.config?.direction as 'up' | 'down') || 'up',
          });
          break;

        case 'crushing':
          trap = new CrushingBlock(this, {
            x: worldPos.x,
            y: worldPos.y,
          });
          break;

        case 'laser':
          trap = new LaserBeam(this, {
            x: worldPos.x,
            y: worldPos.y,
            height: (placement.config?.height as number) || TILE_SIZE * 5,
            endX: placement.config?.endX as number | undefined,
            endY: placement.config?.endY as number | undefined,
          });
          break;

        case 'teleport':
          trap = new TeleportTrap(this, {
            x: worldPos.x,
            y: worldPos.y,
            targetX: (placement.config?.targetX as number) || worldPos.x + TILE_SIZE * 5,
            targetY: (placement.config?.targetY as number) || worldPos.y,
          });
          break;

        case 'gravity':
          trap = new ReverseGravity(this, {
            x: worldPos.x,
            y: worldPos.y,
          });
          break;

        case 'moving':
          const movingPlat = new MovingPlatform(this, {
            x: worldPos.x,
            y: worldPos.y,
            direction: (placement.config?.direction as 'horizontal' | 'vertical') || 'horizontal',
            distance: (placement.config?.distance as number) || TILE_SIZE * 3,
            speed: (placement.config?.speed as number) || 80,
            color: this.currentTheme.platform,
          });
          this.movingPlatforms.push(movingPlat);
          continue;

        case 'bounce':
          const bouncePad = new BouncePad(this, {
            x: worldPos.x,
            y: worldPos.y,
            bouncePower: (placement.config?.bouncePower as number) || -700,
          });
          this.bouncePads.push(bouncePad);
          continue;

        case 'fakefloor':
          const fakeFloor = new FakeFloor(this, {
            x: worldPos.x,
            y: worldPos.y,
            color: this.currentTheme.platform,
          });
          this.fakeFloors.push(fakeFloor);
          continue;

        case 'sawblade':
          const sawblade = new Sawblade(this, {
            x: worldPos.x,
            y: worldPos.y,
            pathPoints: (placement.config?.pathPoints as Array<{ x: number; y: number }>) || [
              { x: worldPos.x, y: worldPos.y },
              { x: worldPos.x + TILE_SIZE * 3, y: worldPos.y },
            ],
            speed: (placement.config?.speed as number) || 100,
          });
          this.sawblades.push(sawblade);
          continue;

        case 'ice':
          const icePlat = new IcePlatform(this, {
            x: worldPos.x,
            y: worldPos.y,
          });
          this.icePlatforms.push(icePlat);
          continue;

        default:
          continue;
      }

      this.traps.push(trap);
    }
  }

  private setupCollisions(): void {
    // Player-platform collision
    this.physics.add.collider(this.player, this.platforms);

    // Player-goal overlap
    this.physics.add.overlap(this.player, this.goal, () => this.onReachGoal());

    // Collapsing platform collisions
    for (const collapsingPlatform of this.collapsingPlatforms) {
      const hitbox = collapsingPlatform.getPlatformBody();
      if (hitbox) {
        this.physics.add.collider(this.player, hitbox, () => {
          collapsingPlatform.trigger();
        });
      }
    }

    // Trap collisions/overlaps
    for (const trap of this.traps) {
      const hitbox = trap.getHitbox();
      if (hitbox) {
        if (trap instanceof TeleportTrap || trap instanceof ReverseGravity) {
          this.physics.add.overlap(this.player, hitbox, () => {
            trap.trigger(this.player);
          });
        } else if (!(trap instanceof CollapsingPlatform)) {
          this.physics.add.overlap(this.player, hitbox, () => {
            this.player.die();
          });
        }
      }
    }

    // Moving platform collisions
    for (const movingPlat of this.movingPlatforms) {
      this.physics.add.collider(this.player, movingPlat.getHitbox());
    }

    // Bounce pad collisions
    for (const bouncePad of this.bouncePads) {
      this.physics.add.overlap(this.player, bouncePad.getHitbox(), () => {
        bouncePad.trigger(this.player);
      });
    }

    // Fake floor collisions
    for (const fakeFloor of this.fakeFloors) {
      this.physics.add.overlap(this.player, fakeFloor.getHitbox(), () => {
        if (!fakeFloor.isTriggered()) {
          fakeFloor.trigger();
        }
      });
    }

    // Sawblade collisions
    for (const sawblade of this.sawblades) {
      this.physics.add.overlap(this.player, sawblade.getHitbox(), () => {
        this.player.die();
      });
    }

    // Ice platform collisions
    for (const icePlat of this.icePlatforms) {
      this.physics.add.collider(this.player, icePlat.getHitbox());
    }

    // Coin collisions
    for (const coin of this.coins) {
      this.physics.add.overlap(this.player, coin.getHitbox(), () => {
        if (!coin.isCollected()) {
          const value = coin.collect();
          this.scoreManager.addCoin(value);
          this.updateCoinUI();
        }
      });
    }
  }

  update(_time: number, _delta: number): void {
    if (this.player && !this.levelTransitioning) {
      this.player.update();

      // Update proximity-based traps
      for (const trap of this.traps) {
        if (trap instanceof SuddenSpike || trap instanceof CrushingBlock) {
          trap.update(this.player);
        }
      }

      // Update moving platforms
      for (const movingPlat of this.movingPlatforms) {
        movingPlat.update();
      }

      // Check if player is on ice platform
      let playerOnIce = false;
      for (const icePlat of this.icePlatforms) {
        if (icePlat.isPlayerOnPlatform(this.player)) {
          playerOnIce = true;
          break;
        }
      }
      this.player.setOnIce(playerOnIce);
    }

    // Update score display
    this.scoreText.setText(`Score: ${this.scoreManager.calculateFinalScore()}`);
    this.updateComboUI();
  }

  private updateCoinUI(): void {
    this.coinText.setText(`Coins: ${this.scoreManager.getCoins()}`);
  }

  private updateComboUI(): void {
    const combo = this.scoreManager.getCombo();
    if (combo > 0) {
      const multiplier = this.scoreManager.getComboMultiplier();
      this.comboText.setText(`${combo}x Streak! (${multiplier}x)`);
      this.comboText.setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  private onPlayerDeath(data?: { x: number; y: number }): void {
    this.scoreManager.addDeath();
    this.deathText.setText(`Deaths: ${this.scoreManager.getDeaths()}`);
    this.updateComboUI();

    // Create death effect
    if (data && data.y < GAME_HEIGHT && data.y > 0) {
      this.createDeathSparkles(data.x, data.y);
    }

    // Reset traps
    for (const trap of this.traps) {
      trap.reset();
    }

    // Reset fake floors
    for (const fakeFloor of this.fakeFloors) {
      fakeFloor.reset();
    }
  }

  private createDeathSparkles(x: number, y: number): void {
    const sparkleCount = 12;
    const colors = [0x00ff88, 0x50ffa8, 0x80ffbb, 0xaaffcc];

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = this.physics.add.sprite(x, y, 'sparkle');
      sparkle.setTint(Phaser.Utils.Array.GetRandom(colors));

      const angle = (i / sparkleCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 200 + Math.random() * 200;
      sparkle.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 150
      );

      sparkle.setBounce(0.6 + Math.random() * 0.3);
      sparkle.setDrag(50);
      sparkle.setScale(0.8 + Math.random() * 0.6);

      this.physics.add.collider(sparkle, this.platforms);

      this.tweens.add({
        targets: sparkle,
        alpha: 0,
        scale: 0,
        duration: 1500 + Math.random() * 500,
        ease: 'Power2',
        onComplete: () => sparkle.destroy(),
      });

      this.tweens.add({
        targets: sparkle,
        angle: 360 * (Math.random() > 0.5 ? 1 : -1),
        duration: 800,
        repeat: 2,
      });
    }
  }

  private onReachGoal(): void {
    if (!this.player.isAlive() || this.levelTransitioning) return;

    this.levelTransitioning = true;
    this.player.freeze();
    this.scoreManager.completeLevel();

    // Level complete effects
    if (this.cache.audio.exists('levelComplete')) {
      this.sound.play('levelComplete', { volume: 0.6 });
    }
    this.cameras.main.flash(200, 255, 215, 0);

    // Show level complete message
    const completeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'LEVEL COMPLETE!', {
      fontSize: '32px',
      color: '#ffd700',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    completeText.setOrigin(0.5);
    completeText.setDepth(200);

    this.tweens.add({
      targets: completeText,
      scale: 1.2,
      duration: 200,
      yoyo: true,
      onComplete: () => {
        this.time.delayedCall(500, () => {
          completeText.destroy();

          // Check if there are more levels
          if (this.levelLoader.hasMoreLevels()) {
            this.loadNextLevel();
          } else {
            // All levels complete!
            if (this.isTestMode) {
              this.scene.start('LevelEditorScene');
            } else {
              this.showAllLevelsComplete();
            }
          }
        });
      },
    });
  }

  private showAllLevelsComplete(): void {
    const completeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ALL LEVELS COMPLETE!', {
      fontSize: '28px',
      color: '#00ff88',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    completeText.setOrigin(0.5);
    completeText.setDepth(200);

    this.time.delayedCall(2000, () => {
      this.endGame();
    });
  }

  private onTimerTick(remaining: number, elapsed: number): void {
    this.timerText.setText(this.timerManager.getFormattedTime());
    this.scoreManager.updateTime(elapsed);

    if (remaining <= 30) {
      this.timerText.setColor('#e94560');
      if (remaining <= 10) {
        this.timerText.setScale(1.1);
      }
    }
  }

  private onTimeUp(): void {
    this.player.freeze();

    const timeUpText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'TIME UP!', {
      fontSize: '48px',
      color: '#e94560',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    timeUpText.setOrigin(0.5);
    timeUpText.setDepth(200);

    this.time.delayedCall(1500, () => {
      this.endGame();
    });
  }

  private endGame(): void {
    const finalScore = this.scoreManager.calculateFinalScore();
    const breakdown = this.scoreManager.getScoreBreakdown();

    this.scene.start('GameOverScene', {
      playerName: this.playerName,
      score: finalScore,
      breakdown,
      deaths: this.scoreManager.getDeaths(),
      levels: this.scoreManager.getLevelsCompleted(),
      time: this.scoreManager.getElapsedSeconds(),
    });
  }

  shutdown(): void {
    this.events.off('playerDeath', this.onPlayerDeath, this);
    this.timerManager.destroy();
    this.clearLevel();
  }
}
