export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { BASE_LOCATION } from '@/lib/types';

// Haversine distance in miles
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Drive time estimate: haversine * 1.35 road factor, 28mph avg city speed
function estimateDriveMins(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const miles = haversineMiles(lat1, lng1, lat2, lng2) * 1.35;
  return Math.max(5, Math.ceil((miles / 28) * 60));
}

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const { data: appts, error } = await supabaseAdmin
      .from('acq_appointments')
      .select(`
        id, scheduled_time, duration_mins, status, outcome, lat, lng, address,
        customer:acq_customers(first_name, last_name),
        vehicle:acq_vehicles(year, make, model),
        agent:acq_agents(id, name, color_hex)
      `)
      .eq('scheduled_date', date)
      .neq('status', 'cancelled')
      .order('scheduled_time');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Group by agent
    const agentMap: Record<string, {
      agent: { id: string; name: string; color_hex: string };
      stops: typeof appts;
    }> = {};

    for (const a of (appts || [])) {
      const agent = Array.isArray(a.agent) ? a.agent[0] : a.agent as { id: string; name: string; color_hex: string } | null;
      if (!agent?.id) continue;
      if (!agentMap[agent.id]) agentMap[agent.id] = { agent, stops: [] };
      agentMap[agent.id].stops.push(a);
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

      let cursor = 480; // 8:00 AM
      let prevLat = BASE_LOCATION.lat;
      let prevLng = BASE_LOCATION.lng;
      const conflicts: string[] = [];

      for (const stop of stops) {
        const timeParts = stop.scheduled_time.split(':');
        const scheduledMins = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
        const appraisalMins = stop.duration_mins || APPRAISAL_MINS;

        // Drive time estimate
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
        timeline.push({ type: 'appraise', startMin: actualStart, endMin: actualStart + appraisalMins, label: 'Appraise', appt: stop, conflict });

        cursor = actualStart + appraisalMins;
        prevLat = toLat;
        prevLng = toLng;
      }

      // Return drive
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
