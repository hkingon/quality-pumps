'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LocationsData } from './index';

type Props = {
  locationsData: LocationsData;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedDuration: string;
  setSelectedDuration: (duration: string) => void;
};

export default function RainfallSelector({
  locationsData,
  selectedCity,
  setSelectedCity,
  selectedDuration,
  setSelectedDuration,
}: Props) {

  const handleCityChange = (cityLabel: string) => {
    setSelectedCity(cityLabel);
    if (cityLabel === 'Custom / Manual') return;

    const cityData = locationsData.find(city => city.label === cityLabel);
    if (cityData) {
      const availableDurations = Object.keys(cityData.data).sort((a, b) => {
        const aMin = cityData.data[a].durationInMin;
        const bMin = cityData.data[b].durationInMin;
        return aMin - bMin;
      });
      if (availableDurations.length > 0) {
        // Default to "2 hour" (120 min) if available, otherwise first duration
        const defaultDuration = availableDurations.includes('2 hour') ? '2 hour' : availableDurations[0];
        setSelectedDuration(defaultDuration);
      }
    }
  };

  const getAvailableDurations = () => {
    if (selectedCity === 'Custom / Manual') return [];
    const cityData = locationsData.find(city => city.label === selectedCity);
    if (!cityData) return [];
    return Object.keys(cityData.data).sort((a, b) => {
      const aMin = cityData.data[a].durationInMin;
      const bMin = cityData.data[b].durationInMin;
      return aMin - bMin;
    });
  };

  const availableDurations = getAvailableDurations();

  return (
    <Card className="w-full space-y-4 rounded-xl border p-4 shadow-sm">
      <CardHeader className="p-0">
        <CardTitle className="text-lg font-semibold">Location & BOM Data</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="city-select">Select Region/City</Label>
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
                    const cityData = locationsData.find(c => c.label === selectedCity);
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