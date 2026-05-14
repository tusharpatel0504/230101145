import axios from "axios";
import { getAuthHeader } from "../config/auth";
import { Log } from "../../../logging_middleware/src/logger";
import MaxHeap from "../utils/priorityQueue";

/**
 * Notification shape
 */
export interface Notification {
  ID: number;
  Type: "Placement" | "Result" | "Event" | string;
  Message: string;
  Timestamp: string; // ISO
}

export interface NotificationsResponse {
  notifications: Notification[];
}

const BASE = "http://4.224.186.213/evaluation-service";

/**
 * Fetch notifications from external API
 */
export async function fetchNotifications(): Promise<Notification[]> {
  try {
    await Log("backend", "info", "service", "Fetching notifications from evaluation API");
    const res = await axios.get<NotificationsResponse>(`${BASE}/notifications`, { headers: getAuthHeader(), timeout: 5000 });
    const data = res.data.notifications;
    await Log("backend", "debug", "service", `Fetched ${data.length} notifications successfully`);
    return data;
  } catch (err: any) {
    await Log("backend", "error", "service", `Failed to fetch notifications: ${err?.message || String(err)}`);
    throw err;
  }
}

/**
 * Compute priority score for a notification
 */
function computeScore(index: number, timestamp: string, type: string): number {
  const weightMap: Record<string, number> = { Placement: 3, Result: 2, Event: 1 };
  const weight = weightMap[type] || 1;
  const recencyBonus = Math.max(0, 1000 - index); // higher for lower index (newer first)
  const score = weight * 1000 + recencyBonus;
  return score;
}

/**
 * Return top N notifications using a max-heap (O(n log k))
 */
export async function getTopNotifications(n: number): Promise<Array<Notification & { priorityScore: number }>> {
  try {
    const items = await fetchNotifications();
    await Log("backend", "info", "service", `Computing top ${n} priority notifications`);

    // sort by timestamp desc to assign recency index
    const sorted = items.slice().sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

    const heap = new MaxHeap<(Notification & { priorityScore: number })>((a, b) => a.priorityScore - b.priorityScore);

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const score = computeScore(i, item.Timestamp, item.Type);
      await Log("backend", "debug", "utils", `Priority score for ${item.Type}: weight=${score} (computed)`);
      const entry = { ...item, priorityScore: score };
      heap.push(entry);
      if (heap.size() > n) heap.pop();
    }

    const result = heap.toArray().sort((a, b) => b.priorityScore - a.priorityScore);
    return result;
  } catch (err: any) {
    await Log("backend", "error", "service", `Failed to compute top notifications: ${err?.message || String(err)}`);
    throw err;
  }
}

/**
 * Filter notifications by Type (case-insensitive). Returns null for invalid type
 */
export async function filterByType(type: string): Promise<Notification[] | null> {
  const t = String(type || "").toLowerCase();
  if (!t) return null;
  const allowed = ["placement", "result", "event"];
  if (!allowed.includes(t)) return null;

  try {
    const items = await fetchNotifications();
    const filtered = items.filter((it) => it.Type.toLowerCase() === t);
    return filtered;
  } catch (err: any) {
    await Log("backend", "error", "service", `Failed to filter notifications: ${err?.message || String(err)}`);
    throw err;
  }
}
