'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Search, MapPin, CloudRain, ExternalLink } from 'lucide-react';
import { LocationsData } from './index';
import { useNominatim } from '@/lib/stormwater/use-nominatim';

interface IFDStatus {
  loading: boolean;
  error?: string;
  loaded: boolean;
  addressLabel?: string;
}

type Props = {
  locationsData: LocationsData;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedDuration: string;
  setSelectedDuration: (duration: string) => void;
  onFetchBOMIFD: (lat: number, lon: number, addressLabel: string) => Promise<void>;
  bomStatus: IFDStatus;
};

export default function RainfallSelector({
  locationsData,
  selectedCity,
  setSelectedCity,
  selectedDuration,
  setSelectedDuration,
  onFetchBOMIFD,
  bomStatus,
}: Props) {
  const [isFetching, setIsFetching] = useState(false);
  const {
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
    selectSuggestion,
  } = useNominatim({ restrictCountry: 'au' });

  const handleCityChange = (cityLabel: string) => {
    setSelectedCity(cityLabel);
    if (cityLabel === 'Custom / Manual') return;

    const cityData = locationsData.find((city) => city.label === cityLabel);
    if (cityData) {
      const availableDurations = Object.keys(cityData.data).sort((a, b) => {
        const aMin = cityData.data[a].durationInMin;
        const bMin = cityData.data[b].durationInMin;
        return aMin - bMin;
      });
      if (availableDurations.length > 0) {
        const defaultDuration = availableDurations.includes('2 hour') ? '2 hour' : availableDurations[0];
        setSelectedDuration(defaultDuration);
      }
    }
  };

  const getAvailableDurations = () => {
    if (selectedCity === 'Custom / Manual') return [];
    const cityData = locationsData.find((city) => city.label === selectedCity);
    if (!cityData) return [];
    return Object.keys(cityData.data).sort((a, b) => {
      const aMin = cityData.data[a].durationInMin;
      const bMin = cityData.data[b].durationInMin;
      return aMin - bMin;
    });
  };

  const availableDurations = getAvailableDurations();

  const handleLocateClick = async () => {
    try {
      await geocode();
    } catch {
      // Error surfaced by hook consumer if needed; toast handled by parent
    }
  };

  const handleFetchClick = async () => {
    if (!latitude || !longitude) {
      try {
        const match = await geocode();
        if (!match) return;
      } catch {
        return;
      }
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    setIsFetching(true);
    try {
      await onFetchBOMIFD(lat, lon, query || 'Site');
    } finally {
      setIsFetching(false);
    }
  };

  const bomUrl =
    latitude && longitude
      ? `https://www.bom.gov.au/water/designRainfalls/revised-ifd/?year=2016&coordinate_type=dd&latitude=${latitude}&longitude=${longitude}&sdmin=true&sdhr=true&sdday=true&user_label=${encodeURIComponent(query || 'Site')}`
      : null;

  return (
    <Card className="w-full space-y-4 rounded-xl border p-4 shadow-sm">
      <CardHeader className="p-0">
        <CardTitle className="text-lg font-semibold">Location & BOM Data</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-5">
        {/* Address / BOM lookup */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="addressSearch">Site Address / Location</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="addressSearch"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 250);
                  }}
                  placeholder="e.g. 100 Adelaide St, Brisbane QLD"
                  className="pr-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLocateClick();
                    }
                  }}
                />
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

                {/* Suggestions Dropdown */}
                {showSuggestions && (suggestions.length > 0 || isSearchingSuggestions) && (
                  <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {isSearchingSuggestions && suggestions.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching addresses...
                      </div>
                    ) : (
                      <ul className="py-1 divide-y divide-border/40">
                        {suggestions.map((item) => (
                          <li
                            key={item.place_id}
                            onClick={() => {
                              selectSuggestion(item);
                              // Parent can detect suggestion selection by lat/lon change
                            }}
                            className="px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left leading-normal break-words"
                          >
                            {item.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                onClick={handleLocateClick}
                disabled={isGeocoding || isFetching}
                className="cursor-pointer flex items-center gap-1 shrink-0"
              >
                {isGeocoding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                Locate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Search by address to resolve coordinates and fetch 10% AEP 120-min rainfall from BOM.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. -27.4678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 153.0281"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleFetchClick}
              disabled={isFetching || isGeocoding || !latitude || !longitude}
              className="cursor-pointer flex items-center gap-1.5"
            >
              {isFetching || bomStatus.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching BOM...
                </>
              ) : (
                <>
                  <CloudRain className="h-4 w-4" />
                  Fetch BOM IFD Data
                </>
              )}
            </Button>
            {bomUrl && (
              <a
                href={bomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors py-2 px-3 rounded-md bg-sky-50 hover:bg-sky-100 font-medium"
              >
                Verify on BOM
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {bomStatus.error && (
            <p className="text-sm text-red-500 font-medium bg-red-50 border border-red-100 p-2.5 rounded-md">
              {bomStatus.error}
            </p>
          )}

          {bomStatus.loaded && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-md">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">BOM IFD data loaded</p>
                {bomStatus.addressLabel && (
                  <p className="text-xs opacity-90 truncate">{bomStatus.addressLabel}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <hr className="border-border/60" />

        {/* Fallback city dropdown */}
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="city-select">Select Region/City (fallback)</Label>
            <Select value={selectedCity} onValueChange={handleCityChange}>
              <SelectTrigger id="city-select">
                <SelectValue placeholder="Select a city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Custom / Manual">Custom / Manual (Enter rainfall below)</SelectItem>
                {[...locationsData].sort((a, b) => a.label.localeCompare(b.label)).map((city) => (
                  <SelectItem key={city.label} value={city.label}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCity !== 'Custom / Manual' && availableDurations.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="duration-select">Storm Duration (BOM lookup)</Label>
              <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                <SelectTrigger id="duration-select">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {availableDurations.map((duration) => {
                    const cityData = locationsData.find((c) => c.label === selectedCity);
                    const label = cityData ? cityData.data[duration].durationInMin : 0;
                    return (
                      <SelectItem key={duration} value={duration}>
                        {duration} ({label} minutes)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
