'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SystemCurveData, SystemCurveComponent } from '@/types';
import { Check, Edit2, Trash, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { FrictionLossModal } from '@/features/friction-loss-calc/components/FrictionLossModal';
import { FlowUnit, HeadUnit } from '@/lib/units';

interface SystemCurveInputsProps {
  system: SystemCurveData;
  index: number;
  updateSystemCurve: (
    id: string,
    updatedSystem: Partial<SystemCurveData>
  ) => void;
  removeSystemCurve: (id: string) => void;
  globalFlowUnit: FlowUnit;
  globalHeadUnit: HeadUnit;
  onGlobalFlowUnitChange: (unit: FlowUnit) => void;
  onGlobalHeadUnitChange: (unit: HeadUnit) => void;
}

export function SystemCurveInputs({
  system,
  index,
  updateSystemCurve,
  removeSystemCurve,
  globalFlowUnit,
  globalHeadUnit,
  onGlobalFlowUnitChange,
  onGlobalHeadUnitChange
}: SystemCurveInputsProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(
    system.name || `Discharge System ${index + 1}`
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

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
    setTempName(system.name || `Discharge System ${index + 1}`);
    setIsEditingName(false);
  };

  const handleAddComponent = (component: SystemCurveComponent) => {
    const newComponents = [...(system.components || [])];
    if (editingComponentId) {
      const idx = newComponents.findIndex(c => c.id === editingComponentId);
      if (idx >= 0) newComponents[idx] = component;
    } else {
      newComponents.push(component);
    }

    // Update system totals based on components
    // Aggregation logic:
    // Total Static Head = Sum(Components Static Head)
    // Operating Flow = Max(Components Flow)? Or assume they are in series and flow is same?
    // Usually pipe systems are series. Flow is constant.
    // If components have different flows, it's ambiguous.
    // Detailed logic in generateCurves will handle it properly.
    // For the summary fields here, we'll just sum static heads and take the flow of the first/last component?

    let totalStaticHead = 0;
    let totalOperatingHead = 0;
    // Assuming series flow, usually we design for a target flow.
    // We'll take the flow from the added component as the "System Flow" if not set?

    newComponents.forEach(c => {
      totalStaticHead += c.staticHead || 0;
      // Operating Head is total head at Q_op.
      // If we sum them, we get total system head required at that Q.
      totalOperatingHead += c.operatingHead || 0;
    });

    updateSystemCurve(system.id, {
      components: newComponents,
      staticHead: totalStaticHead,
      operatingFlow: component.operatingFlow, // Update to latest component flow
      operatingHead: totalOperatingHead
    });
    setIsModalOpen(false);
    setEditingComponentId(null);
  };

  const removeComponent = (compId: string) => {
    const newComponents = (system.components || []).filter(c => c.id !== compId);

    let totalStaticHead = 0;
    let totalOperatingHead = 0;
    newComponents.forEach(c => {
      totalStaticHead += c.staticHead || 0;
      totalOperatingHead += c.operatingHead || 0;
    });

    updateSystemCurve(system.id, {
      components: newComponents,
      staticHead: totalStaticHead,
      operatingHead: totalOperatingHead
    });
  };

  const displayName = system.name || `Discharge System ${index + 1}`;

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
            onClick={() => removeSystemCurve(system.id)}
          >
            <Trash className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {/* Components List Horizontal Scroll */}
      {isExpanded && (
        <div className='flex gap-4 overflow-x-auto pb-4'>
          {system.components?.map((comp, i) => (
            <Card key={comp.id} className='min-w-[200px] bg-muted/30 p-3'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='font-medium text-sm'>Discharge Curve</span>
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
                  <span className='text-muted-foreground'>Op. Head:</span>
                  <span>{comp.operatingHead.toFixed(2)}m</span>
                </div>
              </div>
            </Card>
          ))}

          {/* Add Pipe Button */}
          <div
            className='flex min-w-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4 hover:bg-muted/50'
            onClick={() => {
              setEditingComponentId(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className='mb-2 h-8 w-8 text-muted-foreground' />
            <span className='font-medium text-muted-foreground'>Add Pipe</span>
          </div>
        </div>
      )}

      {/* Manual Overrides / Totals */}
      <div className='mt-2 flex gap-4 border-t pt-4'>
        <div className='flex-1 lg:max-w-[200px]'>
          <Label className='text-xs'>Total Static Head</Label>
          <Input
            type='number'
            value={system.staticHead}
            onChange={(e) => handleInputChange('staticHead', e.target.value)}
          />
        </div>
        <div className='flex-1 lg:max-w-[200px]'>
          <Label className='text-xs'>Target Flow</Label>
          <Input
            type='number'
            value={system.operatingFlow}
            onChange={(e) => handleInputChange('operatingFlow', e.target.value)}
          />
        </div>
        <div className='flex-1 lg:max-w-[200px]'>
          <Label className='text-xs'>Total Op. Head</Label>
          <Input
            type='number'
            value={system.operatingHead}
            onChange={(e) => handleInputChange('operatingHead', e.target.value)}
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
        initialData={editingComponentId ? system.components?.find(c => c.id === editingComponentId) : undefined}
        mode='discharge'
        globalFlowUnit={globalFlowUnit}
        globalHeadUnit={globalHeadUnit}
        onGlobalFlowUnitChange={onGlobalFlowUnitChange}
        onGlobalHeadUnitChange={onGlobalHeadUnitChange}
      />
    </Card>
  );
}
