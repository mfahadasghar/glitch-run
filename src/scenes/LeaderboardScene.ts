import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT, font } from '../config/gameConfig';
import { LeaderboardManager, LeaderboardEntry } from '../systems/LeaderboardManager';

const JBMONO = '"JetBrains Mono", monospace';

export class LeaderboardScene extends Phaser.Scene {
  private leaderboardManager!: LeaderboardManager;
  private fromGameOver: boolean = false;
  private loadingText!: Phaser.GameObjects.Text;
  private contentContainer!: Phaser.GameObjects.Container;

  // Snow effect
  private snowflakes: Phaser.GameObjects.Rectangle[] = [];
  private snowData: Array<{ vx: number; vy: number; baseX: number }> = [];

  constructor() {
    super({ key: 'LeaderboardScene' });
  }

  init(data: { fromMenu?: boolean; fromGameOver?: boolean }): void {
    this.fromGameOver = data.fromGameOver || false;
  }

  async create(): Promise<void> {
    this.leaderboardManager = new LeaderboardManager();

    // Background - purple (Cloud9 theme)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x3b1fad);

    // Create snow effect
    this.snowflakes = [];
    this.snowData = [];
    this.createSnow();

    // Title - white
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.07, 'LEADERBOARD', {
      fontSize: font(FONT.TITLE_LG),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Loading text
    this.loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Loading...', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
    });
    this.loadingText.setOrigin(0.5);

    // Content container (will hold header and entries)
    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.setVisible(false);

