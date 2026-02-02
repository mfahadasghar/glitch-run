import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT, font } from '../config/gameConfig';

const JBMONO = '"JetBrains Mono", monospace';

export class NameEntryScene extends Phaser.Scene {
  private playerName: string = '';
  private nameText!: Phaser.GameObjects.Text;
  private cursorVisible: boolean = true;
  private maxNameLength: number = 10;

  // Snow effect
  private snowflakes: Phaser.GameObjects.Rectangle[] = [];
  private snowData: Array<{ vx: number; vy: number; baseX: number }> = [];

  constructor() {
    super({ key: 'NameEntryScene' });
  }

  create(): void {
    // Purple background (Cloud9 theme)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x3b1fad);

    // Create snow effect
    this.snowflakes = [];
    this.snowData = [];
    this.createSnow();

    // Title - white
    const title = this.add.text(GAME_WIDTH / 2, 150, 'GLITCH RUN', {
      fontSize: font(FONT.TITLE_MD),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Subtitle - white
    const subtitle = this.add.text(GAME_WIDTH / 2, 210, 'Cloud9 Edition', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    subtitle.setOrigin(0.5);

    // Instructions - white
    const instructions = this.add.text(GAME_WIDTH / 2, 320, 'Enter your name:', {
      fontSize: font(FONT.BODY_LG),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    instructions.setOrigin(0.5);

    // Name input box - white with white border
    const inputBox = this.add.rectangle(GAME_WIDTH / 2, 420, 480, 75, 0xffffff, 0.2);
    inputBox.setStrokeStyle(3, 0xffffff);

    // Name text display - white
    this.nameText = this.add.text(GAME_WIDTH / 2, 420, '', {
      fontSize: font(FONT.HEADING),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
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

    // Controls hint - white
    const controls = this.add.text(GAME_WIDTH / 2, 540, 'Arrow Keys to move | UP to jump | SPACE to dash', {
      fontSize: font(FONT.SMALL),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    controls.setOrigin(0.5);

    // Start prompt - white
    const startPrompt = this.add.text(GAME_WIDTH / 2, 650, 'Press ENTER to start', {
      fontSize: font(FONT.BODY_LG),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
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

    // Library button - white
    const libraryBtn = this.add.text(GAME_WIDTH / 2 - 250, 780, '[ Library ]', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    libraryBtn.setOrigin(0.5);
    libraryBtn.setInteractive({ useHandCursor: true });
    libraryBtn.on('pointerover', () => libraryBtn.setAlpha(0.7));
    libraryBtn.on('pointerout', () => libraryBtn.setAlpha(1));
    libraryBtn.on('pointerdown', () => {
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      this.scene.start('LevelLibraryScene', { playerName: this.playerName || 'PLAYER' });
    });

    // Leaderboard button - white
    const leaderboardBtn = this.add.text(GAME_WIDTH / 2, 780, '[ Leaderboard ]', {
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
      if (this.cache.audio.exists('button')) this.sound.play('button', { volume: 0.5 });
      this.scene.start('LeaderboardScene', { fromMenu: true });
    });

    // Level Editor button - white
    const editorBtn = this.add.text(GAME_WIDTH / 2 + 250, 780, '[ Editor ]', {
      fontSize: font(FONT.BODY),
      color: '#ffffff',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    editorBtn.setOrigin(0.5);
    editorBtn.setInteractive({ useHandCursor: true });
    editorBtn.on('pointerover', () => editorBtn.setAlpha(0.7));
    editorBtn.on('pointerout', () => editorBtn.setAlpha(1));
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

      // Gentle drift
      const drift = Math.sin(Date.now() * 0.001 + i) * 0.3;
      let dx = data.vx * dt + drift;
      let dy = data.vy * dt;

      flake.x += dx;
      flake.y += dy;

      // Wrap around screen
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
