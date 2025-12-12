'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface MotorSpeedControlProps {
  pumpId: string;
  pumpName: string;
  baseRpm: number;
  baseHz: number;
  currentRpm: number;
  currentHz: number;
  enabled: boolean;
  onSpeedChange: (pumpId: string, rpm: number, hz: number) => void;
  onEnabledChange: (pumpId: string, enabled: boolean) => void;
}

export function MotorSpeedControl({
  pumpId,
  pumpName,
  baseRpm,
  baseHz,
  currentRpm,
  currentHz,
  enabled,
  onSpeedChange,
  onEnabledChange
}: MotorSpeedControlProps) {
  const [localRpm, setLocalRpm] = useState(currentRpm);
  const [localHz, setLocalHz] = useState(currentHz);

  useEffect(() => {
    setLocalRpm(currentRpm);
    setLocalHz(currentHz);
  }, [currentRpm, currentHz]);

  const handleRpmChange = (value: string) => {
    const rpm = parseFloat(value) || baseRpm;
    const clampedRpm = Math.max(baseRpm * 0.3, Math.min(baseRpm * 1.2, rpm)); // 30% to 120% of base
    const calculatedHz = (clampedRpm / baseRpm) * baseHz;

    setLocalRpm(clampedRpm);
    setLocalHz(calculatedHz);
    onSpeedChange(pumpId, clampedRpm, calculatedHz);
  };

  const handleHzChange = (value: string) => {
    const hz = parseFloat(value) || baseHz;
    const clampedHz = Math.max(baseHz * 0.3, Math.min(baseHz * 1.2, hz)); // 30% to 120% of base
    const calculatedRpm = (clampedHz / baseHz) * baseRpm;

    setLocalHz(clampedHz);
    setLocalRpm(calculatedRpm);
    onSpeedChange(pumpId, calculatedRpm, clampedHz);
  };

  const speedRatio = currentRpm / baseRpm;
  const flowMultiplier = speedRatio;
  const headMultiplier = speedRatio * speedRatio;
  const powerMultiplier = speedRatio * speedRatio * speedRatio;

  return (
    <Card className='space-y-4 p-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Label className='font-semibold'>{pumpName} - Motor Speed</Label>
          <Tooltip>
            <TooltipTrigger>
              <Info className='text-muted-foreground h-4 w-4' />
            </TooltipTrigger>
            <TooltipContent>
              <div className='space-y-1 text-xs'>
                <p>
                  <strong>Affinity Laws:</strong>
                </p>
                <p>Flow ∝ Speed (N₂/N₁)</p>
                <p>Head ∝ Speed² (N₂/N₁)²</p>
                <p>Power ∝ Speed³ (N₂/N₁)³</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className='flex items-center gap-2'>
          <Label htmlFor={`speed-enable-${pumpId}`} className='text-sm'>
            Enable Speed Adjustment
          </Label>
          <Switch
            id={`speed-enable-${pumpId}`}
            checked={enabled}
            onCheckedChange={(checked) => onEnabledChange(pumpId, checked)}
          />
        </div>
      </div>

      {enabled && (
        <>
          <div className='grid grid-cols-2 gap-4'>
            {/* RPM Control */}
            <div className='space-y-2'>
              <Label htmlFor={`rpm-${pumpId}`}>
                Motor Speed (RPM)
                <span className='text-muted-foreground ml-2 text-xs'>
                  Base: {baseRpm}
                </span>
              </Label>
              <Input
                id={`rpm-${pumpId}`}
                type='number'
                value={localRpm.toFixed(0)}
                onChange={(e) => handleRpmChange(e.target.value)}
                min={baseRpm * 0.3}
                max={baseRpm * 1.2}
                step={10}
              />
              <p className='text-muted-foreground text-xs'>
                Range: {(baseRpm * 0.3).toFixed(0)} -{' '}
                {(baseRpm * 1.2).toFixed(0)} RPM
              </p>
            </div>

            {/* Hz Control */}
            <div className='space-y-2'>
              <Label htmlFor={`hz-${pumpId}`}>
                Frequency (Hz)
                <span className='text-muted-foreground ml-2 text-xs'>
                  Base: {baseHz}
                </span>
              </Label>
              <Input
                id={`hz-${pumpId}`}
                type='number'
                value={localHz.toFixed(1)}
                onChange={(e) => handleHzChange(e.target.value)}
                min={baseHz * 0.3}
                max={baseHz * 1.2}
                step={0.1}
              />
              <p className='text-muted-foreground text-xs'>
                Range: {(baseHz * 0.3).toFixed(1)} - {(baseHz * 1.2).toFixed(1)}{' '}
                Hz
              </p>
            </div>
          </div>

          {/* Performance Impact */}
          <div className='bg-muted grid grid-cols-3 gap-2 rounded-lg p-3'>
            <div className='space-y-1'>
              <p className='text-xs font-medium'>Flow Impact</p>
              <Badge variant={speedRatio < 1 ? 'destructive' : 'default'}>
                {(flowMultiplier * 100).toFixed(1)}%
              </Badge>
            </div>
            <div className='space-y-1'>
              <p className='text-xs font-medium'>Head Impact</p>
              <Badge variant={speedRatio < 1 ? 'destructive' : 'default'}>
                {(headMultiplier * 100).toFixed(1)}%
              </Badge>
            </div>
            <div className='space-y-1'>
              <p className='text-xs font-medium'>Power Impact</p>
              <Badge variant={speedRatio < 1 ? 'secondary' : 'default'}>
                {(powerMultiplier * 100).toFixed(1)}%
              </Badge>
            </div>
          </div>

          {speedRatio !== 1 && (
            <div className='rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950'>
              <p className='font-medium'>
                Speed Ratio: {speedRatio.toFixed(3)}
              </p>
              <p className='text-muted-foreground mt-1'>
                The pump curve will be adjusted according to affinity laws
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
