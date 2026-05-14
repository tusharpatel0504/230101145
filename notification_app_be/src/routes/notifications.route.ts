import express from "express";
import {
  getNotificationsHandler,
  getTopNotificationsHandler,
  getNotificationsByTypeHandler,
  getHealthHandler,
} from "../controllers/notifications.controller";

const router = express.Router();

router.get("/notifications", getNotificationsHandler);
router.get("/notifications/top", getTopNotificationsHandler);
router.get("/notifications/type/:type", getNotificationsByTypeHandler);
router.get("/health", getHealthHandler);

export default router;
