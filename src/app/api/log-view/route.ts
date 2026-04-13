import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') || '/';
  const city = url.searchParams.get('city') || null;
  const region = url.searchParams.get('region') || null;
  const country = url.searchParams.get('country') || null;
  const ip = url.searchParams.get('ip') || null;
  const user_agent = url.searchParams.get('ua') || null;
  const referrer = url.searchParams.get('ref') || null;

  const supabase = getSupabaseAdmin();
  await supabase.from('page_views').insert({
    path,
    city,
    region,
    country,
    ip,
    user_agent,
    referrer,
  });

  return new Response('ok', { status: 200 });
}
