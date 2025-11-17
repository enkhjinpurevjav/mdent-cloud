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

    // Basic validation - check if values exist and are not just whitespace
    if (!firstName || !firstName.trim() || !lastName || !lastName.trim() || !branchId || !branchId.trim()) {
      return res.status(400).json({ 
        error: 'firstName, lastName, and branchId are required and must not be empty' 
      });
    }

    // Parse and validate dateOfBirth if provided
    let parsedDateOfBirth = null;
    if (dateOfBirth) {
      const date = new Date(dateOfBirth);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ 
          error: 'dateOfBirth must be a valid date string (ISO 8601 format)' 
        });
      }
      parsedDateOfBirth = date;
    }

    const patient = await prisma.patient.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: parsedDateOfBirth,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        branchId: branchId.trim(),
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
    
    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid branchId: branch does not exist' });
    }
    
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

export default router;
