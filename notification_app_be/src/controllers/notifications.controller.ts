import { Request, Response } from "express";
import { Log } from "../../../logging_middleware/src/logger";
import {
  fetchNotifications,
  getTopNotifications,
  filterByType,
} from "../services/notifications.service";

export async function getNotificationsHandler(req: Request, res: Response) {
  try {
    await Log("backend", "info", "route", "GET /notifications request received");
    const items = await fetchNotifications();
    res.status(200).json(items);
  } catch (err: any) {
    await Log("backend", "error", "controller", `Unhandled error in notifications controller: ${err?.message || String(err)}`);
    res.status(500).json({ error: "Failed to fetch notifications", details: err?.message });
  }
}

export async function getTopNotificationsHandler(req: Request, res: Response) {
  const n = Number(req.query.n) || 10;
  try {
    await Log("backend", "info", "service", `Computing top ${n} priority notifications`);
    const top = await getTopNotifications(n);
    const highest = top.length > 0 ? (top[0] as any).priorityScore : 0;
    await Log("backend", "info", "controller", `Returning top ${n} notifications, highest score=${highest}`);
    res.status(200).json(top);
  } catch (err: any) {
    await Log("backend", "error", "controller", `Unhandled error in top notifications controller: ${err?.message || String(err)}`);
    res.status(500).json({ error: "Failed to compute top notifications", details: err?.message });
  }
}

export async function getNotificationsByTypeHandler(req: Request, res: Response) {
  const type = String(req.params.type || "");
  try {
    const filtered = await filterByType(type);
    if (!filtered) {
      await Log("backend", "warn", "controller", `Requested type ${type} is not a valid notification type`);
      return res.status(400).json({ error: "Invalid notification type" });
    }
    res.status(200).json(filtered);
  } catch (err: any) {
    await Log("backend", "error", "controller", `Unhandled error in type filter controller: ${err?.message || String(err)}`);
    res.status(500).json({ error: "Failed to filter notifications", details: err?.message });
  }
}

export async function getHealthHandler(req: Request, res: Response) {
  res.status(200).json({ status: "ok", service: "notification_app_be" });
}
