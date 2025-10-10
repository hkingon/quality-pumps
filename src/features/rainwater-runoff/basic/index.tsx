'use client';

import { useState, useRef } from 'react';
import RunoffInputs from './RunoffInputs';
import RainfallSelector from './RainfallSelector';
import RunoffResults from './RunoffResults';

// Import your genuine data interfaces
export interface AEPValues {
  '63.2%': number;
  '50%': number;
  '20%': number;
  '10%': number;
  '5%': number;
  '2%': number;
  '1%': number;
}

export interface DurationData {
  durationInMin: number;
  aepValues: AEPValues;
}

export interface LocationData {
  label: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  data: {
    [duration: string]: DurationData;
  };
}

export type LocationsData = LocationData[];
export type AEPType = keyof AEPValues;
export type CatchmentType =
  | 'Box Gutters'
  | 'Eaves Gutters'
  | 'Impervious'
  | 'Pervious'
  | 'No Damage'
  | 'Custom';

// Define the mapping of catchment types to default AEP types
// export const catchmentTypeToAEP: Record<Exclude<CatchmentType, 'Custom'>, AEPType> = {
//   'Residential': '20%',      // 5-year ARI (1/0.2 = 5)
//   'Commercial': '10%',       // 10-year ARI (1/0.1 = 10)
//   'Industrial': '5%',        // 20-year ARI (1/0.05 = 20)
//   'Critical Infrastructure': '1%'  // 100-year ARI (1/0.01 = 100)
// };

export const catchmentTypeToDefaults: Record<
  Exclude<CatchmentType, 'Custom'>,
  { aep: AEPType; runoffCoefficient: number }
> = {
  'Box Gutters': { aep: '1%', runoffCoefficient: 1.0 },
  'Eaves Gutters': { aep: '5%', runoffCoefficient: 1.0 },
  Impervious: { aep: '10%', runoffCoefficient: 0.9 },
  Pervious: { aep: '10%', runoffCoefficient: 0.9 },
  'No Damage': { aep: '50%', runoffCoefficient: 0.9 }
};

// Interface for catchment areas
export interface CatchmentArea {
  id: number;
  area: number;
  runoffCoefficient: number;
  catchmentType: CatchmentType;
  aepType: AEPType | null;
  customIntensity: number | null; // For overriding the rainfall intensity
}

interface Props {
  locationsData: LocationsData; // This will be passed as a prop from your parent component
}

export default function RainwaterCalculator({ locationsData }: Props) {
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('5'); // Default to 5 minutes
  const [selectedAEP, setSelectedAEP] = useState<AEPType>('10%');
  const resultsRef = useRef<HTMLDivElement>(null);

  // Initialize catchment areas with new fields
  const [catchmentAreas, setCatchmentAreas] = useState<CatchmentArea[]>([
    {
      id: 1,
      area: 0,
      runoffCoefficient: 0.9,
      catchmentType: 'Impervious',
      aepType: '10%',
      customIntensity: null
    }
  ]);

  // Results state
  const [individualResults, setIndividualResults] = useState<
    {
      id: number;
      area: number;
      coefficient: number;
      intensity: number;
      runoff: number;
      catchmentType: string;
      aepType: string | null;
    }[]
  >([]);

  const [designFlowRate, setDesignFlowRate] = useState(0);

  // Get current city data
  const getCurrentCityData = () => {
    return locationsData.find((city) => city.label === selectedCity);
  };

  // Get available durations for selected city
  const getAvailableDurations = () => {
    const cityData = getCurrentCityData();
    if (!cityData) return [];
    return Object.keys(cityData.data).sort((a, b) => Number(a) - Number(b));
  };

  // Get AEP values for selected city and duration
  const getCurrentAEPValues = () => {
    const cityData = getCurrentCityData();
    if (!cityData || !cityData.data[selectedDuration]) return null;
    return cityData.data[selectedDuration].aepValues;
  };

  // Get rainfall intensity for given city, duration, and AEP
  const getRainfallIntensity = (
    cityLabel: string,
    duration: string,
    aep: AEPType
  ) => {
    const cityData = locationsData.find((city) => city.label === cityLabel);
    if (!cityData || !cityData.data[duration]) return 0;
    return cityData.data[duration].aepValues[aep];
  };

  const handleCalculate = () => {
    const results = catchmentAreas.map((ca) => {
      // Determine the rainfall intensity to use
      let intensity = 0;

      if (ca.customIntensity !== null) {
        // Use custom intensity if provided
        intensity = ca.customIntensity;
      } else if (selectedCity && ca.aepType) {
        // Use the selected AEP's intensity for the city and duration
        intensity = getRainfallIntensity(
          selectedCity,
          selectedDuration,
          ca.aepType
        );
      } else {
        // Fallback
        intensity = 0;
      }

      const runoff = (ca.area * ca.runoffCoefficient * intensity) / 1000; // m³/hr

      return {
        id: ca.id,
        area: ca.area,
        coefficient: ca.runoffCoefficient,
        intensity,
        runoff,
        catchmentType: ca.catchmentType,
        aepType: ca.aepType
      };
    });

    const totalRunoff = results.reduce((sum, r) => sum + r.runoff, 0);
    setIndividualResults(results);
    setDesignFlowRate(totalRunoff); // m³/hr

    // Scroll to results after a slight delay to ensure state has updated
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className='mx-auto w-full max-w-5xl space-y-4 p-0'>
      <div className='relative flex flex-col lg:flex-row lg:items-start lg:gap-4'>
        <div
          className='relative order-1 mb-4 flex-1 lg:sticky lg:top-4 lg:order-2'
          ref={resultsRef}
        >
          <RunoffResults
            designFlowRate={designFlowRate}
            individualResults={individualResults}
          />
        </div>

        <div className='order-2 mb-32 flex-1 space-y-4 lg:order-1 lg:mb-16'>
          <RainfallSelector
            locationsData={locationsData}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            selectedDuration={selectedDuration}
            setSelectedDuration={setSelectedDuration}
            selectedAEP={selectedAEP}
            setSelectedAEP={setSelectedAEP}
            getCurrentAEPValues={getCurrentAEPValues}
            getAvailableDurations={getAvailableDurations}
          />
          <RunoffInputs
            catchmentAreas={catchmentAreas}
            setCatchmentAreas={setCatchmentAreas}
            handleCalculate={handleCalculate}
            selectedCity={selectedCity}
            selectedDuration={selectedDuration}
            getRainfallIntensity={getRainfallIntensity}
          />
        </div>
      </div>
    </div>
  );
}
