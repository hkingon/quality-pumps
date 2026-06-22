'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, X, FileText } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

/** Selection metrics shown on the per-pump card (and reused by the report). */
export interface CardMetrics {
  capable: boolean;
  score: number;
  badge: { label: string; colorClass: string };
  model?: string;
  pumpType?: string;
  dutyFlow?: number;
  dutyHead?: number;
  efficiencyPct?: number;
  absorbedKW?: number;
  kwhPerML?: number;
  bepPct?: number;
}

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
  metrics?: CardMetrics;
  flowUnit?: string;
  headUnit?: string;
  onRemove?: (pumpId: string) => void;
  onShowReport?: (pumpId: string) => void;
}

const fmt = (v: number | undefined, digits = 1): string =>
  v === undefined || !isFinite(v) ? '—' : v.toFixed(digits);

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='space-y-0.5'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='text-sm font-semibold'>{value}</p>
    </div>
  );
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
  onEnabledChange,
  metrics,
  flowUnit = 'L/min',
  headUnit = 'm',
  onRemove,
  onShowReport
}: MotorSpeedControlProps) {
  const [localRpm, setLocalRpm] = useState(currentRpm.toFixed(0));
  const [localHz, setLocalHz] = useState(currentHz.toFixed(1));

  useEffect(() => {
    setLocalRpm(currentRpm.toFixed(0));
    setLocalHz(currentHz.toFixed(1));
  }, [currentRpm, currentHz]);

  const commitRpmChange = (value: string) => {
    let rpm = parseFloat(value);
    if (isNaN(rpm)) {
      setLocalRpm(currentRpm.toFixed(0));
      return;
    }
    const clampedRpm = Math.max(baseRpm * 0.3, Math.min(baseRpm * 1.2, rpm)); // 30% to 120% of base
    const calculatedHz = (clampedRpm / baseRpm) * baseHz;

    setLocalRpm(clampedRpm.toFixed(0));
    setLocalHz(calculatedHz.toFixed(1));
    if (clampedRpm !== currentRpm) {
      onSpeedChange(pumpId, clampedRpm, calculatedHz);
    }
  };

  const commitHzChange = (value: string) => {
    let hz = parseFloat(value);
    if (isNaN(hz)) {
      setLocalHz(currentHz.toFixed(1));
      return;
    }
    const clampedHz = Math.max(baseHz * 0.3, Math.min(baseHz * 1.2, hz)); // 30% to 120% of base
    const calculatedRpm = (clampedHz / baseHz) * baseRpm;

    setLocalHz(clampedHz.toFixed(1));
    setLocalRpm(calculatedRpm.toFixed(0));
    if (clampedHz !== currentHz) {
      onSpeedChange(pumpId, calculatedRpm, clampedHz);
    }
  };

  const speedRatio = currentRpm / baseRpm;
  const flowMultiplier = speedRatio;
  const headMultiplier = speedRatio * speedRatio;
  const powerMultiplier = speedRatio * speedRatio * speedRatio;

  const displayName = metrics?.model || pumpName;
  const capable = metrics ? metrics.capable : true;

  return (
    <Card className='space-y-4 p-4'>
      {/* Header: model + status badge + remove */}
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <Label className='truncate font-semibold'>{displayName}</Label>
            {metrics && (
              <Badge
                variant='secondary'
                className='flex items-center gap-1.5 whitespace-nowrap'
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${metrics.badge.colorClass}`}
                />
                {metrics.badge.label}
              </Badge>
            )}
          </div>
          {metrics?.pumpType && (
            <p className='text-muted-foreground mt-0.5 truncate text-xs'>
              {metrics.pumpType}
            </p>
          )}
        </div>
        {onRemove && (
          <Button
            variant='ghost'
            size='icon'
            className='text-muted-foreground hover:text-destructive h-7 w-7 shrink-0 cursor-pointer'
            onClick={() => onRemove(pumpId)}
            title='Remove from graph'
          >
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Selection metrics */}
      {metrics &&
        (capable ? (
          <div className='bg-muted/50 grid grid-cols-3 gap-3 rounded-lg p-3'>
            <Metric label='Score' value={fmt(metrics.score, 1)} />
            <Metric
              label='Actual duty'
              value={
                metrics.dutyFlow !== undefined
                  ? `${fmt(metrics.dutyFlow, 1)} ${flowUnit} @ ${fmt(metrics.dutyHead, 1)} ${headUnit}`
                  : '—'
              }
            />
            <Metric label='Efficiency' value={`${fmt(metrics.efficiencyPct, 0)}%`} />
            <Metric label='Absorbed' value={`${fmt(metrics.absorbedKW, 2)} kW`} />
            <Metric label='Energy' value={`${fmt(metrics.kwhPerML, 1)} kWh/ML`} />
            <Metric label='BEP' value={`${fmt(metrics.bepPct, 0)}%`} />
          </div>
        ) : (
          <div className='rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300'>
            Pump not capable of the duty (no operating point within the curve).
          </div>
        ))}

      {/* Speed adjustment */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Label className='text-sm font-medium'>Motor Speed</Label>
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
                value={localRpm}
                onChange={(e) => setLocalRpm(e.target.value)}
                onBlur={(e) => commitRpmChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRpmChange(e.currentTarget.value);
                }}
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
                value={localHz}
                onChange={(e) => setLocalHz(e.target.value)}
                onBlur={(e) => commitHzChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitHzChange(e.currentTarget.value);
                }}
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

      {/* Full report */}
      {onShowReport && (
        <Button
          variant='outline'
          className='w-full cursor-pointer'
          onClick={() => onShowReport(pumpId)}
        >
          <FileText className='mr-2 h-4 w-4' />
          Show full report
        </Button>
      )}
    </Card>
  );
}
