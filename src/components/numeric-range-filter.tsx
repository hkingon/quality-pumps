'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericRange } from '@/types/filters';

interface NumericRangeFilterProps {
  label: string;
  range: NumericRange;
  onRangeChange: (range: NumericRange) => void;
  unit?: string;
  placeholder?: { min: string; max: string };
}

export function NumericRangeFilter({
  label,
  range,
  onRangeChange,
  unit = '',
  placeholder = { min: 'Min', max: 'Max' }
}: NumericRangeFilterProps) {
  const handleMinChange = (value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onRangeChange({ ...range, min: numValue });
  };

  const handleMaxChange = (value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onRangeChange({ ...range, max: numValue });
  };

  return (
    <div className='space-y-2'>
      <Label className='text-sm font-medium'>{label}</Label>
      <div className='flex items-center gap-2'>
        <div className='flex-1'>
          <Input
            type='number'
            placeholder={placeholder.min}
            value={range.min ?? ''}
            onChange={(e) => handleMinChange(e.target.value)}
            className='h-9'
          />
        </div>
        <span className='text-muted-foreground text-sm'>to</span>
        <div className='flex-1'>
          <Input
            type='number'
            placeholder={placeholder.max}
            value={range.max ?? ''}
            onChange={(e) => handleMaxChange(e.target.value)}
            className='h-9'
          />
        </div>
        {unit && (
          <span className='text-muted-foreground w-8 text-sm font-medium'>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
