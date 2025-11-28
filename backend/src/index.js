import express from "express";
import cors from "cors";
import helmet from "helmet";
import pino from "pino";
import prisma from "./db.js";
import branchesRouter from "./routes/branches.js";
import patientsRouter from "./routes/patients.js";
import loginRouter from "./routes/login.js";
import usersRouter from './routes/users.js';
import employeesRouter from './routes/employees.js';
import encountersRouter from './routes/encounters.js';
import billingRouter from './routes/billing.js';

// Logging setup
const log = pino({ level: process.env.LOG_LEVEL || "info" });

// App init
const app = express();

// Middleware stack (no auth, no JWT, no RBAC)
app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: "*", // <-- Open CORS for all origins (remove restrictions)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

// Health check endpoint
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

// Example open endpoint (patients GET)
app.get("/api/patients", (req, res) => {
  res.json({ message: "Open patient data (no auth)", user: "dev-mode" });
});

// Routes (all open, no JWT/auth)
app.use("/api/login", loginRouter);      // public route
app.use("/api/branches", branchesRouter); // open
app.use("/api/patients", patientsRouter); // open
app.use('/api/users', usersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/encounters', encountersRouter);
app.use('/api/billing', billingRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  log.info({ port }, "Backend listening (no security)");
  if (process.env.RUN_SEED === "true") {
    log.warn("RUN_SEED=true – seed placeholder.");
  }
});








