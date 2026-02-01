import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config/gameConfig';
import { GRID_WIDTH, GRID_HEIGHT } from '../config/constants';

const PIXEL_FONT = '"Press Start 2P", monospace';

type PlaceableType =
  | 'platform'
  | 'spike_up'
  | 'spike_down'
  | 'laser'
  | 'gravity'
  | 'teleport'
  | 'crushing'
  | 'collapsing'
  | 'moving_h'
  | 'moving_v'
  | 'bounce'
  | 'fakefloor'
  | 'sawblade'
  | 'ice'
  | 'coin'
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

  // For sawblade path
  private sawbladePoints: Array<{ x: number; y: number }> = [];
  private sawbladePathGraphics!: Phaser.GameObjects.Graphics;

  // Draggable toolbar
  private toolbarContainer!: Phaser.GameObjects.Container;
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
    this.cameras.main.setBackgroundColor(0x1a1a2e);

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
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 15, 'CLICK TO PLACE | RIGHT-CLICK TO DELETE', {
      fontSize: '6px',
      color: '#888888',
      fontFamily: PIXEL_FONT,
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
  }

  private createDefaultLayout(): void {
    // Create ceiling (top row)
    for (let x = 0; x < GRID_WIDTH; x++) {
      this.placeItemAt('platform', x, 0);
    }

    // Create floor (bottom 30% = roughly 4 rows)
    const floorStartY = GRID_HEIGHT - 4;
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
    this.gridGraphics.lineStyle(1, 0x333355, 0.5);

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
    this.gridGraphics.fillStyle(0x2a2a4a, 0.3);
    this.gridGraphics.fillRect(0, (GRID_HEIGHT - 4) * TILE_SIZE, GRID_WIDTH * TILE_SIZE, 4 * TILE_SIZE);
  }

  private createDraggableToolbar(): void {
    // Create main toolbar container
    this.toolbarContainer = this.add.container(5, 5);
    this.toolbarContainer.setDepth(200);

    // Toolbar background - larger size
    const toolbarWidth = 500;
    const toolbarHeight = 210;
    const bg = this.add.rectangle(0, 0, toolbarWidth, toolbarHeight, 0x1a1a2e, 0.95);
    bg.setOrigin(0, 0);
    bg.setStrokeStyle(2, 0x4a4a6a);
    bg.setInteractive({ useHandCursor: true, draggable: true });
    this.toolbarContainer.add(bg);

    // Make entire toolbar background draggable
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDraggingToolbar = true;
      this.dragOffsetX = pointer.x - this.toolbarContainer.x;
      this.dragOffsetY = pointer.y - this.toolbarContainer.y;
      this.isClickOnUI = true;
    });

    // Title area with spacing
    const dragHandle = this.add.rectangle(toolbarWidth / 2, 15, toolbarWidth - 20, 20, 0x555555);
    this.toolbarContainer.add(dragHandle);

    // Drag handle label - larger font
    const dragLabel = this.add.text(toolbarWidth / 2, 15, 'LEVEL EDITOR - DRAG TO MOVE', {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: PIXEL_FONT,
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
      { type: 'moving_h', label: 'MOV H' },
      { type: 'moving_v', label: 'MOV V' },
      { type: 'bounce', label: 'BOUNCE' },
      { type: 'fakefloor', label: 'FAKE' },
      { type: 'sawblade', label: 'SAW' },
      { type: 'ice', label: 'ICE' },
      { type: 'coin', label: 'COIN' },
      { type: 'start', label: 'START' },
      { type: 'goal', label: 'GOAL' },
    ];

    const buttonColor = 0x444444;

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
      btnBg.setStrokeStyle(2, this.currentTool === tool.type ? 0xffffff : 0x666666);
      btnBg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x + buttonWidth / 2, y + buttonHeight / 2, tool.label, {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: PIXEL_FONT,
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
        btnBg.setStrokeStyle(2, this.currentTool === tool.type ? 0xffffff : 0x555555);
      });

      this.toolbarContainer.add([btnBg, label]);
      this.toolButtons.set(tool.type, btnBg);
    });

    // Control buttons - all gray, larger
    const controlButtons = [
      { label: 'SAVE', action: () => this.saveLevel() },
      { label: 'LOAD', action: () => this.loadLevel() },
      { label: 'TEST', action: () => this.testLevel() },
      { label: 'CLEAR', action: () => this.clearLevel() },
      { label: 'BACK', action: () => this.goBack() },
    ];

    const controlStartX = 8;
    const controlStartY = 140;
    const controlBtnWidth = 90;
    const controlBtnHeight = 30;

    controlButtons.forEach((btn, index) => {
      const x = controlStartX + index * (controlBtnWidth + 6);
      const y = controlStartY;

      const btnBg = this.add.rectangle(x + controlBtnWidth / 2, y + controlBtnHeight / 2, controlBtnWidth, controlBtnHeight, buttonColor);
      btnBg.setStrokeStyle(2, 0x666666);
      btnBg.setInteractive({ useHandCursor: true });

      const label = this.add.text(x + controlBtnWidth / 2, y + controlBtnHeight / 2, btn.label, {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: PIXEL_FONT,
      });
      label.setOrigin(0.5);

      btnBg.on('pointerdown', () => {
        this.isClickOnUI = true;
        btn.action();
      });

      btnBg.on('pointerover', () => btnBg.setFillStyle(0x555555));
      btnBg.on('pointerout', () => btnBg.setFillStyle(buttonColor));

      this.toolbarContainer.add([btnBg, label]);
    });

    // Level name (clickable)
    const nameY = 185;
    this.levelNameText = this.add.text(toolbarWidth / 2, nameY, `Level: ${this.levelName}`, {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: PIXEL_FONT,
    });
    this.levelNameText.setOrigin(0.5);
    this.levelNameText.setInteractive({ useHandCursor: true });
    this.levelNameText.on('pointerdown', () => {
      this.isClickOnUI = true;
      this.editLevelName();
    });
    this.toolbarContainer.add(this.levelNameText);
  }

  private createMarkers(): void {
    // Start marker (green player silhouette)
    this.startMarker = this.add.container(
      this.startPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.startPos.y * TILE_SIZE + TILE_SIZE / 2
    );
    const startShape = this.add.rectangle(0, 0, 20, 24, 0x00ff88);
    const startLabel = this.add.text(0, -20, 'START', { fontSize: '10px', color: '#00ff88' });
    startLabel.setOrigin(0.5);
    this.startMarker.add([startShape, startLabel]);
    this.startMarker.setDepth(50);

    // Goal marker (yellow flag)
    this.goalMarker = this.add.container(
      this.goalPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.goalPos.y * TILE_SIZE + TILE_SIZE / 2
    );
    const goalShape = this.add.rectangle(0, 0, 24, 28, 0xffd700);
    goalShape.setStrokeStyle(2, 0xffaa00);
    const goalLabel = this.add.text(0, -22, 'GOAL', { fontSize: '10px', color: '#ffd700' });
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
      btnBg.setStrokeStyle(2, type === tool ? 0xffffff : 0x555555);
    });

    // Update status text
    if (tool === 'teleport') {
      this.statusText.setText('TELEPORT: Click source, then click destination');
    } else if (tool === 'laser') {
      this.statusText.setText('LASER: Click start point, then click end point');
    } else if (tool === 'sawblade') {
      this.statusText.setText('SAWBLADE: Click points for path, then press ENTER to finish');
    } else {
      this.statusText.setText(`Selected: ${tool.toUpperCase()} - Click to place, Right-click to delete`);
    }
  }

  private cancelCurrentAction(): void {
    this.teleportStart = null;
    this.laserStart = null;
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
      this.toolbarContainer.x = Phaser.Math.Clamp(this.toolbarContainer.x, 0, GAME_WIDTH - 500);
      this.toolbarContainer.y = Phaser.Math.Clamp(this.toolbarContainer.y, 0, GAME_HEIGHT - 210);
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
          10, 0x00ffff, 0.5
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
          8, 8, 0xff0000, 0.8
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

    // Handle sawblade (needs multiple clicks + enter)
    if (this.currentTool === 'sawblade') {
      this.sawbladePoints.push({ x: gridX, y: gridY });

      // Draw path
      this.sawbladePathGraphics.clear();
      this.sawbladePathGraphics.lineStyle(2, 0xff8800, 0.8);

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
        this.sawbladePathGraphics.fillCircle(pt.x * TILE_SIZE + TILE_SIZE / 2, pt.y * TILE_SIZE + TILE_SIZE / 2, 5);
      }

      this.statusText.setText(`SAWBLADE: ${this.sawbladePoints.length} points. Press ENTER to finish, ESC to cancel.`);

      // Listen for enter key
      this.input.keyboard?.once('keydown-ENTER', () => {
        if (this.sawbladePoints.length >= 2) {
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

          this.sawbladePoints = [];
          this.sawbladePathGraphics.clear();
          this.statusText.setText('SAWBLADE placed! Click to start another path.');
        }
      });

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
    } else if (type === 'moving_h') {
      item.config = { direction: 'horizontal', distance: TILE_SIZE * 3 };
    } else if (type === 'moving_v') {
      item.config = { direction: 'vertical', distance: TILE_SIZE * 3 };
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
        visual = this.add.rectangle(x, y, TILE_SIZE - 1, TILE_SIZE - 1, 0x4a4a6a);
        break;

      case 'spike_up':
        visual = this.add.triangle(x, y, 0, TILE_SIZE/2, TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE/2, 0x111111);
        break;

      case 'spike_down':
        visual = this.add.triangle(x, y, 0, -TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE, -TILE_SIZE/2, 0x111111);
        break;

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
        const gravArrow = this.add.triangle(0, 0, -8, 8, 0, -8, 8, 8, 0xcc99ff);
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

      case 'moving_h':
      case 'moving_v':
        const moveContainer = this.add.container(x, y);
        const movePlat = this.add.rectangle(0, 0, TILE_SIZE * 2, TILE_SIZE - 4, 0x4a6a4a);
        const moveArrow = item.type === 'moving_h'
          ? this.add.text(0, 0, '<->', { fontSize: '14px', color: '#ffffff' })
          : this.add.text(0, 0, 'v^', { fontSize: '14px', color: '#ffffff' });
        moveArrow.setOrigin(0.5);
        moveContainer.add([movePlat, moveArrow]);
        visual = moveContainer;
        break;

      case 'bounce':
        const bounceContainer = this.add.container(x, y);
        const bounceBase = this.add.rectangle(0, 4, TILE_SIZE - 4, 8, 0x666666);
        const bouncePad = this.add.rectangle(0, -4, TILE_SIZE - 8, 6, 0xff6600);
        bounceContainer.add([bounceBase, bouncePad]);
        visual = bounceContainer;
        break;

      case 'fakefloor':
        visual = this.add.rectangle(x, y, TILE_SIZE - 2, TILE_SIZE - 2, 0x4a4a6a);
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
              pathGraphics.fillCircle(pt.x, pt.y, 4);
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

      case 'coin':
        visual = this.add.circle(x, y, 8, 0xffd700);
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
        } else if (trapType === 'moving_h' || trapType === 'moving_v') {
          trapType = 'moving';
        }

        traps.push({
          type: trapType,
          x: item.gridX,
          y: item.gridY,
          config: item.config,
        });
      }
    });

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
      let type: PlaceableType = trap.type as PlaceableType;

      // Convert trap types
      if (trap.type === 'spike') {
        type = trap.config?.direction === 'down' ? 'spike_down' : 'spike_up';
      } else if (trap.type === 'moving') {
        type = trap.config?.direction === 'vertical' ? 'moving_v' : 'moving_h';
      }

      const item: PlacedItem = {
        type,
        gridX: trap.x,
        gridY: trap.y,
        config: trap.config,
      };

      // Use special key for sawblades to allow multiple
      const key = type === 'sawblade' ? `saw_${trap.x},${trap.y}_${Date.now()}` : `${trap.x},${trap.y}`;
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

    // Recreate default layout
    this.createDefaultLayout();

    this.cancelCurrentAction();
    this.statusText.setText('Level cleared! Default layout restored.');
  }

  private goBack(): void {
    this.scene.start('NameEntryScene');
  }
}
