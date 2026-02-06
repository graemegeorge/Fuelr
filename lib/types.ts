export type FuelKind = "petrol" | "diesel";

export type StationWithDistance = {
  nodeId: string;
  brandName: string | null;
  tradingName: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
  prices: {
    petrol?: number;
    diesel?: number;
  };
  priceSelected?: number;
};
