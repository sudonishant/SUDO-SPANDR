import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function coordinate(item, key) {
  const value = item?.[key] ?? item?.approximate_location?.[key];
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function hasApproximateCoordinates(item) {
  const latitude = coordinate(item, 'latitude');
  const longitude = coordinate(item, 'longitude');
  return latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function approximatePlace(item) {
  const location = item?.approximate_location || {};
  const hasProviderPlace = Boolean(location.city || location.region || location.country);
  if (hasProviderPlace) return [location.city, location.region, location.country].filter(Boolean).join(', ');
  // Legacy RDAP-only records used `country` for registration, not geolocation.
  // Reuse top-level place fields only when that legacy record also has a
  // provider coordinate pair; never turn registration country into a map place.
  return hasApproximateCoordinates(item) ? [item?.city, item?.region, item?.country].filter(Boolean).join(', ') : '';
}

function popupContent(item) {
  const container = document.createElement('div');
  container.className = 'network-map-popup';
  const title = document.createElement('strong');
  title.textContent = item.ip || 'Header IP';
  const place = document.createElement('span');
  place.textContent = approximatePlace(item) || 'Approximate provider location';
  const note = document.createElement('small');
  note.textContent = 'Approximate network-provider estimate — not an exact sender location or a geographic relay route.';
  container.append(title, place, note);
  return container;
}

/**
 * Real interactive Leaflet/OpenStreetMap display. No marker is derived from a
 * registration country, analyst/device IP, or guessed relay origin.
 */
export default function NetworkMap({ results = [], compact = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [tileState, setTileState] = useState({ loading: true, loaded: 0, errors: 0 });
  const markers = useMemo(
    () => results.map((item, index) => ({ item, index })).filter(({ item }) => hasApproximateCoordinates(item)),
    [results],
  );

  useEffect(() => {
    if (!markers.length || !containerRef.current) return undefined;
    setTileState({ loading: true, loaded: 0, errors: 0 });
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: !compact,
      worldCopyJump: true,
    });
    mapRef.current = map;
    let loaded = 0;
    let errors = 0;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    tiles.on('tileload', () => {
      loaded += 1;
      setTileState({ loading: false, loaded, errors });
    });
    tiles.on('load', () => setTileState({ loading: false, loaded, errors }));
    tiles.on('tileerror', () => {
      errors += 1;
      setTileState({ loading: false, loaded, errors });
    });
    tiles.addTo(map);

    const points = [];
    markers.forEach(({ item, index }) => {
      const point = [coordinate(item, 'latitude'), coordinate(item, 'longitude')];
      points.push(point);
      const icon = L.divIcon({
        className: 'network-map-div-icon',
        html: `<span>${index + 1}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });
      L.marker(point, { icon, keyboard: true, title: `${item.ip}: approximate provider location` })
        .addTo(map)
        .bindPopup(popupContent(item), { maxWidth: 280 });
    });
    if (points.length === 1) map.setView(points[0], 8);
    else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 8 });

    const resize = () => map.invalidateSize();
    const frame = window.requestAnimationFrame(resize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer && containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [markers, compact]);

  if (!markers.length) {
    return (
      <div className={`network-map network-map--empty ${compact ? 'network-map--compact' : ''}`} role="status">
        <MapPin size={20} />
        <div>
          <strong>No approximate map point is available</strong>
          <p>Run the network-context lookup. A marker is shown only when the provider returns valid latitude and longitude; IP evidence is still retained without a map point. No OpenStreetMap request is made without a valid marker.</p>
        </div>
      </div>
    );
  }

  const tileMessage = tileState.errors
    ? tileState.loaded
      ? 'Some OpenStreetMap tiles could not be loaded. Remaining tiles and numbered markers may still be visible.'
      : 'OpenStreetMap tiles are unavailable. The map background may be blank; provider-coordinate markers and the IP evidence list are retained.'
    : tileState.loading ? 'Loading OpenStreetMap tiles…' : '';

  return (
    <figure className={`network-map network-map--leaflet ${compact ? 'network-map--compact' : ''}`}>
      <div className="network-map__privacy">
        <MapPin size={14} />
        <p><strong>Third-party map request:</strong> displaying this real map loads tiles from OpenStreetMap. That service can receive your browser IP, request metadata and the requested tile/map area. Marker positions remain approximate provider estimates, not exact sender locations.</p>
      </div>
      <div className="network-map__canvas-wrap">
        <div ref={containerRef} className="network-map__canvas" role="region" aria-label={`Interactive OpenStreetMap with ${markers.length} approximate IP marker${markers.length === 1 ? '' : 's'}`} />
        {tileMessage ? <div className={`network-map__tile-status ${tileState.errors ? 'is-error' : ''}`} role="status">{tileMessage}</div> : null}
      </div>
      <figcaption>
        <span><i /> Numbered markers correspond to the IP evidence list. No geographic relay route is drawn.</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      </figcaption>
    </figure>
  );
}
