'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SuctionCurveData } from '@/types';
import { Check, Edit2, Trash, X } from 'lucide-react';
import { useState } from 'react';

interface SuctionCurveInputsProps {
  suction: SuctionCurveData;
  index: number;
  updateSuctionCurve: (
    id: string,
    updatedSuction: Partial<SuctionCurveData>
  ) => void;
  removeSuctionCurve: (id: string) => void;
}

export function SuctionCurveInputs({
  suction,
  index,
  updateSuctionCurve,
  removeSuctionCurve
}: SuctionCurveInputsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(
    suction.name || `SuctionCurve${index + 1}`
  );

  const handleInputChange = (field: keyof SuctionCurveData, value: string) => {
    if (value === '') {
      updateSuctionCurve(suction.id, { [field]: undefined });
    } else {
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        updateSuctionCurve(suction.id, { [field]: numValue });
      }
    }
  };

  const handleNameSave = () => {
    updateSuctionCurve(suction.id, { name: tempName });
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(suction.name || `SuctionCurve${index + 1}`);
    setIsEditingName(false);
  };

  const displayName = suction.name || `SuctionCurve${index + 1}`;

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
          <Label htmlFor={`staticPressure-${suction.id}`}>
            Static Pressure (m):
          </Label>
          <Input
            id={`staticPressure-${suction.id}`}
            type='number'
            value={
              suction.staticPressure !== undefined ? suction.staticPressure : ''
            }
            onChange={(e) =>
              handleInputChange('staticPressure', e.target.value)
            }
            placeholder='Enter static pressure (default: 10.1325 m)'
            step='any'
          />
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor={`operatingFlow-${suction.id}`}>
            Operating Flow Rate:
          </Label>
          <Input
            id={`operatingFlow-${suction.id}`}
            type='number'
            value={
              suction.operatingFlow !== undefined ? suction.operatingFlow : ''
            }
            onChange={(e) => handleInputChange('operatingFlow', e.target.value)}
            placeholder='Enter operating flow rate'
            step='any'
          />
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor={`operatingNpsha-${suction.id}`}>
            Operating NPSHa:
          </Label>
          <Input
            id={`operatingNpsha-${suction.id}`}
            type='number'
            value={
              suction.operatingNpsha !== undefined ? suction.operatingNpsha : ''
            }
            onChange={(e) =>
              handleInputChange('operatingNpsha', e.target.value)
            }
            placeholder='Enter operating NPSHa'
            step='any'
          />
        </div>

        {/* <div className='grid gap-1.5'>
          <Label htmlFor={`velocityHead-${suction.id}`}>Velocity Head:</Label>
          <Input
            id={`velocityHead-${suction.id}`}
            type='number'
            value={suction.velocityHead !== undefined ? suction.velocityHead : ''}
            onChange={(e) => handleInputChange('velocityHead', e.target.value)}
            placeholder='Enter velocity head'
            step='any'
          />
        </div> */}

        <div className='mt-2 flex justify-end'>
          <Button
            className='cursor-pointer'
            variant='destructive'
            size='sm'
            onClick={() => removeSuctionCurve(suction.id)}
          >
            <Trash className='h-2 w-2' />
          </Button>
        </div>
      </div>
    </Card>
  );
}
