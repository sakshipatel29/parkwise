const mongoose = require("mongoose");

const ParkingSchema = new mongoose.Schema({
  location: String,
  lat: Number,
  lng: Number,
  availableSpots: Number,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Parking", ParkingSchema);