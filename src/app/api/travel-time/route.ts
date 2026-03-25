import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.searchParams.get('origin');
  const dest = request.nextUrl.searchParams.get('dest');

  if (!origin || !dest) {
    return NextResponse.json(
      { error: 'origin and dest query params required (lat,lng format)' },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  if (apiKey && apiKey !== 'REPLACE_WITH_REAL_KEY') {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${dest}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      const element = data.rows?.[0]?.elements?.[0];
      if (element?.status === 'OK') {
        return NextResponse.json({
          minutes: Math.ceil(element.duration.value / 60),
          estimated: false,
        });
      }
    } catch {
      // Fall through to estimate
    }
  }

  return NextResponse.json({ minutes: 25, estimated: true });
}
