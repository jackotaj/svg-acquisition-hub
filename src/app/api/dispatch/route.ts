export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { BASE_LOCATION } from '@/lib/types';

async function getDriveMinutes(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data.routes?.[0]?.duration) return Math.ceil(data.routes[0].duration / 60);
  } catch { /* OSRM timeout — use haversine fallback */ }
  // Haversine fallback (straight-line * 1.4 factor, 30mph avg)
  const R = 3959;
  const dLat = (toLat - fromLat) * Math.PI / 180;
  const dLon = (toLng - fromLng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(fromLat * Math.PI/180) * Math.cos(toLat * Math.PI/180) * Math.sin(dLon/2)**2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.ceil((dist * 1.4 / 30) * 60);
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const { data: appts, error } = await supabaseAdmin
    .from('acq_appointments')
    .select('id, scheduled_time, duration_mins, status, outcome, lat, lng, address, customer:acq_customers(first_name, last_name), vehicle:acq_vehicles(year, make, model), agent:acq_agents(id, name, color_hex)')
    .eq('scheduled_date', date)
    .neq('status', 'cancelled')
    .order('scheduled_time');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by agent
  const agentMap: Record<string, { agent: { id: string; name: string; color_hex: string }; stops: typeof appts }> = {};
  (appts || []).forEach(a => {
    const agent = Array.isArray(a.agent) ? a.agent[0] : a.agent as { id: string; name: string; color_hex: string } | null;
    if (!agent) return;
    if (!agentMap[agent.id]) agentMap[agent.id] = { agent, stops: [] };
    agentMap[agent.id].stops.push(a);
  });

  // Calculate timeline for each agent with OSRM drive times
  const agentTimelines = await Promise.all(
    Object.values(agentMap).map(async ({ agent, stops }) => {
      const APPRAISAL_MINS = 45;
      const timeline: Array<{
        type: 'drive' | 'appraise';
        startMin: number; endMin: number;
        label: string;
        appt?: typeof stops[0];
        conflict?: boolean;
      }> = [];

      let cursor = 480; // 8:00 AM start in minutes from midnight
      let prevLat = BASE_LOCATION.lat;
      let prevLng = BASE_LOCATION.lng;
      const conflicts: string[] = [];

      for (const stop of stops) {
        const scheduledMins = parseInt(stop.scheduled_time.split(':')[0]) * 60 + parseInt(stop.scheduled_time.split(':')[1]);
        const appraisalMins = stop.duration_mins || APPRAISAL_MINS;

        // Drive leg
        let driveTime = 15; // default
        if (stop.lat && stop.lng) driveTime = await getDriveMinutes(prevLat, prevLng, stop.lat, stop.lng);

        const driveStart = cursor;
        const driveEnd = cursor + driveTime;
        const actualStart = Math.max(driveEnd, scheduledMins);
        const conflict = driveEnd > scheduledMins + 10; // arriving more than 10 min late

        if (conflict) conflicts.push(`${stop.scheduled_time.slice(0,5)}: will arrive ~${driveTime}min late`);

        timeline.push({ type: 'drive', startMin: driveStart, endMin: driveEnd, label: `Drive ${driveTime}min` });
        timeline.push({ type: 'appraise', startMin: actualStart, endMin: actualStart + appraisalMins, label: `Appraise`, appt: stop, conflict });

        cursor = actualStart + appraisalMins;
        if (stop.lat) { prevLat = stop.lat; prevLng = stop.lng!; }
      }

      // Drive back to base
      const driveBack = stops.length > 0 ? await getDriveMinutes(prevLat, prevLng, BASE_LOCATION.lat, BASE_LOCATION.lng) : 0;
      if (driveBack > 0) {
        timeline.push({ type: 'drive', startMin: cursor, endMin: cursor + driveBack, label: `Return ${driveBack}min` });
        cursor += driveBack;
      }

      const totalDriveMins = timeline.filter(t => t.type === 'drive').reduce((s, t) => s + (t.endMin - t.startMin), 0);
      const totalAppraisalMins = timeline.filter(t => t.type === 'appraise').reduce((s, t) => s + (t.endMin - t.startMin), 0);
      const startMin = timeline[0]?.startMin || 480;
      const finishMin = cursor;
      const finishHr = Math.floor(finishMin / 60);
      const finishMn = finishMin % 60;
      const finishTime = `${finishHr > 12 ? finishHr - 12 : finishHr}:${String(finishMn).padStart(2, '0')} ${finishHr >= 12 ? 'PM' : 'AM'}`;

      return { agent, stops: stops.length, timeline, totalDriveMins, totalAppraisalMins, startMin, finishMin, finishTime, conflicts };
    })
  );

  return NextResponse.json({ date, agentTimelines });
}
