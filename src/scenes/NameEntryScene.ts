import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/gameConfig';

export class NameEntryScene extends Phaser.Scene {
  private playerName: string = '';
  private nameText!: Phaser.GameObjects.Text;
  private cursorVisible: boolean = true;
  private maxNameLength: number = 10;

  constructor() {
    super({ key: 'NameEntryScene' });
  }

  create(): void {
    // Title
    const title = this.add.text(GAME_WIDTH / 2, 80, 'JUNIE GLITCH RUN', {
      fontSize: '36px',
      color: '#e94560',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(GAME_WIDTH / 2, 130, 'A Level Devil Experience', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'Arial, sans-serif',
    });
    subtitle.setOrigin(0.5);

    // Instructions
    const instructions = this.add.text(GAME_WIDTH / 2, 200, 'Enter your name:', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
    });
    instructions.setOrigin(0.5);

    // Name input box
    const inputBox = this.add.rectangle(GAME_WIDTH / 2, 260, 300, 50, 0x333344);
    inputBox.setStrokeStyle(2, 0x4a4a6a);

    // Name text display
    this.nameText = this.add.text(GAME_WIDTH / 2, 260, '', {
      fontSize: '24px',
      color: '#00ff88',
      fontFamily: 'monospace',
    });
    this.nameText.setOrigin(0.5);

    // Cursor blink
    this.time.addEvent({
      delay: 500,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        this.updateNameDisplay();
      },
      loop: true,
    });

    // Controls hint
    const controls = this.add.text(GAME_WIDTH / 2, 340, 'Arrow Keys to move | UP to jump | SPACE to dash', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'Arial, sans-serif',
    });
    controls.setOrigin(0.5);

    // Start prompt
    const startPrompt = this.add.text(GAME_WIDTH / 2, 400, 'Press ENTER to start', {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'Arial, sans-serif',
    });
    startPrompt.setOrigin(0.5);

    // Pulsing animation for start prompt
    this.tweens.add({
      targets: startPrompt,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Keyboard input
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', this.handleKeyInput, this);
    }

    // Leaderboard button
    const leaderboardBtn = this.add.text(GAME_WIDTH / 2 - 80, 450, '[ Leaderboard ]', {
      fontSize: '14px',
      color: '#4a9eff',
      fontFamily: 'Arial, sans-serif',
    });
    leaderboardBtn.setOrigin(0.5);
    leaderboardBtn.setInteractive({ useHandCursor: true });
    leaderboardBtn.on('pointerover', () => leaderboardBtn.setColor('#6ab8ff'));
    leaderboardBtn.on('pointerout', () => leaderboardBtn.setColor('#4a9eff'));
    leaderboardBtn.on('pointerdown', () => {
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      this.scene.start('LeaderboardScene', { fromMenu: true });
    });

    // Level Editor button
    const editorBtn = this.add.text(GAME_WIDTH / 2 + 80, 450, '[ Level Editor ]', {
      fontSize: '14px',
      color: '#ff9944',
      fontFamily: 'Arial, sans-serif',
    });
    editorBtn.setOrigin(0.5);
    editorBtn.setInteractive({ useHandCursor: true });
    editorBtn.on('pointerover', () => editorBtn.setColor('#ffbb66'));
    editorBtn.on('pointerout', () => editorBtn.setColor('#ff9944'));
    editorBtn.on('pointerdown', () => {
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      this.scene.start('LevelEditorScene');
    });
  }

  private handleKeyInput(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (this.playerName.length > 0) {
        this.startGame();
      }
      return;
    }

    if (event.key === 'Backspace') {
      this.playerName = this.playerName.slice(0, -1);
      this.updateNameDisplay();
      return;
    }

    // Only allow alphanumeric characters
    if (event.key.length === 1 && /^[a-zA-Z0-9]$/.test(event.key)) {
      if (this.playerName.length < this.maxNameLength) {
        this.playerName += event.key.toUpperCase();
        this.updateNameDisplay();
      }
    }
  }

  private updateNameDisplay(): void {
    const cursor = this.cursorVisible ? '_' : '';
    this.nameText.setText(this.playerName + cursor);
  }

  private startGame(): void {
    if (this.input.keyboard) {
      this.input.keyboard.off('keydown', this.handleKeyInput, this);
    }

    // Start sound
    if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });

    // Transition effect
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { playerName: this.playerName });
    });
  }
}
