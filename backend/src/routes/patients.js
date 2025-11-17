import { Router } from 'express';
import prisma from '../db.js';

const router = Router();

// GET /api/patients - Get all patients
router.get('/', async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(patients);
  } catch (error) {
    req.log?.error({ error }, 'Failed to fetch patients');
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// POST /api/patients - Create a new patient
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, phone, email, address, branchId } = req.body;

    // Basic validation
    if (!firstName || !lastName || !branchId) {
      return res.status(400).json({ error: 'firstName, lastName, and branchId are required' });
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone,
        email,
        address,
        branchId,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(patient);
  } catch (error) {
    req.log?.error({ error }, 'Failed to create patient');
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

export default router;
