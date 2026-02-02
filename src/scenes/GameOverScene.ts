import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT, font } from '../config/gameConfig';
import { LeaderboardManager } from '../systems/LeaderboardManager';

// Layout constants (relative to screen height)
const LAYOUT = {
  TITLE_Y: 0.06,
  NAME_Y: 0.14,
  SCORE_Y: 0.24,
  RANK_Y: 0.32,
  BREAKDOWN_Y: 0.40,
  LINE_HEIGHT: 0.037,
  BUTTON_Y: 0.90,
  HINT_Y: 0.96,
};

const JBMONO = '"JetBrains Mono", monospace';

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
  private rankText!: Phaser.GameObjects.Text;

  // Snow effect
  private snowflakes: Phaser.GameObjects.Rectangle[] = [];
  private snowData: Array<{ vx: number; vy: number; baseX: number }> = [];

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: GameOverData): void {
    this.gameData = data;
  }

  async create(): Promise<void> {
    this.leaderboardManager = new LeaderboardManager();

    // Background overlay - purple (Cloud9 theme)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x3b1fad);

    // Create snow effect
    this.snowflakes = [];
    this.snowData = [];
    this.createSnow();

    // Layout values
    const lineHeight = GAME_HEIGHT * LAYOUT.LINE_HEIGHT;

    // Title - white
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * LAYOUT.TITLE_Y, 'GAME OVER', {
      fontSize: font(FONT.TITLE_MD),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Player name - white
    const nameText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * LAYOUT.NAME_Y, this.gameData.playerName, {
      fontSize: font(FONT.SCORE_LG),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    nameText.setOrigin(0.5);

    // Final score (large)
    const scoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * LAYOUT.SCORE_Y, `${this.gameData.score}`, {
      fontSize: font(FONT.SCORE_LG),
      color: '#ffd700',
      fontFamily: JBMONO,
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

    // Rank display (initially showing "Saving...")
    this.rankText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * LAYOUT.RANK_Y, 'Saving score...', {
      fontSize: font(FONT.BODY),
      color: '#888888',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.rankText.setOrigin(0.5);

    // Score breakdown
    const breakdownY = GAME_HEIGHT * LAYOUT.BREAKDOWN_Y;

    this.add.text(GAME_WIDTH / 2, breakdownY, '--- Score Breakdown ---', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const breakdown = this.gameData.breakdown;

    this.createBreakdownLine('Base Score:', `+${breakdown.baseScore}`, breakdownY + lineHeight * 1.2, '#ffffff');
    this.createBreakdownLine('Level Bonus:', `+${breakdown.levelBonus}`, breakdownY + lineHeight * 2.2, '#ffffff');
    this.createBreakdownLine('Death Penalty:', `-${breakdown.deathPenalty}`, breakdownY + lineHeight * 3.2, '#E24462');
    this.createBreakdownLine('Time Penalty:', `-${breakdown.timePenalty}`, breakdownY + lineHeight * 4.2, '#F88909');

    // Stats
    const statsY = breakdownY + lineHeight * 5.8;

    this.add.text(GAME_WIDTH / 2, statsY, '--- Stats ---', {
      fontSize: font(FONT.HEADING),
      color: '#aaaaaa',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.createStatLine('Levels Completed:', `${this.gameData.levels}`, statsY + lineHeight * 1.2);
    this.createStatLine('Deaths:', `${this.gameData.deaths}`, statsY + lineHeight * 2.2);
    this.createStatLine('Time:', this.formatTime(this.gameData.time), statsY + lineHeight * 3.2);

    // Buttons
    const buttonY = GAME_HEIGHT * LAYOUT.BUTTON_Y;

    // Play Again button - white
    const playAgainBtn = this.add.text(GAME_WIDTH / 2 - 110, buttonY, '[ Play Again ]', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    playAgainBtn.setOrigin(0.5);
    playAgainBtn.setInteractive({ useHandCursor: true });
    playAgainBtn.on('pointerover', () => playAgainBtn.setAlpha(0.7));
    playAgainBtn.on('pointerout', () => playAgainBtn.setAlpha(1));
    playAgainBtn.on('pointerdown', () => {
      this.scene.start('NameEntryScene');
    });

    // Leaderboard button - white
    const leaderboardBtn = this.add.text(GAME_WIDTH / 2 + 110, buttonY, '[ Leaderboard ]', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    leaderboardBtn.setOrigin(0.5);
    leaderboardBtn.setInteractive({ useHandCursor: true });
    leaderboardBtn.on('pointerover', () => leaderboardBtn.setAlpha(0.7));
    leaderboardBtn.on('pointerout', () => leaderboardBtn.setAlpha(1));
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
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * LAYOUT.HINT_Y, 'Press ENTER to play again, L for leaderboard', {
      fontSize: font(FONT.BODY),
      color: '#888888',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Add entry to leaderboard (async)
    await this.saveScore();
  }

  private async saveScore(): Promise<void> {
    try {
      const rank = await this.leaderboardManager.addEntry({
        name: this.gameData.playerName,
        score: this.gameData.score,
        levels: this.gameData.levels,
        deaths: this.gameData.deaths,
        time: this.gameData.time,
      });

      // Update rank display
      if (rank > 0) {
        if (rank === 1) {
          this.rankText.setText('NEW HIGH SCORE!');
          this.rankText.setColor('#ffd700');
          this.tweens.add({
            targets: this.rankText,
            scale: 1.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
          });
        } else {
          this.rankText.setText(`#${rank} on Leaderboard!`);
          this.rankText.setColor('#ffffff');
        }
      } else {
        this.rankText.setText('Score saved!');
        this.rankText.setColor('#888888');
      }
    } catch (error) {
      console.error('Failed to save score:', error);
      this.rankText.setText('Could not save score');
      this.rankText.setColor('#ff4444');
    }
  }

  private createBreakdownLine(label: string, value: string, y: number, color: string): void {
    const colOffset = GAME_WIDTH * 0.15; // 15% of screen width
    this.add.text(GAME_WIDTH / 2 - colOffset, y, label, {
      fontSize: font(FONT.BODY),
      color: '#aaaaaa',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH / 2 + colOffset, y, value, {
      fontSize: font(FONT.BODY),
      color,
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
  }

  private createStatLine(label: string, value: string, y: number): void {
    const colOffset = GAME_WIDTH * 0.15; // 15% of screen width
    this.add.text(GAME_WIDTH / 2 - colOffset, y, label, {
      fontSize: font(FONT.BODY),
      color: '#aaaaaa',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    this.add.text(GAME_WIDTH / 2 + colOffset, y, value, {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
