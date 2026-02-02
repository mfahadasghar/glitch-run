import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FONT, font } from '../config/gameConfig';
import { Player } from '../entities/Player';
import { Goal } from '../entities/Goal';
import { Coin } from '../entities/Coin';
import { ScoreManager } from '../systems/ScoreManager';
import { TimerManager } from '../systems/TimerManager';
import { LevelLoader, LevelJSON } from '../systems/LevelLoader';
import { TrapPlacement } from '../generation/TrapPlacer';
import { BaseTrap } from '../traps/BaseTrap';
import { supabaseService, LevelRecord } from '../services/SupabaseService';
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
import { WallOfDeath } from '../traps/WallOfDeath';
import { RisingLava } from '../traps/RisingLava';
import { FakeGoal } from '../traps/FakeGoal';
import { MirrorEnemy } from '../traps/MirrorEnemy';
import { FakeSpike } from '../traps/FakeSpike';
import { MovingGoal } from '../traps/MovingGoal';
import { InvertingRoom } from '../traps/InvertingRoom';

// Cloud9 theme (purple)
const THEMES = [
  { name: 'cloud9-purple', bg: 0x3b1fad, platform: 0x0a032f },
];

// JetBrains Mono font
const JBMONO = '"JetBrains Mono", monospace';

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
  private isLibraryMode: boolean = false;
  private libraryLevelId: string | null = null;
  private libraryLevel: LevelRecord | null = null;

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
  private fakeGoals: FakeGoal[] = [];
  private wallOfDeath: WallOfDeath | null = null;
  private risingLava: RisingLava | null = null;
  private mirrorEnemy: MirrorEnemy | null = null;
  private fakeSpikes: FakeSpike[] = [];
  private movingGoals: MovingGoal[] = [];
  private invertingRoom: InvertingRoom | null = null;

  // Track traps attached to moving platforms
  private attachedTraps: Map<number, BaseTrap[]> = new Map();
  private movingPlatformIdCounter: number = 0;

  // UI elements
  private timerText!: Phaser.GameObjects.Text;
  private deathText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private levelNameText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;

  // Snow particles
  private snowflakes: Phaser.GameObjects.Rectangle[] = [];
  private snowData: Array<{ vx: number; vy: number; baseX: number }> = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { playerName?: string; testMode?: boolean; libraryMode?: boolean; levelId?: string }): void {
    this.playerName = data.playerName || 'PLAYER';
    this.isTestMode = data.testMode || false;
    this.isLibraryMode = data.libraryMode || false;
    this.libraryLevelId = data.levelId || null;
    this.levelTransitioning = false;

    // Get library level from registry if in library mode
    if (this.isLibraryMode) {
      this.libraryLevel = this.registry.get('libraryLevel') as LevelRecord | null;
    }
  }

  create(): void {
    // Initialize managers
    this.scoreManager = new ScoreManager();
    this.timerManager = new TimerManager(this);
    this.levelLoader = new LevelLoader();

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

    // Initialize level loader and load first level
    this.initLevelLoader();

    // Listen for player death
    this.events.on('playerDeath', this.onPlayerDeath, this);

    // Back to editor shortcut in test mode
    if (this.isTestMode) {
      this.input.keyboard?.on('keydown-ESC', () => {
        this.scene.start('LevelEditorScene');
      });
    }

    // Create snow effect
    this.createSnow();

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private createSnow(): void {
    const snowCount = 80;

    for (let i = 0; i < snowCount; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const size = 2 + Math.random() * 3;

      const snowflake = this.add.rectangle(x, y, size, size, 0xffffff, 0.15 + Math.random() * 0.1);
      snowflake.setDepth(1); // Behind most game elements
      snowflake.setScrollFactor(0); // Fixed to camera

      this.snowflakes.push(snowflake);
      this.snowData.push({
        vx: (Math.random() - 0.5) * 10, // Slight horizontal drift
        vy: 15 + Math.random() * 25, // Slow fall speed
        baseX: x,
      });
    }
  }

  private async initLevelLoader(): Promise<void> {
    if (this.isTestMode) {
      // Test mode - load single level from registry
      const testLevel = this.registry.get('testLevel') as LevelJSON;
      if (testLevel) {
        this.levelLoader.setTestMode(testLevel);
      }
    } else if (this.isLibraryMode && this.libraryLevel) {
      // Library mode - load single level from library
      this.levelLoader.setTestMode(this.libraryLevel.level_data as unknown as LevelJSON);
    } else {
      // Normal mode - init from manifest
      await this.levelLoader.init();
    }

    // Load first level
    await this.loadNextLevel();

    // Start timer (only in non-test and non-library mode)
    if (!this.isTestMode && !this.isLibraryMode) {
      this.timerManager.start(
        () => this.onTimeUp(),
        (remaining, elapsed) => this.onTimerTick(remaining, elapsed)
      );
    }
  }

  private createUI(): void {
    const padding = 30;

    // Timer (top center) - hidden in test mode
    this.timerText = this.add.text(GAME_WIDTH / 2, padding, '1:00', {
      fontSize: font(FONT.TITLE_MD),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.timerText.setOrigin(0.5, 0);
    this.timerText.setScrollFactor(0);
    this.timerText.setDepth(100);
    if (this.isTestMode) {
      this.timerText.setText('TEST MODE');
      this.timerText.setColor('#ffffff');
    }

    // Deaths (top left)
    this.deathText = this.add.text(padding, padding, 'Deaths: 0', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.deathText.setScrollFactor(0);
    this.deathText.setDepth(100);

    // Level (top right)
    this.levelText = this.add.text(GAME_WIDTH - padding, padding, 'Level', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(1, 0);
    this.levelText.setScrollFactor(0);
    this.levelText.setDepth(100);

    // Level name (below level number)
    this.levelNameText = this.add.text(GAME_WIDTH - padding, padding + 40, '', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.levelNameText.setOrigin(1, 0);
    this.levelNameText.setScrollFactor(0);
    this.levelNameText.setDepth(100);

    // Score (below timer)
    this.scoreText = this.add.text(GAME_WIDTH / 2, padding + 50, 'Score: 10000', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.scoreText.setOrigin(0.5, 0);
    this.scoreText.setScrollFactor(0);
    this.scoreText.setDepth(100);

    // Coins (below deaths)
    this.coinText = this.add.text(padding, padding + 40, 'Coins: 0', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.coinText.setScrollFactor(0);
    this.coinText.setDepth(100);

    // Combo (below coins)
    this.comboText = this.add.text(padding, padding + 70, '', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.comboText.setScrollFactor(0);
    this.comboText.setDepth(100);

    // Test mode hint
    if (this.isTestMode) {
      const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.95, 'Press ESC to return to editor', {
        fontSize: font(FONT.BODY_LG),
        color: '#ffffff',
        fontFamily: JBMONO,
        fontStyle: 'bold',
      });
      hint.setOrigin(0.5);
      hint.setDepth(100);
    }

    // Library mode hint
    if (this.isLibraryMode) {
      this.timerText.setText('LIBRARY MODE');
      this.timerText.setColor('#00ff88');

      const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.95, 'Press ESC to return to library', {
        fontSize: font(FONT.BODY_LG),
        color: '#ffffff',
        fontFamily: JBMONO,
        fontStyle: 'bold',
      });
      hint.setOrigin(0.5);
      hint.setDepth(100);

      // Add ESC handler for library mode
      this.input.keyboard?.on('keydown-ESC', () => {
        this.recordLibraryStats(false);
        this.scene.start('LevelLibraryScene', { playerName: this.playerName });
      });
    }
  }

  private async loadNextLevel(): Promise<void> {
    // Keep transitioning true during level load to prevent trap updates
    this.levelTransitioning = true;

    // Clear existing level
    this.clearLevel();

    // Get next level (async)
    const levelData = await this.levelLoader.getNextLevel();

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
    // Set background from theme
    this.cameras.main.setBackgroundColor(this.currentTheme.bg);

    // Create platforms
    this.createPlatforms(levelData.platforms);

    // Create player
    this.player = new Player(this, levelData.startX, levelData.startY);
    this.player.setRespawnPoint(levelData.startX, levelData.startY);
    this.player.setPlatforms(this.platforms);

    // Create goal
    this.goal = new Goal(this, levelData.goalX, levelData.goalY - TILE_SIZE / 2);

    // Create traps
    this.createTraps(levelData.traps);

    // Create coins
    this.createCoins(levelData.coins);

    // Auto-attach traps and coins to moving platforms
    this.autoAttachTrapsToMovingPlatforms();

    // Set up collisions
    this.setupCollisions();

    // Update UI
    this.levelText.setText('Level');
    this.levelNameText.setText(levelData.name);

    // Show level intro
    this.showLevelIntro(levelData.name);

    // Level is now fully loaded, allow trap updates
    this.levelTransitioning = false;
  }

  private showLevelIntro(levelName: string): void {
    const introText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, levelName, {
      fontSize: font(FONT.LEVEL_INTRO),
      color: '#ffffff',
      fontFamily: JBMONO,
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

    // Destroy fake goals
    for (const fakeGoal of this.fakeGoals) {
      fakeGoal.destroy();
    }
    this.fakeGoals = [];

    // Destroy wall of death
    if (this.wallOfDeath) {
      this.wallOfDeath.destroy();
      this.wallOfDeath = null;
    }

    // Destroy rising lava
    if (this.risingLava) {
      this.risingLava.destroy();
      this.risingLava = null;
    }

    // Destroy mirror enemy
    if (this.mirrorEnemy) {
      this.mirrorEnemy.destroy();
      this.mirrorEnemy = null;
    }

    // Destroy fake spikes
    for (const fakeSpike of this.fakeSpikes) {
      fakeSpike.destroy();
    }
    this.fakeSpikes = [];

    // Destroy moving goals
    for (const movingGoal of this.movingGoals) {
      movingGoal.destroy();
    }
    this.movingGoals = [];

    // Destroy inverting room
    if (this.invertingRoom) {
      this.invertingRoom.destroy();
      this.invertingRoom = null;
    }

    // Destroy coins
    for (const coin of this.coins) {
      coin.destroy();
    }
    this.coins = [];

    // Clear attached traps tracking
    this.attachedTraps.clear();
    this.movingPlatformIdCounter = 0;
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
    console.log('Creating traps:', trapPlacements);
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
          const platformId = this.movingPlatformIdCounter++;
          const movingPlat = new MovingPlatform(this, {
            x: worldPos.x,
            y: worldPos.y,
            endX: (placement.config?.endX as number) || worldPos.x + TILE_SIZE * 3,
            endY: (placement.config?.endY as number) || worldPos.y,
            speed: (placement.config?.speed as number) || 80,
            color: this.currentTheme.platform,
            id: platformId,
          });
          this.movingPlatforms.push(movingPlat);
          this.attachedTraps.set(platformId, []);
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
          console.log('Creating sawblade at', worldPos, 'with config', placement.config);
          const sawblade = new Sawblade(this, {
            x: worldPos.x,
            y: worldPos.y,
            pathPoints: (placement.config?.pathPoints as Array<{ x: number; y: number }>) || [
              { x: worldPos.x, y: worldPos.y },
              { x: worldPos.x + TILE_SIZE * 3, y: worldPos.y },
            ],
            speed: (placement.config?.speed as number) || 100,
          });
          console.log('Sawblade created:', sawblade);
          this.sawblades.push(sawblade);
          continue;

        case 'ice':
          const icePlat = new IcePlatform(this, {
            x: worldPos.x,
            y: worldPos.y,
          });
          this.icePlatforms.push(icePlat);
          continue;

        case 'fakegoal':
          const fakeGoal = new FakeGoal(this, {
            x: worldPos.x,
            y: worldPos.y,
          });
          this.fakeGoals.push(fakeGoal);
          continue;

        case 'wallofdeath':
          // Wall of death is a level-wide effect, created once
          if (!this.wallOfDeath) {
            this.wallOfDeath = new WallOfDeath(this, {
              speed: (placement.config?.speed as number) || 60,
              delay: (placement.config?.delay as number) || 2000,
            });
            this.wallOfDeath.start();
          }
          continue;

        case 'risinglava':
          // Rising lava is a level-wide effect, created once
          if (!this.risingLava) {
            this.risingLava = new RisingLava(this, {
              speed: (placement.config?.speed as number) || 30,
              delay: (placement.config?.delay as number) || 3000,
            });
            this.risingLava.start();
          }
          continue;

        case 'mirrorenemy':
          // Mirror enemy is a level-wide effect, created once
          if (!this.mirrorEnemy) {
            this.mirrorEnemy = new MirrorEnemy(this, {
              x: worldPos.x,
              y: worldPos.y,
              delay: (placement.config?.delay as number) || 1500,
            });
            this.mirrorEnemy.setPlayer(this.player);
            this.mirrorEnemy.start();
          }
          continue;

        case 'fakespike':
          const fakeSpike = new FakeSpike(this, {
            x: worldPos.x,
            y: worldPos.y,
            direction: (placement.config?.direction as 'up' | 'down') || 'up',
          });
          this.fakeSpikes.push(fakeSpike);
          continue;

        case 'movinggoal':
          const movingGoal = new MovingGoal(this, {
            x: worldPos.x,
            y: worldPos.y,
            maxMoves: (placement.config?.maxMoves as number) || 3,
          });
          this.movingGoals.push(movingGoal);
          continue;

        case 'invertingroom':
          // Inverting room is a level-wide effect, created once
          if (!this.invertingRoom) {
            this.invertingRoom = new InvertingRoom(this, {
              triggerX: (placement.config?.triggerX as number) || GAME_WIDTH / 2,
            });
          }
          continue;

        default:
          continue;
      }

      this.traps.push(trap);

      // Check if trap should be attached to a moving platform (explicit config)
      if (placement.config?.attachedToPlatform !== undefined) {
        const platformId = placement.config.attachedToPlatform as number;
        const attachedList = this.attachedTraps.get(platformId);
        if (attachedList) {
          attachedList.push(trap);
        }
      }
    }
  }

  private autoAttachTrapsToMovingPlatforms(): void {
    for (const movingPlat of this.movingPlatforms) {
      const platBounds = movingPlat.getPlatformBounds();
      const platGridX = Math.floor(platBounds.x / TILE_SIZE);
      const platGridY = Math.floor(platBounds.y / TILE_SIZE);
      const platWidthInTiles = Math.ceil(platBounds.width / TILE_SIZE);

      // Check all traps
      for (const trap of this.traps) {
        // Skip if already attached to a platform
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(trap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const trapGridX = Math.floor(trap.x / TILE_SIZE);
        const trapGridY = Math.floor(trap.y / TILE_SIZE);

        // Check if trap is within 1 tile above the platform
        const isAbovePlatform = trapGridY === platGridY - 1;
        const isWithinPlatformWidth = trapGridX >= platGridX - 1 && trapGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(trap);
            console.log(`Auto-attached trap at (${trapGridX}, ${trapGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check bounce pads
      for (const bouncePad of this.bouncePads) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(bouncePad as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const padGridX = Math.floor(bouncePad.x / TILE_SIZE);
        const padGridY = Math.floor(bouncePad.y / TILE_SIZE);

        const isAbovePlatform = padGridY === platGridY - 1;
        const isWithinPlatformWidth = padGridX >= platGridX - 1 && padGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(bouncePad as unknown as BaseTrap);
            console.log(`Auto-attached bounce pad at (${padGridX}, ${padGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check sawblades
      for (const sawblade of this.sawblades) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(sawblade as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const sawGridX = Math.floor(sawblade.x / TILE_SIZE);
        const sawGridY = Math.floor(sawblade.y / TILE_SIZE);

        const isAbovePlatform = sawGridY === platGridY - 1;
        const isWithinPlatformWidth = sawGridX >= platGridX - 1 && sawGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(sawblade as unknown as BaseTrap);
            console.log(`Auto-attached sawblade at (${sawGridX}, ${sawGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check fake spikes
      for (const fakeSpike of this.fakeSpikes) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(fakeSpike as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const spikeGridX = Math.floor(fakeSpike.x / TILE_SIZE);
        const spikeGridY = Math.floor(fakeSpike.y / TILE_SIZE);

        const isAbovePlatform = spikeGridY === platGridY - 1;
        const isWithinPlatformWidth = spikeGridX >= platGridX - 1 && spikeGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(fakeSpike as unknown as BaseTrap);
            console.log(`Auto-attached fake spike at (${spikeGridX}, ${spikeGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check fake floors
      for (const fakeFloor of this.fakeFloors) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(fakeFloor as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const floorGridX = Math.floor(fakeFloor.x / TILE_SIZE);
        const floorGridY = Math.floor(fakeFloor.y / TILE_SIZE);

        const isAbovePlatform = floorGridY === platGridY - 1;
        const isWithinPlatformWidth = floorGridX >= platGridX - 1 && floorGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(fakeFloor as unknown as BaseTrap);
            console.log(`Auto-attached fake floor at (${floorGridX}, ${floorGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check fake goals
      for (const fakeGoal of this.fakeGoals) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(fakeGoal as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const goalGridX = Math.floor(fakeGoal.x / TILE_SIZE);
        const goalGridY = Math.floor(fakeGoal.y / TILE_SIZE);

        const isAbovePlatform = goalGridY === platGridY - 1;
        const isWithinPlatformWidth = goalGridX >= platGridX - 1 && goalGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(fakeGoal as unknown as BaseTrap);
            console.log(`Auto-attached fake goal at (${goalGridX}, ${goalGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check ice platforms
      for (const icePlat of this.icePlatforms) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(icePlat as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const iceGridX = Math.floor(icePlat.x / TILE_SIZE);
        const iceGridY = Math.floor(icePlat.y / TILE_SIZE);

        const isAbovePlatform = iceGridY === platGridY - 1;
        const isWithinPlatformWidth = iceGridX >= platGridX - 1 && iceGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(icePlat as unknown as BaseTrap);
            console.log(`Auto-attached ice platform at (${iceGridX}, ${iceGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }

      // Also check coins
      for (const coin of this.coins) {
        let alreadyAttached = false;
        for (const [, attachedList] of this.attachedTraps) {
          if (attachedList.includes(coin as unknown as BaseTrap)) {
            alreadyAttached = true;
            break;
          }
        }
        if (alreadyAttached) continue;

        const coinGridX = Math.floor(coin.x / TILE_SIZE);
        const coinGridY = Math.floor(coin.y / TILE_SIZE);

        const isAbovePlatform = coinGridY === platGridY - 1;
        const isWithinPlatformWidth = coinGridX >= platGridX - 1 && coinGridX <= platGridX + platWidthInTiles;

        if (isAbovePlatform && isWithinPlatformWidth) {
          const attachedList = this.attachedTraps.get(movingPlat.platformId);
          if (attachedList) {
            attachedList.push(coin as unknown as BaseTrap);
            // Stop floating animation so coin moves smoothly with platform
            coin.stopFloating();
            console.log(`Auto-attached coin at (${coinGridX}, ${coinGridY}) to platform ${movingPlat.platformId}`);
          }
        }
      }
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

    // Fake goal collisions
    for (const fakeGoal of this.fakeGoals) {
      const hitbox = fakeGoal.getHitbox();
      if (hitbox) {
        this.physics.add.overlap(this.player, hitbox, () => {
          fakeGoal.trigger();
          this.player.die();
        });
      }
    }

    // Wall of death collision
    if (this.wallOfDeath) {
      this.physics.add.overlap(this.player, this.wallOfDeath.getHitbox(), () => {
        this.player.die();
      });
    }

    // Rising lava collision
    if (this.risingLava) {
      this.physics.add.overlap(this.player, this.risingLava.getHitbox(), () => {
        this.player.die();
      });
    }

    // Mirror enemy collision
    if (this.mirrorEnemy) {
      this.physics.add.overlap(this.player, this.mirrorEnemy.getHitbox(), () => {
        this.player.die();
      });
    }

    // Fake spike "collisions" - reveal when touched (not deadly)
    for (const fakeSpike of this.fakeSpikes) {
      // Create a simple overlap zone for fake spikes
      const zone = this.add.zone(fakeSpike.x, fakeSpike.y, TILE_SIZE, TILE_SIZE);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player, zone, () => {
        fakeSpike.reveal();
      });
    }

    // Moving goal collisions
    for (const movingGoal of this.movingGoals) {
      this.physics.add.overlap(this.player, movingGoal.getHitbox(), () => {
        if (movingGoal.canBeCollected()) {
          // Treat as reaching the goal
          this.onReachGoal();
        }
      });
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

      // Update moving platforms and carry player/attached traps
      for (const movingPlat of this.movingPlatforms) {
        movingPlat.update();
        const delta = movingPlat.getDeltaMovement();

        // Carry player with platform if standing on it
        if (movingPlat.isObjectOnPlatform(this.player)) {
          this.player.x += delta.x;
          this.player.y += delta.y;
        }

        // Move attached traps with platform
        const attachedList = this.attachedTraps.get(movingPlat.platformId);
        if (attachedList) {
          for (const trap of attachedList) {
            trap.x += delta.x;
            trap.y += delta.y;
            // Also move the hitbox if it exists
            if ('getHitbox' in trap && typeof trap.getHitbox === 'function') {
              const hitbox = trap.getHitbox();
              if (hitbox) {
                hitbox.x += delta.x;
                hitbox.y += delta.y;
              }
            }
          }
        }
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

      // Update wall of death
      if (this.wallOfDeath) {
        this.wallOfDeath.update();
      }

      // Update rising lava
      if (this.risingLava) {
        this.risingLava.update();
      }

      // Update mirror enemy
      if (this.mirrorEnemy) {
        this.mirrorEnemy.update();
      }

      // Update moving goals
      for (const movingGoal of this.movingGoals) {
        movingGoal.update(this.player);
      }

      // Update inverting room
      if (this.invertingRoom) {
        this.invertingRoom.update(this.player);
      }
    }

    // Update snow particles
    this.updateSnow();

    // Update score display
    this.scoreText.setText(`Score: ${this.scoreManager.calculateFinalScore()}`);
    this.updateComboUI();
  }

  private updateSnow(): void {
    // Get player velocity for influence
    let playerVelX = 0;
    let playerVelY = 0;

    if (this.player && this.player.body) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      playerVelX = body.velocity.x;
      playerVelY = body.velocity.y;
    }

    for (let i = 0; i < this.snowflakes.length; i++) {
      const flake = this.snowflakes[i];
      const data = this.snowData[i];

      // Base movement - slow falling with slight drift
      let dx = data.vx * 0.016;
      let dy = data.vy * 0.016;

      // Add gentle sine wave motion
      data.baseX += dx;
      flake.x = data.baseX + Math.sin(this.time.now * 0.001 + i) * 15;

      // Player influence - snow pushes away from fast movement
      const influence = 0.02;
      dx -= playerVelX * influence * 0.016;
      dy -= playerVelY * influence * 0.5 * 0.016;

      flake.y += dy;

      // Wrap around screen
      if (flake.y > GAME_HEIGHT + 10) {
        flake.y = -10;
        data.baseX = Math.random() * GAME_WIDTH;
        flake.x = data.baseX;
      }
      if (flake.x < -10) {
        data.baseX = GAME_WIDTH + 10;
        flake.x = data.baseX;
      }
      if (flake.x > GAME_WIDTH + 10) {
        data.baseX = -10;
        flake.x = data.baseX;
      }
    }
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

  private onPlayerDeath(_data?: { x: number; y: number }): void {
    this.scoreManager.addDeath();
    this.deathText.setText(`Deaths: ${this.scoreManager.getDeaths()}`);
    this.updateComboUI();

    // Reset all traps to initial state
    for (const trap of this.traps) {
      trap.reset();
    }

    // Reset collapsing platforms
    for (const collapsingPlatform of this.collapsingPlatforms) {
      collapsingPlatform.reset();
    }

    // Reset fake floors
    for (const fakeFloor of this.fakeFloors) {
      fakeFloor.reset();
    }

    // Reset fake goals
    for (const fakeGoal of this.fakeGoals) {
      fakeGoal.reset();
    }

    // Reset wall of death
    if (this.wallOfDeath) {
      this.wallOfDeath.reset();
      this.wallOfDeath.start();
    }

    // Reset rising lava
    if (this.risingLava) {
      this.risingLava.reset();
      this.risingLava.start();
    }

    // Reset mirror enemy
    if (this.mirrorEnemy) {
      this.mirrorEnemy.reset();
      this.mirrorEnemy.setPlayer(this.player);
      this.mirrorEnemy.start();
    }

    // Reset fake spikes
    for (const fakeSpike of this.fakeSpikes) {
      fakeSpike.reset();
    }

    // Reset moving goals
    for (const movingGoal of this.movingGoals) {
      movingGoal.reset();
    }

    // Reset inverting room
    if (this.invertingRoom) {
      this.invertingRoom.reset();
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
      fontSize: font(FONT.SCORE_LG),
      color: '#ffd700',
      fontFamily: JBMONO,
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
        this.time.delayedCall(500, async () => {
          completeText.destroy();

          // Library mode - record completion and return to library
          if (this.isLibraryMode) {
            await this.recordLibraryStats(true);
            this.showLibraryComplete();
            return;
          }

          // Check if there are more levels
          if (this.levelLoader.hasMoreLevels()) {
            await this.loadNextLevel();
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

  private showLibraryComplete(): void {
    const deaths = this.scoreManager.getDeaths();
    const time = this.scoreManager.getElapsedSeconds();

    const statsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      `LEVEL COMPLETE!\n\nDeaths: ${deaths}\nTime: ${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}\n\nReturning to library...`, {
      fontSize: font(FONT.HEADING),
      color: '#00ff88',
      fontFamily: JBMONO,
      fontStyle: 'bold',
      align: 'center',
    });
    statsText.setOrigin(0.5);
    statsText.setDepth(200);

    this.time.delayedCall(2500, () => {
      this.scene.start('LevelLibraryScene', { playerName: this.playerName });
    });
  }

  private showAllLevelsComplete(): void {
    const completeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ALL LEVELS COMPLETE!', {
      fontSize: font(FONT.SCORE_LG),
      color: '#ffd700',
      fontFamily: JBMONO,
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
      this.timerText.setColor('#E24462');
      if (remaining <= 10) {
        this.timerText.setScale(1.1);
      }
    }
  }

  private onTimeUp(): void {
    this.player.freeze();

    const timeUpText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'TIME UP!', {
      fontSize: font(FONT.TIME_UP),
      color: '#E24462',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    timeUpText.setOrigin(0.5);
    timeUpText.setDepth(200);

    this.time.delayedCall(1500, () => {
      this.endGame();
    });
  }

  private async recordLibraryStats(completed: boolean): Promise<void> {
    if (!this.isLibraryMode || !this.libraryLevelId) return;

    await supabaseService.recordPlay({
      level_id: this.libraryLevelId,
      player_name: this.playerName,
      completed,
      deaths: this.scoreManager.getDeaths(),
      time_seconds: this.scoreManager.getElapsedSeconds(),
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

    // Clean up snow
    for (const flake of this.snowflakes) {
      flake.destroy();
    }
    this.snowflakes = [];
    this.snowData = [];
  }
}
