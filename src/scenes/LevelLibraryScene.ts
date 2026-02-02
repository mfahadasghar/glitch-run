import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT, font } from '../config/gameConfig';
import { supabaseService, LevelRecord } from '../services/SupabaseService';

const JBMONO = '"JetBrains Mono", monospace';

// Difficulty colors based on win rate
const DIFFICULTY = {
  EASY: { color: 0x00ff88, label: 'Easy', minWin: 60 },
  MEDIUM: { color: 0xffaa00, label: 'Medium', minWin: 30 },
  HARD: { color: 0xff4444, label: 'Hard', minWin: 10 },
  EXTREME: { color: 0xff00ff, label: 'Extreme', minWin: 0 },
};

// Layout constants
const HEADER_HEIGHT = 180;
const CONTENT_TOP = 190;
const CONTENT_BOTTOM = GAME_HEIGHT - 20;
const CONTENT_HEIGHT = CONTENT_BOTTOM - CONTENT_TOP;

export class LevelLibraryScene extends Phaser.Scene {
  private levels: LevelRecord[] = [];
  private levelCards: Phaser.GameObjects.Container[] = [];
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private loadingText!: Phaser.GameObjects.Text;
  private playerName: string = 'PLAYER';
  private levelCountText!: Phaser.GameObjects.Text;
  private scrollIndicator!: Phaser.GameObjects.Rectangle;
  private scrollTrack!: Phaser.GameObjects.Rectangle;

  // Sort buttons for highlighting
  private sortButtons: Phaser.GameObjects.Text[] = [];
  private currentSort: 'plays' | 'created_at' | 'completions' = 'plays';

  // Snow effect
  private snowflakes: Phaser.GameObjects.Rectangle[] = [];
  private snowData: Array<{ vx: number; vy: number; baseX: number }> = [];

  constructor() {
    super({ key: 'LevelLibraryScene' });
  }

  init(data: { playerName?: string }): void {
    this.playerName = data.playerName || 'PLAYER';
  }

  async create(): Promise<void> {
    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x3b1fad);

    // Snow effect (behind everything)
    this.snowflakes = [];
    this.snowData = [];
    this.createSnow();

