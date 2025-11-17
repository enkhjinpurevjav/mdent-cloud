 url=https://github.com/enkhjinpurevjav/mdent-cloud/blob/main/backend/src/index.js
// backend/src/index.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import prisma from "./db.js";
import branchesRouter from "./routes/branches.js";
import patientsRouter from "./routes/patients.js";

const log = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "https://book.mdent.cloud",
    credentials: true,
  })
);

app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    // simple DB check
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbOk = false;
  }

  res.json({ ok: true, service: "mdent-backend", time: new Date().toISOString(), db: dbOk });
});

// mount API routes
app.use("/api/branches", branchesRouter);
app.use("/api/patients", patientsRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  log.info({ port }, "Backend listening");
  if (process.env.RUN_SEED === "true") {
    log.warn("RUN_SEED=true – seed placeholder.");
  }
});
