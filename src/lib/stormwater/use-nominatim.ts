'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NominatimSuggestion {
  place_id: string;
  lat: string;
  lon: string;
  display_name: string;
}

interface UseNominatimOptions {
  restrictCountry?: string;
}

export function useNominatim(options: UseNominatimOptions = {}) {
  const { restrictCountry = 'au' } = options;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const countryParam = restrictCountry ? `&countrycodes=${restrictCountry}` : '';
  const userAgent = 'Quality-Pumps-Stormwater-Calculator/1.0';

  useEffect(() => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}${countryParam}`,
          { headers: { 'User-Agent': userAgent } }
        );
        if (response.ok) {
          const data = (await response.json()) as NominatimSuggestion[];
          setSuggestions(data || []);
        }
      } catch {
        // Silently ignore autocomplete fetch errors
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [query, countryParam]);

  const geocode = useCallback(async () => {
    if (!query.trim()) {
      throw new Error('Please enter an address to search.');
    }

    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}${countryParam}`,
        { headers: { 'User-Agent': userAgent } }
      );

      if (!response.ok) throw new Error('Geocoding service unavailable.');

      const data = (await response.json()) as NominatimSuggestion[];
      if (data && data.length > 0) {
        const firstMatch = data[0];
        setLatitude(parseFloat(firstMatch.lat).toFixed(6));
        setLongitude(parseFloat(firstMatch.lon).toFixed(6));
        return firstMatch;
      }
      throw new Error('No matching coordinates found for the address. Please enter coordinates manually.');
    } finally {
      setIsGeocoding(false);
    }
  }, [query, countryParam]);

  const selectSuggestion = useCallback((item: NominatimSuggestion) => {
    setQuery(item.display_name);
    setLatitude(parseFloat(item.lat).toFixed(6));
    setLongitude(parseFloat(item.lon).toFixed(6));
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  return {
    query,
    setQuery,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    suggestions,
    isSearchingSuggestions,
    showSuggestions,
    setShowSuggestions,
    isGeocoding,
    geocode,
    selectSuggestion
  };
}
