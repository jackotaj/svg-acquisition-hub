'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string; house_number?: string; city?: string; town?: string;
    state?: string; postcode?: string;
  };
}

interface AddressSearchProps {
  value: string;
  onChange: (address: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
}

function formatShort(r: NominatimResult): string {
  const a = r.address;
  if (!a) return r.display_name.split(',').slice(0, 3).join(',');
  const parts: string[] = [];
  if (a.house_number && a.road) parts.push(`${a.house_number} ${a.road}`);
  else if (a.road) parts.push(a.road);
  if (a.city || a.town) parts.push(a.city || a.town || '');
  if (a.state) parts.push(a.state);
  return parts.join(', ') || r.display_name.split(',').slice(0, 3).join(',');
}

export default function AddressSearch({ value, onChange, placeholder }: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 4) { setResults([]); setOpen(false); return; }
    if (selected && query === selected.label) return; // already resolved

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1&countrycodes=us`,
          { headers: { 'Accept-Language': 'en-US' } }
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch { /* ignore */ }
      setLoading(false);
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (r: NominatimResult) => {
    const label = formatShort(r);
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setQuery(label);
    setSelected({ lat, lng, label });
    setResults([]);
    setOpen(false);
    onChange(label, lat, lng);
  };

  const clear = () => {
    setQuery('');
    setSelected(null);
    onChange('', null, null);
  };

  const mapUrl = selected
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.lng - 0.012},${selected.lat - 0.012},${selected.lng + 0.012},${selected.lat + 0.012}&layer=mapnik&marker=${selected.lat},${selected.lng}`
    : null;

  const inputCls = 'w-full border border-card-border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange bg-card text-foreground placeholder:text-muted';

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); onChange(e.target.value, null, null); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className={`${inputCls} pl-9 pr-9`}
          placeholder={placeholder || 'Search address or location…'}
          autoComplete="off"
        />
        {loading && (
          <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
        )}
        {!loading && query && (
          <button type="button" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl shadow-lg border border-card-border bg-card overflow-hidden"
          style={{ maxWidth: '100%' }}>
          {results.map(r => (
            <button key={r.place_id} type="button" onMouseDown={() => pick(r)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted-bg transition-colors flex items-start gap-2.5 border-b border-card-border last:border-0">
              <MapPin size={14} className="text-orange flex-shrink-0 mt-0.5" />
              <span className="text-foreground line-clamp-1">{formatShort(r)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Map preview */}
      {selected && mapUrl && (
        <div className="rounded-xl overflow-hidden border border-card-border" style={{ height: 180 }}>
          <iframe
            src={mapUrl}
            width="100%"
            height="180"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            title="Location preview"
          />
        </div>
      )}

      {/* Lat/lng badge */}
      {selected && (
        <div className="text-xs text-muted flex items-center gap-1.5">
          <MapPin size={11} className="text-orange" />
          <span>{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} — coordinates saved for routing</span>
        </div>
      )}
    </div>
  );
}
