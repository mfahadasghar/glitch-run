import { SCORE_CONFIG } from '../config/gameConfig';

export class ScoreManager {
  private deaths: number = 0;
  private levelsCompleted: number = 0;
  private elapsedSeconds: number = 0;
  private coins: number = 0;
  private combo: number = 0; // No-death streak
  private maxCombo: number = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.deaths = 0;
    this.levelsCompleted = 0;
    this.elapsedSeconds = 0;
    this.coins = 0;
    this.combo = 0;
    this.maxCombo = 0;
  }

  addDeath(): void {
    this.deaths++;
    this.combo = 0; // Reset combo on death
  }

  completeLevel(): void {
    this.levelsCompleted++;
    this.combo++; // Increment combo for completing level without dying
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
  }

  addCoin(value: number = 100): void {
    this.coins += value;
  }

  updateTime(seconds: number): void {
    this.elapsedSeconds = seconds;
  }

  getDeaths(): number {
    return this.deaths;
  }

  getLevelsCompleted(): number {
    return this.levelsCompleted;
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  getCoins(): number {
    return this.coins;
  }

  getCombo(): number {
    return this.combo;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  // Combo multiplier: 1x, 1.5x, 2x, 2.5x, 3x (max)
  getComboMultiplier(): number {
    return Math.min(1 + this.combo * 0.5, 3);
  }

  calculateFinalScore(): number {
    const deathPenalty = this.deaths * SCORE_CONFIG.deathPenalty;
    const timePenalty = this.elapsedSeconds * SCORE_CONFIG.timePenalty;
    const levelBonus = this.levelsCompleted * SCORE_CONFIG.levelBonus;
    const coinBonus = this.coins;
    const comboBonus = this.maxCombo * 200; // Bonus for max streak achieved

    const score = SCORE_CONFIG.baseScore + levelBonus + coinBonus + comboBonus - deathPenalty - timePenalty;

    return Math.max(0, Math.floor(score));
  }

  getScoreBreakdown(): {
    baseScore: number;
    levelBonus: number;
    coinBonus: number;
    comboBonus: number;
    deathPenalty: number;
    timePenalty: number;
    finalScore: number;
  } {
    return {
      baseScore: SCORE_CONFIG.baseScore,
      levelBonus: this.levelsCompleted * SCORE_CONFIG.levelBonus,
      coinBonus: this.coins,
      comboBonus: this.maxCombo * 200,
      deathPenalty: this.deaths * SCORE_CONFIG.deathPenalty,
      timePenalty: Math.floor(this.elapsedSeconds * SCORE_CONFIG.timePenalty),
      finalScore: this.calculateFinalScore(),
    };
  }
}
