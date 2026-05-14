import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export type Stack = "backend" | "frontend";

export type Level = "debug" | "info" | "warn" | "error" | "fatal";

export type Package =
  | "cache"
  | "controller"
  | "cron_job"
  | "db"
  | "domain"
  | "handler"
  | "repository"
  | "route"
  | "service"
  | "auth"
  | "config"
  | "middleware"
  | "utils";

interface LogPayload {
  stack: Stack;
  level: Level;
  package: Package;
  message: string;
}

function assertOneOf<T extends string>(name: string, value: any, options: T[]): asserts value is T {
  if (!options.includes(value)) {
    throw new Error(`${name} must be one of: ${options.join(",")}`);
  }
}

export async function Log(
  stack: Stack,
  level: Level,
  package_: Package,
  message: string
): Promise<string | undefined> {
  assertOneOf<Stack>("stack", stack, ["backend", "frontend"]);
  assertOneOf<Level>("level", level, ["debug", "info", "warn", "error", "fatal"]);
  const backendPackages: Package[] = [
    "cache",
    "controller",
    "cron_job",
    "db",
    "domain",
    "handler",
    "repository",
    "route",
    "service",
  ];
  const sharedPackages: Package[] = ["auth", "config", "middleware", "utils"];
  if (![...backendPackages, ...sharedPackages].includes(package_)) {
    throw new Error(`package must be one of: ${[...backendPackages, ...sharedPackages].join(",")}`);
  }
  if (typeof message !== "string" || message.length === 0) {
    throw new Error("message must be a non-empty string");
  }

  const bearer = process.env.BEARER_TOKEN;
  if (!bearer) {
    throw new Error("BEARER_TOKEN is not set in environment");
  }

  const payload: LogPayload = {
    stack,
    level,
    package: package_,
    message,
  };

  try {
    const res = await axios.post(
      "http://4.224.186.213/evaluation-service/logs",
      payload,
      {
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    const data = res.data as any;
    const id = data?.logID || data?.id || data?.logId || data?._id;
    if (!id || typeof id !== "string") {
      throw new Error("Invalid response from log server: missing logID");
    }
    return id;
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || String(err);
    process.stderr.write(`[LOGGER ERROR] ${err.message}\n`);
  }
}
