'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MapPin, Phone, Navigation, ExternalLink, Clock } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { BASE_LOCATION } from '@/lib/types';
import type { Appointment, Agent } from '@/lib/types';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMapRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!API_KEY || API_KEY === 'REPLACE_WITH_REAL_KEY') {
      setNoKey(true);
      return;
    }
    setOptions({ key: API_KEY, v: 'weekly' });
    (async () => {
      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
      await importLibrary('marker');
      await importLibrary('routes');
      if (mapRef.current && !mapInstanceRef.current) {
        mapInstanceRef.current = new Map(mapRef.current, {
          center: { lat: BASE_LOCATION.lat, lng: BASE_LOCATION.lng },
          zoom: 10,
        });
        // Base marker (star)
        new google.maps.Marker({
          map: mapInstanceRef.current,
          position: { lat: BASE_LOCATION.lat, lng: BASE_LOCATION.lng },
          title: 'BCK Base — 3415 Seajay Dr',
          label: { text: '★', color: '#f97316', fontSize: '20px' },
          zIndex: 999,
        });
        setMapReady(true);
      }
    })();
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update map markers/routes when data or visibility changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old markers, polylines, and direction renderers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markerMapRef.current.clear();
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    directionsRenderersRef.current.forEach((r) => r.setMap(null));
    directionsRenderersRef.current = [];

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

      // Sort by time
      appts.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

      // Create markers
      appts.forEach((a, idx) => {
        const marker = new google.maps.Marker({
          map,
          position: { lat: a.lat!, lng: a.lng! },
          title: a.customer
            ? `${a.customer.first_name} ${a.customer.last_name}`
            : 'Appointment',
          label: {
            text: String(idx + 1),
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 'bold',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          zIndex: idx + 1,
        });
        marker.addListener('click', () => {
          setSelectedAppt(a);
          mapInstanceRef.current?.panTo({ lat: a.lat!, lng: a.lng! });
          mapInstanceRef.current?.setZoom(14);
        });
        markersRef.current.push(marker);
        markerMapRef.current.set(a.id, marker);
      });

      // Draw road route using Directions API
      if (appts.length > 0) {
        const directionsService = new google.maps.DirectionsService();
        const renderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true, // we draw our own numbered markers
          polylineOptions: {
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 4,
          },
        });
        directionsRenderersRef.current.push(renderer);

        // Route: Base → all stops → back to Base
        const origin = { lat: BASE_LOCATION.lat, lng: BASE_LOCATION.lng };
        const destination = { lat: BASE_LOCATION.lat, lng: BASE_LOCATION.lng };
        const waypoints = appts.map((a) => ({
          location: { lat: a.lat!, lng: a.lng! },
          stopover: true,
        }));

        directionsService.route(
          {
            origin,
            destination,
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              renderer.setDirections(result);
            }
          }
        );
      }
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

  // Group appointments by agent for sidebar (include all statuses for visibility)
  const groupedByAgent: Record<string, Appointment[]> = {};
  appointments
    .filter((a) => a.agent_id && visibleAgents.has(a.agent_id))
    .forEach((a) => {
      if (!a.agent_id) return;
      if (!groupedByAgent[a.agent_id]) groupedByAgent[a.agent_id] = [];
      groupedByAgent[a.agent_id].push(a);
    });

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    appraising: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-500',
    arrived: 'bg-green-100 text-green-700',
  };

  if (noKey) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-navy mb-4">Map View</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Google Maps API Key Required
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
            To enable the map view, add a valid Google Maps API key to your{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
              .env.local
            </code>{' '}
            file:
          </p>
          <pre className="bg-gray-50 text-left text-xs p-4 rounded-lg inline-block">
            NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_api_key_here
          </pre>
          <p className="text-gray-400 text-xs mt-4">
            Enable Maps JavaScript API and Distance Matrix API in Google Cloud
            Console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 -m-4 lg:-m-6 h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Sidebar */}
      <div className="w-full lg:w-80 p-4 lg:p-6 overflow-y-auto bg-white border-r border-gray-100">
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
              style={
                visibleAgents.has(agent.id)
                  ? { backgroundColor: agent.color_hex }
                  : {}
              }
            >
              {agent.name}
            </button>
          ))}
        </div>

        {/* Appointment list by agent */}
        {Object.keys(groupedByAgent).length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No appointments for this date</div>
        )}
        {Object.entries(groupedByAgent).map(([agentId, appts]) => {
          const agent = agents.find((a) => a.id === agentId);
          const activeAppts = appts.filter(a => a.status !== 'cancelled');
          const cancelledAppts = appts.filter(a => a.status === 'cancelled');
          return (
            <div key={agentId} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: agent?.color_hex }} />
                <span className="text-sm font-bold text-navy dark:text-white">{agent?.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{activeAppts.length} stops</span>
              </div>
              {appts
                .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                .map((a) => {
                  const isCancelled = a.status === 'cancelled';
                  const hasCoords = !!(a.lat && a.lng);
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedAppt(a);
                        if (hasCoords && mapInstanceRef.current) {
                          mapInstanceRef.current.panTo({ lat: a.lat!, lng: a.lng! });
                          mapInstanceRef.current.setZoom(15);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-lg mb-1.5 text-xs border transition-colors ${
                        selectedAppt?.id === a.id
                          ? 'border-orange bg-orange/5'
                          : isCancelled
                          ? 'border-gray-100 bg-gray-50 opacity-50'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="font-bold text-gray-600">{a.scheduled_time.slice(0, 5)}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor[a.status] || 'bg-gray-100 text-gray-500'}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="font-semibold text-gray-800 mt-1 truncate">
                        {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : 'Unknown'}
                      </div>
                      <div className="text-gray-400 truncate">
                        {a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : ''}
                      </div>
                      {!hasCoords && !isCancelled && (
                        <div className="text-orange text-xs mt-1">⚠ No coordinates — won&apos;t appear on route</div>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        {/* Info popup */}
        {selectedAppt && (
          <div className="absolute top-4 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-76 z-10" style={{ width: 288 }}>
            <button onClick={() => setSelectedAppt(null)}
              className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 text-xl leading-none">×</button>

            {/* Header */}
            <div className="pr-6">
              <div className="font-bold text-navy text-sm">
                {selectedAppt.customer
                  ? `${selectedAppt.customer.first_name} ${selectedAppt.customer.last_name}`
                  : 'Unknown Customer'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {selectedAppt.vehicle
                  ? `${selectedAppt.vehicle.year} ${selectedAppt.vehicle.make} ${selectedAppt.vehicle.model}`
                  : ''}
              </div>
            </div>

            {/* Time + Status */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-bold text-gray-600">{selectedAppt.scheduled_time.slice(0, 5)}</span>
              <StatusBadge status={selectedAppt.status} />
            </div>

            {/* Address */}
            {selectedAppt.address && (
              <div className="flex items-start gap-1.5 mt-2">
                <MapPin size={12} className="text-orange flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-500">{selectedAppt.address}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <Link href={`/appointments/${selectedAppt.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-orange text-white rounded-lg py-2 text-xs font-semibold hover:bg-orange/90 transition-colors">
                <ExternalLink size={12} />
                View Details
              </Link>
              {selectedAppt.address && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedAppt.address)}&travelmode=driving`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-navy text-white rounded-lg px-3 py-2 text-xs font-semibold hover:bg-navy/90 transition-colors">
                  <Navigation size={12} />
                  Navigate
                </a>
              )}
            </div>

            {/* Click-to-call */}
            {selectedAppt.customer?.phone && (
              <a href={`tel:${selectedAppt.customer.phone}`}
                className="flex items-center gap-2 mt-2 text-xs text-gray-500 hover:text-orange transition-colors">
                <Phone size={12} />
                {selectedAppt.customer.phone}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
