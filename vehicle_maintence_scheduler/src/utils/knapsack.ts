import { Vehicle } from "../services/scheduler.service";
import { Log } from "../../../logging_middleware/src/logger";

export interface KnapsackResult {
  selected: Vehicle[];
  totalDuration: number;
  totalImpact: number;
}

export function solveKnapsack(capacity: number, vehicles: Vehicle[]): KnapsackResult {
  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new Error("capacity must be a non-negative integer");
  }
  if (!Array.isArray(vehicles)) {
    throw new Error("vehicles must be an array");
  }

  const n = vehicles.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = vehicles[i - 1];
    const w = Math.floor(item.Duration);
    const v = item.Impact;
    for (let c = 0; c <= capacity; c++) {
      if (w <= c) {
        dp[i][c] = Math.max(dp[i - 1][c], dp[i - 1][c - w] + v);
      } else {
        dp[i][c] = dp[i - 1][c];
      }
    }
  }

  let c = capacity;
  const selected: Vehicle[] = [];
  for (let i = n; i >= 1; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      const item = vehicles[i - 1];
      selected.push(item);
      c -= Math.floor(item.Duration);
    }
  }

  const totalImpact = selected.reduce((s, it) => s + it.Impact, 0);
  const totalDuration = selected.reduce((s, it) => s + it.Duration, 0);

  selected.reverse();

  return { selected, totalDuration, totalImpact };
}
