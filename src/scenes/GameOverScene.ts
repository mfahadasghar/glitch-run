import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { LeaderboardManager } from '../systems/LeaderboardManager';

interface GameOverData {
  playerName: string;
  score: number;
  breakdown: {
    baseScore: number;
    levelBonus: number;
    deathPenalty: number;
    timePenalty: number;
    finalScore: number;
  };
  deaths: number;
  levels: number;
  time: number;
}

export class GameOverScene extends Phaser.Scene {
  private gameData!: GameOverData;
  private leaderboardManager!: LeaderboardManager;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameOverData): void {
    this.gameData = data;
  }

  create(): void {
    this.leaderboardManager = new LeaderboardManager();

    // Add entry to leaderboard
    const rank = this.leaderboardManager.addEntry({
      name: this.gameData.playerName,
      score: this.gameData.score,
      levels: this.gameData.levels,
      deaths: this.gameData.deaths,
      time: this.gameData.time,
    });

    // Background overlay
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, 50, 'GAME OVER', {
      fontSize: '48px',
      color: '#e94560',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Player name
    const nameText = this.add.text(GAME_WIDTH / 2, 100, this.gameData.playerName, {
      fontSize: '24px',
      color: '#00ff88',
      fontFamily: 'Arial, sans-serif',
    });
    nameText.setOrigin(0.5);

    // Final score (large)
    const scoreText = this.add.text(GAME_WIDTH / 2, 160, `${this.gameData.score}`, {
      fontSize: '64px',
      color: '#ffd700',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    scoreText.setOrigin(0.5);

    // Score animation
    this.tweens.add({
      targets: scoreText,
      scale: 1.1,
      duration: 300,
      yoyo: true,
      repeat: 1,
    });

    // Rank display
    if (rank > 0) {
      const rankText = this.add.text(GAME_WIDTH / 2, 210, `#${rank} on Leaderboard!`, {
        fontSize: '18px',
        color: '#4a9eff',
        fontFamily: 'Arial, sans-serif',
      });
      rankText.setOrigin(0.5);

      if (rank === 1) {
        rankText.setText('NEW HIGH SCORE!');
        rankText.setColor('#ffd700');
        this.tweens.add({
          targets: rankText,
          scale: 1.2,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }
    }

    // Score breakdown
    const breakdownY = 260;
    const lineHeight = 25;

    this.add.text(GAME_WIDTH / 2, breakdownY, '--- Score Breakdown ---', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    const breakdown = this.gameData.breakdown;

    this.createBreakdownLine('Base Score:', `+${breakdown.baseScore}`, breakdownY + lineHeight, '#ffffff');
    this.createBreakdownLine('Level Bonus:', `+${breakdown.levelBonus}`, breakdownY + lineHeight * 2, '#00ff88');
    this.createBreakdownLine('Death Penalty:', `-${breakdown.deathPenalty}`, breakdownY + lineHeight * 3, '#e94560');
    this.createBreakdownLine('Time Penalty:', `-${breakdown.timePenalty}`, breakdownY + lineHeight * 4, '#ff8800');

    // Stats
    const statsY = breakdownY + lineHeight * 6;

    this.add.text(GAME_WIDTH / 2, statsY, '--- Stats ---', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    this.createStatLine('Levels Completed:', `${this.gameData.levels}`, statsY + lineHeight);
    this.createStatLine('Deaths:', `${this.gameData.deaths}`, statsY + lineHeight * 2);
    this.createStatLine('Time:', this.formatTime(this.gameData.time), statsY + lineHeight * 3);

    // Buttons
    const buttonY = GAME_HEIGHT - 80;

    // Play Again button
    const playAgainBtn = this.add.text(GAME_WIDTH / 2 - 100, buttonY, '[ Play Again ]', {
      fontSize: '18px',
      color: '#00ff88',
      fontFamily: 'Arial, sans-serif',
    });
    playAgainBtn.setOrigin(0.5);
    playAgainBtn.setInteractive({ useHandCursor: true });
    playAgainBtn.on('pointerover', () => playAgainBtn.setColor('#00ffaa'));
    playAgainBtn.on('pointerout', () => playAgainBtn.setColor('#00ff88'));
    playAgainBtn.on('pointerdown', () => {
      this.scene.start('NameEntryScene');
    });

    // Leaderboard button
    const leaderboardBtn = this.add.text(GAME_WIDTH / 2 + 100, buttonY, '[ Leaderboard ]', {
      fontSize: '18px',
      color: '#4a9eff',
      fontFamily: 'Arial, sans-serif',
    });
    leaderboardBtn.setOrigin(0.5);
    leaderboardBtn.setInteractive({ useHandCursor: true });
    leaderboardBtn.on('pointerover', () => leaderboardBtn.setColor('#6ab8ff'));
    leaderboardBtn.on('pointerout', () => leaderboardBtn.setColor('#4a9eff'));
    leaderboardBtn.on('pointerdown', () => {
      this.scene.start('LeaderboardScene', { fromGameOver: true });
    });

    // Keyboard shortcuts
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ENTER', () => {
        this.scene.start('NameEntryScene');
      });
      this.input.keyboard.once('keydown-L', () => {
        this.scene.start('LeaderboardScene', { fromGameOver: true });
      });
    }

    // Hint
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Press ENTER to play again, L for leaderboard', {
      fontSize: '12px',
      color: '#666666',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0.5);

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private createBreakdownLine(label: string, value: string, y: number, color: string): void {
    this.add.text(GAME_WIDTH / 2 - 100, y, label, {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH / 2 + 100, y, value, {
      fontSize: '14px',
      color,
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);
  }

  private createStatLine(label: string, value: string, y: number): void {
    this.add.text(GAME_WIDTH / 2 - 80, y, label, {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'Arial, sans-serif',
    }).setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH / 2 + 80, y, value, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
