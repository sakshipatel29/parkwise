const express = require("express");
const router = express.Router();
const Parking = require("../models/Parking");

// Get all parking data
router.get("/", async (req, res) => {
  const data = await Parking.find();
  res.json(data);
});

// Add parking data
router.post("/", async (req, res) => {
  const newData = new Parking(req.body);
  await newData.save();
  res.json(newData);
});

// Simple prediction (average)
router.get("/predict", async (req, res) => {
  const data = await Parking.find();

  if (data.length === 0) {
    return res.json({ predictedSpots: 0 });
  }

  const avg =
    data.reduce((sum, item) => sum + item.availableSpots, 0) / data.length;

  res.json({ predictedSpots: Math.round(avg) });
});

module.exports = router;