import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/branches - Get all branches
router.get('/', async (req, res) => {
  try {
    const branches = await db.branch.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

export default router;
