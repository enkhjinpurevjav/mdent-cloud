import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import prisma from "./db.ts";
import branchesRouter from "./routes/branches.js";
import patientsRouter from "./routes/patients.js";

const log = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "https://book.mdent.cloud",
  credentials: true
}));

// Attach logger to request for routes
app.use((req, _res, next) => {
  req.log = log;
  next();
});

// Health check endpoint with DB connectivity check
app.get("/health", async (_req, res) => {
  let dbHealthy = false;
  try {
    // Simple DB connectivity check
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (error) {
    log.error({ error }, "Database health check failed");
  }
  
  res.json({ 
    ok: true, 
    service: "mdent-backend", 
    db: dbHealthy,
    time: new Date().toISOString() 
  });
});

// API routes
app.use("/api/branches", branchesRouter);
app.use("/api/patients", patientsRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  log.info({ port }, "Backend listening");
  if (process.env.RUN_SEED === "true") {
    log.warn("RUN_SEED=true – seed placeholder.");
  }
});
