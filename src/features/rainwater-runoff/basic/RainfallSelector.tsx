'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { LocationsData, AEPValues, AEPType } from './index';

type Props = {
  locationsData: LocationsData;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedDuration: string;
  setSelectedDuration: (duration: string) => void;
  selectedAEP: AEPType;
  setSelectedAEP: (aep: AEPType) => void;
  getCurrentAEPValues: () => AEPValues | null;
  getAvailableDurations: () => string[];
};

export default function RainfallSelector({
  locationsData,
  selectedCity,
  setSelectedCity,
  selectedDuration,
  setSelectedDuration,
  selectedAEP,
  setSelectedAEP,
  getCurrentAEPValues,
  getAvailableDurations,
}: Props) {

  const handleCityChange = (cityLabel: string) => {
    setSelectedCity(cityLabel);
    
    const cityData = locationsData.find(city => city.label === cityLabel);
    if (cityData) {
      const availableDurations = Object.keys(cityData.data).sort((a, b) => Number(a) - Number(b));
      if (availableDurations.length > 0) {
        const defaultDuration = availableDurations.includes('5 min') ? '5 min' : availableDurations[0];
        setSelectedDuration(defaultDuration);
      }
    }
  };

  const handleDurationChange = (duration: string) => {
    setSelectedDuration(duration);
  };

  const currentAEPValues = getCurrentAEPValues();
  const availableDurations = getAvailableDurations();

  return (
    <Card className="w-full max-w-md space-y-4 p-4 rounded-xl shadow-sm">
      <h3 className="text-lg font-semibold">Rainfall Settings</h3>

      <div className="flex gap-4 ">
      {/* City Selection */}
      <div className="grid gap-2">
        <Label>City</Label>
        <Select value={selectedCity} onValueChange={handleCityChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a city" />
          </SelectTrigger>
          <SelectContent>
            {[...locationsData].sort((a, b) => a.label.localeCompare(b.label)).map((city) => (
              <SelectItem key={city.label} value={city.label}>
                {city.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration Selection */}
      {selectedCity && availableDurations.length > 0 && (
        <div className="grid gap-2">
          <Label>Intensity Duration</Label>
          <Select value={selectedDuration} onValueChange={handleDurationChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {availableDurations.map((duration) => (
                <SelectItem key={duration} value={duration}>
                  {duration} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      </div>


      {/* AEP Selection */}
      {/* {selectedCity && selectedDuration && currentAEPValues && (
        <div className="grid gap-2">
          <Label>AEP (Annual Exceedance Probability)</Label>
          <Select value={selectedAEP} onValueChange={(value: AEPType) => setSelectedAEP(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select AEP" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(currentAEPValues).map((aep) => (
                <SelectItem key={aep} value={aep}>
                  {aep} AEP ({currentAEPValues[aep as AEPType]} mm/hr)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )} */}

      {/* Display Current Selection Info */}
      {/* {selectedCity && selectedDuration && currentAEPValues && (
        <div className="mt-4 border rounded-md p-3 bg-muted/20">
          <h4 className="text-sm font-medium mb-2">Current Selection</h4>
          <div className="text-sm space-y-1">
            <div><strong>City:</strong> {selectedCity}</div>
            <div><strong>Duration:</strong> {selectedDuration} minutes</div>
            <div><strong>AEP:</strong> {selectedAEP}</div>
            <div><strong>Intensity:</strong> {currentAEPValues[selectedAEP]} mm/hr</div>
          </div>
        </div>
      )} */}

      {/* Display All AEP Values for Reference */}
      {/* {selectedCity && selectedDuration && currentAEPValues && (
        <div className="mt-4 border rounded-md p-3 bg-muted/20">
          <h4 className="text-sm font-medium mb-2">All Available AEP Values (mm/hr)</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(currentAEPValues).map(([aep, intensity]) => (
              <div key={aep} className="flex justify-between">
                <span>{aep}:</span>
                <span className="font-medium">{intensity}</span>
              </div>
            ))}
          </div>
        </div>
      )} */}
    </Card>
  );
}