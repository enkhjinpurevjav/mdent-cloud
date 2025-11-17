import { Router } from 'express';
import prisma from '../db.ts';

const router = Router();

// GET /api/branches - Get all branches
router.get('/', async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json(branches);
  } catch (error) {
    req.log?.error({ error }, 'Failed to fetch branches');
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

export default router;
