import { NextRequest, NextResponse } from "next/server";
import { getStations, getLatLngFromStation, extractFuelPrices, getSelectedPrice } from "@/lib/fuelfinder";
import { haversineDistanceKm } from "@/lib/geo";
import { FuelKind } from "@/lib/types";

const MAX_RESULTS = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const fuel = (searchParams.get("fuel") ?? "petrol") as FuelKind;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params are required." },
      { status: 400 }
    );
  }

  const sortParam = searchParams.get("sort");
  const cheapestFlag = searchParams.get("cheapest") === "true";
  const nearestFlag = searchParams.get("nearest") === "true";

  const { stations, updatedAt } = await getStations();

  const enriched = stations
    .filter((station) => !station.permanent_closure && !station.temporary_closure)
    .map((station) => {
      const coords = getLatLngFromStation(station);
      if (!coords) return null;

      const distanceKm = haversineDistanceKm({ lat, lng }, coords);
      const prices = extractFuelPrices(station.fuel_prices);
      const priceSelected = getSelectedPrice(prices, fuel);

      return {
        nodeId: station.node_id,
        brandName: station.brand_name ?? station.trading_name ?? null,
        tradingName: station.trading_name ?? null,
        lat: coords.lat,
        lng: coords.lng,
        distanceKm,
        prices,
        priceSelected
      };
    })
    .filter((station): station is EnrichedStation => station !== null);

  const sortMode = resolveSortMode(sortParam, cheapestFlag, nearestFlag);

  if (sortMode === "both") {
    enriched.sort((a, b) => {
      const priceDiff =
        (a.priceSelected ?? Number.POSITIVE_INFINITY) -
        (b.priceSelected ?? Number.POSITIVE_INFINITY);
      if (priceDiff !== 0) return priceDiff;
      return a.distanceKm - b.distanceKm;
    });
  } else if (sortMode === "cheapest") {
    enriched.sort(
      (a, b) =>
        (a.priceSelected ?? Number.POSITIVE_INFINITY) -
        (b.priceSelected ?? Number.POSITIVE_INFINITY)
    );
  } else if (sortMode === "nearest") {
    enriched.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return NextResponse.json({
    updatedAt,
    results: enriched.slice(0, MAX_RESULTS)
  });
}

function resolveSortMode(
  sortParam: string | null,
  cheapestFlag: boolean,
  nearestFlag: boolean
) {
  if (sortParam === "cheapest" || sortParam === "nearest" || sortParam === "both") {
    return sortParam;
  }
  if (cheapestFlag && nearestFlag) return "both";
  if (cheapestFlag) return "cheapest";
  if (nearestFlag) return "nearest";
  return "both";
}

type EnrichedStation = {
  nodeId: string;
  brandName: string | null;
  tradingName: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
  prices: { petrol?: number; diesel?: number };
  priceSelected: number | undefined;
};
