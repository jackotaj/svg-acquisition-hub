import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '21');
  const excludeRegion = url.searchParams.get('exclude_region') || null;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('page_views')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);

  if (excludeRegion) {
    query = query.neq('region', excludeRegion);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Build summary
  const byRegion: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  const uniqueIPs = new Set<string>();

  for (const row of data || []) {
    const region = row.region || 'Unknown';
    const city = row.city || 'Unknown';
    byRegion[region] = (byRegion[region] || 0) + 1;
    byCity[`${city}, ${region}`] = (byCity[`${city}, ${region}`] || 0) + 1;
    byPath[row.path] = (byPath[row.path] || 0) + 1;
    if (row.ip) uniqueIPs.add(row.ip);
  }

  return Response.json({
    total: (data || []).length,
    uniqueVisitors: uniqueIPs.size,
    byRegion: Object.entries(byRegion).sort((a, b) => b[1] - a[1]),
    byCity: Object.entries(byCity).sort((a, b) => b[1] - a[1]),
    byPath: Object.entries(byPath).sort((a, b) => b[1] - a[1]),
    recent: (data || []).slice(0, 100),
  });
}
