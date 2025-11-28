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

// Important: DO NOT define any /api/patients GET/POST here!

// Use routers
app.use("/api/login", loginRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/patients", patientsRouter);
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


const router = express.Router();

router.get("/", async (req, res) => {
  // This runs when GET /api/patients is called
  try {
    const patients = await prisma.patient.findMany({
      include: { patientBook: true }
    });
    res.json(patients); // Send all patients as JSON
  } catch (err) {
    res.status(500).json({ error: "failed to fetch patients" });
  }
});

export default router;
