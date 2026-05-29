'use client';

import { useState, useMemo, useEffect } from 'react';
import { PipeInputs } from './PipeInputs';
import { FrictionResults } from './FrictionResults';
import { PipeSelector } from './PipeSelector';
import { usePipeLibrary } from '../hooks/usePipeLibrary';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { SystemCurveComponent } from '@/types';
import { FlowUnit, HeadUnit, convertHead } from '@/lib/units';

interface FrictionLossModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (component: SystemCurveComponent) => void;
    initialData?: SystemCurveComponent;
    mode: 'discharge' | 'suction';
    globalFlowUnit: FlowUnit;
    globalHeadUnit: HeadUnit;
    onGlobalFlowUnitChange: (unit: FlowUnit) => void;
    onGlobalHeadUnitChange: (unit: HeadUnit) => void;
}

export function FrictionLossModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    mode,
    globalFlowUnit,
    globalHeadUnit,
    onGlobalFlowUnitChange,
    onGlobalHeadUnitChange
}: FrictionLossModalProps) {
    const { pipeTypes, getSizesForType, getPipeData } = usePipeLibrary();

    const [flowRate, setFlowRate] = useState(initialData?.operatingFlow || 0);
    const [pipeLength, setPipeLength] = useState(initialData?.length || 0);
    const [staticHead, setStaticHead] = useState(initialData?.staticHead || 0);
    const [nominalBore, setNominalBore] = useState(initialData?.nominalSize || '');
    const [pipeTypeId, setPipeTypeId] = useState<string>((initialData?.material as string) || (pipeTypes[0]?.id ?? ''));

    // Re-sync local form state whenever the modal switches to a different component.
    // Without this, the internal state from the previous add/edit persists across
    // clicks because the component itself never re-mounts (it is controlled by isOpen).
    useEffect(() => {
        setFlowRate(initialData?.operatingFlow ?? 0);
        setPipeLength(initialData?.length ?? 0);
        setStaticHead(initialData?.staticHead ?? 0);
        setNominalBore(initialData?.nominalSize ?? '');
        setPipeTypeId((initialData?.material as string) || (pipeTypes[0]?.id ?? ''));
    }, [initialData, pipeTypes]);

    const currentSizes = useMemo(() => getSizesForType(pipeTypeId), [getSizesForType, pipeTypeId]);

    // If we are editing, we might want to try to reverse calc or just start fresh?
    // The requirement says "Adding or editing a curve brings up a 'floating' view of the Friction Loss calculator where the user can edit the Pipe Type, Nominal Bore, Flow Rate, Pipe Length, Static Head and save it to the curve."
    // This implies we SHOULD persist the calculator inputs (Pipe Type, Bore, Length) in the component data if we want to edit them later.
    // I'll stick to what I can store in SystemCurveComponent for now. 
    // Wait, if I can't restore Pipe Length/Type, "Editing" won't show the previous values.
    // I should probably add `calculatorState` to `SystemCurveComponent` to support true editing.
    // But for this first pass, I'll focus on the output values. 
    // Actually, I'll assume users re-enter or I'll just use the basic values I have.

    const { id, c } = useMemo(() => {
        if (!pipeTypeId || !nominalBore) return { id: 160, c: 150 };
        return getPipeData(pipeTypeId, nominalBore);
    }, [nominalBore, pipeTypeId, getPipeData]);

    const standardizedFlowRate = useMemo(() => {
        switch (globalFlowUnit) {
            case 'L/min':
                return flowRate / 60;
            case 'm³/hr':
                return flowRate / 3.6;
            case 'L/sec':
            default:
                return flowRate;
        }
    }, [flowRate, globalFlowUnit]);

    const totalHeadLoss = useMemo(() => {
        const Q = standardizedFlowRate / 1000;
        const L = pipeLength;
        const D = id / 1000;
        const C = c;
        if (!D || !C || Q <= 0) return 0;
        const headLoss =
            (10.67 * L * Math.pow(Q, 1.852)) /
            (Math.pow(C, 1.852) * Math.pow(D, 4.87));
        return parseFloat(headLoss.toFixed(4));
    }, [standardizedFlowRate, pipeLength, id, c]);

    const units = {
        flowRate: globalFlowUnit,
        head: globalHeadUnit,
        id: 'mm',
        velocity: 'm/s'
    };

    const velocity = useMemo(() => {
        const radius = id / 2 / 1000;
        const area = Math.PI * radius * radius;
        return +(standardizedFlowRate / 1000 / area).toFixed(3);
    }, [id, standardizedFlowRate]);

    const velocityHead = useMemo(() => {
        return velocity ** 2 / (2 * 9.81);
    }, [velocity]);

    const totalSystemDuty = useMemo(() => {
        let totalHead;
        if (mode === 'discharge') {
            totalHead = totalHeadLoss + staticHead;
        } else {
            totalHead = 10.1325 + staticHead - totalHeadLoss - velocityHead;
        }
        const converted = convertHead(totalHead, 'm', globalHeadUnit).toFixed(2);
        return `${flowRate.toFixed(2)}${globalFlowUnit} @ ${converted}${globalHeadUnit}`;
    }, [
        flowRate,
        globalFlowUnit,
        totalHeadLoss,
        staticHead,
        globalHeadUnit,
        mode,
        velocityHead
    ]);

    const minID = +(1.128 * Math.sqrt((standardizedFlowRate * 1000) / 3)).toFixed(2);
    const maxID = +(1.128 * Math.sqrt((standardizedFlowRate * 1000) / 0.8)).toFixed(2);

    const handleSave = () => {
        // Determine the "Operating Head" to save.
        // For discharge: It's Static + Friction.
        // For suction: It's Static Pressure - Friction - Velocity Head?
        // The curve logic expects "Operating Head" to be the value at "Operating Flow".
        // For discharge, Curve(Q) = Static + k*Q^2. At Q_op, Curve(Q_op) = Operating Head.
        // So Operating Head = Static + Friction.

        // For suction, Curve(Q) = StaticPressure - k*Q^2. At Q_op, Curve(Q_op) = NPSHa.
        // So "Operating Head" in the component struct should probably be the RESULTING head (Total Dynamic Head or NPSHa).

        let calculatedHead = 0;
        if (mode === 'discharge') {
            calculatedHead = staticHead + totalHeadLoss;
        } else {
            // Ideally for Suction, we want the component to store "Static Pressure" as staticHead.
            // And "Operating NPSHa" as operatingHead.
            calculatedHead = 10.1325 + staticHead - totalHeadLoss - velocityHead;
        }

        const component: SystemCurveComponent = {
            id: initialData?.id || Date.now().toString(),
            name: initialData?.name || `Pipe Segment ${Date.now()}`,
            staticHead: staticHead,
            operatingFlow: flowRate,
            operatingHead: calculatedHead,
            flowUnit: globalFlowUnit,
            headUnit: 'm', // Force internal storage as 'm' if possible or keep user unit?

            // Persist calculator inputs
            length: pipeLength,
            diameter: id,
            nominalSize: nominalBore,
            material: pipeTypeId,
            cValue: c
        };

        // NOTE: The previous logic relied heavily on converting everything to 'm' and 'L/min' later or handled it in place.
        // I will pass the raw calculated values. The Dashboard logic has to handle units.
        // BUT wait, `totalHeadLoss` is in 'm' (calc) but displayed in `headUnit`.
        // Let's store everything in 'm' and 'L/min' internally to simplify aggregation?
        // Or store in the units selected here?
        // Ref: curve-dashboard converts everything.
        // Let's store in the units selected in this modal, so we can display them back if needed?
        // Actually, to make aggregation easy, converting to standard units here (L/min, m) is safer.

        // Let's stick to what the inputs are.
        // `flowRate` is in `flowRateUnit`.
        // `staticHead` is in... actually input doesn't restrict unit, it's just a number. 
        // `totalHeadLoss` calculation returns meters?
        // Looking at FrictionLossPage:
        // const headLoss = (10.67 * L *...) -> Hazen Williams usually output meters if D in meters?
        // Yes, standard metric formula gives head loss in meters.
        // `convertHead` function calculates display value.

        // So `totalHeadLoss` is in METERS.
        // `staticHead` input... user assumes it is in `headUnit`?
        // In `FrictionLossPage`, `totalHead = totalHeadLoss + staticHead`.
        // So `staticHead` is assumed to be in METERS there?
        // Wait, `convertHead(totalHead, 'm/Head', headUnit)`.
        // If `headUnit` is 'kPa', it converts totalHead (m) to kPa.
        // So `staticHead` input in that page was treated as METERS.

        // In `curve-dashboard`, we have global Flow and Head units.
        // A component might be added with "L/sec" and "m".
        // I should save the units used so we can convert properly.

        onSave({
            ...component,
            headUnit: 'm', // The calculator seems to work in meters internally for head loss.
            flowUnit: globalFlowUnit,
            // We'll treat `staticHead` and `operatingHead` as fitting `headUnit`?
            // Actually `operatingHead` derived from `totalHeadLoss` (m) + `staticHead` (m).
            // So they are in meters.
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className='max-h-[90vh] w-full min-w-5xl max-w-6xl overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle>Friction Loss Calculator - {mode === 'discharge' ? 'Discharge' : 'Suction'} Pipe</DialogTitle>
                </DialogHeader>

                <div className='flex flex-col gap-6 lg:flex-row'>
                    {/* Inputs Column */}
                    <div className='w-full space-y-4 lg:w-1/2'>
                        <PipeSelector
                            pipeTypes={pipeTypes}
                            loading={false}
                            pipeTypeId={pipeTypeId}
                            setPipeTypeId={(val) => {
                                setPipeTypeId(val);
                                setNominalBore('');
                            }}
                            nominalSize={nominalBore}
                            setNominalSize={setNominalBore}
                            sizes={currentSizes}
                        />

                        <div className='flex flex-wrap items-center gap-4'>
                            <div className='flex items-center gap-2'>
                                <span><strong>Head Unit:</strong></span>
                                <Select value={globalHeadUnit} onValueChange={(val: any) => onGlobalHeadUnitChange(val)}>
                                    <SelectTrigger className='w-24'><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='m'>m/Head</SelectItem>
                                        <SelectItem value='kPa'>kPa</SelectItem>
                                        <SelectItem value='psi'>psi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className='flex items-center gap-2'>
                                <span><strong>Flow Unit:</strong></span>
                                <Select value={globalFlowUnit} onValueChange={(val: any) => onGlobalFlowUnitChange(val)}>
                                    <SelectTrigger className='w-24'><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='L/sec'>L/sec</SelectItem>
                                        <SelectItem value='L/min'>L/min</SelectItem>
                                        <SelectItem value='m³/hr'>m³/hr</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <PipeInputs
                            flowRate={flowRate}
                            setFlowRate={setFlowRate}
                            pipeLength={pipeLength}
                            setPipeLength={setPipeLength}
                            staticHead={staticHead}
                            setStaticHead={setStaticHead}
                            flowRateUnit={globalFlowUnit}
                        />
                    </div>

                    {/* Results Column */}
                    <div className='w-full space-y-4 lg:w-1/2'>
                        <FrictionResults
                            totalHeadLoss={convertHead(totalHeadLoss, 'm', globalHeadUnit)}
                            totalSystemDuty={totalSystemDuty}
                            velocity={velocity}
                            minID={minID}
                            maxID={maxID}
                            units={{ ...units, head: globalHeadUnit }}
                        >
                            <div className='mt-6 flex justify-end gap-3'>
                                <Button variant='outline' onClick={onClose}>Cancel</Button>
                                <Button onClick={handleSave}>Save Pipe Component</Button>
                            </div>
                        </FrictionResults>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
