/**
 * Timer utility for measuring elapsed time
 */

export class Timer {
  private startTime: number;
  private isRunning: boolean;

  constructor() {
    this.startTime = 0;
    this.isRunning = false;
  }

  /**
   * Start the timer
   */
  start(): void {
    this.startTime = Date.now();
    this.isRunning = true;
  }

  /**
   * Stop the timer and return elapsed time in milliseconds
   */
  stop(): number {
    if (!this.isRunning) {
      return 0;
    }
    this.isRunning = false;
    return Date.now() - this.startTime;
  }

  /**
   * Get elapsed time in milliseconds without stopping the timer
   */
  getElapsedMs(): number {
    if (!this.isRunning) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get elapsed time in seconds (rounded) without stopping the timer
   */
  getElapsedSeconds(): number {
    return Math.round(this.getElapsedMs() / 1000);
  }

  /**
   * Format elapsed time as "Xs" (e.g., "10s")
   */
  formatElapsedSeconds(): string {
    const seconds = this.getElapsedSeconds();
    return `${seconds}s`;
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = 0;
    this.isRunning = false;
  }
}
