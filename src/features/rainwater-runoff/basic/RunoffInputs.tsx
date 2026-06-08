'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type Props = {
  setSelectedCity: (city: string) => void;
  catchmentArea: number;
  setCatchmentArea: (v: number) => void;
  runoffCoeff: number;
  setRunoffCoeff: (v: number) => void;
  rainMode: 'depth' | 'intensity';
  setRainMode: (v: 'depth' | 'intensity') => void;
  rainDepth: number;
  setRainDepth: (v: number) => void;
  rainIntensity: number;
  setRainIntensity: (v: number) => void;
  stormDuration: number;
  setStormDuration: (v: number) => void;
  pumpWindow: number;
  setPumpWindow: (v: number) => void;
  storageMethod: 'minimum' | 'manual' | 'round';
  setStorageMethod: (v: 'minimum' | 'manual' | 'round') => void;
  manualStorage: number;
  setManualStorage: (v: number) => void;
  wellDiameter: number;
  setWellDiameter: (v: number) => void;
  drawdown: number;
  setDrawdown: (v: number) => void;
  selectedPumpFlow: number;
  setSelectedPumpFlow: (v: number) => void;
  minPumpFlow: number;
  setMinPumpFlow: (v: number) => void;
  allowableDischarge: number | '';
  setAllowableDischarge: (v: number | '') => void;
  handleCalculate: () => void;
};

