'use client';

import { useState } from 'react';
import TimeOfConcentration from './TimeOfConcentration';
import RainfallInput from './RainfallInput';
import HydrographCreation from './HydrographCreation';
import PumpComparison from './PumpComparison';
import CSVFormatHelper from './CSVFormatHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Common type for hydrograph data
export interface HydrographDataPoint {
  time: number;
  flowRate: number;
}

// Updated IFD data interface
export interface IFDData {
  duration: number; // in minutes
  durationLabel: string; // original duration label (e.g., "1 min", "2 hour")
  intensities: Record<string, number>; // AEP percentages as keys, intensities as values
}

export default function AdvancedRainwaterCalculator() {
  // Step 1: Time of Concentration state
  const [distanceToPit, setDistanceToPit] = useState<number>(0);
  const [slopeGrade, setSlopeGrade] = useState<number>(0);
  const [hortonValue, setHortonValue] = useState<string>('Paved Surface');
  const [customHortonValue, setCustomHortonValue] = useState<number | null>(
    null
  );
  const [timeOfConcentration, setTimeOfConcentration] = useState<number | null>(
    null
  );

  // Step 2: Rainfall Input state
  const [rainfallEvent, setRainfallEvent] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [catchmentArea, setCatchmentArea] = useState<number>(0);
  const [csvData, setCsvData] = useState<IFDData[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [runOffCoeff, setRunOffCoeff] = useState<number>(0);

  // Step 3: Hydrograph Creation state
  const [hydrographData, setHydrographData] = useState<
    HydrographDataPoint[] | null
  >(null);

  // Step 4: Pump Comparison state
  const [pumpFlowRate, setPumpFlowRate] = useState<number>(0);
  const [detentionVolume, setDetentionVolume] = useState<number | null>(null);

  // Active step tracking
  const [activeStep, setActiveStep] = useState<number>(1);

  // Calculate Time of Concentration
  const calculateTc = () => {
    if (!catchmentArea || !distanceToPit || !slopeGrade) {
      return;
    }

    // Get the Horton's roughness value (n)
    let n: number;
    if (hortonValue === 'Custom' && customHortonValue) {
      n = customHortonValue;
    } else {
      // Standard values based on the selection
      const hortonValues: Record<string, number> = {
        'Paved Surface': 0.015,
        'Bare Soil Surface': 0.0275,
        'Poorly Grassed Surface': 0.035,
        'Average Grassed Surface': 0.045,
        'Densely Grassed Surface': 0.06
      };
      n = hortonValues[hortonValue] || 0.015;
    }

    // Friend's Equation: Tc = B * (n * L^(1/3)) / S^(1/5)
    const B = 107;
    const L = distanceToPit; // length of overland flow in meters
    const S = slopeGrade; // slope in percent

    const tc = (B * (n * Math.pow(L, 1 / 3))) / Math.pow(S, 1 / 5);

    setTimeOfConcentration(parseFloat(tc.toFixed(2)));
    setActiveStep(2);
  };

  // Interpolate intensity from CSV data at a given duration (matching the JS logic)
  const interpolateIntensity = (
    targetDuration: number,
    aepPercentage: string
  ): number | null => {
    if (!csvData) return null;

    // First try to find exact match
    const exactMatch = csvData.find((d) => d.duration === targetDuration);
    if (exactMatch && exactMatch.intensities[aepPercentage]) {
      return exactMatch.intensities[aepPercentage];
    }

    // Sort data by duration for interpolation
    const sortedData = csvData
      .filter((d) => d.intensities[aepPercentage] !== undefined)
      .sort((a, b) => a.duration - b.duration);

    if (sortedData.length === 0) return null;

    // Handle edge cases
    if (targetDuration <= sortedData[0].duration) {
      return sortedData[0].intensities[aepPercentage];
    }
    if (targetDuration >= sortedData[sortedData.length - 1].duration) {
      return sortedData[sortedData.length - 1].intensities[aepPercentage];
    }

    // Find bracketing durations for interpolation
    for (let i = 0; i < sortedData.length - 1; i++) {
      const d1 = sortedData[i].duration;
      const d2 = sortedData[i + 1].duration;

      if (targetDuration >= d1 && targetDuration <= d2) {
        const I1 = sortedData[i].intensities[aepPercentage];
        const I2 = sortedData[i + 1].intensities[aepPercentage];

        // Linear interpolation
        const interpolatedIntensity =
          I1 + (I2 - I1) * ((targetDuration - d1) / (d2 - d1));
        return parseFloat(interpolatedIntensity.toFixed(3));
      }
    }

    return null;
  };

  // Get selected intensity based on AEP and duration
  const getSelectedIntensity = (): number | null => {
    if (!csvData || !rainfallEvent || !selectedDuration) return null;

    // Extract AEP percentage from the selected rainfall event
    const aepMatch = rainfallEvent.match(/\((\d+\.?\d*%)\s+AEP\)/);
    if (!aepMatch) return null;

    const aepPercentage = aepMatch[1];
    return interpolateIntensity(selectedDuration, aepPercentage);
  };

  // Alternative helper function specifically for Time of Concentration
  const getIntensityAtTc = (): number | null => {
    if (!csvData || !rainfallEvent || !timeOfConcentration) return null;

    // Extract AEP percentage from the selected rainfall event
    const aepMatch = rainfallEvent.match(/\((\d+\.?\d*%)\s+AEP\)/);
    if (!aepMatch) return null;

    const aepPercentage = aepMatch[1];
    return interpolateIntensity(timeOfConcentration, aepPercentage);
  };

  // Handle Rainfall Input and create hydrograph
  const handleRainfallInput = () => {
    if (
      !timeOfConcentration ||
      !csvData ||
      !selectedDuration ||
      !catchmentArea
    ) {
      return;
    }

    const hydrograph = createHydrographFromIFD();
    setHydrographData(hydrograph);
    setActiveStep(3);
  };

  // Create Hydrograph based on IFD data (Updated for m² and m³/hr units)
  const createHydrographFromIFD = (): HydrographDataPoint[] => {
    if (
      !timeOfConcentration ||
      !csvData ||
      !selectedDuration ||
      !catchmentArea ||
      !rainfallEvent ||
      !runOffCoeff
    ) {
      return [];
    }

    const aepMatch = rainfallEvent.match(/\((\d+\.?\d*%)\s+AEP\)/);
    if (!aepMatch) return [];
    const aepPercentage = aepMatch[1];

    const hydrograph: HydrographDataPoint[] = [];
    const Tc = timeOfConcentration;
    const stormLength = selectedDuration;
    const area = catchmentArea; // in m²
    const coeff = runOffCoeff;

    // Get intensity at Tc for the initial rising limb calculation
    const I_Tc = interpolateIntensity(Tc, aepPercentage);
    if (!I_Tc) return [];

    // Calculate Q at Tc: Q(Tc) = (C × I(Tc) × A)/1000
    // Conversion: mm/h × m² × runoff coeff = mm⋅m²/h → m³/h (divide by 1000)
    const Q_Tc = (coeff * I_Tc * area) / 1000;

    // Build hydrograph points at 1-minute intervals
    for (let t = 0; t <= stormLength; t++) {
      let Q: number;

      if (t <= Tc) {
        // For 0 ≤ t ≤ Tc: linear increase from 0 to Q(Tc)
        Q = (t / Tc) * Q_Tc;
      } else {
        // For t > Tc: Q(t) = (C × I(t) × A)/1000, with I(t) interpolated from CSV
        const I_t = interpolateIntensity(t, aepPercentage);
        if (I_t !== null) {
          Q = (coeff * I_t * area) / 1000;
        } else {
          Q = 0;
        }
      }

      hydrograph.push({
        time: t,
        flowRate: parseFloat(Q.toFixed(4)) // Flow in m³/hr
      });
    }

    return hydrograph;
  };

  // Handle Pump Comparison
  const handlePumpComparison = () => {
    if (!hydrographData || !pumpFlowRate) {
      return;
    }

    const volume = calculateDetentionVolume();
    setDetentionVolume(volume);
    setActiveStep(4);
  };

  // Calculate detention volume (Updated for m³/hr units)
  const calculateDetentionVolume = (): number => {
    if (!hydrographData || !pumpFlowRate) {
      return 0;
    }

    let volume = 0; // in cubic meters

    // Use trapezoidal integration with m³/hr units
    for (let i = 0; i < hydrographData.length - 1; i++) {
      const Q1 = hydrographData[i].flowRate; // m³/hr
      const Q2 = hydrographData[i + 1].flowRate; // m³/hr

      // Calculate excess flow above pump rate
      const excess1 = Math.max(0, Q1 - pumpFlowRate);
      const excess2 = Math.max(0, Q2 - pumpFlowRate);

      // Average excess for trapezoidal rule
      const avgExcess = (excess1 + excess2) / 2; // m³/hr

      // Volume = flow rate × time (1 minute = 1/60 hour)
      volume += avgExcess * (1 / 60); // m³/hr × 1/60 hr = m³
    }

    return parseFloat(volume.toFixed(2));
  };

  // Reset the calculator
  const resetCalculator = () => {
    setDistanceToPit(0);
    setSlopeGrade(0);
    setHortonValue('Paved Surface');
    setCustomHortonValue(null);
    setTimeOfConcentration(null);

    setRainfallEvent('');
    setSelectedDuration(0);
    setCatchmentArea(0);
    setCsvData(null);
    setCsvFileName('');

    setHydrographData(null);

    setPumpFlowRate(0);
    setDetentionVolume(null);

    setActiveStep(1);
  };

  return (
    <div className='mx-auto max-w-4xl space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>
          Advanced Rainwater Runoff Calculator
        </h1>
        <Button
          className='cursor-pointer'
          variant='outline'
          onClick={resetCalculator}
        >
          Reset All
        </Button>
      </div>

      <p className='text-muted-foreground'>
        This hydrograph-based tool helps engineers assess detailed runoff and
        detention requirements using IFD (Intensity-Frequency-Duration) data.
      </p>

      {/* CSV Format Helper */}
      <div className='mb-6'>
        <Tabs defaultValue='calculator' className='w-full'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='calculator'>Calculator</TabsTrigger>
            <TabsTrigger value='csv-help'>IFD Format Guide</TabsTrigger>
          </TabsList>
          <TabsContent value='calculator' className='mt-6 space-y-6'>
            {/* Step 1: Time of Concentration */}
            <Card className={activeStep === 1 ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>
                    1
                  </span>
                  Time of Concentration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TimeOfConcentration
                  catchmentSize={catchmentArea}
                  setCatchmentSize={setCatchmentArea}
                  distanceToPit={distanceToPit}
                  setDistanceToPit={setDistanceToPit}
                  slopeGrade={slopeGrade}
                  setSlopeGrade={setSlopeGrade}
                  hortonValue={hortonValue}
                  setHortonValue={setHortonValue}
                  customHortonValue={customHortonValue}
                  setCustomHortonValue={setCustomHortonValue}
                  calculateTc={calculateTc}
                />

                {timeOfConcentration !== null && (
                  <Alert className='bg-primary/10 mt-4'>
                    <AlertDescription>
                      Time of Concentration (Tc):{' '}
                      <strong>{timeOfConcentration} minutes</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Rainfall Input */}
            <Card className={activeStep === 2 ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>
                    2
                  </span>
                  Rainfall Input
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RainfallInput
                  rainfallEvent={rainfallEvent}
                  setRainfallEvent={setRainfallEvent}
                  selectedDuration={selectedDuration}
                  setSelectedDuration={setSelectedDuration}
                  catchmentArea={catchmentArea}
                  setCatchmentArea={setCatchmentArea}
                  timeOfConcentration={timeOfConcentration}
                  setTimeOfConcentration={setTimeOfConcentration}
                  csvData={csvData}
                  setCsvData={setCsvData}
                  runOffCoeff={runOffCoeff}
                  setRunOffCoeff={setRunOffCoeff}
                  csvFileName={csvFileName}
                  setCsvFileName={setCsvFileName}
                  handleRainfallInput={handleRainfallInput}
                />
              </CardContent>
            </Card>

            {/* Step 3: Hydrograph Creation */}
            {hydrographData && (
              <Card className={activeStep === 3 ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>
                      3
                    </span>
                    Hydrograph Creation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HydrographCreation
                    hydrographData={hydrographData}
                    timeOfConcentration={timeOfConcentration}
                    rainfallEvent={rainfallEvent}
                    selectedDuration={selectedDuration}
                    selectedIntensity={getIntensityAtTc() || 0}
                    catchmentArea={catchmentArea}
                    csvFileName={csvFileName}
                    runOffCoeff={runOffCoeff}
                  />

                  <div className='mt-4'>
                    <Button
                      className='cursor-pointer'
                      onClick={() => setActiveStep(4)}
                    >
                      Proceed to Pump Comparison
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Pump Comparison */}
            {hydrographData && (
              <Card className={activeStep === 4 ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>
                      4
                    </span>
                    Pump Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PumpComparison
                    hydrographData={hydrographData}
                    pumpFlowRate={pumpFlowRate}
                    setPumpFlowRate={setPumpFlowRate}
                    detentionVolume={detentionVolume}
                    handlePumpComparison={handlePumpComparison}
                    selectedIntensity={getIntensityAtTc() || 0}
                    catchmentArea={catchmentArea}
                    runOffCoeff={runOffCoeff}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value='csv-help' className='mt-6'>
            <CSVFormatHelper />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
