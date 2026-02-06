import { NextRequest, NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get("postcode");

  if (!postcode) {
    return NextResponse.json({ error: "postcode query param is required." }, { status: 400 });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", postcode);
  url.searchParams.set("countrycodes", "gb");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Fuelr/1.0 (support@fuelr.app)",
      "Accept-Language": "en"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to geocode postcode." },
      { status: response.status }
    );
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "No results found." }, { status: 404 });
  }

  return NextResponse.json({
    lat: Number(data[0].lat),
    lng: Number(data[0].lon)
  });
}
