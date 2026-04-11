export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';

export async function GET(request: NextRequest) {
  const curb = getCurbSupabase();
  const month = request.nextUrl.searchParams.get('month');

  let query = curb
    .from('curb_appointments')
    .select(`id, scheduled_date, scheduled_time, vas_rep, lead_source, status, outcome,
      purchase_price, offer_amount, lost_reason, lat, lng, address,
      seller:curb_sellers(first_name, last_name),
      lead:curb_leads(year, make, model, mileage, condition)`)
    .eq('tenant_id', SVG_TENANT_ID);

  if (month) {
    query = query.gte('scheduled_date', `${month}-01`).lte('scheduled_date', `${month}-31`);
  }

  const { data: rawAppts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rawAppts) return NextResponse.json({});

  // Shape for frontend compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appts = rawAppts.map((a: any) => ({
    ...a,
    purchase_amount: a.purchase_price,
    customer: a.seller ? { first_name: a.seller.first_name, last_name: a.seller.last_name } : null,
    vehicle: a.lead ? { year: a.lead.year, make: a.lead.make, model: a.lead.model, mileage: a.lead.mileage, condition: a.lead.condition } : null,
  }));

  // ── Funnel ──
  const total = appts.length;
  const showed = appts.filter(a => !['canceled', 'scheduled'].includes(a.status) && a.outcome !== 'no_show').length;
  const offered = appts.filter(a => a.offer_amount != null || a.outcome === 'purchased' || a.outcome === 'no_purchase').length;
  const purchased = appts.filter(a => a.outcome === 'purchased').length;
  const noShows = appts.filter(a => a.outcome === 'no_show').length;
  const cancelled = appts.filter(a => a.status === 'canceled').length;

  // ── Lead Source Analysis ──
  const sourceMap: Record<string, { total: number; showed: number; offered: number; purchased: number; revenue: number }> = {};
  for (const a of appts) {
    const src = a.lead_source || 'Unknown';
    if (!sourceMap[src]) sourceMap[src] = { total: 0, showed: 0, offered: 0, purchased: 0, revenue: 0 };
    sourceMap[src].total++;
    if (!['canceled', 'scheduled'].includes(a.status) && a.outcome !== 'no_show') sourceMap[src].showed++;
    if (a.offer_amount != null || a.outcome === 'purchased' || a.outcome === 'no_purchase') sourceMap[src].offered++;
    if (a.outcome === 'purchased') { sourceMap[src].purchased++; sourceMap[src].revenue += a.purchase_amount || 0; }
  }
  const leadSources = Object.entries(sourceMap).map(([source, s]) => ({
    source, ...s,
    showRate: s.total > 0 ? Math.round((s.showed / s.total) * 100) : 0,
    closeRate: s.showed > 0 ? Math.round((s.purchased / s.showed) * 100) : 0,
    conversionRate: s.total > 0 ? Math.round((s.purchased / s.total) * 100) : 0,
    avgDeal: s.purchased > 0 ? Math.round(s.revenue / s.purchased) : 0,
  })).sort((a, b) => b.purchased - a.purchased);

  // ── Vehicle Intelligence ──
  const makeMap: Record<string, { count: number; purchased: number }> = {};
  const conditionMap: Record<string, number> = {};
  const mileageBuckets: Record<string, number> = { '0-50k': 0, '50k-100k': 0, '100k-150k': 0, '150k+': 0 };
  let totalMileage = 0; let mileageCount = 0;

  for (const a of appts) {
    const v = a.vehicle;
    if (!v) continue;
    const make = v.make || 'Unknown';
    if (!makeMap[make]) makeMap[make] = { count: 0, purchased: 0 };
    makeMap[make].count++;
    if (a.outcome === 'purchased') makeMap[make].purchased++;
    if (v.condition) conditionMap[v.condition] = (conditionMap[v.condition] || 0) + 1;
    if (v.mileage) {
      totalMileage += v.mileage; mileageCount++;
      if (v.mileage < 50000) mileageBuckets['0-50k']++;
      else if (v.mileage < 100000) mileageBuckets['50k-100k']++;
      else if (v.mileage < 150000) mileageBuckets['100k-150k']++;
      else mileageBuckets['150k+']++;
    }
  }
  const topMakes = Object.entries(makeMap)
    .map(([make, d]) => ({ make, ...d, convRate: d.count > 0 ? Math.round((d.purchased / d.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count).slice(0, 10);

  // ── Timing Analysis ──
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayMap: Record<string, { total: number; purchased: number; noShow: number }> = {};
  const hourMap: Record<string, { total: number; purchased: number }> = {};

  for (const a of appts) {
    const d = new Date(a.scheduled_date + 'T12:00:00');
    const day = DAYS[d.getDay()];
    if (!dayMap[day]) dayMap[day] = { total: 0, purchased: 0, noShow: 0 };
    dayMap[day].total++;
    if (a.outcome === 'purchased') dayMap[day].purchased++;
    if (a.outcome === 'no_show') dayMap[day].noShow++;

    const hr = a.scheduled_time ? parseInt(a.scheduled_time.split(':')[0]) : null;
    if (hr !== null) {
      const label = hr < 12 ? `${hr}am` : hr === 12 ? '12pm' : `${hr - 12}pm`;
      if (!hourMap[label]) hourMap[label] = { total: 0, purchased: 0 };
      hourMap[label].total++;
      if (a.outcome === 'purchased') hourMap[label].purchased++;
    }
  }
  const dayStats = DAYS.map(d => ({ day: d, ...(dayMap[d] || { total: 0, purchased: 0, noShow: 0 }) }));
  const hourStats = Object.entries(hourMap)
    .map(([hour, d]) => ({ hour, ...d, rate: d.total > 0 ? Math.round((d.purchased / d.total) * 100) : 0 }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

  // ── Lost Deal Analysis ──
  const noPurchase = appts.filter(a => a.outcome === 'no_purchase');
  const lostReasonMap: Record<string, number> = {};
  for (const a of noPurchase) {
    const r = a.lost_reason || 'Unknown';
    lostReasonMap[r] = (lostReasonMap[r] || 0) + 1;
  }
  const lostReasons = Object.entries(lostReasonMap)
    .map(([reason, count]) => ({ reason, count, pct: noPurchase.length > 0 ? Math.round((count / noPurchase.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // ── Offer Intelligence ──
  const offeredAppts = appts.filter(a => a.offer_amount != null);
  const acceptedOffers = offeredAppts.filter(a => a.outcome === 'purchased');
  const rejectedOffers = offeredAppts.filter(a => a.outcome === 'no_purchase');
  const avgOffer = offeredAppts.length > 0
    ? Math.round(offeredAppts.reduce((s, a) => s + (a.offer_amount || 0), 0) / offeredAppts.length) : 0;
  const avgPurchase = acceptedOffers.length > 0
    ? Math.round(acceptedOffers.reduce((s, a) => s + (a.purchase_amount || 0), 0) / acceptedOffers.length) : 0;

  // ── Geography ──
  const geoPoints = appts
    .filter(a => a.lat && a.lng)
    .map(a => ({ lat: a.lat, lng: a.lng, outcome: a.outcome, address: a.address }));

  return NextResponse.json({
    funnel: { total, showed, offered, purchased, noShows, cancelled },
    leadSources,
    vehicles: { topMakes, conditionMap, mileageBuckets, avgMileage: mileageCount > 0 ? Math.round(totalMileage / mileageCount) : 0 },
    timing: { dayStats, hourStats },
    lostDeals: { total: noPurchase.length, reasons: lostReasons },
    offers: {
      total: offeredAppts.length,
      accepted: acceptedOffers.length,
      rejected: rejectedOffers.length,
      acceptanceRate: offeredAppts.length > 0 ? Math.round((acceptedOffers.length / offeredAppts.length) * 100) : 0,
      avgOffer,
      avgPurchase,
    },
    geoPoints,
    allAppts: appts,
  });
}
