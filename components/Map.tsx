"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { StationWithDistance } from "@/lib/types";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src
});

const formatPrice = (value?: number) =>
  value === undefined ? "--" : `${value.toFixed(2)}p`;

function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

function buildPriceIcon(price?: number, active?: boolean) {
  const html = `<div class="map-marker ${active ? "active" : ""}">${formatPrice(
    price
  )}</div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [60, 28]
  });
}

type MapProps = {
  stations: StationWithDistance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  center: { lat: number; lng: number } | null;
  fuel: "petrol" | "diesel";
};

export default function Map({ stations, activeId, onSelect, center, fuel }: MapProps) {
  const mapCenter = center ?? { lat: 51.5072, lng: -0.1276 };

  const stationIcons = useMemo(() => {
    return stations.reduce<Record<string, ReturnType<typeof buildPriceIcon>>>((acc, station) => {
      const price = fuel === "petrol" ? station.prices.petrol : station.prices.diesel;
      acc[station.nodeId] = buildPriceIcon(price, station.nodeId === activeId);
      return acc;
    }, {});
  }, [stations, activeId, fuel]);

  return (
    <div className="map-shell">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={12}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {center && <MapCenter lat={center.lat} lng={center.lng} />}
        {stations.map((station) => (
          <Marker
            key={station.nodeId}
            position={[station.lat, station.lng]}
            icon={stationIcons[station.nodeId]}
            eventHandlers={{
              click: () => onSelect(station.nodeId)
            }}
          >
            <Popup>
              <strong>{station.brandName ?? "Forecourt"}</strong>
              <br />
              {formatPrice(
                fuel === "petrol" ? station.prices.petrol : station.prices.diesel
              )} {fuel}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
