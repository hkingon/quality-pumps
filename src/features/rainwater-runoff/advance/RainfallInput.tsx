'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState, useRef } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Info, Upload, FileText, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Papa from 'papaparse';

interface IFDData {
  duration: number; // in minutes
  durationLabel: string; // original duration label (e.g., "1 min", "2 hour")
  intensities: Record<string, number>; // AEP percentages as keys, intensities as values
}

interface RainfallInputProps {
  rainfallEvent: string;
  setRainfallEvent: (value: string) => void;
  selectedDuration: number;
  setSelectedDuration: (value: number) => void;
  catchmentArea: number;
  setCatchmentArea: (value: number) => void;
  timeOfConcentration: number | null;
  setTimeOfConcentration: (value: number | null) => void;
  csvData: IFDData[] | null;
  setCsvData: (data: IFDData[] | null) => void;
  runOffCoeff: number;
  setRunOffCoeff: (data: number) => void;
  csvFileName: string;
  setCsvFileName: (name: string) => void;
  handleRainfallInput: () => void;
}

export default function RainfallInput({
  rainfallEvent,
  setRainfallEvent,
  selectedDuration,
  setSelectedDuration,
  catchmentArea,
  setCatchmentArea,
  timeOfConcentration,
  setTimeOfConcentration,
  csvData,
  setCsvData,
  runOffCoeff,
  setRunOffCoeff,
  csvFileName,
  setCsvFileName,
  handleRainfallInput
}: RainfallInputProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [csvError, setCsvError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTc, setIsEditingTc] = useState(false);
  const [customTc, setCustomTc] = useState<number>(0);
  const [availableAEPs, setAvailableAEPs] = useState<string[]>([]);

  // AEP mapping from percentage to descriptive text
  const aepMapping: Record<string, string> = {
    '63.2%': '1 in 1 Year (63.2% AEP)',
    '50%': '1 in 2 Years (50% AEP)',
    '20%': '1 in 5 Years (20% AEP)',
    '10%': '1 in 10 Years (10% AEP)',
    '5%': '1 in 20 Years (5% AEP)',
    '2%': '1 in 50 Years (2% AEP)',
    '1%': '1 in 100 Years (1% AEP)'
  };

  const parseIFDFile = (file: File) => {
    setCsvFileName(file.name);
    setCsvError('');

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            setCsvError('Error parsing CSV file. Please check the format.');
            return;
          }

          const rows = results.data as string[][];

          if (rows.length === 0) {
            setCsvError('CSV file is empty.');
            return;
          }

          // Find the header row with AEP percentages
          let headerRowIndex = -1;
          let aepColumns: string[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (
              row[0] &&
              row[0].toLowerCase().includes('duration') &&
              row.some((cell) => cell && cell.includes('%'))
            ) {
              headerRowIndex = i;
              // Extract AEP columns (skip first two columns which are duration labels)
              aepColumns = row
                .slice(2)
                .filter((cell) => cell && cell.includes('%'));
              break;
            }
          }

          if (headerRowIndex === -1 || aepColumns.length === 0) {
            setCsvError(
              'Could not find AEP header row. Please ensure the CSV contains Annual Exceedance Probability columns.'
            );
            return;
          }

          setAvailableAEPs(aepColumns);

          // Parse data rows
          const parsedData: IFDData[] = [];

          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[0] || !row[1]) continue; // Skip if no duration info

            const durationLabel = row[0].trim();
            const durationInMinutes = parseFloat(row[1]);

            if (isNaN(durationInMinutes) || durationInMinutes <= 0) continue;

            const intensities: Record<string, number> = {};
            let hasValidIntensity = false;

            // Parse intensities for each AEP
            for (let j = 0; j < aepColumns.length; j++) {
              const intensityValue = parseFloat(row[j + 2]);
              if (!isNaN(intensityValue) && intensityValue > 0) {
                intensities[aepColumns[j]] = intensityValue;
                hasValidIntensity = true;
              }
            }

            if (hasValidIntensity) {
              parsedData.push({
                duration: durationInMinutes,
                durationLabel: durationLabel,
                intensities: intensities
              });
            }
          }

          if (parsedData.length === 0) {
            setCsvError(
              'No valid data rows found. Please check the CSV format.'
            );
            return;
          }

          // Sort by duration
          parsedData.sort((a, b) => a.duration - b.duration);

          setCsvData(parsedData);
          setCsvError('');

          // Reset selections when new data is loaded
          setRainfallEvent('');
          setSelectedDuration(0);
        } catch (error) {
          setCsvError('Error processing CSV file. Please check the format.');
        }
      },
      error: (error) => {
        setCsvError(`Error reading file: ${error.message}`);
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    parseIFDFile(file);
  };

  const clearCSV = () => {
    setCsvData(null);
    setCsvFileName('');
    setCsvError('');
    setSelectedDuration(0);
    setRainfallEvent('');
    setAvailableAEPs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEditTc = () => {
    setIsEditingTc(true);
    setCustomTc(timeOfConcentration || 0);
  };

  const handleSaveTc = () => {
    if (customTc > 0) {
      setTimeOfConcentration(customTc);
      setIsEditingTc(false);
    }
  };

  const handleCancelEditTc = () => {
    setIsEditingTc(false);
    setCustomTc(timeOfConcentration || 0);
  };

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!rainfallEvent) {
      newErrors.rainfallEvent = 'Please select a rainfall event (AEP)';
    }

    if (!csvData || csvData.length === 0) {
      newErrors.csvData = 'Please upload a valid IFD CSV file';
    }

    if (!selectedDuration || selectedDuration <= 0) {
      newErrors.selectedDuration =
        'Please select a valid duration from the uploaded data';
    }

    if (!catchmentArea || catchmentArea <= 0) {
      newErrors.catchmentArea = 'Catchment area must be greater than 0';
    }

    if (!runOffCoeff || runOffCoeff > 1 || runOffCoeff < 0) {
      newErrors.runoffcoeff = 'Runoff Coefficient must be from 0 - 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateInputs()) {
      handleRainfallInput();
    }
  };

  // Get selected intensity value based on AEP and duration
  const getSelectedIntensity = (): number | null => {
    if (!csvData || !rainfallEvent || !selectedDuration) return null;

    const selectedData = csvData.find((d) => d.duration === selectedDuration);
    if (!selectedData) return null;

    // Extract AEP percentage from the selected rainfall event
    const aepMatch = rainfallEvent.match(/\((\d+\.?\d*%)\s+AEP\)/);
    if (!aepMatch) return null;

    const aepPercentage = aepMatch[1];
    return selectedData.intensities[aepPercentage] || null;
  };

  const selectedIntensity = getSelectedIntensity();

  return (
    <div className='space-y-4'>
      {!timeOfConcentration && (
        <Alert variant='destructive'>
          <AlertTitle className='flex items-center gap-2'>
            <Info className='h-4 w-4' />
            Complete Step 1 (Time of Concentration) first
          </AlertTitle>
        </Alert>
      )}

      {/* CSV File Upload Section */}
      <Card className='border-dashed'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-lg'>
            <Upload className='h-5 w-5' />
            Upload IFD (Intensity-Frequency-Duration) Data (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='csvFile'>IFD CSV File</Label>
            <Input
              ref={fileInputRef}
              id='csvFile'
              type='file'
              accept='.csv'
              onChange={handleFileUpload}
              disabled={!timeOfConcentration}
            />
            <p className='text-muted-foreground text-sm'>
              Upload an IFD CSV file containing duration and intensity data for
              different Annual Exceedance Probabilities (AEP)
            </p>
          </div>

          {csvError && (
            <Alert variant='destructive'>
              <AlertDescription>{csvError}</AlertDescription>
            </Alert>
          )}

          {csvData && csvFileName && (
            <Alert className='border-green-200 bg-green-50'>
              <CheckCircle className='h-4 w-4 text-green-600' />
              <AlertTitle className='text-green-800'>
                IFD file uploaded successfully!
              </AlertTitle>
              <AlertDescription className='text-green-700'>
                <div className='flex items-center justify-between'>
                  <span>
                    {csvFileName} ({csvData.length} duration points,{' '}
                    {availableAEPs.length} AEP levels)
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={clearCSV}
                    className='cursor-pointer'
                  >
                    Clear
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {csvData && csvData.length > 0 && (
            <div className='max-h-40 overflow-y-auto rounded border p-3'>
              <p className='mb-2 text-sm font-medium'>
                Preview of uploaded IFD data:
              </p>
              <div className='space-y-2'>
                <div className='flex gap-4 border-b pb-1 text-xs font-medium'>
                  <span className='w-16'>Duration</span>
                  {availableAEPs.slice(0, 4).map((aep) => (
                    <span key={aep} className='w-16 text-right'>
                      {aep}
                    </span>
                  ))}
                  {availableAEPs.length > 4 && <span>...</span>}
                </div>
                {csvData.slice(0, 6).map((row, index) => (
                  <div key={index} className='flex gap-4 font-mono text-xs'>
                    <span className='w-16'>{row.durationLabel}</span>
                    {availableAEPs.slice(0, 4).map((aep) => (
                      <span key={aep} className='w-16 text-right'>
                        {row.intensities[aep]?.toFixed(1) || '-'}
                      </span>
                    ))}
                    {availableAEPs.length > 4 && <span>...</span>}
                  </div>
                ))}
                {csvData.length > 6 && (
                  <div className='text-muted-foreground pt-1 text-xs'>
                    ... and {csvData.length - 6} more duration points
                  </div>
                )}
              </div>
            </div>
          )}

          {errors.csvData && (
            <p className='text-destructive text-sm'>{errors.csvData}</p>
          )}
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='rainfallEvent'>
            Annual Exceedance Probability (AEP)
          </Label>
          <Select
            value={rainfallEvent}
            onValueChange={setRainfallEvent}
            disabled={!timeOfConcentration || !csvData}
          >
            <SelectTrigger id='rainfallEvent'>
              <SelectValue placeholder='Select AEP from uploaded data' />
            </SelectTrigger>
            <SelectContent>
              {availableAEPs.map((aep) => (
                <SelectItem key={aep} value={aepMapping[aep] || `${aep} AEP`}>
                  {aepMapping[aep] || `${aep} AEP`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.rainfallEvent && (
            <p className='text-destructive text-sm'>{errors.rainfallEvent}</p>
          )}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='selectedDuration'>Duration</Label>
          <Select
            value={selectedDuration.toString()}
            onValueChange={(value) => setSelectedDuration(parseInt(value))}
            disabled={!timeOfConcentration || !csvData}
          >
            <SelectTrigger id='selectedDuration'>
              <SelectValue placeholder='Select duration from uploaded data' />
            </SelectTrigger>
            <SelectContent>
              {csvData?.map((dataPoint) => (
                <SelectItem
                  key={dataPoint.duration}
                  value={dataPoint.duration.toString()}
                >
                  {dataPoint.durationLabel} ({dataPoint.duration} min)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.selectedDuration && (
            <p className='text-destructive text-sm'>
              {errors.selectedDuration}
            </p>
          )}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='catchmentArea'>Catchment Area (m²)</Label>
          <Input
            id='catchmentArea'
            type='number'
            value={catchmentArea || ''}
            onChange={(e) => setCatchmentArea(parseFloat(e.target.value) || 0)}
            placeholder='Enter catchment area'
            disabled={!timeOfConcentration}
          />
          {errors.catchmentArea && (
            <p className='text-destructive text-sm'>{errors.catchmentArea}</p>
          )}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='runoffcoeff'>Runoff Coefficient (0-1)</Label>
          <Input
            id='runoffcoeff'
            type='number'
            value={runOffCoeff || ''}
            onChange={(e) => setRunOffCoeff(parseFloat(e.target.value) || 0)}
            placeholder='Enter runoff coefficient'
            disabled={!timeOfConcentration}
          />
          {errors.runoffcoeff && (
            <p className='text-destructive text-sm'>{errors.runoffcoeff}</p>
          )}
        </div>

        {selectedIntensity && (
          <div className='space-y-2'>
            <Label>Selected Rainfall Intensity</Label>
            <div className='bg-muted rounded-md p-3'>
              <span className='font-medium'>{selectedIntensity} mm/hr</span>
              <p className='text-muted-foreground text-sm'>
                Duration:{' '}
                {
                  csvData?.find((d) => d.duration === selectedDuration)
                    ?.durationLabel
                }{' '}
                ({selectedDuration} min)
              </p>
              <p className='text-muted-foreground text-sm'>
                AEP: {rainfallEvent.split('(')[0].trim()}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className='pt-2'>
        <Button
          onClick={handleSubmit}
          className='w-full cursor-pointer md:w-auto'
          disabled={!timeOfConcentration || !csvData || !selectedIntensity}
        >
          Generate Hyetograph
        </Button>
      </div>

      {timeOfConcentration && (
        <Card className='bg-primary/10'>
          <AlertDescription className='px-2'>
            <div className='flex w-full items-center justify-between'>
              <div>
                <p className='text-sm font-medium'>
                  <strong>Time of Concentration:</strong> {timeOfConcentration}{' '}
                  minutes
                </p>
                <p className='mt-1 text-xs'>
                  For additional redundancy, select a duration shorter than the
                  calculated time of concentration.
                </p>
              </div>
              <div className='flex gap-2'>
                {!isEditingTc ? (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleEditTc}
                    className='cursor-pointer'
                  >
                    Edit
                  </Button>
                ) : (
                  <div className='flex items-center gap-2'>
                    <Input
                      type='number'
                      value={customTc || ''}
                      onChange={(e) =>
                        setCustomTc(parseFloat(e.target.value) || 0)
                      }
                      placeholder='Enter Tc'
                      className='h-8 w-20 text-sm'
                      step='0.1'
                      min='0'
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={handleSaveTc}
                      className='h-8 cursor-pointer px-2'
                      disabled={!customTc || customTc <= 0}
                    >
                      Save
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={handleCancelEditTc}
                      className='h-8 cursor-pointer px-2'
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </AlertDescription>
        </Card>
      )}
    </div>
  );
}
