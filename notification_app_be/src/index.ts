import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/notifications.route";
import { Log } from "../../logging_middleware/src/logger";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(router);

const PORT = 3002;

app.listen(PORT, async () => {
  try {
    await Log("backend", "info", "config", "Notification service started on port 3002");
  } catch (err) {
  }
});

export default app;
