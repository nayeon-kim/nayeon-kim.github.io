/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { motion } from 'motion/react';
import { Search, Navigation, MapPin, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { calculateSweepingStatus, SweepingSchedule, StatusResult } from './lib/sweeping-logic';
import { cn } from './lib/utils';

const SF_CENTER = { lat: 37.7749, lng: -122.4194 };
const MAP_OPTIONS = {
  disableDefaultUI: true,
  clickableIcons: false,
  styles: [
    {
      featureType: "all",
      elementType: "labels.text.fill",
      stylers: [{ color: "#747474" }]
    },
    {
      featureType: "poi",
      elementType: "all",
      stylers: [{ visibility: "off" }]
    },
    {
      featureType: "transit",
      elementType: "all",
      stylers: [{ visibility: "off" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }]
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#e9e9e9" }]
    }
  ]
};

function normalizeStreetValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bterrace\b/g, 'ter')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStreetName(value: string): string | null {
  const firstSegment = value.split(',')[0]?.trim();
  if (!firstSegment) return null;

  return normalizeStreetValue(firstSegment.replace(/^\d+\s+/, '').trim());
}

function extractStreetNumber(value: string): number | null {
  const match = value.match(/^\s*(\d+)/);
  if (!match) return null;

  return Number.parseInt(match[1], 10);
}

