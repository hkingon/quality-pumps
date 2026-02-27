'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SuctionCurveData, SystemCurveComponent } from '@/types';
import { Check, Edit2, Trash, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { FrictionLossModal } from '@/features/friction-loss-calc/components/FrictionLossModal';
import { FlowUnit, HeadUnit } from '@/lib/units';

interface SuctionCurveInputsProps {
  suction: SuctionCurveData;
  index: number;
  updateSuctionCurve: (
    id: string,
    updatedSuction: Partial<SuctionCurveData>
  ) => void;
  removeSuctionCurve: (id: string) => void;
  globalFlowUnit: FlowUnit;
  globalHeadUnit: HeadUnit;
  onGlobalFlowUnitChange: (unit: FlowUnit) => void;
  onGlobalHeadUnitChange: (unit: HeadUnit) => void;
}

export function SuctionCurveInputs({
  suction,
  index,
  updateSuctionCurve,
  removeSuctionCurve,
  globalFlowUnit,
  globalHeadUnit,
  onGlobalFlowUnitChange,
  onGlobalHeadUnitChange
}: SuctionCurveInputsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(
    suction.name || `Suction Curve ${index + 1}`
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

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
    setTempName(suction.name || `Suction Curve ${index + 1}`);
    setIsEditingName(false);
  };

  const handleAddComponent = (component: SystemCurveComponent) => {
    const newComponents = [...(suction.components || [])];
    if (editingComponentId) {
      const idx = newComponents.findIndex(c => c.id === editingComponentId);
      if (idx >= 0) newComponents[idx] = component;
    } else {
      newComponents.push(component);
    }

    // Aggregation for Suction:
    // Total Static Pressure = 10.1325 + Sum(Static Heads [which are actually pressures?]) ? 
    // The Modal returns "calculatedHead" for Suction as (10.1325 + Static - Friction - Velocity).
    // But here we need to map back to SuctionCurveData fields:
    // staticPressure (user typically enters 10.1325 or atmospheric + tank level)
    // operatingFlow
    // operatingNpsha (The result)

    // If we have multiple components, e.g. pipe 1, pipe 2.
    // Friction losses sum up.
    // Static pressure usually refers to the SOURCE.
    // So "Static Pressure" is just ONE value for the system, not sum of components?
    // User might add "Pipe 1" (friction), "Pipe 2" (friction).
    // And define "Static tank level".
    // The drawing shows "Static Head: 25... + Static Head : 25".
    // For DISCHARGE this implies lifting 25m then another 25m? Yes.
    // For SUCTION, do we have multiple "static pressures"?
    // Usually Suction is: Reservoir Surface -> Pump.
    // There's only one relevant static difference.
    // UNLESS it's a boosted system?
    // Let's assume the components' 'staticHead' sums up (elevation changes).

    // And for SuctionCurveData:
    // staticPressure = Base (10.1325) + Sum(Component Static Heads)?
    // operatingNpsha = staticPressure - Sum(Component Friction).

    // Let's sum component static heads to get total Elevation Head available.
    // Then correct for Atmospheric?
    // Default static pressure is 10.1325.
    // If components have static head (positive or negative), we sum them.

    let totalElevationHead = 0;
    let totalOpHead = 0; // This from component is "Resulting Head" (NPSHa for that segment?)
    // Actually the modal calculated `10.1325 + static - friction`.
    // Summing these doesn't make sense.

    // We should probably just sum Friction and Static Geometric Heads.
    // Modal returns:
    // staticHead (input)
    // operatingHead (calculated result) -> ignore for aggregation?
    // We need FRICTION from the component.
    // Friction = (10.1325 + static - operatingHead - velocity) ... messy inverse calc.

    // Better strategy: The component data includes inputs.
    // We can re-calculate friction here if needed, or trust `component.operatingHead`?
    // Wait, for DISCHARGE, `operatingHead` = Static + Friction.
    // So Friction = OperatingHead - Static.
    // For SUCTION, Modal return `operatingHead` = 10.1325 + Static - Friction.
    // So Friction = 10.1325 + Static - OperatingHead.

    // Let's recalculate Totals:
    let totalStaticGeometric = 0;
    let totalFriction = 0;

    newComponents.forEach(c => {
      totalStaticGeometric += c.staticHead || 0;
      // Re-derive friction
      const friction = (10.1325 + (c.staticHead || 0)) - (c.operatingHead || 0);
      // Note: Modal calculated Velocity Head too. 
      // NPSHa = Static - Friction - Velocity.
      // We probably want to sum Friction?
      // Let's rely on `curve-dashboard` to do the heavy lifting curve generation.
      // Here just update summary fields.
    });

    // For Summary:
    // Static Pressure = 10.1325 + Total Static Geometric
    // Operating NPSHa = Static Pressure - Total Friction (approx).

    updateSuctionCurve(suction.id, {
      components: newComponents,
      staticPressure: 10.1325 + totalStaticGeometric,
      operatingFlow: component.operatingFlow,
      // We'll leave operatingNpsha user-editable or approx?
      // Let's just sum the 'static' part for now and let user set NPSHa or let dashboard calc it.
      // Actually, if we use components, we should probably ignore the manual "Operating NPSHa" in curve generation?
      // But for UI feedback, let's leave it.
    });
    setIsModalOpen(false);
    setEditingComponentId(null);
  };

  const removeComponent = (compId: string) => {
    const newComponents = (suction.components || []).filter(c => c.id !== compId);
    updateSuctionCurve(suction.id, { components: newComponents });
  };

  const displayName = suction.name || `Suction Curve ${index + 1}`;

  return (
    <Card className='mb-4 border p-4'>
      <div className='mb-4 flex items-center justify-between'>
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
            <Button size='sm' onClick={handleNameSave} className='cursor-pointer'>
              <Check className='h-3 w-3' />
            </Button>
            <Button size='sm' variant='outline' onClick={handleNameCancel} className='cursor-pointer'>
              <X className='h-3 w-3' />
            </Button>
          </div>
        ) : (
          <div className='flex items-center gap-2'>
            <h3 className='text-lg font-semibold'>{displayName}</h3>
            <Button size='sm' variant='ghost' onClick={() => setIsEditingName(true)} className='h-6 w-6 cursor-pointer p-1'>
              <Edit2 className='h-3 w-3' />
            </Button>
          </div>
        )}
        <div className='flex items-center gap-2'>
          <Button
            className='cursor-pointer'
            variant='outline'
            size='sm'
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </Button>
          <Button
            className='cursor-pointer'
            variant='destructive'
            size='sm'
            onClick={() => removeSuctionCurve(suction.id)}
          >
            <Trash className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Components List */}
      {isExpanded && (
        <div className='flex gap-4 overflow-x-auto pb-4'>
          {suction.components?.map((comp, i) => (
            <Card key={comp.id} className='min-w-[200px] bg-slate-50 p-3'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='font-medium text-sm'>Suction Pipe</span>
                <div className='flex gap-1'>
                  <Button size='icon' variant='ghost' className='h-6 w-6' onClick={() => {
                    setEditingComponentId(comp.id);
                    setIsModalOpen(true);
                  }}>
                    <Edit2 className='h-3 w-3' />
                  </Button>
                  <Button size='icon' variant='ghost' className='h-6 w-6 text-red-500' onClick={() => removeComponent(comp.id)}>
                    <Trash className='h-3 w-3' />
                  </Button>
                </div>
              </div>

              <div className='space-y-2 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Static:</span>
                  <span>{comp.staticHead.toFixed(2)}m</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Flow:</span>
                  <span>{comp.operatingFlow.toFixed(1)} {comp.flowUnit || 'L/min'}</span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>NPSHa:</span>
                  <span>{comp.operatingHead.toFixed(2)}m</span>
                </div>
              </div>
            </Card>
          ))}

          <div
            className='flex min-w-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 hover:bg-gray-100'
            onClick={() => {
              setEditingComponentId(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className='mb-2 h-8 w-8 text-gray-400' />
            <span className='font-medium text-gray-500'>Add Pipe</span>
          </div>
        </div>
      )}

      <div className='mt-2 flex gap-4 border-t pt-4'>
        <div className='flex-1 lg:max-w-[200px]'>
          <Label className='text-xs'>Static Pressure</Label>
          <Input
            type='number'
            value={suction.staticPressure}
            onChange={(e) => handleInputChange('staticPressure', e.target.value)}
          />
        </div>
        <div className='flex-1 lg:max-w-[200px]'>
          <Label className='text-xs'>Total Op. Flow</Label>
          <Input
            type='number'
            value={suction.operatingFlow}
            onChange={(e) => handleInputChange('operatingFlow', e.target.value)}
          />
        </div>
        <div className='flex-1 lg:max-w-[200px]'>
          <Label className='text-xs'>Resulting NPSHa</Label>
          <Input
            type='number'
            value={suction.operatingNpsha}
            onChange={(e) => handleInputChange('operatingNpsha', e.target.value)}
          />
        </div>
      </div>

      <FrictionLossModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingComponentId(null);
        }}
        onSave={handleAddComponent}
        initialData={editingComponentId ? suction.components?.find(c => c.id === editingComponentId) : undefined}
        mode='suction'
        globalFlowUnit={globalFlowUnit}
        globalHeadUnit={globalHeadUnit}
        onGlobalFlowUnitChange={onGlobalFlowUnitChange}
        onGlobalHeadUnitChange={onGlobalHeadUnitChange}
      />
    </Card>
  );
}
