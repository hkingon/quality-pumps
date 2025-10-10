'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  CatchmentArea,
  CatchmentType,
  AEPType,
  catchmentTypeToDefaults,
  AEPValues
} from './index';
import { Switch } from '@/components/ui/switch';

type Props = {
  catchmentAreas: CatchmentArea[];
  setCatchmentAreas: (areas: CatchmentArea[]) => void;
  handleCalculate: () => void;
  selectedCity: string;
  selectedDuration: string;
  getRainfallIntensity: (
    cityLabel: string,
    duration: string,
    aep: AEPType
  ) => number;
};

export default function RunoffInputs({
  catchmentAreas,
  setCatchmentAreas,
  handleCalculate,
  selectedCity,
  selectedDuration,
  getRainfallIntensity
}: Props) {
  const addCatchmentArea = () => {
    const newId =
      catchmentAreas.length > 0
        ? Math.max(...catchmentAreas.map((ca) => ca.id)) + 1
        : 1;
    setCatchmentAreas([
      ...catchmentAreas,
      {
        id: newId,
        area: 0,
        runoffCoefficient: 0.9, // Updated default for Australian code
        catchmentType: 'Impervious', // Updated default
        aepType: '10%', // Updated default
        customIntensity: null
      }
    ]);
  };

  const updateCatchmentArea = (
    id: number,
    field: keyof CatchmentArea,
    value: any
  ) => {
    setCatchmentAreas(
      catchmentAreas.map((ca) => {
        if (ca.id === id) {
          const updatedCA = { ...ca, [field]: value };

          // When catchment type changes, update the AEP type and runoff coefficient accordingly
          if (field === 'catchmentType' && value !== 'Custom') {
            const defaults =
              catchmentTypeToDefaults[
                value as Exclude<CatchmentType, 'Custom'>
              ];
            updatedCA.aepType = defaults.aep;
            updatedCA.runoffCoefficient = defaults.runoffCoefficient;
          }

          return updatedCA;
        }
        return ca;
      })
    );
  };

  const removeCatchmentArea = (id: number) => {
    setCatchmentAreas(catchmentAreas.filter((ca) => ca.id !== id));
  };

  const toggleCustomIntensity = (id: number, enabled: boolean) => {
    setCatchmentAreas(
      catchmentAreas.map((ca) => {
        if (ca.id === id) {
          // If enabling custom intensity, set a default value
          // If disabling, set to null
          const customIntensity = enabled
            ? selectedCity && ca.aepType
              ? getRainfallIntensity(selectedCity, selectedDuration, ca.aepType)
              : 100
            : null;

          return { ...ca, customIntensity };
        }
        return ca;
      })
    );
  };

  const catchmentTypes: CatchmentType[] = [
    'Box Gutters',
    'Eaves Gutters',
    'Impervious',
    'Pervious',
    'No Damage',
    'Custom'
  ];
  const aepTypes: AEPType[] = ['63.2%', '50%', '20%', '10%', '5%', '2%', '1%'];

  return (
    <div className='mb-2 w-full max-w-md space-y-4 rounded-xl border p-4 shadow-sm'>
      <h3 className='text-lg font-semibold'>Catchment Areas</h3>

      {catchmentAreas.map((ca, index) => {
        // Calculate the current rainfall intensity based on settings
        let currentIntensity = 0;
        if (ca.customIntensity !== null) {
          currentIntensity = ca.customIntensity;
        } else if (selectedCity && ca.aepType) {
          currentIntensity = getRainfallIntensity(
            selectedCity,
            selectedDuration,
            ca.aepType
          );
        }

        return (
          <div key={ca.id} className='grid gap-3 rounded border p-3'>
            <div className='flex items-center justify-between'>
              <Label className='font-medium'>Catchment Area {index + 1}</Label>
            </div>

            <div className='grid gap-2'>
              <Label htmlFor={`area-${ca.id}`}>Area (m²)</Label>
              <Input
                id={`area-${ca.id}`}
                type='number'
                value={ca.area || ''}
                onChange={(e) =>
                  updateCatchmentArea(ca.id, 'area', Number(e.target.value))
                }
              />
            </div>

            {/* <div className="grid gap-2">
              <Label htmlFor={`coefficient-${ca.id}`}>Runoff Coefficient</Label>
              <Input
                id={`coefficient-${ca.id}`}
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={ca.runoffCoefficient || ''}
                onChange={(e) => updateCatchmentArea(ca.id, 'runoffCoefficient', Number(e.target.value))}
              />
            </div> */}

            <div className='grid gap-2'>
              <Label htmlFor={`catchmentType-${ca.id}`}>Catchment Type</Label>
              <Select
                value={ca.catchmentType}
                onValueChange={(val) =>
                  updateCatchmentArea(ca.id, 'catchmentType', val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select type' />
                </SelectTrigger>
                <SelectContent>
                  {catchmentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ca.catchmentType !== 'Custom' && (
                <div className='text-muted-foreground text-xs'>
                  Default for {ca.catchmentType}:{' '}
                  {
                    catchmentTypeToDefaults[
                      ca.catchmentType as Exclude<CatchmentType, 'Custom'>
                    ].aep
                  }{' '}
                  AEP, Runoff Coefficient:{' '}
                  {
                    catchmentTypeToDefaults[
                      ca.catchmentType as Exclude<CatchmentType, 'Custom'>
                    ].runoffCoefficient
                  }
                </div>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor={`coefficient-${ca.id}`}>Runoff Coefficient</Label>
              <Input
                id={`coefficient-${ca.id}`}
                type='number'
                min='0'
                max='1'
                step='0.01'
                value={ca.runoffCoefficient || ''}
                onChange={(e) =>
                  updateCatchmentArea(
                    ca.id,
                    'runoffCoefficient',
                    Number(e.target.value)
                  )
                }
                disabled={ca.catchmentType !== 'Custom'}
              />
              {ca.catchmentType !== 'Custom' && (
                <div className='text-muted-foreground text-xs'>
                  Automatically set based on catchment type
                </div>
              )}
            </div>

            {/* Show AEP selection only for custom catchment type */}
            {ca.catchmentType === 'Custom' && (
              <div className='grid gap-2'>
                <Label htmlFor={`aepType-${ca.id}`}>AEP Type</Label>
                <Select
                  value={ca.aepType || ''}
                  onValueChange={(val) =>
                    updateCatchmentArea(ca.id, 'aepType', val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select AEP' />
                  </SelectTrigger>
                  <SelectContent>
                    {aepTypes.map((aep) => (
                      <SelectItem key={aep} value={aep}>
                        {aep} (
                        {selectedCity
                          ? getRainfallIntensity(
                              selectedCity,
                              selectedDuration,
                              aep
                            )
                          : 0}{' '}
                        mm/hr)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* {ca.catchmentType !== 'Custom' && (
              <div className="text-sm font-medium py-1 px-2 bg-blue-50 rounded">
                AEP: {ca.aepType} (Australian Code Default)
              </div>
            )} */}

            {/* Custom Intensity Override */}
            <div className='space-y-2'>
              <div className='flex items-center space-x-2'>
                <Switch
                  id={`override-${ca.id}`}
                  checked={ca.customIntensity !== null}
                  onCheckedChange={(checked) =>
                    toggleCustomIntensity(ca.id, checked)
                  }
                />
                <Label htmlFor={`override-${ca.id}`}>
                  Override Rainfall Intensity
                </Label>
              </div>

              {ca.customIntensity !== null && (
                <div className='grid gap-2'>
                  <Label htmlFor={`intensity-${ca.id}`}>
                    Custom Intensity (mm/hr)
                  </Label>
                  <Input
                    id={`intensity-${ca.id}`}
                    type='number'
                    value={ca.customIntensity || ''}
                    onChange={(e) =>
                      updateCatchmentArea(
                        ca.id,
                        'customIntensity',
                        Number(e.target.value)
                      )
                    }
                  />
                </div>
              )}
            </div>

            <div className='bg-muted/30 rounded px-2 py-1 text-sm font-medium'>
              Current Rainfall Intensity: {currentIntensity} mm/hr
              {ca.customIntensity !== null
                ? ' (Custom)'
                : ca.aepType
                  ? ` (${ca.aepType} AEP)`
                  : ''}
            </div>

            <Button
              className='cursor-pointer'
              variant='destructive'
              onClick={() => removeCatchmentArea(ca.id)}
              disabled={catchmentAreas.length <= 1}
            >
              Remove
            </Button>
          </div>
        );
      })}

      <Button className='cursor-pointer' onClick={addCatchmentArea}>
        Add Catchment Area
      </Button>

      <Button
        className='w-full cursor-pointer'
        onClick={handleCalculate}
        disabled={!selectedCity}
      >
        Calculate
      </Button>

      {!selectedCity && (
        <div className='text-center text-sm text-red-600'>
          Please select a city first
        </div>
      )}
    </div>
  );
}
