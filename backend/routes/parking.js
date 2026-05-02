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

  const currentHour = new Date().getHours();

  const filtered = data.filter((item) => {
    const hour = new Date(item.timestamp).getHours();
    return hour === currentHour;
  });

  const dataset = filtered.length > 0 ? filtered : data;

  const avg =
    dataset.reduce((sum, item) => sum + item.availableSpots, 0) /
    dataset.length;

  res.json({
    predictedSpots: Math.round(avg),
    basedOn: filtered.length > 0 ? "current hour data" : "all data",
  });
});

module.exports = router;