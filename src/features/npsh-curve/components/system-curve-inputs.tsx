'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SystemCurveData } from '@/types';
import { Check, Edit2, Trash, X } from 'lucide-react';
import { useState } from 'react';

interface SystemCurveInputsProps {
  system: SystemCurveData;
  index: number;
  updateSystemCurve: (
    id: string,
    updatedSystem: Partial<SystemCurveData>
  ) => void;
  removeSystemCurve: (id: string) => void;
  isNpshCurve?: boolean;
}

export function SystemCurveInputs({
  system,
  index,
  updateSystemCurve,
  removeSystemCurve,
  isNpshCurve = false
}: SystemCurveInputsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(
    system.name || `${isNpshCurve ? 'NPSH' : 'System'} Curve ${index + 1}`
  );

  const handleInputChange = (field: keyof SystemCurveData, value: string) => {
    if (value === '') {
      updateSystemCurve(system.id, { [field]: undefined });
    } else {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        updateSystemCurve(system.id, { [field]: numValue });
      }
    }
  };

  const handleNameSave = () => {
    updateSystemCurve(system.id, { name: tempName });
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(
      system.name || `${isNpshCurve ? 'NPSH' : 'System'} Curve ${index + 1}`
    );
    setIsEditingName(false);
  };

  const displayName =
    system.name || `${isNpshCurve ? 'NPSH' : 'System'} Curve ${index + 1}`;

  return (
    <Card className='mb-4 border p-4'>
      <div className='mb-2 flex items-center justify-between'>
        {isEditingName ? (
          <div className='flex flex-1 items-center gap-2'>
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className='flex-1'
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSave();
                if (e.key === 'Escape') handleNameCancel();
              }}
              autoFocus
            />
            <Button
              size='sm'
              onClick={handleNameSave}
              className='cursor-pointer'
            >
              <Check className='h-3 w-3' />
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={handleNameCancel}
              className='cursor-pointer'
            >
              <X className='h-3 w-3' />
            </Button>
          </div>
        ) : (
          <div className='flex items-center gap-2'>
            <h3 className='font-medium'>{displayName}</h3>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => setIsEditingName(true)}
              className='h-6 w-6 cursor-pointer p-1'
            >
              <Edit2 className='h-3 w-3' />
            </Button>
          </div>
        )}
      </div>

      <div className='space-y-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor={`staticHead-${system.id}`}>
            {isNpshCurve ? 'NPSH Available (Starting Point):' : 'Static Head:'}
          </Label>
          <Input
            id={`staticHead-${system.id}`}
            type='number'
            value={system.staticHead !== undefined ? system.staticHead : ''}
            onChange={(e) => handleInputChange('staticHead', e.target.value)}
            placeholder={
              isNpshCurve
                ? 'Enter NPSH available (default: 10.1325)'
                : 'Enter static head'
            }
            step='any'
          />
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor={`operatingFlow-${system.id}`}>
            Operating Flow Rate:
          </Label>
          <Input
            id={`operatingFlow-${system.id}`}
            type='number'
            value={
              system.operatingFlow !== undefined ? system.operatingFlow : ''
            }
            onChange={(e) => handleInputChange('operatingFlow', e.target.value)}
            placeholder='Enter operating flow rate'
            step='any'
          />
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor={`operatingHead-${system.id}`}>
            {isNpshCurve ? 'Operating NPSH Required:' : 'Operating Head:'}
          </Label>
          <Input
            id={`operatingHead-${system.id}`}
            type='number'
            value={
              system.operatingHead !== undefined ? system.operatingHead : ''
            }
            onChange={(e) => handleInputChange('operatingHead', e.target.value)}
            placeholder={
              isNpshCurve
                ? 'Enter operating NPSH required'
                : 'Enter operating head'
            }
            step='any'
          />
        </div>

        <div className='mt-2 flex justify-end'>
          <Button
            className='cursor-pointer'
            variant='destructive'
            size='sm'
            onClick={() => removeSystemCurve(system.id)}
          >
            <Trash className='h-2 w-2' />
          </Button>
        </div>
      </div>
    </Card>
  );
}
