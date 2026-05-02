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

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="parking"](around:3000,${lat},${lng});
        way["amenity"="parking"](around:3000,${lat},${lng});
        relation["amenity"="parking"](around:3000,${lat},${lng});
      );
      out center tags;
    `;

    const overpassResponse = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "ParkWise/1.0",
        },
        body: new URLSearchParams({
          data: query,
        }),
      }
    );

    if (!overpassResponse.ok) {
      const text = await overpassResponse.text();
      console.log("Overpass error:", text);
      return res.status(500).json({
        error: "Overpass API request failed",
        details: text,
      });
    }

    const data = await overpassResponse.json();

    const formatted = data.elements
      .map((item, index) => ({
        _id: `osm-${item.type}-${item.id}`,
        location: item.tags?.name || `Parking Area ${index + 1}`,
        lat: item.lat || item.center?.lat,
        lng: item.lon || item.center?.lon,
        availableSpots: Math.floor(Math.random() * 20) + 1,
        source: "OpenStreetMap",
      }))
      .filter((item) => item.lat && item.lng);

    res.json(formatted);
  } catch (error) {
    console.log("Nearby route error:", error.message);

    res.status(500).json({
      error: "Failed to fetch nearby parking",
      message: error.message,
    });
  }
});

module.exports = router;