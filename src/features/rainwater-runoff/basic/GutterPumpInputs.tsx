/**
 * @deprecated
 * This gutter pump input component is not currently used by the basic rainwater calculator.
 * It was part of an earlier experimental flow. Retained for possible future use.
 */

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GutterPumpInputsProps {
    // gutterSize: number;
    // setGutterSize: (value: number) => void;
    pumpFlowRate: number;
    setPumpFlowRate: (value: number) => void;
    pumpDutyCycle: number;
    setPumpDutyCycle: (value: number) => void;
    startsPerHour: number;
    setStartsPerHour: (value: number) => void;
}

export default function GutterPumpInputs({
    // gutterSize,
    // setGutterSize,
    pumpFlowRate,
    setPumpFlowRate,
    pumpDutyCycle,
    setPumpDutyCycle,
    startsPerHour,
    setStartsPerHour,
}: GutterPumpInputsProps) {
    return (
        <div className="w-full max-w-md space-y-4 p-4 border rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold">Gutter & Pump Inputs</h3>

            {/* <div className="grid gap-2">
                <Label htmlFor="gutterSize">Gutter Size (mm)</Label>
                <Input
                    id="gutterSize"
                    type="number"
                    value={gutterSize}
                    onChange={(e) => setGutterSize(Number(e.target.value))}
                />
            </div> */}

            <div className="grid gap-2">
                <Label htmlFor="pumpFlowRate">Pump Flow Rate (L/sec)</Label>
                <Input
                    id="pumpFlowRate"
                    type="number"
                    value={pumpFlowRate}
                    onChange={(e) => setPumpFlowRate(Number(e.target.value))}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="pumpDutyCycle">Pump Duty Cycle (%)</Label>
                <Input
                    id="pumpDutyCycle"
                    type="number"
                    value={pumpDutyCycle}
                    onChange={(e) => setPumpDutyCycle(Number(e.target.value))}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="startsPerHour">Starts per Hour</Label>
                <Input
                    id="startsPerHour"
                    type="number"
                    value={startsPerHour}
                    onChange={(e) => setStartsPerHour(Number(e.target.value))}
                />
            </div>
        </div>
    );
}
