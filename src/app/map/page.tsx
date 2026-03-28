'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { BASE_LOCATION } from '@/lib/types';
import type { Appointment, Agent } from '@/lib/types';

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<any[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default marker icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [BASE_LOCATION.lat, BASE_LOCATION.lng],
        zoom: 10,
        zoomControl: true,
      });

      // OpenStreetMap tiles — free, no API key
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Base star marker
      const starIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;background:#f97316;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;line-height:1;">★</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([BASE_LOCATION.lat, BASE_LOCATION.lng], { icon: starIcon })
        .bindTooltip('BCK Base — 3415 Seajay Dr', { permanent: false })
        .addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(() => {
    fetch(`/api/appointments?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setAppointments(Array.isArray(data) ? data : []));
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAgents(list);
        setVisibleAgents(new Set(list.map((a: Agent) => a.id)));
      });
  }, [selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Update markers/routes when data changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;

      // Clear old layers
      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      const filteredAppts = appointments.filter(
        (a) => a.agent_id && visibleAgents.has(a.agent_id) && a.lat && a.lng
      );

      // Group by agent
      const byAgent: Record<string, Appointment[]> = {};
      filteredAppts.forEach((a) => {
        if (!a.agent_id) return;
        if (!byAgent[a.agent_id]) byAgent[a.agent_id] = [];
        byAgent[a.agent_id].push(a);
      });

      Object.entries(byAgent).forEach(([agentId, appts]) => {
        const agent = agents.find((a) => a.id === agentId);
        const color = agent?.color_hex || '#f97316';

        appts.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

        // Numbered circle markers
        appts.forEach((a, idx) => {
          if (!a.lat || !a.lng) return;
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:28px;height:28px;background:${color};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);color:white;font-size:12px;font-weight:bold;">${idx + 1}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const customerName = a.customer
            ? `${a.customer.first_name} ${a.customer.last_name}`
            : 'Appointment';
          const vehicleInfo = a.vehicle
            ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}`
            : '';

          const marker = L.marker([a.lat, a.lng], { icon })
            .bindTooltip(`${a.scheduled_time.slice(0, 5)} — ${customerName}<br/>${vehicleInfo}`, {
              direction: 'top',
              offset: [0, -14],
            })
            .addTo(map);

          marker.on('click', () => setSelectedAppt(a));
          layersRef.current.push(marker);
        });

        // Route polyline: base → each stop
        const routePoints: [number, number][] = [
          [BASE_LOCATION.lat, BASE_LOCATION.lng],
          ...appts.filter(a => a.lat && a.lng).map((a) => [a.lat!, a.lng!] as [number, number]),
        ];

        const polyline = L.polyline(routePoints, {
          color,
          weight: 3,
          opacity: 0.7,
          dashArray: '6, 4',
        }).addTo(map);
        layersRef.current.push(polyline);
      });
    });
  }, [appointments, agents, visibleAgents, mapReady]);

  const toggleAgent = (id: string) => {
    setVisibleAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupedByAgent: Record<string, Appointment[]> = {};
  appointments
    .filter((a) => a.agent_id && visibleAgents.has(a.agent_id))
    .forEach((a) => {
      if (!a.agent_id) return;
      if (!groupedByAgent[a.agent_id]) groupedByAgent[a.agent_id] = [];
      groupedByAgent[a.agent_id].push(a);
    });

  return (
    <div className="flex flex-col lg:flex-row gap-4 -m-4 lg:-m-6 h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Leaflet CSS */}
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { font-family: inherit; }
      `}</style>

      {/* Sidebar */}
      <div className="w-full lg:w-80 p-4 lg:p-6 overflow-y-auto bg-white border-r border-gray-100 flex-shrink-0">
        <h1 className="text-xl font-bold text-navy mb-4">Map View</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
        />

        {/* Agent legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                visibleAgents.has(agent.id)
                  ? 'border-transparent text-white'
                  : 'border-gray-200 text-gray-400 bg-gray-50'
              }`}
              style={visibleAgents.has(agent.id) ? { backgroundColor: agent.color_hex } : {}}
            >
              {agent.name}
            </button>
          ))}
        </div>

        {/* Appointment list by agent */}
        {Object.entries(groupedByAgent).map(([agentId, appts]) => {
          const agent = agents.find((a) => a.id === agentId);
          return (
            <div key={agentId} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: agent?.color_hex }} />
                <span className="text-sm font-semibold">{agent?.name}</span>
              </div>
              {appts.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAppt(a)}
                  className={`w-full text-left p-2 rounded-lg mb-1 text-xs border transition-colors ${
                    selectedAppt?.id === a.id ? 'border-orange bg-orange/5' : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">
                    {a.scheduled_time.slice(0, 5)} —{' '}
                    {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : 'Unknown'}
                  </div>
                  <div className="text-gray-500">
                    {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : ''}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />

        {/* Selected appointment info panel */}
        {selectedAppt && (
          <div className="absolute top-4 right-4 bg-white rounded-xl shadow-lg border border-gray-100 p-4 w-72" style={{ zIndex: 1000 }}>
            <button
              onClick={() => setSelectedAppt(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
            <h3 className="font-semibold text-sm pr-6">
              {selectedAppt.customer
                ? `${selectedAppt.customer.first_name} ${selectedAppt.customer.last_name}`
                : 'Unknown'}
            </h3>
            {selectedAppt.vehicle && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedAppt.vehicle.year} {selectedAppt.vehicle.make} {selectedAppt.vehicle.model}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">{selectedAppt.scheduled_time.slice(0, 5)}</p>
            {selectedAppt.address && (
              <p className="text-xs text-gray-400 mt-1">{selectedAppt.address}</p>
            )}
            <div className="mt-2">
              <StatusBadge status={selectedAppt.status} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
