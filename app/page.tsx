"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Controls from "@/components/Controls";
import StationList from "@/components/StationList";
import { FuelKind, StationWithDistance } from "@/lib/types";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

type LatLng = { lat: number; lng: number };

type ApiResponse = {
  updatedAt: number;
  results: StationWithDistance[];
};

const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 };

export default function Home() {
  const [fuel, setFuel] = useState<FuelKind>("petrol");
  const [sortCheapest, setSortCheapest] = useState(false);
  const [sortNearest, setSortNearest] = useState(true);
  const [postcode, setPostcode] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [stations, setStations] = useState<StationWithDistance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Detecting your location...");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("fuelr-theme") as
      | "dark"
      | "light"
      | null;
    const storedFuel = window.localStorage.getItem("fuelr-fuel") as FuelKind | null;
    const storedCheapest = window.localStorage.getItem("fuelr-cheapest");
    const storedNearest = window.localStorage.getItem("fuelr-nearest");

    if (storedTheme) setTheme(storedTheme);
    if (storedFuel) setFuel(storedFuel);
    if (storedCheapest !== null) setSortCheapest(storedCheapest === "true");
    if (storedNearest !== null) setSortNearest(storedNearest === "true");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("fuelr-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("fuelr-fuel", fuel);
  }, [fuel]);

  useEffect(() => {
    window.localStorage.setItem("fuelr-cheapest", String(sortCheapest));
    window.localStorage.setItem("fuelr-nearest", String(sortNearest));
  }, [sortCheapest, sortNearest]);

  const sortMode = useMemo(() => {
    if (sortCheapest && sortNearest) return "both";
    if (sortCheapest) return "cheapest";
    if (sortNearest) return "nearest";
    return "both";
  }, [sortCheapest, sortNearest]);

  const fetchStations = useCallback(
    async (coords: LatLng) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          lat: String(coords.lat),
          lng: String(coords.lng),
          fuel,
          sort: sortMode
        });
        const response = await fetch(`/api/stations?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load stations.");
        }
        const data = (await response.json()) as ApiResponse;
        setStations(data.results);
        setActiveId(data.results[0]?.nodeId ?? null);
        setStatus(`Updated ${new Date(data.updatedAt).toLocaleTimeString()}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stations.");
      } finally {
        setLoading(false);
      }
    },
    [fuel, sortMode]
  );

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("Location not available. Enter a postcode instead.");
      return;
    }

    setStatus("Fetching your location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setLocation(coords);
        fetchStations(coords);
      },
      () => {
        setStatus("Location denied. Enter a postcode instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [fetchStations]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (location) {
      fetchStations(location);
    }
  }, [fuel, sortMode, location, fetchStations]);

  const handleSearch = useCallback(async () => {
    if (!postcode.trim()) return;
    setLoading(true);
    setError(null);
    setStatus("Looking up postcode...");
    try {
      const response = await fetch(`/api/geocode?postcode=${encodeURIComponent(postcode)}`);
      if (!response.ok) {
        throw new Error("Could not find that postcode.");
      }
      const data = (await response.json()) as LatLng;
      setLocation(data);
      await fetchStations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to geocode postcode.");
    } finally {
      setLoading(false);
    }
  }, [postcode, fetchStations]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <main>
      <section className="app-shell">
        <div className="top-bar">
          <div className="logo">
            <h1>Fuelr</h1>
            <span>live pricing</span>
          </div>
          <div className="pill">{loading ? "Syncing..." : status}</div>
        </div>

        <p className="status-banner">
          Find your nearest stations, ranked by {sortMode.replace("both", "price + distance")}.
        </p>

        <Controls
          fuel={fuel}
          setFuel={setFuel}
          sortCheapest={sortCheapest}
          sortNearest={sortNearest}
          toggleCheapest={() => setSortCheapest((prev) => !prev)}
          toggleNearest={() => setSortNearest((prev) => !prev)}
          postcode={postcode}
          setPostcode={setPostcode}
          onSearch={handleSearch}
          onUseLocation={requestLocation}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        {error && <div className="status-banner error">{error}</div>}

        <StationList
          stations={stations}
          activeId={activeId}
          onSelect={setActiveId}
          fuel={fuel}
        />
      </section>

      <Map
        stations={stations}
        activeId={activeId}
        onSelect={setActiveId}
        center={location ?? DEFAULT_CENTER}
        fuel={fuel}
      />
    </main>
  );
}
