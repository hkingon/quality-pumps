'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import RunoffInputs from './RunoffInputs';
import RainfallSelector from './RainfallSelector';
import RunoffResults from './RunoffResults';
import { parseIFDText, getAEPIntensity, type IFDData } from '@/lib/stormwater/ifd-utils';
import { toast } from 'sonner';

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

interface Props {
  locationsData: LocationsData;
}

export default function RainwaterCalculator({ locationsData }: Props) {
  const [selectedCity, setSelectedCity] = useState<string>('Adelaide');
  const [selectedDuration, setSelectedDuration] = useState<string>('2 hour');
  
  // Input states matching the AS/NZS 3500.3 stormwater calculator
  const [catchmentArea, setCatchmentArea] = useState<number>(200);
  const [runoffCoeff, setRunoffCoeff] = useState<number>(1.00);
  const [rainMode, setRainMode] = useState<'depth' | 'intensity'>('depth');
  const [rainDepth, setRainDepth] = useState<number>(60);
  const [rainIntensity, setRainIntensity] = useState<number>(30);
  const [stormDuration, setStormDuration] = useState<number>(120);
  const [pumpWindow, setPumpWindow] = useState<number>(30);
  
  const [storageMethod, setStorageMethod] = useState<'minimum' | 'manual' | 'round'>('minimum');
  const [manualStorage, setManualStorage] = useState<number>(3);
  const [wellDiameter, setWellDiameter] = useState<number>(1.5);
  const [drawdown, setDrawdown] = useState<number>(1.7);
  
  const [selectedPumpFlow, setSelectedPumpFlow] = useState<number>(10);
  const [minPumpFlow, setMinPumpFlow] = useState<number>(10);
  const [allowableDischarge, setAllowableDischarge] = useState<number | ''>('');

  // BOM IFD lookup state (cached per address)
  const [bomIFDData, setBomIFDData] = useState<IFDData[] | null>(null);
  const [bomAddressLabel, setBomAddressLabel] = useState<string>('');
  const [isFetchingBOM, setIsFetchingBOM] = useState(false);
  const [bomError, setBomError] = useState<string>('');

  const resultsRef = useRef<HTMLDivElement>(null);

  // Apply rainfall values from BOM IFD data when duration or AEP changes
  const applyBOMRainfall = (durationMin: number, aep: string) => {
    if (!bomIFDData || bomIFDData.length === 0) return;
    const intensity = getAEPIntensity(bomIFDData, durationMin, aep);
    if (intensity == null) {
      setBomError(`Could not determine ${aep} AEP rainfall for ${durationMin} min from BOM data.`);
      return;
    }
    setBomError('');
    setRainIntensity(Number(intensity.toFixed(2)));
    setRainDepth(Number((intensity * (durationMin / 60)).toFixed(1)));
  };

  // Sync city/duration selection to rainfall inputs
  useEffect(() => {
    if (selectedCity && selectedCity !== 'Custom / Manual') {
      const cityData = locationsData.find((city) => city.label === selectedCity);
      if (cityData && cityData.data[selectedDuration]) {
        const durationData = cityData.data[selectedDuration];
        const intensity = durationData.aepValues['10%']; // 10 year ARI
        const durationMin = durationData.durationInMin;

        setStormDuration(durationMin);
        setRainIntensity(intensity);
        setRainDepth(Number((intensity * (durationMin / 60)).toFixed(1)));
      }
    }
  }, [selectedCity, selectedDuration, locationsData]);

  // Re-apply cached BOM data when the user changes storm duration or AEP is implied
  useEffect(() => {
    if (bomIFDData && bomIFDData.length > 0) {
      applyBOMRainfall(stormDuration, '10%');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stormDuration, bomIFDData]);

  // Main calculation engine
  const results = useMemo(() => {
    const A = Math.max(0, catchmentArea);
    const C = Math.max(0, Math.min(1, runoffCoeff));
    const duration = Math.max(1, stormDuration);
    const windowMin = Math.max(1, pumpWindow);
    const pumpFlow = Math.max(0, selectedPumpFlow);
    const minPump = Math.max(0, minPumpFlow);
    const hasAllowable = typeof allowableDischarge === 'number' && allowableDischarge > 0;
    const limit = hasAllowable ? (allowableDischarge as number) : 0;

    let computedDepth = rainDepth;
    let computedIntensity = rainIntensity;

    if (rainMode === 'intensity') {
      computedDepth = rainIntensity * (duration / 60);
    } else {
      computedIntensity = rainDepth / (duration / 60);
    }

    const runoffVolume = (A * C * computedDepth) / 1000;
    const minimumStorage = Math.max(A * 0.01, 3);
    
    let activeStorage = minimumStorage;
    if (storageMethod === 'manual') {
      activeStorage = Math.max(0, manualStorage);
    } else if (storageMethod === 'round') {
      const diameter = Math.max(0, wellDiameter);
      const activeDrawdown = Math.max(0, drawdown);
      activeStorage = (Math.PI * Math.pow(diameter, 2) / 4) * activeDrawdown;
    }

    const pumpWindowVolume = (pumpFlow * windowMin * 60) / 1000;
    const combinedStorage = activeStorage + pumpWindowVolume;

    const requiredPumpForActiveStorage = Math.max(
      0,
      ((runoffVolume - activeStorage) * 1000) / (windowMin * 60)
    );
    const requiredPumpWithMinimumNote = Math.max(requiredPumpForActiveStorage, minPump);
    const requiredStorageAtSelectedPump = Math.max(minimumStorage, runoffVolume - pumpWindowVolume);
    const recommendedFlowWithMinimumStorage = Math.max(
      minPump,
      Math.max(0, ((runoffVolume - minimumStorage) * 1000) / (windowMin * 60))
    );

    const storagePass = combinedStorage + 1e-9 >= runoffVolume;
    const wetWellMinPass = activeStorage + 1e-9 >= minimumStorage;
    const areaWarn = A > 2000;
    const pumpMinWarn = pumpFlow > 0 && pumpFlow + 1e-9 < minPump;
    const allowableFail = hasAllowable && pumpFlow - 1e-9 > limit;
    const recommendationAllowableFail = hasAllowable && recommendedFlowWithMinimumStorage - 1e-9 > limit;

    return {
      computedDepth,
      computedIntensity,
      runoffVolume,
      minimumStorage,
      activeStorage,
      pumpWindowVolume,
      combinedStorage,
      requiredPumpWithMinimumNote,
      requiredStorageAtSelectedPump,
      recommendedFlowWithMinimumStorage,
      storagePass,
      wetWellMinPass,
      areaWarn,
      pumpMinWarn,
      allowableFail,
      recommendationAllowableFail,
      hasAllowable,
      limit,
      A,
      C,
      duration,
      windowMin,
      pumpFlow,
      minPump
    };
  }, [
    catchmentArea,
    runoffCoeff,
    rainMode,
    rainDepth,
    rainIntensity,
    stormDuration,
    pumpWindow,
    storageMethod,
    manualStorage,
    wellDiameter,
    drawdown,
    selectedPumpFlow,
    minPumpFlow,
    allowableDischarge
  ]);

  const handleCalculate = () => {
    // Scroll to results
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFetchBOMIFD = async (lat: number, lon: number, addressLabel: string) => {
    setIsFetchingBOM(true);
    setBomError('');
    try {
      const response = await fetch(
        `/api/stormwater/fetch-ifd?latitude=${lat}&longitude=${lon}&label=${encodeURIComponent(addressLabel || 'Site')}`
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `BOM fetch failed (status ${response.status})`);
      }

      const csvText = await response.text();
      const { data, error } = parseIFDText(csvText, `BOM_IFD_${lat.toFixed(4)}_${lon.toFixed(4)}.csv`);

      if (error || !data || data.length === 0) {
        throw new Error(error || 'BOM IFD data could not be parsed.');
      }

      setBomIFDData(data);
      setBomAddressLabel(addressLabel || `BOM ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      setSelectedCity('Custom / Manual');

      const defaultDuration = 120;
      const defaultAEP = '10%';
      setStormDuration(defaultDuration);
      const intensity = getAEPIntensity(data, defaultDuration, defaultAEP);
      if (intensity == null) {
        throw new Error(`Could not determine ${defaultAEP} AEP rainfall for ${defaultDuration} min from BOM data.`);
      }
      setRainIntensity(Number(intensity.toFixed(2)));
      setRainDepth(Number((intensity * (defaultDuration / 60)).toFixed(1)));

      toast.success('BOM 10% AEP 120-min rainfall data loaded successfully.');
    } catch (err: any) {
      const message = err.message || 'Failed to fetch BOM IFD data.';
      setBomError(message);
      toast.error(message);
    } finally {
      setIsFetchingBOM(false);
    }
  };

  const clearBOMData = () => {
    setBomIFDData(null);
    setBomAddressLabel('');
    setBomError('');
  };

  return (
    <div className='mx-auto w-full max-w-7xl space-y-4 p-0'>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start'>
        <div className='space-y-4 lg:col-span-1'>
          <RainfallSelector
            locationsData={locationsData}
            selectedCity={selectedCity}
            setSelectedCity={(city) => {
              if (city !== 'Custom / Manual') {
                clearBOMData();
              }
              setSelectedCity(city);
            }}
            selectedDuration={selectedDuration}
            setSelectedDuration={setSelectedDuration}
            onFetchBOMIFD={handleFetchBOMIFD}
            bomStatus={{
              loading: isFetchingBOM,
              error: bomError,
              loaded: !!bomIFDData && bomIFDData.length > 0,
              addressLabel: bomAddressLabel,
            }}
          />
          <RunoffInputs
            setSelectedCity={(city) => {
              if (city !== 'Custom / Manual') {
                clearBOMData();
              }
              setSelectedCity(city);
            }}
            catchmentArea={catchmentArea}
            setCatchmentArea={setCatchmentArea}
            runoffCoeff={runoffCoeff}
            setRunoffCoeff={setRunoffCoeff}
            rainMode={rainMode}
            setRainMode={setRainMode}
            rainDepth={rainDepth}
            setRainDepth={setRainDepth}
            rainIntensity={rainIntensity}
            setRainIntensity={setRainIntensity}
            stormDuration={stormDuration}
            setStormDuration={setStormDuration}
            pumpWindow={pumpWindow}
            setPumpWindow={setPumpWindow}
            storageMethod={storageMethod}
            setStorageMethod={setStorageMethod}
            manualStorage={manualStorage}
            setManualStorage={setManualStorage}
            wellDiameter={wellDiameter}
            setWellDiameter={setWellDiameter}
            drawdown={drawdown}
            setDrawdown={setDrawdown}
            selectedPumpFlow={selectedPumpFlow}
            setSelectedPumpFlow={setSelectedPumpFlow}
            minPumpFlow={minPumpFlow}
            setMinPumpFlow={setMinPumpFlow}
            allowableDischarge={allowableDischarge}
            setAllowableDischarge={setAllowableDischarge}
            handleCalculate={handleCalculate}
          />
        </div>

        <div className='lg:col-span-2' ref={resultsRef}>
          <RunoffResults results={results} />
        </div>
      </div>
    </div>
  );
}