    // Header background
    const headerBg = this.add.rectangle(GAME_WIDTH / 2, HEADER_HEIGHT / 2, GAME_WIDTH, HEADER_HEIGHT, 0x2a1080, 0.6);
    headerBg.setDepth(50);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 35, 'LEVEL LIBRARY', {
      fontSize: font(FONT.TITLE_MD),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    title.setDepth(100);

    // Subtitle with level count
    this.levelCountText = this.add.text(GAME_WIDTH / 2, 75, 'Community Created Levels', {
      fontSize: font(FONT.BODY),
      color: '#aaaaaa',
      fontFamily: JBMONO,
    });
    this.levelCountText.setOrigin(0.5);
    this.levelCountText.setDepth(100);

    // Loading text
    this.loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
    });
    this.loadingText.setOrigin(0.5);
    this.loadingText.setDepth(200);

    // Loading animation
    this.createLoadingAnimation();

    // Back button
    const backBtn = this.add.text(70, 35, '< Back', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    backBtn.setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.setDepth(100);
    backBtn.on('pointerover', () => backBtn.setColor('#00ff88'));
    backBtn.on('pointerout', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerdown', () => {
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      this.scene.start('NameEntryScene');
    });

    // Refresh button
    const refreshBtn = this.add.text(GAME_WIDTH - 70, 35, 'Refresh', {
      fontSize: font(FONT.BODY),
      color: '#888888',
      fontFamily: JBMONO,
    });
    refreshBtn.setOrigin(0.5);
    refreshBtn.setInteractive({ useHandCursor: true });
    refreshBtn.setDepth(100);
    refreshBtn.on('pointerover', () => refreshBtn.setColor('#ffffff'));
    refreshBtn.on('pointerout', () => refreshBtn.setColor('#888888'));
    refreshBtn.on('pointerdown', async () => {
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      await this.loadLevels(this.currentSort);
    });

    // Sort buttons
    this.createSortButtons();

    // Divider line
    const divider = this.add.rectangle(GAME_WIDTH / 2, HEADER_HEIGHT, GAME_WIDTH - 100, 2, 0x5533dd, 0.5);
    divider.setDepth(100);

    // Content container for scrolling
    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.setDepth(10);

    // Create mask for scrolling area (clips content to visible area below header)
    const maskY = CONTENT_TOP + CONTENT_HEIGHT / 2;
    const maskShape = this.add.rectangle(GAME_WIDTH / 2, maskY, GAME_WIDTH - 60, CONTENT_HEIGHT, 0x000000);
    maskShape.setVisible(false);
    const mask = maskShape.createGeometryMask();
    this.contentContainer.setMask(mask);

    // Scrollbar track
    this.scrollTrack = this.add.rectangle(GAME_WIDTH - 25, maskY, 8, CONTENT_HEIGHT - 20, 0x1a0a4f, 0.8);
    this.scrollTrack.setDepth(100);

    // Scrollbar indicator
    this.scrollIndicator = this.add.rectangle(GAME_WIDTH - 25, CONTENT_TOP + 50, 8, 80, 0x5533dd, 1);
    this.scrollIndicator.setDepth(101);

    // Load levels
    await this.loadLevels('plays');

    // Scroll handling
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.8, 0, this.maxScrollY);
      this.updateScroll();
    });

    // Keyboard navigation
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('NameEntryScene');
    });
    this.input.keyboard?.on('keydown-UP', () => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - 80, 0, this.maxScrollY);
      this.updateScroll();
    });
    this.input.keyboard?.on('keydown-DOWN', () => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + 80, 0, this.maxScrollY);
      this.updateScroll();
    });

    // Fade in
    this.cameras.main.fadeIn(200);
  }

  private createLoadingAnimation(): void {
    const dots = ['', '.', '..', '...'];
    let dotIndex = 0;
    this.time.addEvent({
      delay: 300,
      callback: () => {
        if (this.loadingText.visible) {
          this.loadingText.setText('Loading' + dots[dotIndex]);
          dotIndex = (dotIndex + 1) % dots.length;
        }
      },
      loop: true,
    });
  }

  private createSortButtons(): void {
    const sortY = 140;
    const sortOptions = [
      { label: 'Popular', sort: 'plays' as const },
      { label: 'Newest', sort: 'created_at' as const },
      { label: 'Most Wins', sort: 'completions' as const },
    ];

    this.sortButtons = [];
    const buttonWidth = 130;
    const gap = 15;
    const totalWidth = sortOptions.length * buttonWidth + (sortOptions.length - 1) * gap;
    let startX = GAME_WIDTH / 2 - totalWidth / 2 + buttonWidth / 2;

    for (const option of sortOptions) {
      const isActive = option.sort === this.currentSort;

      // Button background
      const btnBg = this.add.rectangle(startX, sortY, buttonWidth, 30, isActive ? 0x5533dd : 0x1a0a4f, 0.9);
      btnBg.setStrokeStyle(2, isActive ? 0x7755ff : 0x3b1fad);
      btnBg.setDepth(100);

      const btn = this.add.text(startX, sortY, option.label, {
        fontSize: font(FONT.CAPTION),
        color: isActive ? '#ffffff' : '#888888',
        fontFamily: JBMONO,
        fontStyle: isActive ? 'bold' : 'normal',
      });
      btn.setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.setDepth(101);
      btn.setData('sort', option.sort);
      btn.setData('bg', btnBg);

      btn.on('pointerover', () => {
        if (this.currentSort !== option.sort) {
          btn.setColor('#ffffff');
          btnBg.setFillStyle(0x2a1580, 0.9);
        }
      });
      btn.on('pointerout', () => {
        if (this.currentSort !== option.sort) {
          btn.setColor('#888888');
          btnBg.setFillStyle(0x1a0a4f, 0.9);
        }
      });
      btn.on('pointerdown', async () => {
        if (this.currentSort === option.sort) return;

        if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.3 });
        this.currentSort = option.sort;
        this.updateSortButtonStyles();
        this.loadingText.setVisible(true);
        await this.loadLevels(option.sort);
      });

      this.sortButtons.push(btn);
      startX += buttonWidth + gap;
    }
  }

  private updateSortButtonStyles(): void {
    for (const btn of this.sortButtons) {
      const sort = btn.getData('sort');
      const bg = btn.getData('bg') as Phaser.GameObjects.Rectangle;
      const isActive = sort === this.currentSort;

      btn.setColor(isActive ? '#ffffff' : '#888888');
      btn.setFontStyle(isActive ? 'bold' : 'normal');
      bg.setFillStyle(isActive ? 0x5533dd : 0x1a0a4f, 0.9);
      bg.setStrokeStyle(2, isActive ? 0x7755ff : 0x3b1fad);
    }
  }

  private async loadLevels(orderBy: 'plays' | 'created_at' | 'completions'): Promise<void> {
    this.loadingText.setVisible(true);

    // Clear existing cards
    for (const card of this.levelCards) {
      card.destroy();
    }
    this.levelCards = [];
    this.contentContainer.removeAll();

    // Fetch levels
    this.levels = await supabaseService.getLevels(orderBy);

    this.loadingText.setVisible(false);

    // Update subtitle with count
    const countText = this.levels.length === 0
      ? 'No levels yet'
      : `${this.levels.length} level${this.levels.length !== 1 ? 's' : ''} available`;
    this.levelCountText.setText(countText);

    if (this.levels.length === 0) {
      const emptyContainer = this.add.container(GAME_WIDTH / 2, CONTENT_TOP + CONTENT_HEIGHT / 2 - 50);

      const emptyIcon = this.add.text(0, -40, '?', {
        fontSize: '72px',
        color: '#5533dd',
        fontFamily: JBMONO,
        fontStyle: 'bold',
      });
      emptyIcon.setOrigin(0.5);
      emptyContainer.add(emptyIcon);

      const emptyText = this.add.text(0, 30, 'No levels yet!', {
        fontSize: font(FONT.HEADING),
        color: '#ffffff',
        fontFamily: JBMONO,
        fontStyle: 'bold',
      });
      emptyText.setOrigin(0.5);
      emptyContainer.add(emptyText);

      const emptySubtext = this.add.text(0, 70, 'Be the first to create and publish a level!', {
        fontSize: font(FONT.BODY),
        color: '#888888',
        fontFamily: JBMONO,
      });
      emptySubtext.setOrigin(0.5);
      emptyContainer.add(emptySubtext);

      // Create level button
      const createBtn = this.add.text(0, 130, '[ Open Editor ]', {
        fontSize: font(FONT.BODY_LG),
        color: '#00ff88',
        fontFamily: JBMONO,
        fontStyle: 'bold',
      });
      createBtn.setOrigin(0.5);
      createBtn.setInteractive({ useHandCursor: true });
      createBtn.on('pointerover', () => createBtn.setScale(1.1));
      createBtn.on('pointerout', () => createBtn.setScale(1));
      createBtn.on('pointerdown', () => {
        this.scene.start('LevelEditorScene');
      });
      emptyContainer.add(createBtn);

      this.contentContainer.add(emptyContainer);
      this.scrollIndicator.setVisible(false);
      this.scrollTrack.setVisible(false);
      return;
    }

    this.scrollIndicator.setVisible(true);
    this.scrollTrack.setVisible(true);

    // Card layout
    const cardWidth = 400;
    const cardHeight = 120;
    const paddingX = 25;
    const paddingY = 15;
    const columns = 2;
    const gridWidth = columns * cardWidth + (columns - 1) * paddingX;
    const startX = (GAME_WIDTH - gridWidth) / 2;
    const startY = CONTENT_TOP + 10;

    this.levels.forEach((level, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      const x = startX + col * (cardWidth + paddingX);
      const y = startY + row * (cardHeight + paddingY);

      const card = this.createLevelCard(level, x, y, cardWidth, cardHeight, index);
      this.levelCards.push(card);
      this.contentContainer.add(card);
    });

    // Calculate max scroll
    const totalRows = Math.ceil(this.levels.length / columns);
    const contentHeight = totalRows * (cardHeight + paddingY);
    this.maxScrollY = Math.max(0, contentHeight - CONTENT_HEIGHT + 30);
    this.scrollY = 0;
    this.updateScroll();
  }

  private getDifficulty(winRate: number): typeof DIFFICULTY.EASY {
    if (winRate >= DIFFICULTY.EASY.minWin) return DIFFICULTY.EASY;
    if (winRate >= DIFFICULTY.MEDIUM.minWin) return DIFFICULTY.MEDIUM;
    if (winRate >= DIFFICULTY.HARD.minWin) return DIFFICULTY.HARD;
    return DIFFICULTY.EXTREME;
  }

  private createLevelCard(level: LevelRecord, x: number, y: number, width: number, height: number, index: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0x0a032f, 0.95);
    bg.setStrokeStyle(2, 0x3b1fad);
    bg.setOrigin(0, 0);
    container.add(bg);

    // Difficulty indicator bar on left
    const winRate = supabaseService.getWinRate(level);
    const difficulty = this.getDifficulty(winRate);
    const diffBar = this.add.rectangle(0, 0, 4, height, difficulty.color, 1);
    diffBar.setOrigin(0, 0);
    container.add(diffBar);

    // Level name
    const nameText = this.add.text(15, 12, level.name, {
      fontSize: font(FONT.BODY_LG),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    nameText.setOrigin(0, 0);
    container.add(nameText);

    // Creator
    const creatorText = this.add.text(15, 38, `by ${level.creator_name}`, {
      fontSize: font(FONT.CAPTION),
      color: '#666666',
      fontFamily: JBMONO,
    });
    container.add(creatorText);

    // Difficulty tag
    const diffTag = this.add.text(15, 62, difficulty.label, {
      fontSize: font(FONT.CAPTION),
      color: Phaser.Display.Color.IntegerToColor(difficulty.color).rgba,
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    container.add(diffTag);

    // Stats row
    const statsY = 88;
    const avgDeaths = supabaseService.getAvgDeaths(level);

    // Plays stat
    const playsText = this.add.text(15, statsY, `${level.plays} plays`, {
      fontSize: font(FONT.CAPTION),
      color: '#888888',
      fontFamily: JBMONO,
    });
    container.add(playsText);

    // Win rate stat
    const winText = this.add.text(110, statsY, `${winRate}% win`, {
      fontSize: font(FONT.CAPTION),
      color: '#888888',
      fontFamily: JBMONO,
    });
    container.add(winText);

    // Deaths stat
    const deathText = this.add.text(200, statsY, `${avgDeaths} deaths avg`, {
      fontSize: font(FONT.CAPTION),
      color: '#888888',
      fontFamily: JBMONO,
    });
    container.add(deathText);

    // Play button
    const btnWidth = 70;
    const btnHeight = 36;
    const btnX = width - btnWidth / 2 - 15;
    const btnY = height / 2;

    const playBtnBg = this.add.rectangle(btnX, btnY, btnWidth, btnHeight, 0x00aa55, 1);
    playBtnBg.setStrokeStyle(2, 0x00ff88);
    container.add(playBtnBg);

    const playBtn = this.add.text(btnX, btnY, 'PLAY', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    playBtn.setOrigin(0.5);
    container.add(playBtn);

    // Make play button interactive
    playBtnBg.setInteractive({ useHandCursor: true });
    playBtnBg.on('pointerover', () => {
      playBtnBg.setFillStyle(0x00cc66);
      bg.setStrokeStyle(2, 0x00ff88);
    });
    playBtnBg.on('pointerout', () => {
      playBtnBg.setFillStyle(0x00aa55);
      bg.setStrokeStyle(2, 0x3b1fad);
    });
    playBtnBg.on('pointerdown', () => {
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      this.playLevel(level);
    });

    // Make whole card hoverable
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setStrokeStyle(2, 0x5533dd);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(2, 0x3b1fad);
    });
    bg.on('pointerdown', () => {
      this.playLevel(level);
    });

    // Entrance animation
    container.setAlpha(0);
    container.x = x - 30;
    this.tweens.add({
      targets: container,
      alpha: 1,
      x: x,
      duration: 250,
      delay: index * 40,
      ease: 'Power2',
    });

    return container;
  }

  private playLevel(level: LevelRecord): void {
    // Store level data for GameScene
    this.registry.set('libraryLevel', level);
    this.registry.set('isLibraryMode', true);

    // Fade out transition
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        playerName: this.playerName,
        libraryMode: true,
        levelId: level.id,
      });
    });
  }

  private updateScroll(): void {
    this.contentContainer.y = -this.scrollY;

    // Update scrollbar position
    if (this.maxScrollY > 0) {
      const scrollPercent = this.scrollY / this.maxScrollY;
      const trackHeight = CONTENT_HEIGHT - 40;
      const indicatorHeight = Math.max(40, (CONTENT_HEIGHT / (this.maxScrollY + CONTENT_HEIGHT)) * trackHeight);
      const maxIndicatorY = trackHeight - indicatorHeight;

      this.scrollIndicator.setSize(8, indicatorHeight);
      this.scrollIndicator.y = CONTENT_TOP + 20 + scrollPercent * maxIndicatorY + indicatorHeight / 2;
    } else {
      this.scrollIndicator.setVisible(false);
      this.scrollTrack.setVisible(false);
    }
  }

  private createSnow(): void {
    const snowCount = 40;
    for (let i = 0; i < snowCount; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const size = 2 + Math.random() * 2;
      const snowflake = this.add.rectangle(x, y, size, size, 0xffffff, 0.08 + Math.random() * 0.06);
      snowflake.setDepth(1);
      this.snowflakes.push(snowflake);
      this.snowData.push({
        vx: (Math.random() - 0.5) * 10,
        vy: 15 + Math.random() * 20,
        baseX: x,
      });
    }
  }

  private updateSnow(): void {
    const dt = 0.016;
    for (let i = 0; i < this.snowflakes.length; i++) {
      const flake = this.snowflakes[i];
      const data = this.snowData[i];

      const drift = Math.sin(Date.now() * 0.001 + i) * 0.2;
      const dx = data.vx * dt + drift;
      const dy = data.vy * dt;

      flake.x += dx;
      flake.y += dy;

      if (flake.y > GAME_HEIGHT + 10) {
        flake.y = -10;
        flake.x = Math.random() * GAME_WIDTH;
        data.baseX = flake.x;
      }
      if (flake.x < -10) flake.x = GAME_WIDTH + 10;
      if (flake.x > GAME_WIDTH + 10) flake.x = -10;
    }
  }

  update(): void {
    this.updateSnow();
  }
}
