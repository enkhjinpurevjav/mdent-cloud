import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";

const app = express();
const log = pino({ level: process.env.LOG_LEVEL || "info" });

app.use(helmet());
app.use(express.json());

const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://book.mdent.cloud";
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "mdent-backend",
    node: process.version,
    env: process.env.NODE_ENV || "production",
    time: new Date().toISOString()
  });
});

// Placeholder root
app.get("/", (_req, res) => {
  res.json({ message: "M Dent API online" });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  log.info({ port }, "Backend listening");
  if (process.env.RUN_SEED === "true") {
    log.warn("RUN_SEED=true (first run). Add your seed logic here; then set to false.");
  }
});