    // Back button - white
    const backBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.91, '[ Back ]', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    backBtn.setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setAlpha(0.7));
    backBtn.on('pointerout', () => backBtn.setAlpha(1));
    backBtn.on('pointerdown', () => this.goBack());

    // Keyboard shortcuts
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ESC', () => this.goBack());
      this.input.keyboard.once('keydown-ENTER', () => this.goBack());
    }

    // Hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.96, 'Press ESC or ENTER to go back', {
      fontSize: font(FONT.BODY_LG),
      color: '#888888',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Fade in
    this.cameras.main.fadeIn(200, 0, 0, 0);

    // Load leaderboard data
    await this.loadLeaderboard();
  }

  private async loadLeaderboard(): Promise<void> {
    await this.leaderboardManager.load();

    this.loadingText.setVisible(false);
    this.contentContainer.setVisible(true);

    // Header row
    const headerY = GAME_HEIGHT * 0.17;
    this.createHeaderRow(headerY);

    // Leaderboard entries
    const entries = this.leaderboardManager.getTopEntries(10);
    const startY = GAME_HEIGHT * 0.22;
    const rowHeight = GAME_HEIGHT * 0.055;

    if (entries.length === 0) {
      const emptyText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'No scores yet!\nBe the first to play!', {
        fontSize: font(FONT.HEADING),
        color: '#888888',
        fontFamily: JBMONO,
        fontStyle: 'bold',
        align: 'center',
      });
      emptyText.setOrigin(0.5);
      this.contentContainer.add(emptyText);
    } else {
      entries.forEach((entry, index) => {
        this.createLeaderboardRow(entry, index + 1, startY + index * rowHeight);
      });
    }
  }

  private createHeaderRow(y: number): void {
    // Center the table horizontally with proper spacing (relative to screen width)
    const tableStartX = GAME_WIDTH * 0.10;
    const columns = [
      { x: tableStartX, text: '#' },
      { x: tableStartX + GAME_WIDTH * 0.04, text: 'Name' },
      { x: tableStartX + GAME_WIDTH * 0.18, text: 'Score' },
      { x: tableStartX + GAME_WIDTH * 0.29, text: 'Lvl' },
      { x: tableStartX + GAME_WIDTH * 0.35, text: 'Deaths' },
      { x: tableStartX + GAME_WIDTH * 0.46, text: 'Time' },
      { x: tableStartX + GAME_WIDTH * 0.55, text: 'Date' },
    ];

    for (const col of columns) {
      const text = this.add.text(col.x, y, col.text, {
        fontSize: font(FONT.HEADING),
        color: '#ffffff',
        fontFamily: JBMONO,
        fontStyle: 'bold',
      });
      text.setOrigin(0, 0.5);
      text.setAlpha(0.8);
      this.contentContainer.add(text);
    }

    // Separator line - white
    const line = this.add.rectangle(GAME_WIDTH / 2, y + GAME_HEIGHT * 0.023, GAME_WIDTH * 0.84, 2, 0xffffff, 0.5);
    this.contentContainer.add(line);
  }

  private createLeaderboardRow(entry: LeaderboardEntry, rank: number, y: number): void {
    // Center the table horizontally with proper spacing (relative to screen width)
    const tableStartX = GAME_WIDTH * 0.10;

    // Rank colors - all white with varying opacity
    let rankAlpha = 1;
    if (rank === 2) rankAlpha = 0.9;
    else if (rank === 3) rankAlpha = 0.8;
    else if (rank > 3) rankAlpha = 0.7;

    // Background for top 3 - white translucent
    if (rank <= 3) {
      const bg = this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH * 0.84, GAME_HEIGHT * 0.046, 0xffffff, 0.15);
      this.contentContainer.add(bg);
    }

    const rowFontSize = font(FONT.HEADING);

    // Rank - white
    const rankText = this.add.text(tableStartX, y, `${rank}`, {
      fontSize: rowFontSize,
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    rankText.setOrigin(0, 0.5);
    rankText.setAlpha(rankAlpha);
    this.contentContainer.add(rankText);

    // Name - white
    const nameText = this.add.text(tableStartX + GAME_WIDTH * 0.04, y, entry.name, {
      fontSize: rowFontSize,
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    nameText.setOrigin(0, 0.5);
    nameText.setAlpha(rankAlpha);
    this.contentContainer.add(nameText);

    // Score - gold for top 3
    const scoreColor = rank <= 3 ? '#ffd700' : '#ffffff';
    const scoreText = this.add.text(tableStartX + GAME_WIDTH * 0.18, y, `${entry.score}`, {
      fontSize: rowFontSize,
      color: scoreColor,
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    scoreText.setOrigin(0, 0.5);
    scoreText.setAlpha(rankAlpha);
    this.contentContainer.add(scoreText);

    // Levels - white
    const levelText = this.add.text(tableStartX + GAME_WIDTH * 0.29, y, `${entry.levels}`, {
      fontSize: rowFontSize,
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    levelText.setOrigin(0, 0.5);
    levelText.setAlpha(rankAlpha);
    this.contentContainer.add(levelText);

    // Deaths - white
    const deathText = this.add.text(tableStartX + GAME_WIDTH * 0.35, y, `${entry.deaths}`, {
      fontSize: rowFontSize,
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    deathText.setOrigin(0, 0.5);
    deathText.setAlpha(rankAlpha);
    this.contentContainer.add(deathText);

    // Time - white
    const timeText = this.add.text(tableStartX + GAME_WIDTH * 0.46, y, this.formatTime(entry.time), {
      fontSize: rowFontSize,
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    timeText.setOrigin(0, 0.5);
    timeText.setAlpha(rankAlpha);
    this.contentContainer.add(timeText);

    // Date - white
    const dateText = this.add.text(tableStartX + GAME_WIDTH * 0.55, y, this.leaderboardManager.formatDate(entry.date), {
      fontSize: rowFontSize,
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    dateText.setOrigin(0, 0.5);
    dateText.setAlpha(rankAlpha * 0.8);
    this.contentContainer.add(dateText);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private goBack(): void {
    if (this.fromGameOver) {
      this.scene.start('GameOverScene');
    } else {
      this.scene.start('NameEntryScene');
    }
  }

  private createSnow(): void {
    const snowCount = 60;
    for (let i = 0; i < snowCount; i++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      const size = 2 + Math.random() * 3;
      const snowflake = this.add.rectangle(x, y, size, size, 0xffffff, 0.15 + Math.random() * 0.1);
      snowflake.setDepth(1);
      this.snowflakes.push(snowflake);
      this.snowData.push({
        vx: (Math.random() - 0.5) * 15,
        vy: 20 + Math.random() * 30,
        baseX: x,
      });
    }
  }

  private updateSnow(): void {
    const dt = 0.016;
    for (let i = 0; i < this.snowflakes.length; i++) {
      const flake = this.snowflakes[i];
      const data = this.snowData[i];

      const drift = Math.sin(Date.now() * 0.001 + i) * 0.3;
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
