import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { LeaderboardManager, LeaderboardEntry } from '../systems/LeaderboardManager';

export class LeaderboardScene extends Phaser.Scene {
  private leaderboardManager!: LeaderboardManager;
  private fromGameOver: boolean = false;

  constructor() {
    super({ key: 'LeaderboardScene' });
  }

  init(data: { fromMenu?: boolean; fromGameOver?: boolean }): void {
    this.fromGameOver = data.fromGameOver || false;
  }

  create(): void {
    this.leaderboardManager = new LeaderboardManager();

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a1a2e);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 40, 'LEADERBOARD', {
      fontSize: '36px',
      color: '#ffd700',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Header row
    const headerY = 90;
    this.createHeaderRow(headerY);

    // Leaderboard entries
    const entries = this.leaderboardManager.getTopEntries(10);
    const startY = 120;
    const rowHeight = 32;

    if (entries.length === 0) {
      const emptyText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'No scores yet!\nBe the first to play!', {
        fontSize: '20px',
        color: '#888888',
        fontFamily: 'Arial, sans-serif',
        align: 'center',
      });
      emptyText.setOrigin(0.5);
    } else {
      entries.forEach((entry, index) => {
        this.createLeaderboardRow(entry, index + 1, startY + index * rowHeight);
      });
    }

    // Back button
    const backBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, '[ Back ]', {
      fontSize: '20px',
      color: '#4a9eff',
      fontFamily: 'Arial, sans-serif',
    });
    backBtn.setOrigin(0.5);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#6ab8ff'));
    backBtn.on('pointerout', () => backBtn.setColor('#4a9eff'));
    backBtn.on('pointerdown', () => this.goBack());

    // Keyboard shortcuts
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ESC', () => this.goBack());
      this.input.keyboard.once('keydown-ENTER', () => this.goBack());
    }

    // Hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 20, 'Press ESC or ENTER to go back', {
      fontSize: '12px',
      color: '#666666',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    // Fade in
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  private createHeaderRow(y: number): void {
    const columns = [
      { x: 50, text: '#', width: 30 },
      { x: 100, text: 'Name', width: 100 },
      { x: 220, text: 'Score', width: 80 },
      { x: 310, text: 'Lvl', width: 40 },
      { x: 370, text: 'Deaths', width: 60 },
      { x: 450, text: 'Time', width: 60 },
      { x: 530, text: 'Date', width: 100 },
    ];

    for (const col of columns) {
      const text = this.add.text(col.x, y, col.text, {
        fontSize: '12px',
        color: '#888888',
        fontFamily: 'Arial, sans-serif',
      });
      text.setOrigin(0, 0.5);
    }

    // Separator line
    this.add.rectangle(GAME_WIDTH / 2, y + 15, GAME_WIDTH - 40, 1, 0x444444);
  }

  private createLeaderboardRow(entry: LeaderboardEntry, rank: number, y: number): void {
    // Rank colors
    let rankColor = '#ffffff';
    if (rank === 1) rankColor = '#ffd700';
    else if (rank === 2) rankColor = '#c0c0c0';
    else if (rank === 3) rankColor = '#cd7f32';

    // Background for top 3
    if (rank <= 3) {
      this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH - 40, 28, 0x2a2a4e, 0.5);
    }

    // Rank
    this.add.text(50, y, `${rank}`, {
      fontSize: '14px',
      color: rankColor,
      fontFamily: 'monospace',
      fontStyle: rank <= 3 ? 'bold' : 'normal',
    }).setOrigin(0, 0.5);

    // Name
    this.add.text(100, y, entry.name, {
      fontSize: '14px',
      color: '#00ff88',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);

    // Score
    this.add.text(220, y, `${entry.score}`, {
      fontSize: '14px',
      color: '#ffd700',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Levels
    this.add.text(310, y, `${entry.levels}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Deaths
    this.add.text(370, y, `${entry.deaths}`, {
      fontSize: '14px',
      color: '#e94560',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Time
    this.add.text(450, y, this.formatTime(entry.time), {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Date
    this.add.text(530, y, this.leaderboardManager.formatDate(entry.date), {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);
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
}
