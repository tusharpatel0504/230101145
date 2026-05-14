import express from "express";
import {
  getDepotsHandler,
  getVehiclesHandler,
  getScheduleHandler,
  getHealthHandler,
} from "../controllers/scheduler.controller";

const router = express.Router();

router.get("/depots", getDepotsHandler);
router.get("/vehicles", getVehiclesHandler);
router.get("/schedule", getScheduleHandler);
router.get("/health", getHealthHandler);

export default router;