function normalizeSideValue(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function getPreferredSides(streetNumber: number | null): string[] {
  if (streetNumber === null) return [];

  return streetNumber % 2 === 0 ? ['north', 'east'] : ['south', 'west'];
}

function getDistanceValue(row: SweepingSchedule): number {
  const parsed = Number.parseFloat(row.distance_m || '');
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function describeWeeks(schedule: SweepingSchedule): string {
  const activeWeeks = [1, 2, 3, 4, 5].filter((weekNum) => {
    const value = (schedule as Record<string, string>)[`week${weekNum}`];
    return value === 'Y' || value === '1';
  });

  return activeWeeks.length ? activeWeeks.join('/') : 'none';
}

export default function App() {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || '',
    libraries: ['places']
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPos, setMarkerPos] = useState(SF_CENTER);
  const [address, setAddress] = useState('');
  const [queriedAddress, setQueriedAddress] = useState('San Francisco, CA');
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    point: string;
    url: string;
    totalRows: number;
    selectedStreet: string;
    selectedCnn: string;
    selectedSide: string;
    cnnCounts: string[];
    rankedCandidates: string[];
    selectedSchedules: string[];
    statusSummary: string[];
    sampleRows: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const formatLatLngLabel = useCallback((lat: number, lng: number) => {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }, []);

  const simplifyAddress = useCallback((value: string) => {
    const parts = value.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length <= 1) return value;

    const trimmed = parts.filter((part, index) => {
      if (index === parts.length - 1 && /^(usa|us|united states|united states of america)$/i.test(part)) {
        return false;
      }

      return true;
    }).map((part, index, arr) => {
      if (index === arr.length - 1) {
        return part.replace(/\s+\d{5}(?:-\d{4})?$/, '').trim();
      }

      return part;
    });

    return trimmed.join(', ');
  }, []);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!window.google?.maps?.Geocoder) {
      setQueriedAddress(formatLatLngLabel(lat, lng));
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results.length > 0) {
        setQueriedAddress(simplifyAddress(results[0].formatted_address));
        return;
      }

      setQueriedAddress(formatLatLngLabel(lat, lng));
    });
  }, [formatLatLngLabel, simplifyAddress]);

  const selectBestSchedules = useCallback((rows: SweepingSchedule[], addressLabel: string) => {
    const selectedStreet = extractStreetName(addressLabel);
    const streetNumber = extractStreetNumber(addressLabel);
    const preferredSides = getPreferredSides(streetNumber);

    const streetMatchedRows = selectedStreet
      ? rows.filter((row) => normalizeStreetValue(row.corridor || '') === selectedStreet)
      : rows;

    const candidateRows = streetMatchedRows.length ? streetMatchedRows : rows;
    const candidateMap = new Map<string, {
      rows: SweepingSchedule[];
      score: number;
      bestDistance: number;
      reasons: string[];
      seenRows: Set<string>;
    }>();

    candidateRows.forEach((row, index) => {
      const side = normalizeSideValue(row.blockside || row.cnnrightleft);
      const candidateKey = `${row.cnn}::${side || 'unknown'}`;
      const rowKey = [
        row.weekday,
        row.fromhour,
        row.tohour,
        row.week1,
        row.week2,
        row.week3,
        row.week4,
        row.week5,
      ].join('|');
      const existing = candidateMap.get(candidateKey) || {
        rows: [],
        score: 0,
        bestDistance: Number.POSITIVE_INFINITY,
        reasons: [],
        seenRows: new Set<string>(),
      };

      if (!existing.seenRows.has(rowKey)) {
        existing.rows.push(row);
        existing.seenRows.add(rowKey);
      }

      const distance = getDistanceValue(row);
      if (distance < existing.bestDistance) {
        existing.bestDistance = distance;
      }

      if (selectedStreet && normalizeStreetValue(row.corridor || '') === selectedStreet) {
        if (!existing.reasons.includes('street match')) existing.reasons.push('street match');
      }

      if (preferredSides.includes(side)) {
        if (!existing.reasons.includes('address parity side')) existing.reasons.push('address parity side');
      }

      candidateMap.set(candidateKey, existing);
    });

    const rankedCandidates = Array.from(candidateMap.entries())
      .map(([key, value]) => {
        const sample = value.rows[0];
        const side = normalizeSideValue(sample.blockside || sample.cnnrightleft);
        let score = 0;

        if (selectedStreet && normalizeStreetValue(sample.corridor || '') === selectedStreet) {
          score += 1000;
        }

        if (preferredSides.includes(side)) {
          score += 250;
        }

        score += Math.max(0, 200 - Math.round(value.bestDistance));

        return { key, ...value, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.bestDistance - b.bestDistance;
      });

    const selectedCandidate = rankedCandidates[0] || null;

    return {
      selectedStreet: selectedStreet || 'none',
      selectedCnn: selectedCandidate ? selectedCandidate.rows[0].cnn : 'none',
      selectedSide: selectedCandidate ? (selectedCandidate.rows[0].blockside || selectedCandidate.rows[0].cnnrightleft || 'unknown') : 'unknown',
      rankedCandidates: rankedCandidates.slice(0, 6).map((candidate) => {
        const sample = candidate.rows[0];
        return `${sample.corridor || 'Unknown'} | CNN ${sample.cnn} | ${sample.blockside || sample.cnnrightleft || 'unknown'} | score ${candidate.score} | ${candidate.bestDistance.toFixed(1)}m | ${candidate.reasons.join(', ') || 'distance rank only'}`;
      }),
      schedules: selectedCandidate ? selectedCandidate.rows : candidateRows,
    };
  }, []);

  const fetchSweepingData = useCallback(async (lat: number, lng: number, addressLabel?: string) => {
    setLoading(true);
    setDebugInfo(null);
    console.log(`Fetching sweeping data for: ${lat}, ${lng}`);
    try {
      // Query the street sweeping dataset directly by distance to the schedule line.
      // This avoids relying on older centerline dataset IDs that may disappear over time.
      const sweepingParams = new URLSearchParams({
        '$select': 'cnn,corridor,limits,cnnrightleft,blockside,weekday,fromhour,tohour,week1,week2,week3,week4,week5,holidays,distance_in_meters(line,\'POINT(' + lng + ' ' + lat + ')\') as distance_m',
        '$where': `distance_in_meters(line,'POINT(${lng} ${lat})')<150`,
        '$order': `distance_in_meters(line,'POINT(${lng} ${lat})')`,
        '$limit': '50'
      });
      const sweepingUrl = `https://data.sfgov.org/resource/yhqp-riqs.json?${sweepingParams.toString()}`;
      const sweepingRes = await fetch(sweepingUrl);

      if (!sweepingRes.ok) {
        throw new Error(`Sweeping API failed: ${sweepingRes.status}`);
      }

      const sweepingData: SweepingSchedule[] = await sweepingRes.json();
      console.log('Sweeping Schedule Data:', sweepingData);

      const selection = selectBestSchedules(sweepingData, addressLabel || formatLatLngLabel(lat, lng));

      const cnnCounts = Array.from(
        sweepingData.reduce((map, row) => {
          const key = `${row.cnn} (${row.blockside || row.cnnrightleft || 'n/a'})`;
          map.set(key, (map.get(key) || 0) + 1);
          return map;
        }, new Map<string, number>())
      )
        .map(([key, count]) => `${key}: ${count}`)
        .slice(0, 6);

      const sampleRows = sweepingData.slice(0, 8).map((row) =>
        `${row.corridor || 'Unknown'} | ${row.limits || 'No limits'} | CNN ${row.cnn} | ${row.blockside || row.cnnrightleft || 'n/a'} | ${row.weekday} ${row.fromhour}-${row.tohour} | weeks ${describeWeeks(row)} | ${row.distance_m || '?'}m`
      );

      const selectedSchedules = selection.schedules.map((row) =>
        `${row.corridor || 'Unknown'} | ${row.limits || 'No limits'} | CNN ${row.cnn} | ${row.blockside || row.cnnrightleft || 'n/a'} | ${row.weekday} ${row.fromhour}-${row.tohour} | weeks ${describeWeeks(row)}`
      );

      const nextStatus = calculateSweepingStatus(new Date(), selection.schedules);

      setDebugInfo({
        point: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        url: sweepingUrl,
        totalRows: sweepingData.length,
        selectedStreet: selection.selectedStreet,
        selectedCnn: selection.selectedCnn,
        selectedSide: selection.selectedSide,
        cnnCounts,
        rankedCandidates: selection.rankedCandidates,
        selectedSchedules,
        statusSummary: nextStatus.debugSummary || [],
        sampleRows,
      });

      if (!Array.isArray(sweepingData) || sweepingData.length === 0) {
        setStatus({
          status: 'GREEN',
          message: 'No sweeping data for this block',
          nextDate: null,
          window: 'Try a nearby curb or different street segment',
          countdown: ''
        });
        return;
      }

      // Calculate status from a single best-matching block/side instead of mixing nearby segments.
      setStatus(nextStatus);
    } catch (error) {
      console.error('Full Error Context:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus({
        status: 'GREEN',
        message: 'Connection Error',
        nextDate: null,
        window: `Details: ${errorMsg}`,
        countdown: ''
      });
      setDebugInfo({
        point: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        url: 'Request failed before debug rows were available',
        totalRows: 0,
        selectedStreet: 'n/a',
        selectedCnn: 'n/a',
        selectedSide: 'n/a',
        cnnCounts: [],
        rankedCandidates: [],
        selectedSchedules: [],
        statusSummary: [],
        sampleRows: [errorMsg],
      });
    } finally {
      setLoading(false);
    }
  }, [formatLatLngLabel, selectBestSchedules]);

  const applySelectedLocation = useCallback((lat: number, lng: number, displayAddress?: string) => {
    const resolvedAddress = displayAddress || formatLatLngLabel(lat, lng);
    const newPos = { lat, lng };

    setAddress(resolvedAddress);
    setQueriedAddress(resolvedAddress);
    setMarkerPos(newPos);
    map?.panTo(newPos);
    map?.setZoom(18);
    fetchSweepingData(lat, lng, resolvedAddress);
  }, [fetchSweepingData, formatLatLngLabel, map]);

  const geocodeTypedAddress = useCallback((rawAddress: string) => {
    const trimmedAddress = rawAddress.trim();
    if (!trimmedAddress || !window.google?.maps?.Geocoder) {
      setSearchStatus(trimmedAddress ? 'Search unavailable' : 'Enter an address to search');
      return;
    }

    setSearchStatus(`Searching for ${trimmedAddress}...`);
    const geocoder = new window.google.maps.Geocoder();
    const searchAddress = /san francisco/i.test(trimmedAddress)
      ? trimmedAddress
      : `${trimmedAddress}, San Francisco, CA`;

    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === 'OK' && results && results[0]?.geometry?.location) {
        const location = results[0].geometry.location;
        const displayAddress = simplifyAddress(results[0].formatted_address || searchAddress);
        setSearchStatus(`Showing ${displayAddress}`);
        applySelectedLocation(location.lat(), location.lng(), displayAddress);
        return;
      }

      setSearchStatus(`Search failed: ${status}`);
    });
  }, [applySelectedLocation, simplifyAddress]);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setMarkerPos(newPos);
      reverseGeocode(newPos.lat, newPos.lng);
      fetchSweepingData(newPos.lat, newPos.lng, formatLatLngLabel(newPos.lat, newPos.lng));
    }
  }, [fetchSweepingData, formatLatLngLabel, reverseGeocode]);

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const displayAddress = simplifyAddress(
          place.formatted_address ||
          place.name ||
          formatLatLngLabel(place.geometry.location.lat(), place.geometry.location.lng())
        );
        applySelectedLocation(place.geometry.location.lat(), place.geometry.location.lng(), displayAddress);
        return;
      }
    }

    geocodeTypedAddress(address);
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPos(newPos);
        reverseGeocode(newPos.lat, newPos.lng);
        map?.panTo(newPos);
        map?.setZoom(18);
        fetchSweepingData(newPos.lat, newPos.lng, formatLatLngLabel(newPos.lat, newPos.lng));
      });
    }
  };

  useEffect(() => {
    // Initial fetch
    reverseGeocode(SF_CENTER.lat, SF_CENTER.lng);
    fetchSweepingData(SF_CENTER.lat, SF_CENTER.lng, 'San Francisco, CA');
  }, [fetchSweepingData, reverseGeocode]);

  const statusContent = loading ? (
    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Checking schedules...</p>
    </div>
  ) : status ? (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-400">{queriedAddress}</p>
          <h2 className="mb-1 text-3xl font-bold tracking-tight">
            {status.status === 'RED' ? 'Move Your Car' :
             status.status === 'ORANGE' ? 'Move Soon' : 'Safe to Park'}
          </h2>
          <p className={cn(
            "text-lg font-semibold flex items-center gap-2",
            status.status === 'RED' ? "text-red-600" :
            status.status === 'ORANGE' ? "text-orange-500" : "text-emerald-600"
          )}>
            {status.status === 'RED' ? <AlertTriangle className="w-5 h-5" /> :
             status.status === 'ORANGE' ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {status.message}
          </p>
        </div>

        <div className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl",
          status.status === 'RED' ? "bg-red-50 text-red-600" :
          status.status === 'ORANGE' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
        )}>
          <MapPin className="h-8 w-8" />
        </div>
      </div>

      <div className="rounded-2xl bg-gray-50 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">Next Cleaning</p>
        <div className="flex items-end justify-between gap-4">
          <p className="text-sm font-bold text-gray-800">
            {status.nextDate ? status.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
          </p>
          <p className="text-sm font-semibold text-gray-500">{status.countdown || 'N/A'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="mb-2 flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-600" />
          <p className="font-bold text-blue-900">Cleaning Window</p>
        </div>
        <p className="font-medium text-blue-800">{status.window}</p>
      </div>

      {debugInfo ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Debug</p>
          <div className="space-y-2 text-xs text-amber-900">
            <p><span className="font-semibold">Point:</span> {debugInfo.point}</p>
            <p><span className="font-semibold">Rows returned:</span> {debugInfo.totalRows}</p>
            <p className="break-all"><span className="font-semibold">URL:</span> {debugInfo.url}</p>
            <p><span className="font-semibold">Selected street:</span> {debugInfo.selectedStreet}</p>
            <p><span className="font-semibold">Selected CNN:</span> {debugInfo.selectedCnn}</p>
            <p><span className="font-semibold">Selected side:</span> {debugInfo.selectedSide}</p>
            {debugInfo.cnnCounts.length ? (
              <div>
                <p className="font-semibold">CNN groups</p>
                {debugInfo.cnnCounts.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
            {debugInfo.rankedCandidates.length ? (
              <div>
                <p className="font-semibold">Ranked candidates</p>
                {debugInfo.rankedCandidates.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
            {debugInfo.selectedSchedules.length ? (
              <div>
                <p className="font-semibold">Selected schedules</p>
                {debugInfo.selectedSchedules.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
            {debugInfo.statusSummary.length ? (
              <div>
                <p className="font-semibold">Chosen next event</p>
                {debugInfo.statusSummary.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
            {debugInfo.sampleRows.length ? (
              <div>
                <p className="font-semibold">Sample rows</p>
                {debugInfo.sampleRows.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  if (loadError || !googleMapsApiKey) {
    const errorTitle = googleMapsApiKey ? 'Google Maps Failed to Load' : 'Google Maps API Key Required';
    const errorBody = googleMapsApiKey
      ? 'The app found a Google Maps API key, but Google Maps could not load it for this page.'
      : 'To use SF Sweep, you must add a Google Maps API key as VITE_GOOGLE_MAPS_API_KEY.';

    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-red-50 p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-600 mb-4" />
        <h1 className="text-xl font-bold text-red-900 mb-2">{errorTitle}</h1>
        <p className="text-red-700 max-w-md">
          {errorBody}
        </p>
        {loadError ? (
          <div className="mt-4 max-w-md rounded-2xl bg-white/70 p-4 text-left text-sm text-red-800 shadow-sm">
            <p className="font-bold">Google Maps error</p>
            <p className="mt-1 break-words">{loadError.message}</p>
            <p className="mt-3 break-all text-xs text-red-700">Origin: {window.location.origin}</p>
          </div>
        ) : null}
        <a 
          href="https://developers.google.com/maps/documentation/javascript/get-api-key" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-6 px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
        >
          Get API Key
        </a>
      </div>
    );
  }

  if (!isLoaded) return <div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading SF Sweep...</div>;

  return (
    <div className="h-screen w-full overflow-hidden bg-white font-sans text-gray-900 md:relative">
      {/* Search Overlay */}
      <form
        className="absolute top-4 left-4 right-4 z-10 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          geocodeTypedAddress(address);
        }}
      >
        <div className="relative flex-1">
          <Autocomplete
            onLoad={ref => autocompleteRef.current = ref}
            onPlaceChanged={onPlaceChanged}
            options={{ componentRestrictions: { country: 'us' }, bounds: { north: 37.85, south: 37.70, east: -122.35, west: -122.55 } }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search SF address..."
                className="w-full pl-10 pr-4 py-3 bg-white border-none rounded-2xl shadow-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </Autocomplete>
        </div>
        <button
          type="button"
          onClick={() => geocodeTypedAddress(address)}
          className="p-3 bg-white rounded-2xl shadow-xl active:scale-95 transition-transform"
          aria-label="Search address"
        >
          <Search className="w-5 h-5 text-gray-700" />
        </button>
        <button 
          type="button"
          onClick={handleLocate}
          className="p-3 bg-white rounded-2xl shadow-xl active:scale-95 transition-transform"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>
      </form>

      {searchStatus ? (
        <div className="absolute left-4 right-4 top-[4.75rem] z-10 rounded-2xl bg-white/90 px-4 py-2 text-xs font-medium text-gray-600 shadow-lg backdrop-blur-sm md:left-4 md:right-auto md:max-w-sm">
          {searchStatus}
        </div>
      ) : null}

      {/* Map Section */}
      <div className="relative h-[calc(100vh-19rem)] min-h-[18rem] w-full md:h-full">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={SF_CENTER}
          zoom={14}
          onLoad={setMap}
          onClick={onMapClick}
          options={MAP_OPTIONS}
        >
          <Marker 
            position={markerPos} 
            animation={google.maps.Animation.DROP}
          />
        </GoogleMap>
      </div>

      {/* Mobile Status Sheet */}
      <motion.div 
        className="relative z-20 flex max-h-[55vh] flex-col overflow-y-auto rounded-t-[32px] bg-white px-6 pt-8 pb-10 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] md:hidden"
        initial={false}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-gray-200" />
        <div>{statusContent}</div>
      </motion.div>

      {/* Desktop Floating Status Card */}
      <div className="pointer-events-none absolute inset-x-6 bottom-6 z-20 hidden md:flex md:justify-end">
        <div className="pointer-events-auto w-full max-w-md rounded-[28px] bg-white/94 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.16)] backdrop-blur-sm">
          {statusContent}
        </div>
      </div>
    </div>
  );
}
