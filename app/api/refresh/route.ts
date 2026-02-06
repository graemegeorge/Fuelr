import { NextRequest, NextResponse } from "next/server";
import { refreshStations } from "@/lib/fuelfinder";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-refresh-token");
  const expected = process.env.REFRESH_TOKEN;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await refreshStations();

  return NextResponse.json({
    updatedAt: data.updatedAt,
    count: data.stations.length
  });
}
