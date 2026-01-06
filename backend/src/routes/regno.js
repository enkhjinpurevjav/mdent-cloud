import express from "express";
import { parseRegNo } from "../utils/regno.js";

const router = express.Router();

// GET /api/regno/parse?regNo=...
router.get("/parse", (req, res) => {
  const { regNo } = req.query;
  const result = parseRegNo(regNo);

  // Always 200 OK so frontend can show reason, but you can also use 400 if you want.
  return res.json(result);
});

export default router;