export default function RunoffInputs({
  setSelectedCity,
  catchmentArea,
  setCatchmentArea,
  runoffCoeff,
  setRunoffCoeff,
  rainMode,
  setRainMode,
  rainDepth,
  setRainDepth,
  rainIntensity,
  setRainIntensity,
  stormDuration,
  setStormDuration,
  pumpWindow,
  setPumpWindow,
  storageMethod,
  setStorageMethod,
  manualStorage,
  setManualStorage,
  wellDiameter,
  setWellDiameter,
  drawdown,
  setDrawdown,
  selectedPumpFlow,
  setSelectedPumpFlow,
  minPumpFlow,
  setMinPumpFlow,
  allowableDischarge,
  setAllowableDischarge,
  handleCalculate,
}: Props) {

  const handleManualRainfallChange = (value: number, field: 'depth' | 'intensity' | 'duration') => {
    setSelectedCity('Custom / Manual'); // Decouple from city default when typing manually
    if (field === 'depth') {
      setRainDepth(value);
    } else if (field === 'intensity') {
      setRainIntensity(value);
    } else if (field === 'duration') {
      setStormDuration(value);
    }
  };

  const handleResetDefaults = () => {
    setSelectedCity('Adelaide');
    setCatchmentArea(200);
    setRunoffCoeff(1.00);
    setRainMode('depth');
    setRainDepth(60);
    setRainIntensity(30);
    setStormDuration(120);
    setPumpWindow(30);
    setStorageMethod('minimum');
    setManualStorage(3);
    setWellDiameter(1.5);
    setDrawdown(1.7);
    setSelectedPumpFlow(10);
    setMinPumpFlow(10);
    setAllowableDischarge('');
  };

  return (
    <div className="space-y-4 w-full">
      {/* 1. Catchment & Rainfall */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">1. Catchment & Rainfall</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="catchmentArea">Catchment area, A (m²)</Label>
              <Input
                id="catchmentArea"
                type="number"
                min={0}
                value={catchmentArea || ''}
                onChange={(e) => setCatchmentArea(Number(e.target.value))}
              />
              <span className="text-[11px] text-muted-foreground">Section 9 is for areas &lt; 2000 m².</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="runoffCoeff">Runoff coefficient, C</Label>
              <Input
                id="runoffCoeff"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={runoffCoeff || ''}
                onChange={(e) => setRunoffCoeff(Number(e.target.value))}
              />
              <span className="text-[11px] text-muted-foreground">1.00 for roofs/pavements.</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rainMode">Rainfall input method</Label>
            <Select value={rainMode} onValueChange={(val: 'depth' | 'intensity') => setRainMode(val)}>
              <SelectTrigger id="rainMode">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="depth">Rainfall depth (mm)</SelectItem>
                <SelectItem value="intensity">Rainfall intensity (mm/hr)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rainMode === 'depth' ? (
            <div className="grid gap-2">
              <Label htmlFor="rainDepth">Rainfall depth, d (mm)</Label>
              <Input
                id="rainDepth"
                type="number"
                min={0}
                step={0.1}
                value={rainDepth || ''}
                onChange={(e) => handleManualRainfallChange(Number(e.target.value), 'depth')}
              />
              <span className="text-[11px] text-muted-foreground">For 10-year, 120-min storm.</span>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="rainIntensity">Rainfall intensity, I (mm/hr)</Label>
              <Input
                id="rainIntensity"
                type="number"
                min={0}
                step={0.1}
                value={rainIntensity || ''}
                onChange={(e) => handleManualRainfallChange(Number(e.target.value), 'intensity')}
              />
              <span className="text-[11px] text-muted-foreground">Depth will be calculated as Intensity × duration.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stormDuration">Storm duration (min)</Label>
              <Input
                id="stormDuration"
                type="number"
                min={1}
                value={stormDuration || ''}
                onChange={(e) => handleManualRainfallChange(Number(e.target.value), 'duration')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pumpWindow">Storage window (min)</Label>
              <Input
                id="pumpWindow"
                type="number"
                min={1}
                value={pumpWindow || ''}
                onChange={(e) => setPumpWindow(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Wet Well Active Storage */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">2. Wet Well Active Storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="storageMethod">Volume method</Label>
            <Select value={storageMethod} onValueChange={(val: 'minimum' | 'manual' | 'round') => setStorageMethod(val)}>
              <SelectTrigger id="storageMethod">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimum">Use Section 9 minimum active storage</SelectItem>
                <SelectItem value="manual">Enter actual active storage</SelectItem>
                <SelectItem value="round">Calculate from round diameter & drawdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {storageMethod === 'manual' && (
            <div className="grid gap-2">
              <Label htmlFor="manualStorage">Actual active storage (m³)</Label>
              <Input
                id="manualStorage"
                type="number"
                min={0}
                step={0.01}
                value={manualStorage || ''}
                onChange={(e) => setManualStorage(Number(e.target.value))}
              />
            </div>
          )}

          {storageMethod === 'round' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="wellDiameter">Wet well diameter (m)</Label>
                <Input
                  id="wellDiameter"
                  type="number"
                  min={0}
                  step={0.01}
                  value={wellDiameter || ''}
                  onChange={(e) => setWellDiameter(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="drawdown">Active drawdown (m)</Label>
                <Input
                  id="drawdown"
                  type="number"
                  min={0}
                  step={0.01}
                  value={drawdown || ''}
                  onChange={(e) => setDrawdown(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Pump Flow & Discharge Limit */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">3. Pump Flow & Discharge Limit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="selectedPumpFlow">Duty pump flow (L/s)</Label>
              <Input
                id="selectedPumpFlow"
                type="number"
                min={0}
                step={0.1}
                value={selectedPumpFlow || ''}
                onChange={(e) => setSelectedPumpFlow(Number(e.target.value))}
              />
              <span className="text-[11px] text-muted-foreground">Treat as single duty flow rate.</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minPumpFlow">Min pump note (L/s)</Label>
              <Input
                id="minPumpFlow"
                type="number"
                min={0}
                step={0.1}
                value={minPumpFlow || ''}
                onChange={(e) => setMinPumpFlow(Number(e.target.value))}
              />
              <span className="text-[11px] text-muted-foreground">Section 9 note advises &ge; 10 L/s.</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="allowableDischarge">Allowable discharge limit (L/s)</Label>
            <Input
              id="allowableDischarge"
              type="number"
              min={0}
              step={0.1}
              placeholder="Optional"
              value={allowableDischarge === '' ? '' : allowableDischarge}
              onChange={(e) => {
                const val = e.target.value;
                setAllowableDischarge(val === '' ? '' : Number(val));
              }}
            />
            <span className="text-[11px] text-muted-foreground">Checks that pump flow does not overload discharge systems.</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 cursor-pointer" onClick={handleCalculate}>
              Calculate
            </Button>
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={handleResetDefaults}>
              Reset defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
