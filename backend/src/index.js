import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import prisma from "./db.js";

import branchesRouter from "./routes/branches.js";
import patientsRouter from "./routes/patients.js";
import loginRouter from "./routes/login.js";
import usersRouter from "./routes/users.js";
import employeesRouter from "./routes/employees.js";
import encountersRouter from "./routes/encounters.js";
import billingRouter from "./routes/billing.js";
import appointmentsRouter from "./routes/appointments.js";

const log = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

// Health (non-API path)
app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  res.json({
    ok: true,
    service: "mdent-backend",
    time: new Date().toISOString(),
    db: dbOk,
  });
});

// Wire routers — do not define handlers inline here
app.use("/api/login", loginRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/users", usersRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/encounters", encountersRouter);
app.use("/api/billing", billingRouter);
app.use("/api/appointments", appointmentsRouter);

// Optional central error handler
app.use((err, _req, res, _next) => {
  log.error({ err }, "Unhandled error");
  res.status(500).json({ error: "internal server error" });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  log.info({ port }, "Backend listening");
  if (process.env.RUN_SEED === "true") {
    log.warn("RUN_SEED=true – seed placeholder.");
  }
});

export default app;
