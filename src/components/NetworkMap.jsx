import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';

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

/**
 * An offline, Natural Earth world outline. No map tiles or visitor coordinates
 * are requested from a third party. Points come only from the explicit IP
 * context lookup and remain approximate network-provider estimates.
 */
export default function NetworkMap({ results = [], compact = false }) {
  const markers = results.map((item, index) => ({ item, index })).filter(({ item }) => hasApproximateCoordinates(item));
  const geography = useMemo(() => {
    const land = feature(world, world.objects.countries);
    const projection = geoNaturalEarth1().fitExtent([[20, 20], [940, 480]], land);
    const path = geoPath(projection);
    return {
      projection,
      land: path(land),
      borders: path(mesh(world, world.objects.countries, (a, b) => a !== b)),
      graticule: path(geoGraticule10()),
    };
  }, []);

  if (!markers.length) {
    return (
      <div className={`network-map network-map--empty ${compact ? 'network-map--compact' : ''}`} role="status">
        <MapPin size={20} />
        <div>
          <strong>No approximate map point is available</strong>
          <p>Run the network-context lookup. A marker is shown only when the provider returns valid latitude and longitude; IP evidence is still retained without a map point.</p>
        </div>
      </div>
    );
  }

  return (
    <figure className={`network-map ${compact ? 'network-map--compact' : ''}`}>
      <svg viewBox="0 0 960 500" role="img" aria-label={`Approximate network-location map with ${markers.length} IP marker${markers.length === 1 ? '' : 's'}`}>
        <defs>
          <linearGradient id="spandr-map-ocean" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f8f5" />
            <stop offset="1" stopColor="#e8f0eb" />
          </linearGradient>
          <filter id="spandr-map-shadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#5f3628" floodOpacity=".24" />
          </filter>
        </defs>
        <rect x="0" y="0" width="960" height="500" rx="22" fill="url(#spandr-map-ocean)" />
        <path d={geography.graticule} className="network-map__graticule" />
        <path d={geography.land} className="network-map__land" />
        <path d={geography.borders} className="network-map__borders" />
        {markers.map(({ item, index }) => {
          const point = geography.projection([coordinate(item, 'longitude'), coordinate(item, 'latitude')]);
          if (!point) return null;
          const place = approximatePlace(item) || 'Approximate provider location';
          return (
            <g key={`${item.ip}-${index}`} transform={`translate(${point[0]}, ${point[1]})`} className="network-map__marker" filter="url(#spandr-map-shadow)">
              <title>{`${item.ip}: ${place}. Approximate network context, not an exact sender location.`}</title>
              <circle r="15" className="network-map__marker-ring" />
              <circle r="10" className="network-map__marker-dot" />
              <text textAnchor="middle" dominantBaseline="central">{index + 1}</text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span><i /> Numbered markers correspond to the IP evidence list.</span>
        <span>Approximate provider estimates · not a geographic relay route or exact sender location</span>
      </figcaption>
    </figure>
  );
}
