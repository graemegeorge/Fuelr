import { LatLng } from "./geo";
import { promises as fs } from "fs";
import path from "path";
import { FuelKind } from "./types";

const DEFAULT_BASE_URL = "https://www.fuel-finder.service.gov.uk";
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_BATCHES = 200;
const DEFAULT_CACHE_PATH = path.join(process.cwd(), ".cache", "fuelr-cache.json");

export type FuelPriceEntry = Record<string, unknown>;

export type StationRecord = {
  node_id: string;
  trading_name?: string | null;
  brand_name?: string | null;
  mft_organisation_name?: string | null;
  temporary_closure?: boolean | null;
  permanent_closure?: boolean | null;
  location?: Record<string, unknown> | null;
  fuel_prices?: FuelPriceEntry[] | null;
};

type TokenState = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
};

type CacheState = {
  updatedAt: number;
  lastSyncAt: number;
  stations: StationRecord[];
};

const globalState = globalThis as typeof globalThis & {
  __fuelrToken?: TokenState | null;
  __fuelrCache?: CacheState | null;
  __fuelrRefresh?: Promise<CacheState> | null;
};

let tokenState: TokenState | null = globalState.__fuelrToken ?? null;
let cacheState: CacheState | null = globalState.__fuelrCache ?? null;
let refreshPromise: Promise<CacheState> | null = globalState.__fuelrRefresh ?? null;
let diskLoadPromise: Promise<CacheState | null> | null = null;

export async function getStations(): Promise<CacheState> {
  const now = Date.now();
  if (!cacheState) {
    const diskCache = await loadCacheFromDisk();
    if (diskCache) {
      cacheState = diskCache;
      globalState.__fuelrCache = diskCache;
    }
  }
  if (cacheState) {
    const isFresh = now - cacheState.updatedAt < CACHE_TTL_MS;
    if (!isFresh) {
      triggerRefresh();
    }
    return cacheState;
  }

  if (!refreshPromise) {
    refreshPromise = refreshStations();
    globalState.__fuelrRefresh = refreshPromise;
  }

  try {
    cacheState = await refreshPromise;
    globalState.__fuelrCache = cacheState;
    return cacheState;
  } finally {
    refreshPromise = null;
    globalState.__fuelrRefresh = null;
  }
}

export async function refreshStations(): Promise<CacheState> {
  const token = await ensureAccessToken();
  const useIncremental = Boolean(cacheState?.lastSyncAt);
  const effectiveTimestamp = cacheState?.lastSyncAt
    ? formatTimestamp(cacheState.lastSyncAt)
    : null;

  const [pfs, prices] = await Promise.all([
    useIncremental && effectiveTimestamp
      ? fetchAllBatched<StationRecord>("/api/v1/pfs", token, effectiveTimestamp)
      : fetchAllBatched<StationRecord>("/api/v1/pfs", token),
    useIncremental && effectiveTimestamp
      ? fetchAllBatched<StationRecord>(
          "/api/v1/pfs/fuel-prices",
          token,
          effectiveTimestamp
        )
      : fetchAllBatched<StationRecord>("/api/v1/pfs/fuel-prices", token)
  ]);

  const priceMap = new Map<string, StationRecord>();
  for (const entry of prices) {
    priceMap.set(entry.node_id, entry);
  }

  let merged: StationRecord[] = [];
  if (useIncremental && cacheState) {
    const stationMap = new Map<string, StationRecord>();
    for (const station of cacheState.stations) {
      stationMap.set(station.node_id, station);
    }
    for (const station of pfs) {
      stationMap.set(station.node_id, {
        ...stationMap.get(station.node_id),
        ...station
      });
    }
    for (const [nodeId, station] of stationMap.entries()) {
      const priceUpdate = priceMap.get(nodeId);
      if (priceUpdate?.fuel_prices) {
        station.fuel_prices = priceUpdate.fuel_prices;
      }
      merged.push(station);
    }
  } else {
    merged = pfs.map((station) => ({
      ...station,
      fuel_prices:
        priceMap.get(station.node_id)?.fuel_prices ??
        station.fuel_prices ??
        []
    }));
  }

  const now = Date.now();
  const nextCache = {
    updatedAt: Date.now(),
    lastSyncAt: now,
    stations: merged
  };

  cacheState = nextCache;
  globalState.__fuelrCache = nextCache;
  persistCacheToDisk(nextCache).catch(() => null);
  return nextCache;
}

