import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);

  const [parking, setParking] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
  
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
  
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  useEffect(() => {
    fetchParking();
    fetchPrediction();
  }, []);

  const filteredParking = parking
  .filter((p) =>
    p.location.toLowerCase().includes(search.toLowerCase())
  )
  .map((p) => {
    if (userLocation) {
      const distance = getDistance(
        userLocation.lat,
        userLocation.lng,
        p.lat,
        p.lng
      );
      return { ...p, distance };
    }
    return p;
  })
  .sort((a, b) => {
    if (!userLocation) return 0;
    return a.distance - b.distance;
  });

  useEffect(() => {
    if (parking.length === 0) return;
  
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [parking[0].lng, parking[0].lat],
        zoom: 13,
      });
  
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    }
  
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  
    filteredParking.forEach((spot) => {
      const markerColor =
        spot.availableSpots >= 15
          ? "#22c55e"
          : spot.availableSpots >= 7
          ? "#f59e0b"
          : "#ef4444";
  
      const marker = new mapboxgl.Marker({ color: markerColor })
        .setLngLat([spot.lng, spot.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <strong>${spot.location}</strong><br/>
            ${spot.availableSpots} spots available
          `)
        )
        .addTo(map.current);
  
      markersRef.current.push(marker);
    });
  
    if (userLocation) {
      const userMarker = new mapboxgl.Marker({ color: "#111827" })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <strong>You are here</strong>
          `)
        )
        .addTo(map.current);
  
      markersRef.current.push(userMarker);
    }
  }, [parking, filteredParking, userLocation]);

  const fetchParking = async () => {
    try {
      const res = await axios.get("https://parkwise-n9ph.onrender.com/api/parking");
      setParking(res.data);
    } catch (err) {
      setError("Unable to connect to backend.");
    }
  };

  const fetchPrediction = async () => {
    try {
      const res = await axios.get("https://parkwise-n9ph.onrender.com/api/parking/predict");
      setPrediction(res.data.predictedSpots);
    } catch (err) {
      setPrediction("Unavailable");
    }
  };

  const findNearMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
  
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
  
        setUserLocation({ lat, lng });
  
        const res = await axios.get(
          `https://parkwise-n9ph.onrender.com/api/parking/nearby?lat=${lat}&lng=${lng}`
        );
  
        setParking(res.data);
  
        if (map.current) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: 14,
          });
        }
      },
      () => {
        alert("Unable to get your location. Please allow location access.");
      }
    );
  };

  const bestSpot = filteredParking.reduce((best, current) => {
    if (!best) return current;
  
    if (userLocation) {
      const scoreCurrent =
        current.availableSpots * 2 - current.distance;
      const scoreBest =
        best.availableSpots * 2 - best.distance;
  
      return scoreCurrent > scoreBest ? current : best;
    }
  
    return current.availableSpots > best.availableSpots
      ? current
      : best;
  }, null);

  const getDirections = async (spot) => {
    if (!userLocation) {
      alert("Click Find Parking Near Me first.");
      return;
    }
  
    setSelectedSpot(spot);
  
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLocation.lng},${userLocation.lat};${spot.lng},${spot.lat}?geometries=geojson&overview=full&access_token=${process.env.REACT_APP_MAPBOX_TOKEN}`;
  
    const res = await fetch(url);
    const data = await res.json();
  
    if (!data.routes || data.routes.length === 0) {
      alert("No route found.");
      return;
    }
  
    const route = data.routes[0];
  
    setRouteInfo({
      distance: (route.distance / 1000).toFixed(2),
      duration: Math.round(route.duration / 60),
    });
  
    const geojson = {
      type: "Feature",
      properties: {},
      geometry: route.geometry,
    };
  
    if (map.current.getSource("route")) {
      map.current.getSource("route").setData(geojson);
    } else {
      map.current.addSource("route", {
        type: "geojson",
        data: geojson,
      });
  
      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
        },
      });
    }
  
    map.current.fitBounds(
      [
        [userLocation.lng, userLocation.lat],
        [spot.lng, spot.lat],
      ],
      { padding: 80 }
    );
  };

  return (
    <div className="app">
      <header className="hero">
        <h1>ParkWise</h1>
        <p>Smart parking finder with real-time availability and prediction.</p>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats">
        <div className="stat-card">
          <h3>Total Locations</h3>
          <p>{parking.length}</p>
        </div>

        <div className="stat-card">
          <h3>Predicted Availability</h3>
          <p>{prediction ?? "Loading"} spots</p>
        </div>

        <div className="stat-card">
          <h3>Total Available Spots</h3>
          <p>{parking.reduce((sum, item) => sum + item.availableSpots, 0)}</p>
        </div>
      </section>

      {bestSpot && (
        <div className="stat-card" style={{ marginBottom: "20px" }}>
          <h3>Recommended Parking</h3>
          <p>{bestSpot.location}</p>
          <p>{bestSpot.availableSpots} spots available</p>
        </div>
      )}

      {selectedSpot && routeInfo && (
        <div className="stat-card" style={{ marginBottom: "20px" }}>
          <h3>Route to {selectedSpot.location}</h3>
          <p>{routeInfo.distance} km away</p>
          <p>Estimated drive: {routeInfo.duration} min</p>
        </div>
      )}

      <section style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search location (e.g. Downtown, Mall...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "12px",
            width: "100%",
            borderRadius: "10px",
            border: "1px solid #ccc",
          }}
        />
      </section>

      <button className="near-btn" onClick={findNearMe}>
        Find Parking Near Me
      </button>

      <section className="map-section">
        <h2>Parking Map</h2>
        {parking.length === 0 ? (
          <p>No parking locations available to show on map.</p>
        ) : (
          <div ref={mapContainer} className="map-container" />
        )}
      </section>

      <section className="parking-section">
        <h2>Available Parking Spots</h2>

        <div className="parking-grid">
          {parking.length === 0 ? (
            <p>No parking data found yet.</p>
          ) : (
            filteredParking.map((p) => (
              <div className="parking-card" key={p._id}>
                {p.distance && (
                  <p className="coords">{p.distance.toFixed(2)} km away</p>
                )}

                <h3>{p.location}</h3>

                <p className="spots">{p.availableSpots} spots available</p>

                <p className="coords">
                  Lat: {p.lat} | Lng: {p.lng}
                </p>

                <button className="route-btn" onClick={() => getDirections(p)}>
                  Get Directions
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default App;