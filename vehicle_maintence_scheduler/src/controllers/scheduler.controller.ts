import { Request, Response } from "express";
import { Log } from "../../../logging_middleware/src/logger";
import {
  fetchDepots,
  fetchVehicles,
  computeSchedules,
} from "../services/scheduler.service";

export async function getDepotsHandler(req: Request, res: Response) {
  try {
    await Log("backend", "info", "route", "GET /depots request received");
    const depots = await fetchDepots();
    res.status(200).json(depots);
  } catch (err: any) {
    await Log("backend", "error", "controller", `Unhandled error in depots controller: ${err?.message || String(err)}`);
    res.status(500).json({ error: "Failed to fetch depots", details: err?.message });
  }
}

export async function getVehiclesHandler(req: Request, res: Response) {
  try {
    await Log("backend", "info", "route", "GET /vehicles request received");
    const vehicles = await fetchVehicles();
    res.status(200).json(vehicles);
  } catch (err: any) {
    await Log("backend", "error", "controller", `Unhandled error in vehicles controller: ${err?.message || String(err)}`);
    res.status(500).json({ error: "Failed to fetch vehicles", details: err?.message });
  }
}

export async function getScheduleHandler(req: Request, res: Response) {
  try {
    await Log("backend", "info", "route", "GET /schedule request received");
    const result = await computeSchedules();
    res.status(200).json(result);
  } catch (err: any) {
    await Log("backend", "error", "controller", `Unhandled error in schedule controller: ${err?.message || String(err)}`);
    res.status(500).json({ error: "Failed to compute schedule", details: err?.message });
  }
}

export async function getHealthHandler(req: Request, res: Response) {
  res.status(200).json({ status: "ok" });
}