export function getLatLngFromStation(station: StationRecord): LatLng | null {
  const location = station.location ?? {};
  const lat = pickNumber(
    location["lat"],
    location["latitude"],
    location["lat_deg"],
    location["lat_deg_wgs84"],
    location["y"]
  );
  const lng = pickNumber(
    location["lng"],
    location["longitude"],
    location["lon"],
    location["long"],
    location["lng_deg"],
    location["lng_deg_wgs84"],
    location["x"]
  );

  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }

  const coords = location["coordinates"];
  if (Array.isArray(coords) && coords.length >= 2) {
    const lngCoord = Number(coords[0]);
    const latCoord = Number(coords[1]);
    if (!Number.isNaN(latCoord) && !Number.isNaN(lngCoord)) {
      return { lat: latCoord, lng: lngCoord };
    }
  }

  return null;
}

export function extractFuelPrices(entries: FuelPriceEntry[] | null | undefined) {
  const prices: { petrol?: number; diesel?: number } = {};
  if (!entries) return prices;

  for (const entry of entries) {
    const fuelTypeRaw =
      String(
        entry["fuel_type"] ??
          entry["fuel_type_code"] ??
          entry["fuelType"] ??
          entry["code"] ??
          ""
      ).toLowerCase();

    const priceValue = pickNumber(
      entry["price"],
      entry["price_per_litre"],
      entry["price_per_liter"],
      entry["unit_price"],
      entry["cost"]
    );

    if (priceValue === null) continue;

    if (isDiesel(fuelTypeRaw)) {
      prices.diesel = priceValue;
    } else if (isPetrol(fuelTypeRaw)) {
      prices.petrol = priceValue;
    }
  }

  return prices;
}

export function getSelectedPrice(
  prices: { petrol?: number; diesel?: number },
  fuel: FuelKind
): number | undefined {
  return fuel === "petrol" ? prices.petrol : prices.diesel;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

function isDiesel(value: string) {
  return value.includes("diesel") || value === "d" || value.includes("b7");
}

function isPetrol(value: string) {
  return (
    value.includes("unleaded") ||
    value.includes("petrol") ||
    value.includes("e10") ||
    value.includes("e5") ||
    value === "u"
  );
}

async function ensureAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenState && tokenState.expiresAt > now + 30_000) {
    return tokenState.accessToken;
  }

  const baseUrl = process.env.FUELFINDER_BASE_URL ?? DEFAULT_BASE_URL;
  const clientId = process.env.FUELFINDER_CLIENT_ID;
  const clientSecret = process.env.FUELFINDER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Fuel Finder client credentials.");
  }

  const response = await fetch(`${baseUrl}/api/v1/oauth/generate_access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token request failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const data = payload?.data ?? payload;

  tokenState = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000
  };
  globalState.__fuelrToken = tokenState;

  return tokenState.accessToken;
}

async function fetchAllBatched<T>(
  endpoint: string,
  token: string,
  effectiveStartTimestamp?: string
): Promise<T[]> {
  const results: T[] = [];
  for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
    const url = new URL(`${getBaseUrl()}${endpoint}`);
    url.searchParams.set("batch-number", String(batch));
    if (effectiveStartTimestamp) {
      url.searchParams.set("effective-start-timestamp", effectiveStartTimestamp);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (response.status === 401 || response.status === 403) {
      tokenState = null;
      return fetchAllBatched(endpoint, await ensureAccessToken(), effectiveStartTimestamp);
    }

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 400 && body.includes("All PFS data have been fetched successfully")) {
        break;
      }
      throw new Error(`Fuel Finder fetch failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as T[];
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    results.push(...data);
  }

  return results;
}

function getBaseUrl() {
  return process.env.FUELFINDER_BASE_URL ?? DEFAULT_BASE_URL;
}

function formatTimestamp(value: number) {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function triggerRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshStations();
    globalState.__fuelrRefresh = refreshPromise;
    refreshPromise.finally(() => {
      refreshPromise = null;
      globalState.__fuelrRefresh = null;
    });
  }
}

function getCachePath() {
  return process.env.FUELFINDER_CACHE_PATH ?? DEFAULT_CACHE_PATH;
}

async function loadCacheFromDisk(): Promise<CacheState | null> {
  if (diskLoadPromise) {
    return diskLoadPromise;
  }
  diskLoadPromise = (async () => {
    try {
      const filePath = getCachePath();
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as CacheState;
      if (!parsed?.stations || !Array.isArray(parsed.stations)) return null;
      return parsed;
    } catch {
      return null;
    } finally {
      diskLoadPromise = null;
    }
  })();
  return diskLoadPromise;
}

async function persistCacheToDisk(cache: CacheState) {
  const filePath = getCachePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(cache), "utf8");
}
