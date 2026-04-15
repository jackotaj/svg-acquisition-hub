import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Geo comes from Vercel headers in Next 15 (request.geo was removed)
  const h = request.headers;
  const city = h.get('x-vercel-ip-city');
  const region = h.get('x-vercel-ip-country-region');
  const country = h.get('x-vercel-ip-country');
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const userAgent = h.get('user-agent');
  const referrer = h.get('referer');

  // Direct Supabase REST write — awaited so it doesn't get dropped
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          path: pathname,
          city: city ? decodeURIComponent(city) : null,
          region: region || null,
          country: country || null,
          ip,
          user_agent: userAgent || null,
          referrer: referrer || null,
        }),
      });
    } catch {
      // Don't block the page on a logging failure
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
