import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: true,
    error: null,
  });

  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 300000, // 5 minutes cache
  } = options;

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          loading: false,
          error: null,
        });
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { ...state, refresh: requestLocation };
}

// Haversine formula to calculate distance between two points
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Calculate delivery fee based on distance
// Base fee: ₹15, per km: ₹5
export function calculateDeliveryFee(distanceKm: number): number {
  const baseFee = 15;
  const perKmRate = 5;
  const fee = baseFee + Math.ceil(distanceKm) * perKmRate;
  return Math.min(fee, 99); // Cap at ₹99
}

// Estimate delivery time based on distance
export function estimateDeliveryTime(distanceKm: number): string {
  const baseTime = 15; // mins for preparation
  const speedKmPerMin = 0.5; // avg speed 30 km/h = 0.5 km/min
  const travelTime = Math.ceil(distanceKm / speedKmPerMin);
  const totalMin = baseTime + travelTime;
  
  if (totalMin <= 20) return '10-20 min';
  if (totalMin <= 30) return '20-30 min';
  if (totalMin <= 45) return '30-45 min';
  if (totalMin <= 60) return '45-60 min';
  return '60+ min';
}

// Format distance for display
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
