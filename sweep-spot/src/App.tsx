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
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const fetchSweepingData = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    console.log(`Fetching sweeping data for: ${lat}, ${lng}`);
    try {
      // Query the street sweeping dataset directly by distance to the schedule line.
      // This avoids relying on older centerline dataset IDs that may disappear over time.
      const sweepingParams = new URLSearchParams({
        '$select': 'cnn,corridor,limits,cnnrightleft,blockside,weekday,fromhour,tohour,week1,week2,week3,week4,week5,holidays',
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

      // Calculate status from the nearest schedule rows returned by the live dataset.
      const result = calculateSweepingStatus(new Date(), sweepingData);
      setStatus(result);
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
    } finally {
      setLoading(false);
    }
  }, []);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setMarkerPos(newPos);
      fetchSweepingData(newPos.lat, newPos.lng);
    }
  }, [fetchSweepingData]);

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const newPos = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setMarkerPos(newPos);
        map?.panTo(newPos);
        map?.setZoom(18);
        fetchSweepingData(newPos.lat, newPos.lng);
      }
    }
  };

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMarkerPos(newPos);
        map?.panTo(newPos);
        map?.setZoom(18);
        fetchSweepingData(newPos.lat, newPos.lng);
      });
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSweepingData(SF_CENTER.lat, SF_CENTER.lng);
  }, [fetchSweepingData]);

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
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden font-sans text-gray-900">
      {/* Search Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
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
          onClick={handleLocate}
          className="p-3 bg-white rounded-2xl shadow-xl active:scale-95 transition-transform"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>
      </div>

      {/* Map Section (40%) */}
      <div className="h-[45%] w-full relative">
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

      {/* Status Card (60%) */}
      <motion.div 
        className="flex-1 bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-20 relative px-6 pt-8 flex flex-col"
        initial={false}
        animate={{ height: '55%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className="absolute top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-gray-200" />

        <div className="flex flex-col h-full">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-gray-500 font-medium">Checking schedules...</p>
            </div>
          ) : status ? (
            <div className="space-y-6">
              {/* Status Indicator */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight mb-1">
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
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  status.status === 'RED' ? "bg-red-50 text-red-600" :
                  status.status === 'ORANGE' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  <MapPin className="w-8 h-8" />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Next Cleaning</p>
                  <p className="text-sm font-bold text-gray-800">
                    {status.nextDate ? status.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Countdown</p>
                  <p className="text-sm font-bold text-gray-800">{status.countdown || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <p className="font-bold text-blue-900">Cleaning Window</p>
                </div>
                <p className="text-blue-800 font-medium">{status.window}</p>
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
