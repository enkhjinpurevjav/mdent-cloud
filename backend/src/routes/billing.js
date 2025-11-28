import express from "express";
const router = express.Router();

// Example stub route
router.get("/", (req, res) => {
  res.json({ message: "Billing route is connected!" });
});

export default router;
