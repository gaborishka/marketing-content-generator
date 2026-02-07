// Timeout budget utility for long-running pipeline functions.

export class TimeoutBudget {
  private readonly startTime: number;
  private readonly maxMs: number;

  constructor(maxSeconds: number, safetyMarginSeconds: number = 30) {
    this.startTime = Date.now();
    this.maxMs = (maxSeconds - safetyMarginSeconds) * 1000;
  }

  remainingMs(): number {
    return Math.max(0, this.maxMs - (Date.now() - this.startTime));
  }

  remainingSeconds(): number {
    return Math.round(this.remainingMs() / 1000);
  }

  hasTimeFor(estimatedSeconds: number): boolean {
    return this.remainingMs() > estimatedSeconds * 1000;
  }

  isExpired(): boolean {
    return this.remainingMs() <= 0;
  }
}
