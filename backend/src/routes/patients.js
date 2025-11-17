import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/patients - List patients with optional search
router.get('/', async (req, res) => {
  try {
    const { name, regNo } = req.query;
    
    const where = {};
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (regNo) {
      where.regNo = { contains: regNo, mode: 'insensitive' };
    }

    const patients = await db.patient.findMany({
      where,
      include: {
        branch: true,
        patientBook: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// POST /api/patients - Create a new patient with patient book
router.post('/', async (req, res) => {
  try {
    const { name, phone, regNo, branchId } = req.body;

    if (!name || !branchId) {
      return res.status(400).json({ error: 'Name and branchId are required' });
    }

    // Generate a unique book number based on timestamp and random number
    const bookNumber = `BK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create patient with patient book in a transaction
    const patient = await db.patient.create({
      data: {
        name,
        phone,
        regNo,
        branchId: parseInt(branchId),
        patientBook: {
          create: {
            bookNumber,
          },
        },
      },
      include: {
        branch: true,
        patientBook: true,
      },
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

export default router;
