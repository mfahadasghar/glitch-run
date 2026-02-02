import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, FONT, font } from '../config/gameConfig';
import { GRID_WIDTH, GRID_HEIGHT } from '../config/constants';
import { supabaseService } from '../services/SupabaseService';

const JBMONO = '"JetBrains Mono", monospace';

type PlaceableType =
  | 'platform'
  | 'spike_up'
  | 'spike_down'
  | 'laser'
  | 'gravity'
  | 'teleport'
  | 'crushing'
  | 'collapsing'
  | 'moving'
  | 'bounce'
  | 'fakefloor'
  | 'sawblade'
  | 'ice'
  | 'coin'
  | 'fakegoal'
  | 'mirrorenemy'
  | 'fakespike'
  | 'movinggoal'
  | 'start'
  | 'goal'
  | 'eraser';

interface PlacedItem {
  type: PlaceableType;
  gridX: number;
  gridY: number;
  config?: Record<string, unknown>;
}

interface LevelData {
  name: string;
  platforms: number[][]; // [x, y] pairs
  traps: Array<{
    type: string;
    x: number;
    y: number;
    config?: Record<string, unknown>;
  }>;
  start: { x: number; y: number };
  goal: { x: number; y: number };
  coins: number[][]; // [x, y] pairs
}

export class LevelEditorScene extends Phaser.Scene {
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private placedItems: Map<string, PlacedItem> = new Map();
  private placedVisuals: Map<string, Phaser.GameObjects.GameObject> = new Map();

  private currentTool: PlaceableType = 'platform';
  private toolButtons: Map<PlaceableType, Phaser.GameObjects.Rectangle> = new Map();

  private startPos: { x: number; y: number } = { x: 3, y: GRID_HEIGHT - 5 };
  private goalPos: { x: number; y: number } = { x: GRID_WIDTH - 4, y: GRID_HEIGHT - 5 };

  private startMarker!: Phaser.GameObjects.Container;
  private goalMarker!: Phaser.GameObjects.Container;

  private levelNameText!: Phaser.GameObjects.Text;
  private levelName: string = 'Untitled Level';

  private statusText!: Phaser.GameObjects.Text;

  // For teleport linking
  private teleportStart: { x: number; y: number } | null = null;

  // For laser linking (start and end points)
  private laserStart: { x: number; y: number } | null = null;

  // For moving platform (start and end points)
  private movingStart: { x: number; y: number } | null = null;

  // For sawblade path
  private sawbladePoints: Array<{ x: number; y: number }> = [];
  private sawbladePathGraphics!: Phaser.GameObjects.Graphics;

  // Draggable toolbar
  private toolbarContainer!: Phaser.GameObjects.Container;

  // Toggle states for level-wide effects
  private wallOfDeathEnabled: boolean = false;
  private risingLavaEnabled: boolean = false;
  private invertingRoomEnabled: boolean = false;
  private wallOfDeathButton!: Phaser.GameObjects.Rectangle;
  private risingLavaButton!: Phaser.GameObjects.Rectangle;
  private invertingRoomButton!: Phaser.GameObjects.Rectangle;
  private wallOfDeathLabel!: Phaser.GameObjects.Text;
  private risingLavaLabel!: Phaser.GameObjects.Text;
  private invertingRoomLabel!: Phaser.GameObjects.Text;
  private isDraggingToolbar: boolean = false;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  // Prevent click-through
  private isClickOnUI: boolean = false;

  constructor() {
    super({ key: 'LevelEditorScene' });
  }

  init(): void {
    // Check if returning from test mode
    const wasTestMode = this.registry.get('editorState');
    if (wasTestMode) {
      // Will restore state in create()
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x3b1fad);

    // Reset state
    this.placedItems.clear();
    this.placedVisuals.forEach(v => v.destroy());
    this.placedVisuals.clear();
    this.isClickOnUI = false;

    // Create grid
    this.createGrid();

    // Create draggable toolbar
    this.createDraggableToolbar();

    // Create start/goal markers
    this.createMarkers();

    // Create status text
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.985, 'CLICK TO PLACE | RIGHT-CLICK TO DELETE', {
      fontSize: font(FONT.BODY),
      color: '#888888',
      fontFamily: JBMONO,
      fontStyle: 'bold',
    });
    this.statusText.setOrigin(0.5);
    this.statusText.setDepth(50);

    // Sawblade path graphics
    this.sawbladePathGraphics = this.add.graphics();
    this.sawbladePathGraphics.setDepth(5);

    // Check if restoring from test mode
    const editorState = this.registry.get('editorState');
    if (editorState) {
      this.restoreEditorState(editorState);
      this.registry.remove('editorState');
    } else {
      // Create default level layout (floor + ceiling)
      this.createDefaultLayout();
    }

