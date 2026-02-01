import Phaser from 'phaser';
import { SESSION_TIME } from '../config/gameConfig';

export class TimerManager {
  private scene: Phaser.Scene;
  private remainingTime: number;
  private elapsedTime: number = 0;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private isPaused: boolean = false;
  private onTimeUp: (() => void) | null = null;
  private onTick: ((remaining: number, elapsed: number) => void) | null = null;

  constructor(scene: Phaser.Scene, duration: number = SESSION_TIME) {
    this.scene = scene;
    this.remainingTime = duration;
  }

  start(onTimeUp: () => void, onTick?: (remaining: number, elapsed: number) => void): void {
    this.onTimeUp = onTimeUp;
    this.onTick = onTick || null;
    this.elapsedTime = 0;

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });
  }

  private tick(): void {
    if (this.isPaused) return;

    this.remainingTime--;
    this.elapsedTime++;

    if (this.onTick) {
      this.onTick(this.remainingTime, this.elapsedTime);
    }

    if (this.remainingTime <= 0) {
      this.stop();
      if (this.onTimeUp) {
        this.onTimeUp();
      }
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  stop(): void {
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }
  }

  getRemainingTime(): number {
    return this.remainingTime;
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  getFormattedTime(): string {
    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  isRunning(): boolean {
    return this.timerEvent !== null && !this.isPaused;
  }

  addTime(seconds: number): void {
    this.remainingTime += seconds;
  }

  destroy(): void {
    this.stop();
  }
}
