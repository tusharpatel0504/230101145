import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/scheduler.route";
import { Log } from "../../logging_middleware/src/logger";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(router);

const PORT = 3001;

app.listen(PORT, async () => {
  try {
    await Log("backend", "info", "config", "Vehicle scheduler service started on port 3001");
  } catch (err) {
  }
});

export default app;
