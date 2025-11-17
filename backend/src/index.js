import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";

const log = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://book.mdent.cloud",
  credentials: true
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mdent-backend", time: new Date().toISOString() });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  log.info({ port }, "Backend listening");
  if (process.env.RUN_SEED === "true") {
    log.warn("RUN_SEED=true – seed placeholder.");
  }
});
