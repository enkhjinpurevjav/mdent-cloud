// backend/src/routes/patients.js
import express from "express";
import prisma from "../db.js";

const router = express.Router();

// POST /api/patients
// body: { name, regNo, phone, branchId }
router.post("/", async (req, res) => {
  const { name, regNo, phone, branchId } = req.body;
  if (!name || !branchId) {
    return res.status(400).json({ error: "name and branchId are required" });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        name,
        regNo,
        phone,
        branchId,
        book: { create: { bookNumber: `BOOK-${Date.now()}` } },
      },
      include: { book: true },
    });
    res.status(201).json(patient);
  } catch (err) {
    console.error("POST /api/patients error:", err);
    res.status(500).json({ error: "failed to create patient" });
  }
});

// GET /api/patients?q=search
router.get("/", async (req, res) => {
  const q = req.query.q || "";
  try {
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { regNo: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { book: true },
      orderBy: { id: "desc" },
      take: 100,
    });
    res.json(patients);
  } catch (err) {
    console.error("GET /api/patients error:", err);
    res.status(500).json({ error: "failed to list patients" });
  }
});

export default router;
