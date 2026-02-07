import { describe, it, expect, vi } from "vitest";
import { TimeoutBudget } from "../utils/timeout";

describe("TimeoutBudget", () => {
  it("starts with full remaining time minus safety margin", () => {
    const budget = new TimeoutBudget(540, 30);
    // Should be approximately 510 seconds remaining
    expect(budget.remainingSeconds()).toBeGreaterThanOrEqual(509);
    expect(budget.remainingSeconds()).toBeLessThanOrEqual(510);
  });

  it("reports not expired when just created", () => {
    const budget = new TimeoutBudget(540, 30);
    expect(budget.isExpired()).toBe(false);
  });

  it("hasTimeFor returns true when enough time remains", () => {
    const budget = new TimeoutBudget(540, 30);
    expect(budget.hasTimeFor(120)).toBe(true);
    expect(budget.hasTimeFor(500)).toBe(true);
  });

  it("hasTimeFor returns false when not enough time remains", () => {
    const budget = new TimeoutBudget(540, 30);
    expect(budget.hasTimeFor(600)).toBe(false);
  });

  it("remainingMs is non-negative even after expiry", () => {
    // Create a budget with 0 usable time (safety margin equals max)
    const budget = new TimeoutBudget(30, 30);
    expect(budget.remainingMs()).toBe(0);
    expect(budget.isExpired()).toBe(true);
  });

  it("uses default safety margin of 30 seconds", () => {
    const budget = new TimeoutBudget(60);
    // 60 - 30 = 30 seconds remaining
    expect(budget.remainingSeconds()).toBeGreaterThanOrEqual(29);
    expect(budget.remainingSeconds()).toBeLessThanOrEqual(30);
  });

  it("tracks elapsed time", async () => {
    const budget = new TimeoutBudget(540, 30);
    const initialRemaining = budget.remainingMs();

    // Wait a small amount
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(budget.remainingMs()).toBeLessThan(initialRemaining);
  });
});