    // Input handling
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-S', () => this.saveLevel());
    this.input.keyboard?.on('keydown-T', () => this.testLevel());
    this.input.keyboard?.on('keydown-L', () => this.loadLevel());
    this.input.keyboard?.on('keydown-ESC', () => this.cancelCurrentAction());
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.finishSawblade();
      this.finishMoving();
    });
  }

  private createDefaultLayout(): void {
    // Create ceiling (top row)
    for (let x = 0; x < GRID_WIDTH; x++) {
      this.placeItemAt('platform', x, 0);
    }

    // Create floor (bottom 3 rows for 18-row grid)
    const floorStartY = GRID_HEIGHT - 3;
    for (let y = floorStartY; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.placeItemAt('platform', x, y);
      }
    }

    // Set default start and goal positions
    this.startPos = { x: 3, y: floorStartY - 1 };
    this.goalPos = { x: GRID_WIDTH - 4, y: floorStartY - 1 };
    this.updateMarkerPositions();
  }

  private createGrid(): void {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, 0x0a032f, 0.6);

    // Vertical lines
    for (let x = 0; x <= GRID_WIDTH; x++) {
      this.gridGraphics.lineBetween(
        x * TILE_SIZE, 0,
        x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE
      );
    }

    // Horizontal lines
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      this.gridGraphics.lineBetween(
        0, y * TILE_SIZE,
        GRID_WIDTH * TILE_SIZE, y * TILE_SIZE
      );
    }

    // Highlight floor area
    this.gridGraphics.fillStyle(0x0a032f, 0.3);
    this.gridGraphics.fillRect(0, (GRID_HEIGHT - 4) * TILE_SIZE, GRID_WIDTH * TILE_SIZE, 4 * TILE_SIZE);
  }

  private createDraggableToolbar(): void {
    // Create main toolbar container
    this.toolbarContainer = this.add.container(5, 5);
    this.toolbarContainer.setDepth(200);

    // Toolbar background - larger size (Cloud9 theme)
    const toolbarWidth = 500;
    const toolbarHeight = 360;
    const bg = this.add.rectangle(0, 0, toolbarWidth, toolbarHeight, 0x0a032f, 0.95);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x3b1fad);
    bg.setInteractive({ useHandCursor: true, draggable: true });
    this.toolbarContainer.add(bg);

    // Make entire toolbar background draggable
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDraggingToolbar = true;
      this.dragOffsetX = pointer.x - this.toolbarContainer.x;
      this.dragOffsetY = pointer.y - this.toolbarContainer.y;
      this.isClickOnUI = true;
    });

    // Title area with spacing (Cloud9 theme)
    const dragHandle = this.add.rectangle(toolbarWidth / 2, 15, toolbarWidth - 20, 20, 0x3b1fad);
    this.toolbarContainer.add(dragHandle);

    // Drag handle label - larger font
    const dragLabel = this.add.text(toolbarWidth / 2, 15, 'LEVEL EDITOR - DRAG TO MOVE', {
      fontSize: font(FONT.CAPTION),
      color: '#ffffff',
      fontFamily: JBMONO,
    });
    dragLabel.setOrigin(0.5);
    this.toolbarContainer.add(dragLabel);

    // Tools - all gray for readability
    const tools: { type: PlaceableType; label: string }[] = [
      { type: 'platform', label: 'PLAT' },
      { type: 'eraser', label: 'ERASE' },
      { type: 'spike_up', label: 'SPK ^' },
      { type: 'spike_down', label: 'SPK v' },
      { type: 'laser', label: 'LASER' },
      { type: 'gravity', label: 'GRAV' },
      { type: 'teleport', label: 'TELE' },
      { type: 'crushing', label: 'CRUSH' },
      { type: 'collapsing', label: 'FALL' },
      { type: 'moving', label: 'MOVING' },
      { type: 'bounce', label: 'BOUNCE' },
      { type: 'fakefloor', label: 'FAKE' },
      { type: 'sawblade', label: 'SAW' },
      { type: 'ice', label: 'ICE' },
      { type: 'coin', label: 'COIN' },
      { type: 'fakegoal', label: 'F.GOAL' },
      { type: 'mirrorenemy', label: 'MIRROR' },
      { type: 'fakespike', label: 'F.SPIKE' },
      { type: 'movinggoal', label: 'M.GOAL' },
      { type: 'start', label: 'START' },
      { type: 'goal', label: 'GOAL' },
    ];

    const buttonColor = 0x0a032f;

    const startX = 8;
    const startY = 38;
    const buttonWidth = 75;
    const buttonHeight = 28;
    const padding = 5;
    const columns = 6;

    tools.forEach((tool, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * (buttonWidth + padding);
      const y = startY + row * (buttonHeight + padding);

      const btnBg = this.add.rectangle(x + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, buttonColor);
      btnBg.setStrokeStyle(2, this.currentTool === tool.type ? 0xffffff : 0x3b1fad);
      btnBg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x + buttonWidth / 2, y + buttonHeight / 2, tool.label, {
        fontSize: font(FONT.CAPTION),
        color: '#ffffff',
        fontFamily: JBMONO,
      });
      label.setOrigin(0.5);

      btnBg.on('pointerdown', () => {
        this.isClickOnUI = true;
        this.selectTool(tool.type);
      });

      btnBg.on('pointerover', () => {
        if (this.currentTool !== tool.type) {
          btnBg.setStrokeStyle(2, 0xaaaaaa);
        }
      });

      btnBg.on('pointerout', () => {
        btnBg.setStrokeStyle(2, this.currentTool === tool.type ? 0xffffff : 0x3b1fad);
      });

      this.toolbarContainer.add([btnBg, label]);
      this.toolButtons.set(tool.type, btnBg);
    });

    // Control buttons - all gray, larger
    const controlButtons = [
      { label: 'SAVE', action: () => this.saveLevel() },
      { label: 'LOAD', action: () => this.loadLevel() },
      { label: 'TEST', action: () => this.testLevel() },
      { label: 'PUBLISH', action: () => this.publishLevel() },
      { label: 'CLEAR', action: () => this.clearLevel() },
      { label: 'BACK', action: () => this.goBack() },
    ];

    const controlStartX = 8;
    const controlStartY = 210;
    const controlBtnWidth = 75;
    const controlBtnHeight = 30;

    controlButtons.forEach((btn, index) => {
      const x = controlStartX + index * (controlBtnWidth + 6);
      const y = controlStartY;

      const btnBg = this.add.rectangle(x + controlBtnWidth / 2, y + controlBtnHeight / 2, controlBtnWidth, controlBtnHeight, buttonColor);
      btnBg.setStrokeStyle(2, 0x3b1fad);
      btnBg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x + controlBtnWidth / 2, y + controlBtnHeight / 2, btn.label, {
        fontSize: font(FONT.CAPTION),
        color: '#ffffff',
        fontFamily: JBMONO,
      });
      label.setOrigin(0.5);

      btnBg.on('pointerdown', () => {
        this.isClickOnUI = true;
        btn.action();
      });

      btnBg.on('pointerover', () => btnBg.setFillStyle(0x3b1fad));
      btnBg.on('pointerout', () => btnBg.setFillStyle(buttonColor));

      this.toolbarContainer.add([btnBg, label]);
    });

    // Level name (clickable)
    const nameY = 255;
    this.levelNameText = this.add.text(toolbarWidth / 2, nameY, `Level: ${this.levelName}`, {
      fontSize: font(FONT.CAPTION),
      color: '#ffffff',
      fontFamily: JBMONO,
    });
    this.levelNameText.setOrigin(0.5);
    this.levelNameText.setInteractive({ useHandCursor: true });
    this.levelNameText.on('pointerdown', () => {
      this.isClickOnUI = true;
      this.editLevelName();
    });
    this.toolbarContainer.add(this.levelNameText);

    // Toggle buttons for level-wide effects
    const toggleY = 280;
    const toggleBtnWidth = 140;
    const toggleBtnHeight = 28;

    // Wall of Death toggle
    this.wallOfDeathButton = this.add.rectangle(
      toolbarWidth / 4,
      toggleY + toggleBtnHeight / 2,
      toggleBtnWidth,
      toggleBtnHeight,
      0x0a032f
    );
    this.wallOfDeathButton.setStrokeStyle(2, 0x3b1fad);
    this.wallOfDeathButton.setInteractive({ useHandCursor: true });

    this.wallOfDeathLabel = this.add.text(toolbarWidth / 4, toggleY + toggleBtnHeight / 2, 'WALL: OFF', {
      fontSize: font(FONT.CAPTION),
      color: '#888888',
      fontFamily: JBMONO,
    });
    this.wallOfDeathLabel.setOrigin(0.5);

    this.wallOfDeathButton.on('pointerdown', () => {
      this.isClickOnUI = true;
      this.wallOfDeathEnabled = !this.wallOfDeathEnabled;
      this.updateToggleButton(
        this.wallOfDeathButton,
        this.wallOfDeathLabel,
        'WALL',
        this.wallOfDeathEnabled
      );
    });

    this.toolbarContainer.add([this.wallOfDeathButton, this.wallOfDeathLabel]);

    // Rising Lava toggle
    this.risingLavaButton = this.add.rectangle(
      toolbarWidth * 3 / 4,
      toggleY + toggleBtnHeight / 2,
      toggleBtnWidth,
      toggleBtnHeight,
      0x0a032f
    );
    this.risingLavaButton.setStrokeStyle(2, 0x3b1fad);
    this.risingLavaButton.setInteractive({ useHandCursor: true });

    this.risingLavaLabel = this.add.text(toolbarWidth * 3 / 4, toggleY + toggleBtnHeight / 2, 'LAVA: OFF', {
      fontSize: font(FONT.CAPTION),
      color: '#888888',
      fontFamily: JBMONO,
    });
    this.risingLavaLabel.setOrigin(0.5);

    this.risingLavaButton.on('pointerdown', () => {
      this.isClickOnUI = true;
      this.risingLavaEnabled = !this.risingLavaEnabled;
      this.updateToggleButton(
        this.risingLavaButton,
        this.risingLavaLabel,
        'LAVA',
        this.risingLavaEnabled
      );
    });

    this.toolbarContainer.add([this.risingLavaButton, this.risingLavaLabel]);

    // Inverting Room toggle (second row)
    const toggleY2 = toggleY + toggleBtnHeight + 8;
    this.invertingRoomButton = this.add.rectangle(
      toolbarWidth / 2,
      toggleY2 + toggleBtnHeight / 2,
      toggleBtnWidth,
      toggleBtnHeight,
      0x0a032f
    );
    this.invertingRoomButton.setStrokeStyle(2, 0x3b1fad);
    this.invertingRoomButton.setInteractive({ useHandCursor: true });

    this.invertingRoomLabel = this.add.text(toolbarWidth / 2, toggleY2 + toggleBtnHeight / 2, 'FLIP: OFF', {
      fontSize: font(FONT.CAPTION),
      color: '#888888',
      fontFamily: JBMONO,
    });
    this.invertingRoomLabel.setOrigin(0.5);

    this.invertingRoomButton.on('pointerdown', () => {
      this.isClickOnUI = true;
      this.invertingRoomEnabled = !this.invertingRoomEnabled;
      this.updateToggleButton(
        this.invertingRoomButton,
        this.invertingRoomLabel,
        'FLIP',
        this.invertingRoomEnabled
      );
    });

    this.toolbarContainer.add([this.invertingRoomButton, this.invertingRoomLabel]);
  }

  private updateToggleButton(
    button: Phaser.GameObjects.Rectangle,
    label: Phaser.GameObjects.Text,
    name: string,
    enabled: boolean
  ): void {
    if (enabled) {
      button.setFillStyle(0x006600);
      button.setStrokeStyle(2, 0x00ff00);
      label.setText(`${name}: ON`);
      label.setColor('#00ff00');
    } else {
      button.setFillStyle(0x0a032f);
      button.setStrokeStyle(2, 0x3b1fad);
      label.setText(`${name}: OFF`);
      label.setColor('#888888');
    }
  }

  private createMarkers(): void {
    // Start marker (green player silhouette)
    this.startMarker = this.add.container(
      this.startPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.startPos.y * TILE_SIZE + TILE_SIZE / 2
    );
    const startShape = this.add.rectangle(0, 0, TILE_SIZE * 0.5, TILE_SIZE * 0.6, 0x00ff88);
    const startLabel = this.add.text(0, -TILE_SIZE * 0.45, 'START', { fontSize: `${TILE_SIZE * 0.3}px`, color: '#00ff88' });
    startLabel.setOrigin(0.5);
    this.startMarker.add([startShape, startLabel]);
    this.startMarker.setDepth(50);

    // Goal marker (yellow flag)
    this.goalMarker = this.add.container(
      this.goalPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.goalPos.y * TILE_SIZE + TILE_SIZE / 2
    );
    const goalShape = this.add.rectangle(0, 0, TILE_SIZE * 0.55, TILE_SIZE * 0.7, 0xffd700);
    goalShape.setStrokeStyle(3, 0xffaa00);
    const goalLabel = this.add.text(0, -TILE_SIZE * 0.5, 'GOAL', { fontSize: `${TILE_SIZE * 0.3}px`, color: '#ffd700' });
    goalLabel.setOrigin(0.5);
    this.goalMarker.add([goalShape, goalLabel]);
    this.goalMarker.setDepth(50);
  }

  private updateMarkerPositions(): void {
    this.startMarker.setPosition(
      this.startPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.startPos.y * TILE_SIZE + TILE_SIZE / 2
    );
    this.goalMarker.setPosition(
      this.goalPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.goalPos.y * TILE_SIZE + TILE_SIZE / 2
    );
  }

  private selectTool(tool: PlaceableType): void {
    // Cancel any in-progress action
    this.cancelCurrentAction();

    this.currentTool = tool;

    // Update button visuals
    this.toolButtons.forEach((btnBg, type) => {
      btnBg.setStrokeStyle(2, type === tool ? 0xffffff : 0x3b1fad);
    });

    // Update status text
    if (tool === 'teleport') {
      this.statusText.setText('TELEPORT: Click source, then click destination');
    } else if (tool === 'laser') {
      this.statusText.setText('LASER: Click start point, then click end point');
    } else if (tool === 'moving') {
      this.statusText.setText('MOVING: Click start, then end, press ENTER');
    } else if (tool === 'sawblade') {
      this.statusText.setText('SAWBLADE: Click points for path, then press ENTER to finish');
    } else {
      this.statusText.setText(`Selected: ${tool.toUpperCase()} - Click to place, Right-click to delete`);
    }
  }

  private cancelCurrentAction(): void {
    this.teleportStart = null;
    this.laserStart = null;
    this.movingStart = null;
    this.sawbladePoints = [];
    this.sawbladePathGraphics.clear();

    // Destroy temp teleport marker if exists
    if ((this as any).tempTeleportMarker) {
      (this as any).tempTeleportMarker.destroy();
      (this as any).tempTeleportMarker = null;
    }

    // Destroy temp laser marker if exists
    if ((this as any).tempLaserMarker) {
      (this as any).tempLaserMarker.destroy();
      (this as any).tempLaserMarker = null;
    }

    // Destroy temp moving marker if exists
    if ((this as any).tempMovingMarker) {
      (this as any).tempMovingMarker.destroy();
      (this as any).tempMovingMarker = null;
    }
    if ((this as any).tempMovingLine) {
      (this as any).tempMovingLine.destroy();
      (this as any).tempMovingLine = null;
    }
    (this as any).tempMovingEnd = null;
  }

  private drawSawbladePath(): void {
    this.sawbladePathGraphics.clear();
    this.sawbladePathGraphics.lineStyle(3, 0xff8800, 0.8);

    if (this.sawbladePoints.length > 1) {
      this.sawbladePathGraphics.beginPath();
      this.sawbladePathGraphics.moveTo(
        this.sawbladePoints[0].x * TILE_SIZE + TILE_SIZE / 2,
        this.sawbladePoints[0].y * TILE_SIZE + TILE_SIZE / 2
      );
      for (let i = 1; i < this.sawbladePoints.length; i++) {
        this.sawbladePathGraphics.lineTo(
          this.sawbladePoints[i].x * TILE_SIZE + TILE_SIZE / 2,
          this.sawbladePoints[i].y * TILE_SIZE + TILE_SIZE / 2
        );
      }
      this.sawbladePathGraphics.strokePath();
    }

    // Draw points
    for (const pt of this.sawbladePoints) {
      this.sawbladePathGraphics.fillStyle(0xff8800, 1);
      this.sawbladePathGraphics.fillCircle(pt.x * TILE_SIZE + TILE_SIZE / 2, pt.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.12);
    }
  }

  private finishSawblade(): void {
    if (this.currentTool !== 'sawblade' || this.sawbladePoints.length < 2) {
      return;
    }

    const firstPt = this.sawbladePoints[0];
    const item: PlacedItem = {
      type: 'sawblade',
      gridX: firstPt.x,
      gridY: firstPt.y,
      config: {
        pathPoints: this.sawbladePoints.map(p => ({
          x: p.x * TILE_SIZE + TILE_SIZE / 2,
          y: p.y * TILE_SIZE + TILE_SIZE / 2,
        })),
      },
    };
    const sawKey = `saw_${firstPt.x},${firstPt.y}_${Date.now()}`;
    this.placedItems.set(sawKey, item);
    this.createVisual(item, sawKey);

    console.log('Sawblade placed:', item);

    this.sawbladePoints = [];
    this.sawbladePathGraphics.clear();
    this.statusText.setText('SAWBLADE placed! Click to start another path.');
  }

  private finishMoving(): void {
    if (this.currentTool !== 'moving' || !this.movingStart || !(this as any).tempMovingEnd) {
      return;
    }

    const endPt = (this as any).tempMovingEnd;
    const item: PlacedItem = {
      type: 'moving',
      gridX: this.movingStart.x,
      gridY: this.movingStart.y,
      config: {
        endX: endPt.x * TILE_SIZE + TILE_SIZE / 2,
        endY: endPt.y * TILE_SIZE + TILE_SIZE / 2,
      },
    };
    const movingKey = `moving_${this.movingStart.x},${this.movingStart.y}_${Date.now()}`;
    this.placedItems.set(movingKey, item);
    this.createVisual(item, movingKey);

    console.log('Moving platform placed:', item);

    // Clean up temp elements
    if ((this as any).tempMovingMarker) {
      (this as any).tempMovingMarker.destroy();
      (this as any).tempMovingMarker = null;
    }
    if ((this as any).tempMovingLine) {
      (this as any).tempMovingLine.destroy();
      (this as any).tempMovingLine = null;
    }
    (this as any).tempMovingEnd = null;
    this.movingStart = null;

    this.statusText.setText('MOVING placed! Click to start another.');
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Check if clicking on toolbar area
    const toolbarBounds = this.toolbarContainer.getBounds();
    if (toolbarBounds.contains(pointer.x, pointer.y)) {
      this.isClickOnUI = true;
      return;
    }

    // If we just clicked UI, don't place
    if (this.isClickOnUI) {
      return;
    }

    const gridX = Math.floor(pointer.x / TILE_SIZE);
    const gridY = Math.floor(pointer.y / TILE_SIZE);

    if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) return;

    if (pointer.rightButtonDown()) {
      this.deleteAt(gridX, gridY);
    } else {
      this.placeAt(gridX, gridY);
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Handle toolbar dragging
    if (this.isDraggingToolbar) {
      this.toolbarContainer.x = pointer.x - this.dragOffsetX;
      this.toolbarContainer.y = pointer.y - this.dragOffsetY;

      // Keep toolbar on screen
      this.toolbarContainer.x = Phaser.Math.Clamp(this.toolbarContainer.x, 0, GAME_WIDTH * 0.74);
      this.toolbarContainer.y = Phaser.Math.Clamp(this.toolbarContainer.y, 0, GAME_HEIGHT * 0.81);
      return;
    }

    // Handle continuous placement while dragging
    if (pointer.isDown && !this.isClickOnUI) {
      const toolbarBounds = this.toolbarContainer.getBounds();
      if (toolbarBounds.contains(pointer.x, pointer.y)) return;

      const gridX = Math.floor(pointer.x / TILE_SIZE);
      const gridY = Math.floor(pointer.y / TILE_SIZE);

      if (gridX < 0 || gridX >= GRID_WIDTH || gridY < 0 || gridY >= GRID_HEIGHT) return;

      // Only allow drag-painting for simple tools
      if (this.currentTool === 'platform' || this.currentTool === 'eraser') {
        if (pointer.rightButtonDown()) {
          this.deleteAt(gridX, gridY);
        } else {
          this.placeAt(gridX, gridY);
        }
      }
    }
  }

  private handlePointerUp(): void {
    this.isDraggingToolbar = false;
    this.isClickOnUI = false;
  }

  private placeAt(gridX: number, gridY: number): void {
    // Handle special tools
    if (this.currentTool === 'start') {
      this.startPos = { x: gridX, y: gridY };
      this.updateMarkerPositions();
      return;
    }

    if (this.currentTool === 'goal') {
      this.goalPos = { x: gridX, y: gridY };
      this.updateMarkerPositions();
      return;
    }

    if (this.currentTool === 'eraser') {
      this.deleteAt(gridX, gridY);
      return;
    }

    // Handle teleport (needs two clicks)
    if (this.currentTool === 'teleport') {
      if (!this.teleportStart) {
        this.teleportStart = { x: gridX, y: gridY };
        this.statusText.setText('TELEPORT: Now click destination...');
        // Show temporary marker
        const marker = this.add.circle(
          gridX * TILE_SIZE + TILE_SIZE / 2,
          gridY * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE * 0.2, 0x00ffff, 0.5
        );
        marker.setDepth(60);
        this.tweens.add({
          targets: marker,
          scale: 1.5,
          alpha: 0,
          duration: 500,
          repeat: -1,
        });
        (this as any).tempTeleportMarker = marker;
        return;
      } else {
        // Place teleport with target
        const item: PlacedItem = {
          type: 'teleport',
          gridX: this.teleportStart.x,
          gridY: this.teleportStart.y,
          config: {
            targetX: gridX * TILE_SIZE + TILE_SIZE / 2,
            targetY: gridY * TILE_SIZE + TILE_SIZE / 2,
          },
        };
        const sourceKey = `${this.teleportStart.x},${this.teleportStart.y}`;
        this.placedItems.set(sourceKey, item);
        this.createVisual(item, sourceKey);

        // Draw line to target
        const line = this.add.graphics();
        line.lineStyle(2, 0x00ffff, 0.5);
        line.lineBetween(
          this.teleportStart.x * TILE_SIZE + TILE_SIZE / 2,
          this.teleportStart.y * TILE_SIZE + TILE_SIZE / 2,
          gridX * TILE_SIZE + TILE_SIZE / 2,
          gridY * TILE_SIZE + TILE_SIZE / 2
        );
        line.setDepth(4);

        // Destroy temp marker
        if ((this as any).tempTeleportMarker) {
          (this as any).tempTeleportMarker.destroy();
          (this as any).tempTeleportMarker = null;
        }

        this.teleportStart = null;
        this.statusText.setText('TELEPORT placed! Click to place another.');
        return;
      }
    }

    // Handle laser (needs two clicks - start and end)
    if (this.currentTool === 'laser') {
      if (!this.laserStart) {
        this.laserStart = { x: gridX, y: gridY };
        this.statusText.setText('LASER: Now click end point...');
        // Show temporary marker
        const marker = this.add.rectangle(
          gridX * TILE_SIZE + TILE_SIZE / 2,
          gridY * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE * 0.15, TILE_SIZE * 0.15, 0xff0000, 0.8
        );
        marker.setDepth(60);
        this.tweens.add({
          targets: marker,
          scale: 1.5,
          alpha: 0.3,
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
        (this as any).tempLaserMarker = marker;
        return;
      } else {
        // Place laser with start and end points
        const item: PlacedItem = {
          type: 'laser',
          gridX: this.laserStart.x,
          gridY: this.laserStart.y,
          config: {
            endX: gridX * TILE_SIZE + TILE_SIZE / 2,
            endY: gridY * TILE_SIZE + TILE_SIZE / 2,
          },
        };
        const laserKey = `laser_${this.laserStart.x},${this.laserStart.y}_${Date.now()}`;
        this.placedItems.set(laserKey, item);
        this.createVisual(item, laserKey);

        // Destroy temp marker
        if ((this as any).tempLaserMarker) {
          (this as any).tempLaserMarker.destroy();
          (this as any).tempLaserMarker = null;
        }

        this.laserStart = null;
        this.statusText.setText('LASER placed! Click to place another.');
        return;
      }
    }

    // Handle moving platform (needs two clicks + enter)
    if (this.currentTool === 'moving') {
      if (!this.movingStart) {
        this.movingStart = { x: gridX, y: gridY };
        this.statusText.setText('MOVING: Now click end point, then ENTER');
        // Show temporary marker
        const marker = this.add.rectangle(
          gridX * TILE_SIZE + TILE_SIZE / 2,
          gridY * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE * 2, TILE_SIZE, 0x4a6a4a, 0.8
        );
        marker.setStrokeStyle(2, 0x3a5a3a);
        marker.setDepth(60);
        (this as any).tempMovingMarker = marker;
        (this as any).tempMovingEnd = null;
        return;
      } else {
        // Store end point and show preview line
        (this as any).tempMovingEnd = { x: gridX, y: gridY };

        // Draw preview line
        if ((this as any).tempMovingLine) {
          (this as any).tempMovingLine.destroy();
        }
        const line = this.add.graphics();
        line.lineStyle(2, 0x4a6a4a, 0.5);
        line.lineBetween(
          this.movingStart.x * TILE_SIZE + TILE_SIZE / 2,
          this.movingStart.y * TILE_SIZE + TILE_SIZE / 2,
          gridX * TILE_SIZE + TILE_SIZE / 2,
          gridY * TILE_SIZE + TILE_SIZE / 2
        );
        line.setDepth(4);
        (this as any).tempMovingLine = line;

        this.statusText.setText('MOVING: Press ENTER to place, ESC to cancel');
        return;
      }
    }

    // Handle sawblade (needs multiple clicks + enter)
    if (this.currentTool === 'sawblade') {
      this.sawbladePoints.push({ x: gridX, y: gridY });

      // Draw path
      this.drawSawbladePath();

      this.statusText.setText(`SAWBLADE: ${this.sawbladePoints.length} points. Press ENTER to finish, ESC to cancel.`);

      return;
    }

    // Place regular item
    this.placeItemAt(this.currentTool, gridX, gridY);
  }

  private placeItemAt(type: PlaceableType, gridX: number, gridY: number): void {
    const key = `${gridX},${gridY}`;

    // Delete existing item at this position
    if (this.placedItems.has(key)) {
      this.deleteAt(gridX, gridY);
    }

    // Place new item
    const item: PlacedItem = {
      type,
      gridX,
      gridY,
    };

    // Add config for specific types
    if (type === 'spike_up') {
      item.config = { direction: 'up' };
    } else if (type === 'spike_down') {
      item.config = { direction: 'down' };
    }

    this.placedItems.set(key, item);
    this.createVisual(item, key);
  }

  private deleteAt(gridX: number, gridY: number): void {
    const key = `${gridX},${gridY}`;

    if (this.placedItems.has(key)) {
      this.placedItems.delete(key);

      const visual = this.placedVisuals.get(key);
      if (visual) {
        visual.destroy();
        this.placedVisuals.delete(key);
      }
    }
  }

  private createVisual(item: PlacedItem, key: string): void {
    const x = item.gridX * TILE_SIZE + TILE_SIZE / 2;
    const y = item.gridY * TILE_SIZE + TILE_SIZE / 2;

    let visual: Phaser.GameObjects.GameObject;

    switch (item.type) {
      case 'platform':
        visual = this.add.rectangle(x, y, TILE_SIZE - 1, TILE_SIZE - 1, 0x0a032f);
        break;

      case 'spike_up': {
        // Spike at bottom of cell, pointing up - use graphics for precise control
        const spikeUpGfx = this.add.graphics();
        const spikeUpHeight = TILE_SIZE * 0.5;
        const spikeUpWidth = TILE_SIZE * 0.7;
        const baseY = y + TILE_SIZE / 2; // Bottom of cell
        spikeUpGfx.fillStyle(0x111111, 1);
        spikeUpGfx.beginPath();
        spikeUpGfx.moveTo(x - spikeUpWidth / 2, baseY); // Bottom left
        spikeUpGfx.lineTo(x, baseY - spikeUpHeight);     // Top (tip)
        spikeUpGfx.lineTo(x + spikeUpWidth / 2, baseY); // Bottom right
        spikeUpGfx.closePath();
        spikeUpGfx.fillPath();
        visual = spikeUpGfx;
        break;
      }

      case 'spike_down': {
        // Spike at top of cell, pointing down - use graphics for precise control
        const spikeDownGfx = this.add.graphics();
        const spikeDownHeight = TILE_SIZE * 0.5;
        const spikeDownWidth = TILE_SIZE * 0.7;
        const topY = y - TILE_SIZE / 2; // Top of cell
        spikeDownGfx.fillStyle(0x111111, 1);
        spikeDownGfx.beginPath();
        spikeDownGfx.moveTo(x - spikeDownWidth / 2, topY); // Top left
        spikeDownGfx.lineTo(x, topY + spikeDownHeight);     // Bottom (tip)
        spikeDownGfx.lineTo(x + spikeDownWidth / 2, topY); // Top right
        spikeDownGfx.closePath();
        spikeDownGfx.fillPath();
        visual = spikeDownGfx;
        break;
      }

      case 'laser':
        const laserContainer = this.add.container(0, 0);
        // Start emitter
        const laserStart = this.add.rectangle(x, y, TILE_SIZE - 4, TILE_SIZE - 4, 0x660000);
        laserStart.setStrokeStyle(2, 0xff0000);
        laserContainer.add(laserStart);

        // If we have end point, draw the beam
        if (item.config?.endX !== undefined && item.config?.endY !== undefined) {
          const endX = item.config.endX as number;
          const endY = item.config.endY as number;

          // End emitter
          const laserEnd = this.add.rectangle(endX, endY, TILE_SIZE - 4, TILE_SIZE - 4, 0x660000);
          laserEnd.setStrokeStyle(2, 0xff0000);
          laserContainer.add(laserEnd);

          // Laser beam line
          const beam = this.add.graphics();
          beam.lineStyle(4, 0xff0000, 0.6);
          beam.lineBetween(x, y, endX, endY);
          laserContainer.add(beam);
        }
        visual = laserContainer;
        break;

      case 'gravity':
        const gravContainer = this.add.container(x, y);
        const gravBg = this.add.rectangle(0, 0, TILE_SIZE - 2, TILE_SIZE - 2, 0x9966ff, 0.5);
        const gravArrowSize = TILE_SIZE * 0.25;
        const gravArrow = this.add.triangle(0, 0, -gravArrowSize, gravArrowSize, 0, -gravArrowSize, gravArrowSize, gravArrowSize, 0xcc99ff);
        gravContainer.add([gravBg, gravArrow]);
        visual = gravContainer;
        break;

      case 'teleport':
        const teleContainer = this.add.container(x, y);
        const teleCircle = this.add.circle(0, 0, TILE_SIZE / 3, 0x00ffff, 0.7);
        const teleInner = this.add.circle(0, 0, TILE_SIZE / 6, 0x00aaaa);
        teleContainer.add([teleCircle, teleInner]);
        visual = teleContainer;
        break;

      case 'crushing':
        visual = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2, 0x666666);
        (visual as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0x444444);
        break;

      case 'collapsing':
        visual = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2, 0x8b4513);
        (visual as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0x654321);
        break;

      case 'moving':
        const moveContainer = this.add.container(0, 0);

        // Draw path line if end point exists
        if (item.config?.endX !== undefined && item.config?.endY !== undefined) {
          const endX = item.config.endX as number;
          const endY = item.config.endY as number;

          // Path line
          const pathLine = this.add.graphics();
          pathLine.lineStyle(2, 0x4a6a4a, 0.5);
          pathLine.lineBetween(x, y, endX, endY);
          moveContainer.add(pathLine);

          // End marker
          const endMarker = this.add.rectangle(endX, endY, TILE_SIZE * 2, TILE_SIZE - 4, 0x4a6a4a, 0.3);
          endMarker.setStrokeStyle(1, 0x3a5a3a);
          moveContainer.add(endMarker);
        }

        // Start platform (main visual)
        const movePlat = this.add.rectangle(x, y, TILE_SIZE * 2, TILE_SIZE - 4, 0x4a6a4a);
        movePlat.setStrokeStyle(2, 0x3a5a3a);
        moveContainer.add(movePlat);

        visual = moveContainer;
        break;

      case 'bounce':
        const bounceContainer = this.add.container(x, y);
        // Position at bottom of cell
        const bottomY = TILE_SIZE / 2;
        const baseHeight = TILE_SIZE * 0.15;
        const springHeight = TILE_SIZE * 0.3;
        const padHeight = TILE_SIZE * 0.15;
        const baseY = bottomY - baseHeight / 2;
        const springY = baseY - baseHeight / 2 - springHeight / 2;
        const padY = springY - springHeight / 2 - padHeight / 2;

        const bounceBase = this.add.rectangle(0, baseY, TILE_SIZE * 0.9, baseHeight, 0x666666);
        const bounceSpring = this.add.rectangle(0, springY, TILE_SIZE * 0.4, springHeight, 0xffaa00);
        bounceSpring.setStrokeStyle(2, 0xff8800);
        const bouncePadRect = this.add.rectangle(0, padY, TILE_SIZE * 0.8, padHeight, 0xff6600);
        bouncePadRect.setStrokeStyle(2, 0xff4400);
        bounceContainer.add([bounceBase, bounceSpring, bouncePadRect]);
        visual = bounceContainer;
        break;

      case 'fakefloor':
        visual = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2, 0x0a032f);
        (visual as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0xff0000, 0.5);
        break;

      case 'sawblade':
        const sawContainer = this.add.container(0, 0);

        // Draw path if pathPoints exist
        if (item.config?.pathPoints) {
          const pathPoints = item.config.pathPoints as Array<{ x: number; y: number }>;
          if (pathPoints.length > 1) {
            const pathGraphics = this.add.graphics();
            pathGraphics.lineStyle(2, 0xff8800, 0.6);
            pathGraphics.beginPath();
            pathGraphics.moveTo(pathPoints[0].x, pathPoints[0].y);
            for (let i = 1; i < pathPoints.length; i++) {
              pathGraphics.lineTo(pathPoints[i].x, pathPoints[i].y);
            }
            pathGraphics.strokePath();

            // Draw points
            for (const pt of pathPoints) {
              pathGraphics.fillStyle(0xff8800, 0.8);
              pathGraphics.fillCircle(pt.x, pt.y, TILE_SIZE * 0.1);
            }
            sawContainer.add(pathGraphics);
          }
        }

        // Sawblade circle at start position
        const sawCircle = this.add.circle(x, y, TILE_SIZE / 2, 0x888888);
        sawCircle.setStrokeStyle(2, 0x666666);
        const sawInner = this.add.circle(x, y, TILE_SIZE / 4, 0x444444);
        sawContainer.add([sawCircle, sawInner]);
        visual = sawContainer;
        break;

      case 'ice':
        visual = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2, 0x88ddff);
        (visual as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0x66bbdd);
        break;

      case 'fakegoal':
        const fakeGoalContainer = this.add.container(x, y);
        const fakeGoalDoor = this.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE * 1.5 - 4, 0xffd700);
        fakeGoalDoor.setStrokeStyle(3, 0xff0000);
        const fakeGoalX = this.add.text(0, 0, 'X', { fontSize: `${TILE_SIZE * 0.7}px`, color: '#ff0000', fontStyle: 'bold' });
        fakeGoalX.setOrigin(0.5);
        fakeGoalContainer.add([fakeGoalDoor, fakeGoalX]);
        visual = fakeGoalContainer;
        break;

      case 'mirrorenemy':
        const mirrorContainer = this.add.container(x, y);
        const mirrorSize = TILE_SIZE * 0.6;
        const mirrorBody = this.add.rectangle(0, 0, mirrorSize, mirrorSize, 0x000000, 0.8);
        mirrorBody.setStrokeStyle(3, 0xff0000);
        const eyeSize = TILE_SIZE * 0.1;
        const mirrorEyeL = this.add.rectangle(-mirrorSize * 0.2, -mirrorSize * 0.1, eyeSize, eyeSize, 0xff0000);
        const mirrorEyeR = this.add.rectangle(mirrorSize * 0.2, -mirrorSize * 0.1, eyeSize, eyeSize, 0xff0000);
        mirrorContainer.add([mirrorBody, mirrorEyeL, mirrorEyeR]);
        visual = mirrorContainer;
        break;

      case 'fakespike': {
        // Fake spike - looks like spike but with green tint to show it's safe
        const fakeSpikeContainer = this.add.container(0, 0);
        const fakeSpikeHeight = TILE_SIZE * 0.5;
        const fakeSpikeWidth = TILE_SIZE * 0.7;
        const fakeBaseY = y + TILE_SIZE / 2; // Bottom of cell
        // Draw spike using graphics
        const fakeSpikeGfx = this.add.graphics();
        fakeSpikeGfx.fillStyle(0x111111, 0.6);
        fakeSpikeGfx.beginPath();
        fakeSpikeGfx.moveTo(x - fakeSpikeWidth / 2, fakeBaseY); // Bottom left
        fakeSpikeGfx.lineTo(x, fakeBaseY - fakeSpikeHeight);     // Top (tip)
        fakeSpikeGfx.lineTo(x + fakeSpikeWidth / 2, fakeBaseY); // Bottom right
        fakeSpikeGfx.closePath();
        fakeSpikeGfx.fillPath();
        fakeSpikeContainer.add(fakeSpikeGfx);
        // Question mark to indicate it's fake
        const safeMark = this.add.text(x, y + TILE_SIZE * 0.15, '?', { fontSize: `${TILE_SIZE * 0.5}px`, color: '#00ff00', fontStyle: 'bold' });
        safeMark.setOrigin(0.5);
        fakeSpikeContainer.add(safeMark);
        visual = fakeSpikeContainer;
        break;
      }

      case 'movinggoal':
        // Moving goal - golden door with arrows
        const movingGoalContainer = this.add.container(x, y);
        const movingGoalDoor = this.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE * 1.5 - 4, 0xffd700);
        movingGoalDoor.setStrokeStyle(3, 0xffaa00);
        const arrowSz = TILE_SIZE * 0.15;
        const arrowL = this.add.triangle(-TILE_SIZE/2 - arrowSz, 0, 0, -arrowSz, 0, arrowSz, -arrowSz * 1.5, 0, 0xffffff);
        const arrowR = this.add.triangle(TILE_SIZE/2 + arrowSz, 0, 0, -arrowSz, 0, arrowSz, arrowSz * 1.5, 0, 0xffffff);
        movingGoalContainer.add([movingGoalDoor, arrowL, arrowR]);
        visual = movingGoalContainer;
        break;

      case 'coin':
        visual = this.add.circle(x, y, TILE_SIZE * 0.25, 0xffd700);
        break;

      default:
        visual = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2, 0xff00ff);
    }

    (visual as any).setDepth?.(10);
    this.placedVisuals.set(key, visual);
  }

  private editLevelName(): void {
    const newName = prompt('Enter level name:', this.levelName);
    if (newName) {
      this.levelName = newName;
      this.levelNameText.setText(`Level: ${this.levelName}`);
    }
  }

  private saveLevel(): void {
    const levelData = this.exportLevelData();
    const json = JSON.stringify(levelData, null, 2);

    // Create download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.levelName.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.statusText.setText(`Level "${this.levelName}" saved!`);
  }

  private loadLevel(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string) as LevelData;
          this.importLevelData(data);
          this.statusText.setText(`Level "${data.name}" loaded!`);
        } catch (err) {
          this.statusText.setText('Error loading level file!');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  private exportLevelData(): LevelData {
    const platforms: number[][] = [];
    const traps: LevelData['traps'] = [];
    const coins: number[][] = [];

    this.placedItems.forEach((item) => {
      if (item.type === 'platform') {
        platforms.push([item.gridX, item.gridY]);
      } else if (item.type === 'coin') {
        coins.push([item.gridX, item.gridY]);
      } else {
        // It's a trap
        let trapType = item.type as string;
        if (trapType === 'spike_up' || trapType === 'spike_down') {
          trapType = 'spike';
        }

        traps.push({
          type: trapType,
          x: item.gridX,
          y: item.gridY,
          config: item.config,
        });
      }
    });

    // Add wall of death if enabled
    if (this.wallOfDeathEnabled) {
      traps.push({
        type: 'wallofdeath',
        x: 0,
        y: 0,
        config: { speed: 60, delay: 2000 },
      });
    }

    // Add rising lava if enabled
    if (this.risingLavaEnabled) {
      traps.push({
        type: 'risinglava',
        x: 0,
        y: 0,
        config: { speed: 30, delay: 3000 },
      });
    }

    // Add inverting room if enabled
    if (this.invertingRoomEnabled) {
      traps.push({
        type: 'invertingroom',
        x: 0,
        y: 0,
        config: {},
      });
    }

    return {
      name: this.levelName,
      platforms,
      traps,
      start: this.startPos,
      goal: this.goalPos,
      coins,
    };
  }

  private importLevelData(data: LevelData): void {
    // Clear current level completely
    this.placedItems.clear();
    this.placedVisuals.forEach((v) => v.destroy());
    this.placedVisuals.clear();

    // Reset toggle states
    this.wallOfDeathEnabled = false;
    this.risingLavaEnabled = false;
    this.invertingRoomEnabled = false;

    this.levelName = data.name;
    this.levelNameText.setText(`Level: ${this.levelName}`);

    // Set start/goal
    this.startPos = data.start;
    this.goalPos = data.goal;
    this.updateMarkerPositions();

    // Place platforms
    for (const [x, y] of data.platforms) {
      this.placeItemAt('platform', x, y);
    }

    // Place traps
    for (const trap of data.traps) {
      // Check for level-wide effects
      if (trap.type === 'wallofdeath') {
        this.wallOfDeathEnabled = true;
        this.updateToggleButton(this.wallOfDeathButton, this.wallOfDeathLabel, 'WALL', true);
        continue;
      }
      if (trap.type === 'risinglava') {
        this.risingLavaEnabled = true;
        this.updateToggleButton(this.risingLavaButton, this.risingLavaLabel, 'LAVA', true);
        continue;
      }
      if (trap.type === 'invertingroom') {
        this.invertingRoomEnabled = true;
        this.updateToggleButton(this.invertingRoomButton, this.invertingRoomLabel, 'FLIP', true);
        continue;
      }

      let type: PlaceableType = trap.type as PlaceableType;

      // Convert trap types
      if (trap.type === 'spike') {
        type = trap.config?.direction === 'down' ? 'spike_down' : 'spike_up';
      }

      const item: PlacedItem = {
        type,
        gridX: trap.x,
        gridY: trap.y,
        config: trap.config,
      };

      // Use special keys for multi-instance traps
      let key: string;
      if (type === 'sawblade') {
        key = `saw_${trap.x},${trap.y}_${Date.now()}`;
      } else if (type === 'moving') {
        key = `moving_${trap.x},${trap.y}_${Date.now()}`;
      } else if (type === 'laser') {
        key = `laser_${trap.x},${trap.y}_${Date.now()}`;
      } else {
        key = `${trap.x},${trap.y}`;
      }
      this.placedItems.set(key, item);
      this.createVisual(item, key);
    }

    // Place coins
    for (const [x, y] of data.coins) {
      this.placeItemAt('coin', x, y);
    }
  }

  private saveEditorState(): object {
    return {
      levelName: this.levelName,
      levelData: this.exportLevelData(),
      toolbarX: this.toolbarContainer.x,
      toolbarY: this.toolbarContainer.y,
    };
  }

  private restoreEditorState(state: any): void {
    this.levelName = state.levelName;
    this.levelNameText.setText(`Level: ${this.levelName}`);
    this.toolbarContainer.setPosition(state.toolbarX, state.toolbarY);
    this.importLevelData(state.levelData);
  }

  private testLevel(): void {
    const levelData = this.exportLevelData();

    // Save editor state to restore when returning
    this.registry.set('editorState', this.saveEditorState());

    // Store level for GameScene
    this.registry.set('testLevel', levelData);
    this.registry.set('isTestMode', true);

    this.scene.start('GameScene', {
      playerName: 'TESTER',
      testMode: true,
    });
  }

  private clearLevel(): void {
    // Clear all placed items
    this.placedItems.clear();

    // Destroy all visuals
    this.placedVisuals.forEach((visual) => visual.destroy());
    this.placedVisuals.clear();

    // Reset toggle buttons
    this.wallOfDeathEnabled = false;
    this.risingLavaEnabled = false;
    this.invertingRoomEnabled = false;
    this.updateToggleButton(this.wallOfDeathButton, this.wallOfDeathLabel, 'WALL', false);
    this.updateToggleButton(this.risingLavaButton, this.risingLavaLabel, 'LAVA', false);
    this.updateToggleButton(this.invertingRoomButton, this.invertingRoomLabel, 'FLIP', false);

    // Recreate default layout
    this.createDefaultLayout();

    this.cancelCurrentAction();
    this.statusText.setText('Level cleared! Default layout restored.');
  }

  private async publishLevel(): Promise<void> {
    const levelData = this.exportLevelData();

    // Basic validation
    if (levelData.platforms.length < 5) {
      this.statusText.setText('Need at least 5 platforms to publish!');
      return;
    }

    if (this.levelName === 'Untitled Level') {
      this.statusText.setText('Please name your level before publishing!');
      this.editLevelName();
      return;
    }

    // Ask for creator name
    const creatorName = prompt('Enter your name (creator):', 'Anonymous') || 'Anonymous';

    this.statusText.setText('Publishing level...');

    const result = await supabaseService.publishLevel(levelData, creatorName);

    if (result.success) {
      this.statusText.setText(`Level "${this.levelName}" published successfully!`);
    } else {
      console.error('Publish failed:', result.error);
      this.statusText.setText(`Failed: ${result.error}`);
    }
  }

  private goBack(): void {
    this.scene.start('NameEntryScene');
  }
}
