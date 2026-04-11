export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurbSupabase, SVG_TENANT_ID } from '@/lib/curb-supabase';
import { BASE_LOCATION } from '@/lib/types';

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function estimateDriveMins(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const miles = haversineMiles(lat1, lng1, lat2, lng2) * 1.35;
  return Math.max(5, Math.ceil((miles / 28) * 60));
}

export async function GET(request: NextRequest) {
  try {
    const curb = getCurbSupabase();
    const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: appts, error } = await curb
      .from('curb_appointments')
      .select(`
        id, scheduled_time, status, outcome, lat, lng, address,
        seller:curb_sellers(first_name, last_name),
        lead:curb_leads(year, make, model),
        agent:curb_users(id, first_name, last_name, color_hex)
      `)
      .eq('tenant_id', SVG_TENANT_ID)
      .eq('scheduled_date', date)
      .neq('status', 'canceled')
      .order('scheduled_time');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Shape for frontend compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shaped = (appts || []).map((a: any) => ({
      ...a,
      customer: a.seller ? { first_name: a.seller.first_name, last_name: a.seller.last_name } : null,
      vehicle: a.lead ? { year: a.lead.year, make: a.lead.make, model: a.lead.model } : null,
      agent: a.agent ? { id: a.agent.id, name: `${a.agent.first_name} ${a.agent.last_name}`.trim(), color_hex: a.agent.color_hex } : null,
    }));

    // Group by agent
    const agentMap: Record<string, {
      agent: { id: string; name: string; color_hex: string };
      stops: typeof shaped;
    }> = {};

    for (const a of shaped) {
      if (!a.agent?.id) continue;
      if (!agentMap[a.agent.id]) agentMap[a.agent.id] = { agent: a.agent, stops: [] };
      agentMap[a.agent.id].stops.push(a);
    }

    const APPRAISAL_MINS = 45;

    const agentTimelines = Object.values(agentMap).map(({ agent, stops }) => {
      const timeline: Array<{
        type: 'drive' | 'appraise';
        startMin: number;
        endMin: number;
        label: string;
        appt?: typeof stops[0];
        conflict?: boolean;
      }> = [];

      let cursor = 480;
      let prevLat = BASE_LOCATION.lat;
      let prevLng = BASE_LOCATION.lng;
      const conflicts: string[] = [];

      for (const stop of stops) {
        const timeParts = stop.scheduled_time.split(':');
        const scheduledMins = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);

        const toLat = stop.lat ?? prevLat;
        const toLng = stop.lng ?? prevLng;
        const driveTime = estimateDriveMins(prevLat, prevLng, toLat, toLng);

        const driveStart = cursor;
        const driveEnd = cursor + driveTime;
        const actualStart = Math.max(driveEnd, scheduledMins);
        const lateBy = driveEnd - scheduledMins;
        const conflict = lateBy > 10;

        if (conflict) {
          conflicts.push(`${stop.scheduled_time.slice(0, 5)}: ~${lateBy}min late (${driveTime}min drive from prev stop)`);
        }

        timeline.push({ type: 'drive', startMin: driveStart, endMin: driveEnd, label: `Drive ~${driveTime}min` });
        timeline.push({ type: 'appraise', startMin: actualStart, endMin: actualStart + APPRAISAL_MINS, label: 'Appraise', appt: stop, conflict });

        cursor = actualStart + APPRAISAL_MINS;
        prevLat = toLat;
        prevLng = toLng;
      }

      const returnDrive = stops.length > 0
        ? estimateDriveMins(prevLat, prevLng, BASE_LOCATION.lat, BASE_LOCATION.lng)
        : 0;
      if (returnDrive > 0) {
        timeline.push({ type: 'drive', startMin: cursor, endMin: cursor + returnDrive, label: `Return ~${returnDrive}min` });
        cursor += returnDrive;
      }

      const totalDriveMins = timeline.filter(t => t.type === 'drive').reduce((s, t) => s + (t.endMin - t.startMin), 0);
      const totalAppraisalMins = timeline.filter(t => t.type === 'appraise').reduce((s, t) => s + (t.endMin - t.startMin), 0);
      const startMin = timeline[0]?.startMin ?? 480;
      const finishMin = cursor;
      const finishHr = Math.floor(finishMin / 60);
      const finishMn = finishMin % 60;
      const finishTime = `${finishHr > 12 ? finishHr - 12 : finishHr}:${String(finishMn).padStart(2, '0')} ${finishHr >= 12 ? 'PM' : 'AM'}`;

      return { agent, stops: stops.length, timeline, totalDriveMins, totalAppraisalMins, startMin, finishMin, finishTime, conflicts };
    });

    return NextResponse.json({ date, agentTimelines });
  } catch (err) {
    console.error('Dispatch API error:', err);
    return NextResponse.json({ error: 'Internal server error', agentTimelines: [] }, { status: 500 });
  }
}
