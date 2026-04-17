import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Track a client-side click event — used for the Curb upgrade banner/popup.
 * Writes to the existing page_views table with path="click:<event>" so we can
 * filter clicks vs page views at query time. No new migration needed.
 *
 * Client calls this via navigator.sendBeacon() so the request survives
 * navigation to a different origin (e.g., app.curb.direct).
 */
export async function POST(request: Request) {
  let body: { event?: string } = {};
  try {
    body = await request.json();
  } catch {
    // sendBeacon may POST form-data instead — try that fallback
    try {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = { event: params.get('event') ?? undefined };
    } catch {
      // Ignore — we'll just record as unknown
    }
  }

  const event = body.event || 'unknown';
  const headers = request.headers;
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const rawCity = headers.get('x-vercel-ip-city');
  const city = rawCity ? decodeURIComponent(rawCity) : null;
  const region = headers.get('x-vercel-ip-country-region') || null;
  const country = headers.get('x-vercel-ip-country') || null;
  const userAgent = headers.get('user-agent') || null;
  const referrer = headers.get('referer') || null;

  const supabase = getSupabaseAdmin();
  await supabase.from('page_views').insert({
    path: `click:${event}`,
    city,
    region,
    country,
    ip,
    user_agent: userAgent,
    referrer,
  });

  return new Response('ok', { status: 200 });
}
