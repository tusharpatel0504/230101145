import axios from "axios";
import { getAuthHeader } from "../config/auth";
import { Log } from "../../../logging_middleware/src/logger";
import { solveKnapsack, KnapsackResult } from "../utils/knapsack";

export interface Vehicle {
  TaskID: number;
  Duration: number;
  Impact: number;
}

export interface Depot {
  DepotID: number;
  MechanicHours: number;
}

export interface DepotsResponse {
  depots: Depot[];
}

export interface VehiclesResponse {
  vehicles: Vehicle[];
}

export interface DepotSchedule {
  depotID: number;
  mechanicHours: number;
  selectedTasks: Vehicle[];
  totalDuration: number;
  totalImpact: number;
}

const BASE = "http://4.224.186.213/evaluation-service";

export async function fetchDepots(): Promise<Depot[]> {
  try {
    await Log("backend", "info", "service", "Fetching depots from evaluation API");
    const res = await axios.get<DepotsResponse>(`${BASE}/depots`, { headers: getAuthHeader(), timeout: 5000 });
    const data = res.data.depots;
    await Log("backend", "debug", "service", `Fetched ${data.length} depots successfully`);
    return data;
  } catch (err: any) {
    await Log("backend", "error", "service", `Failed to fetch depots: ${err?.message || String(err)}`);
    throw err;
  }
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    await Log("backend", "info", "service", "Fetching vehicles from evaluation API");
    const res = await axios.get<VehiclesResponse>(`${BASE}/vehicles`, { headers: getAuthHeader(), timeout: 5000 });
    const data = res.data.vehicles;
    await Log("backend", "debug", "service", `Fetched ${data.length} vehicles successfully`);
    return data;
  } catch (err: any) {
    await Log("backend", "error", "service", `Failed to fetch vehicles: ${err?.message || String(err)}`);
    throw err;
  }
}

export async function computeSchedules(): Promise<DepotSchedule[]> {
  try {
    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    const results: DepotSchedule[] = [];

    for (const depot of depots) {
      try {
        await Log("backend", "debug", "utils", `Running knapsack for depot ${depot.DepotID}, capacity=${depot.MechanicHours}, tasks=${vehicles.length}`);
        const kp: KnapsackResult = solveKnapsack(depot.MechanicHours, vehicles);
        await Log("backend", "info", "utils", `Knapsack complete for depot ${depot.DepotID}: selected ${kp.selected.length} tasks, impact=${kp.totalImpact}`);

        results.push({
          depotID: depot.DepotID,
          mechanicHours: depot.MechanicHours,
          selectedTasks: kp.selected,
          totalDuration: kp.totalDuration,
          totalImpact: kp.totalImpact,
        });
      } catch (err: any) {
        await Log("backend", "error", "service", `Failed knapsack for depot ${depot.DepotID}: ${err?.message || String(err)}`);
      }
    }

    return results;
  } catch (err: any) {
    await Log("backend", "error", "service", `Failed to compute schedules: ${err?.message || String(err)}`);
    throw err;
  }
}
