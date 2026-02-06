"use client";

import { StationWithDistance } from "@/lib/types";

const formatPrice = (value?: number) =>
  value === undefined ? "--" : `${value.toFixed(2)}p`;

const formatDistance = (km: number) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

type StationListProps = {
  stations: StationWithDistance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  fuel: "petrol" | "diesel";
};

export default function StationList({
  stations,
  activeId,
  onSelect,
  fuel
}: StationListProps) {
  if (stations.length === 0) {
    return (
      <div className="status-banner">
        No stations match that fuel type yet. Try switching fuel.
      </div>
    );
  }

  return (
    <div className="station-list">
      {stations.map((station, index) => {
        const isActive = station.nodeId === activeId;
        const primaryPrice = fuel === "petrol" ? station.prices.petrol : station.prices.diesel;
        const secondaryPrice = fuel === "petrol" ? station.prices.diesel : station.prices.petrol;

        return (
          <button
            key={station.nodeId}
            type="button"
            className={`station-card fade-in ${isActive ? "active" : ""}`}
            style={{ animationDelay: `${index * 40}ms` }}
            onClick={() => onSelect(station.nodeId)}
          >
            <div className="station-meta">
              <div>
                <h3>{station.brandName ?? "Forecourt"}</h3>
                <p className="badge">{formatDistance(station.distanceKm)}</p>
              </div>
              <div className="price">
                {formatPrice(primaryPrice)}
                <small> / {fuel}</small>
              </div>
            </div>
            <div className="station-meta">
              <p className="badge">{station.tradingName ?? ""}</p>
              <p className="badge">
                {fuel === "petrol" ? "Diesel" : "Petrol"}: {formatPrice(secondaryPrice)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
