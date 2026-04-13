import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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

  // Fire-and-forget: log page view via internal API
  const geo = request.geo || {};
  const logUrl = new URL('/api/log-view', request.url);
  logUrl.searchParams.set('path', pathname);
  logUrl.searchParams.set('city', geo.city || '');
  logUrl.searchParams.set('region', geo.region || '');
  logUrl.searchParams.set('country', geo.country || '');
  logUrl.searchParams.set('ip', request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '');
  logUrl.searchParams.set('ua', request.headers.get('user-agent') || '');
  logUrl.searchParams.set('ref', request.headers.get('referer') || '');

  // Non-blocking fetch — don't await
  fetch(logUrl.toString()).catch(() => {});

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
