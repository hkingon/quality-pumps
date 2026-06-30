'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { SuctionCurveData, SystemCurveComponent } from '@/types';
import { Check, Edit2, Trash, X, Plus, ChevronDown, ChevronUp, Lock } from 'lucide-react';
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
  isGuest?: boolean;
  onGuestSignUp?: () => void;
}

export function SuctionCurveInputs({
  suction,
  index,
  updateSuctionCurve,
  removeSuctionCurve,
  globalFlowUnit,
  globalHeadUnit,
  onGlobalFlowUnitChange,
  onGlobalHeadUnitChange,
  isGuest = false,
  onGuestSignUp
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

    let totalStaticGeometric = 0;
    newComponents.forEach(c => {
      totalStaticGeometric += c.staticHead || 0;
    });

    updateSuctionCurve(suction.id, {
      components: newComponents,
      staticPressure: 10.1325 + totalStaticGeometric,
      operatingFlow: component.operatingFlow,
    });
    setIsModalOpen(false);
    setEditingComponentId(null);
  };

  const removeComponent = (compId: string) => {
    const newComponents = (suction.components || []).filter(c => c.id !== compId);
    updateSuctionCurve(suction.id, { components: newComponents });
  };

  const handleAddPipeClick = () => {
    if (isGuest) {
      onGuestSignUp?.();
      return;
    }
    setEditingComponentId(null);
    setIsModalOpen(true);
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
          {suction.components?.map((comp) => (
            <Card key={comp.id} className='bg-muted min-w-[200px] p-3'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-sm font-medium'>Suction Pipe</span>
                <div className='flex gap-1'>
                  <Button size='icon' variant='ghost' className='h-6 w-6' onClick={() => {
                    setEditingComponentId(comp.id);
                    setIsModalOpen(true);
                  }}>
                    <Edit2 className='h-3 w-3' />
                  </Button>
                  <Button size='icon' variant='ghost' className='text-destructive h-6 w-6' onClick={() => removeComponent(comp.id)}>
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

          {/* Add Pipe / Sign-up gate */}
          <div
            className='border-muted-foreground/30 bg-muted/40 hover:bg-muted/70 flex min-w-[130px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors'
            onClick={handleAddPipeClick}
          >
            {isGuest ? (
              <>
                <Lock className='text-muted-foreground mb-2 h-8 w-8' />
                <span className='text-muted-foreground text-center text-xs font-medium leading-tight'>
                  Sign up to add pipe
                </span>
              </>
            ) : (
              <>
                <Plus className='text-muted-foreground mb-2 h-8 w-8' />
                <span className='text-muted-foreground font-medium'>Add Pipe</span>
              </>
            )}
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
