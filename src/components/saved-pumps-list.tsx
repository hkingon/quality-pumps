'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { SavedPump, SystemCurveData } from '@/types';
import { Pencil, Plus, Search, X, Filter, ChevronDown } from 'lucide-react';
import { convertFlow, convertHead, FlowUnit, HeadUnit } from '@/lib/units';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PumpDetailView from '@/features/pumps/pump-details-view';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { NumericRangeFilter } from '@/components/numeric-range-filter';
import {
  FilterState,
  initialFilters,
  PUMP_CLASS_OPTIONS,
  APPLICATION_OPTIONS,
  IMPELLER_TYPE_OPTIONS,
  INSTALLATION_CONFIG_OPTIONS,
  OTHER_TRAITS_OPTIONS,
  PHASE_OPTIONS,
  POLE_OPTIONS
} from '@/types/filters';

interface SavedPumpsListProps {
  savedPumps: SavedPump[];
  publicPumps?: SavedPump[];
  systemCurveData?: SystemCurveData[];
  addSavedPumpToChart: (pump: SavedPump) => void;
  removeSavedPumpFromChart: (pump: SavedPump) => void;
  removeSavedPump: (id: string) => void;
  editPumpFromSaved: (pump: SavedPump) => void;
  headUnit: HeadUnit;
  flowUnit: FlowUnit;
  dischargeCurveMode?: 'and' | 'or';
}

export function SavedPumpsList({
  savedPumps,
  publicPumps = [],
  systemCurveData = [],
  addSavedPumpToChart,
  removeSavedPumpFromChart,
  removeSavedPump,
  editPumpFromSaved,
  headUnit,
  flowUnit,
  dischargeCurveMode = 'or'
}: SavedPumpsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pumpsOnChart, setPumpsOnChart] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const allPumps = useMemo(() => {
    const ownedPumps = savedPumps.map((pump) => ({
      ...pump,
      isPublic: false,
      isOwned: true
    }));

    const savedPumpIds = new Set(savedPumps.map((p) => p.id));
    const uniquePublicPumps = publicPumps
      .filter((pump) => !savedPumpIds.has(pump.id))
      .map((pump) => ({
        ...pump,
        isPublic: true,
        isOwned: false
      }));

    return [...ownedPumps, ...uniquePublicPumps];
  }, [savedPumps, publicPumps]);

  useEffect(() => {
    const storedPumpsOnChart = sessionStorage.getItem('pumpsOnChart');
    if (storedPumpsOnChart) {
      try {
        const parsed = JSON.parse(storedPumpsOnChart);
        if (Array.isArray(parsed)) {
          setPumpsOnChart(parsed);
        }
      } catch (error) {
        console.error('Error parsing pumpsOnChart from sessionStorage:', error);
      }
    }
  }, []);

  const operatingFlow = systemCurveData[0]?.operatingFlow || 0;
  const operatingHead = systemCurveData[0]?.operatingHead || 0;

  // Get unique brands for filter
  const uniqueBrands = useMemo(
    () => [
      ...new Set(savedPumps.map((p) => p.brand).filter((b): b is string => !!b))
    ],
    [savedPumps]
  );

  const togglePumpOnChart = (pump: SavedPump) => {
    const isAdded = pumpsOnChart.includes(pump.id);
    if (isAdded) {
      const updatedPumps = pumpsOnChart.filter((id) => id !== pump.id);
      setPumpsOnChart(updatedPumps);
      sessionStorage.setItem('pumpsOnChart', JSON.stringify(updatedPumps));
      removeSavedPumpFromChart(pump);
    } else {
      const updatedPumps = [...pumpsOnChart, pump.id];
      setPumpsOnChart(updatedPumps);
      sessionStorage.setItem('pumpsOnChart', JSON.stringify(updatedPumps));
      addSavedPumpToChart(pump);
    }
  };

  const clearAllFilters = () => {
    setFilters(initialFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;

    // Count multi-select filters
    if (filters.pumpClass.length > 0) count++;
    if (filters.application.length > 0) count++;
    if (filters.impellerType.length > 0) count++;
    if (filters.installationConfiguration.length > 0) count++;
    if (filters.otherTraits.length > 0) count++;
    if (filters.phases.length > 0) count++;
    if (filters.poles.length > 0) count++;
    if (filters.brand.length > 0) count++;

    // Count numeric range filters
    if (filters.powerRange.min !== null || filters.powerRange.max !== null)
      count++;
    if (filters.currentRange.min !== null || filters.currentRange.max !== null)
      count++;
    if (filters.voltageRange.min !== null || filters.voltageRange.max !== null)
      count++;
    if (
      filters.inletSizeRange.min !== null ||
      filters.inletSizeRange.max !== null
    )
      count++;
    if (
      filters.outletSizeRange.min !== null ||
      filters.outletSizeRange.max !== null
    )
      count++;
    if (
      filters.temperatureRange.min !== null ||
      filters.temperatureRange.max !== null
    )
      count++;

    return count;
  };

  // Helper function to check if pump matches multi-select filter
  const matchesMultiSelect = (
    pumpValue: string | string[] | undefined,
    selectedValues: string[]
  ): boolean => {
    if (selectedValues.length === 0) return true;
    if (!pumpValue) return false;

    if (Array.isArray(pumpValue)) {
      // If pump has multiple values, check if any of them are in the selected values
      return pumpValue.some(val => selectedValues.includes(val));
    }

    return selectedValues.includes(pumpValue);
  };

  // Helper function to check numeric range
  const isInRange = (
    value: number | undefined,
    range: { min: number | null; max: number | null }
  ): boolean => {
    if (range.min === null && range.max === null) return true;
    if (value === undefined || value === null) return false;
    if (range.min !== null && value < range.min) return false;
    if (range.max !== null && value > range.max) return false;
    return true;
  };

  const filteredPumps = useMemo(() => {
    return allPumps
      .filter((pump) => {
        // Search query
        if (
          searchQuery &&
          !pump.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        // Multi-select filters
        if (!matchesMultiSelect(pump.pumpClass, filters.pumpClass))
          return false;
        if (!matchesMultiSelect(pump.application, filters.application))
          return false;
        if (!matchesMultiSelect(pump.impellerType, filters.impellerType))
          return false;
        if (
          !matchesMultiSelect(
            pump.configuration,
            filters.installationConfiguration
          )
        )
          return false;

        // Other traits - check if pump has any of the selected traits
        if (filters.otherTraits.length > 0) {
          const pumpTraits = pump.otherTraits || [];
          const hasMatchingTrait = filters.otherTraits.some((trait) =>
            pumpTraits.includes(trait)
          );
          if (!hasMatchingTrait) return false;
        }

        // Phases - handle "1 Phase", "3 Phase", "DC" format
        if (filters.phases.length > 0) {
          const pumpPhaseStr = pump.phases?.toString();
          const matchesPhase = filters.phases.some((phase) => {
            if (phase === '1 Phase') return pumpPhaseStr === '1';
            if (phase === '3 Phase') return pumpPhaseStr === '3';
            if (phase === 'DC') {
              const typeArr = Array.isArray(pump.type) ? pump.type : [pump.type || ''];
              return typeArr.some(t =>
                t.toLowerCase().includes('dc') ||
                t.toLowerCase().includes('solar')
              );
            }
            return false;
          });
          if (!matchesPhase) return false;
        }

        // Poles
        if (!matchesMultiSelect(pump.poles?.toString(), filters.poles))
          return false;

        // Brand
        if (!matchesMultiSelect(pump.brand || '', filters.brand)) return false;

        // Numeric range filters
        if (!isInRange(pump.kw, filters.powerRange)) return false;
        if (!isInRange(pump.amps, filters.currentRange)) return false;
        if (!isInRange(pump.voltage, filters.voltageRange)) return false;
        if (!isInRange(pump.inlet, filters.inletSizeRange)) return false;
        if (!isInRange(pump.outlet, filters.outletSizeRange)) return false;
        if (!isInRange(pump.maxTemp, filters.temperatureRange)) return false;

        return true;
      })
      .map((pump) => {
        const pumpMaxFlow = convertFlow(pump.maxFlow, pump.flowUnit, flowUnit);
        const pumpMaxHead = convertHead(pump.maxHead, pump.headUnit, headUnit);

        let bepFlow = 0;
        let bepHead = 0;

        if (pump.pvsq && pump.pvsq.length > 0) {
          let maxProduct = 0;
          pump.pvsq.forEach((point) => {
            const product = point.flow * point.head;
            if (product > maxProduct) {
              maxProduct = product;
              bepFlow = point.flow;
              bepHead = point.head;
            }
          });
        } else {
          const numPoints = 100;
          let maxProduct = 0;
          for (let i = 0; i <= numPoints; i++) {
            const flow = (pump.maxFlow * i) / numPoints;
            const head = pump.maxHead * (1 - Math.pow(flow / pump.maxFlow, 2));
            const product = flow * head;
            if (product > maxProduct) {
              maxProduct = product;
              bepFlow = flow;
              bepHead = head;
            }
          }
        }

        const bepFlowConverted = convertFlow(bepFlow, pump.flowUnit, flowUnit);
        const bepHeadConverted = convertHead(bepHead, pump.headUnit, headUnit);

        const getDutyMetrics = (targetFlow: number, targetHead: number) => {
          const targetFlowInPumpUnits = convertFlow(targetFlow, flowUnit, pump.flowUnit);
          const targetHeadInPumpUnits = convertHead(targetHead, headUnit, pump.headUnit);

          let canMeet = false;
          if (
            targetFlowInPumpUnits > 0 &&
            targetHeadInPumpUnits > 0 &&
            targetFlowInPumpUnits <= pump.maxFlow
          ) {
            if (pump.pvsq && pump.pvsq.length > 0) {
              const sortedPoints = [...pump.pvsq].sort((a, b) => a.flow - b.flow);
              let pumpHeadAtOperatingFlow = 0;
              let lowerPoint = sortedPoints[0];
              let upperPoint = sortedPoints[sortedPoints.length - 1];

              for (let i = 0; i < sortedPoints.length - 1; i++) {
                if (
                  sortedPoints[i].flow <= targetFlowInPumpUnits &&
                  sortedPoints[i + 1].flow >= targetFlowInPumpUnits
                ) {
                  lowerPoint = sortedPoints[i];
                  upperPoint = sortedPoints[i + 1];
                  break;
                }
              }

              if (lowerPoint.flow === upperPoint.flow) {
                pumpHeadAtOperatingFlow = lowerPoint.head;
              } else {
                const ratio =
                  (targetFlowInPumpUnits - lowerPoint.flow) /
                  (upperPoint.flow - lowerPoint.flow);
                pumpHeadAtOperatingFlow =
                  lowerPoint.head + ratio * (upperPoint.head - lowerPoint.head);
              }

              const tolerance = 0.1;
              canMeet = targetHeadInPumpUnits <= pumpHeadAtOperatingFlow + tolerance;
            } else {
              const pumpHeadAtOperatingFlow =
                pump.maxHead * (1 - Math.pow(targetFlowInPumpUnits / pump.maxFlow, 2));
              const tolerance = 0.1;
              canMeet = targetHeadInPumpUnits <= pumpHeadAtOperatingFlow + tolerance;
            }
          }

          let s = Infinity;
          if (
            canMeet &&
            targetFlow > 0 &&
            targetHead > 0 &&
            bepFlowConverted > 0 &&
            bepHeadConverted > 0
          ) {
            const k = 1;
            const etaDuty = 0.65;
            const flowRatio = targetFlow / bepFlowConverted;
            const headRatio = targetHead / bepHeadConverted;

            if (flowRatio > 0 && headRatio > 0) {
              const flowTerm = Math.pow(Math.log(flowRatio), 2);
              const headTerm = Math.pow(Math.log(headRatio), 2);
              const efficiencyTerm = k * (1 - etaDuty);
              s = Math.sqrt(flowTerm + headTerm) + efficiencyTerm;
            }
          }

          const dist = Math.sqrt(
            Math.pow(bepFlowConverted - targetFlow, 2) +
            Math.pow(bepHeadConverted - targetHead, 2)
          );

          return { canMeet, score: s, bepDistance: dist };
        };

        const validDuties = systemCurveData.filter(d => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0);
        
        let overallCanMeetDuty = dischargeCurveMode === 'and' ? true : false;
        let finalScore = Infinity;
        let finalBepDistance = Infinity;

        if (validDuties.length === 0) {
          overallCanMeetDuty = false;
          finalScore = Infinity;
          finalBepDistance = 0;
        } else {
          if (dischargeCurveMode === 'and') {
             let totalScore = 0;
             let totalDistance = 0;
             for (const duty of validDuties) {
               const metrics = getDutyMetrics(duty.operatingFlow, duty.operatingHead);
               overallCanMeetDuty = overallCanMeetDuty && metrics.canMeet;
               totalScore += metrics.score;
               totalDistance += metrics.bepDistance;
             }
             if (overallCanMeetDuty) {
               finalScore = totalScore;
               finalBepDistance = totalDistance;
             } else {
               finalBepDistance = totalDistance; // sum of distances still
             }
          } else {
             // OR mode
             for (const duty of validDuties) {
               const metrics = getDutyMetrics(duty.operatingFlow, duty.operatingHead);
               overallCanMeetDuty = overallCanMeetDuty || metrics.canMeet;
               if (metrics.canMeet && metrics.score < finalScore) {
                 finalScore = metrics.score;
                 finalBepDistance = metrics.bepDistance;
               }
             }
             // Fallback for distance if not meeting any
             if (!overallCanMeetDuty) {
               let minDistance = Infinity;
               for (const duty of validDuties) {
                 const metrics = getDutyMetrics(duty.operatingFlow, duty.operatingHead);
                 if (metrics.bepDistance < minDistance) {
                   minDistance = metrics.bepDistance;
                 }
               }
               finalBepDistance = minDistance !== Infinity ? minDistance : 0;
             }
          }
        }

        return {
          ...pump,
          bepDistance: finalBepDistance !== Infinity ? finalBepDistance : 0,
          canMeetDuty: overallCanMeetDuty,
          score: finalScore,
          bepFlow: bepFlowConverted,
          bepHead: bepHeadConverted,
          convertedMaxFlow: pumpMaxFlow,
          convertedMaxHead: pumpMaxHead
        };
      })
      .sort((a, b) => {
        if (a.canMeetDuty && !b.canMeetDuty) return -1;
        if (!a.canMeetDuty && b.canMeetDuty) return 1;
        if (a.canMeetDuty && b.canMeetDuty) {
          return a.score - b.score;
        }
        return a.bepDistance - b.bepDistance;
      });
  }, [
    allPumps,
    searchQuery,
    filters,
    systemCurveData,
    flowUnit,
    headUnit,
    dischargeCurveMode
  ]);

  const handleViewPump = (pumpId: string): void => {
    setSelectedPumpId(pumpId);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className='space-y-4'>
      {/* Search Bar */}
      <div className='relative'>
        <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
        <Input
          type='text'
          placeholder='Search pumps...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='pl-8'
        />
      </div>

      {/* Filter Section */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant='outline' className='w-full justify-between'>
            <div className='flex items-center gap-2'>
              <Filter className='h-4 w-4' />
              <span>Filters</span>
              {getActiveFilterCount() > 0 && (
                <Badge variant='secondary' className='ml-2'>
                  {getActiveFilterCount()}
                </Badge>
              )}
            </div>
            <ChevronDown className='h-4 w-4' />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='mt-4 space-y-4'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {/* Pump Class - Hierarchical */}
            <MultiSelectFilter
              label='Pump Class'
              options={PUMP_CLASS_OPTIONS}
              selected={filters.pumpClass}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, pumpClass: selected }))
              }
              placeholder='Select pump class...'
            />

            {/* Application */}
            <MultiSelectFilter
              label='Application'
              options={APPLICATION_OPTIONS}
              selected={filters.application}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, application: selected }))
              }
              placeholder='Select application...'
            />

            {/* Impeller Type */}
            <MultiSelectFilter
              label='Impeller Type'
              options={IMPELLER_TYPE_OPTIONS}
              selected={filters.impellerType}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, impellerType: selected }))
              }
              placeholder='Select impeller type...'
            />

            {/* Installation Configuration */}
            <MultiSelectFilter
              label='Installation Configuration'
              options={INSTALLATION_CONFIG_OPTIONS}
              selected={filters.installationConfiguration}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({
                  ...prev,
                  installationConfiguration: selected
                }))
              }
              placeholder='Select configuration...'
            />

            {/* Other Traits */}
            <MultiSelectFilter
              label='Other Traits'
              options={OTHER_TRAITS_OPTIONS}
              selected={filters.otherTraits}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, otherTraits: selected }))
              }
              placeholder='Select traits...'
            />

            {/* Phases */}
            <MultiSelectFilter
              label='Phases'
              options={PHASE_OPTIONS}
              selected={filters.phases}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, phases: selected }))
              }
              placeholder='Select phases...'
            />

            {/* Poles */}
            <MultiSelectFilter
              label='Poles'
              options={POLE_OPTIONS}
              selected={filters.poles}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, poles: selected }))
              }
              placeholder='Select poles...'
            />

            {/* Brand */}
            <MultiSelectFilter
              label='Brand'
              options={uniqueBrands}
              selected={filters.brand}
              onSelectionChange={(selected) =>
                setFilters((prev) => ({ ...prev, brand: selected }))
              }
              placeholder='Select brands...'
            />

            {/* Power Range */}
            <NumericRangeFilter
              label='Power Range'
              range={filters.powerRange}
              onRangeChange={(range) =>
                setFilters((prev) => ({ ...prev, powerRange: range }))
              }
              unit='kW'
              placeholder={{ min: 'Min kW', max: 'Max kW' }}
            />

            {/* Current Range */}
            <NumericRangeFilter
              label='Current Range'
              range={filters.currentRange}
              onRangeChange={(range) =>
                setFilters((prev) => ({ ...prev, currentRange: range }))
              }
              unit='A'
              placeholder={{ min: 'Min A', max: 'Max A' }}
            />

            {/* Voltage Range */}
            <NumericRangeFilter
              label='Voltage Range'
              range={filters.voltageRange}
              onRangeChange={(range) =>
                setFilters((prev) => ({ ...prev, voltageRange: range }))
              }
              unit='V'
              placeholder={{ min: 'Min V', max: 'Max V' }}
            />

            {/* Inlet Size Range */}
            <NumericRangeFilter
              label='Inlet Size'
              range={filters.inletSizeRange}
              onRangeChange={(range) =>
                setFilters((prev) => ({ ...prev, inletSizeRange: range }))
              }
              unit='mm'
              placeholder={{ min: 'Min', max: 'Max' }}
            />

            {/* Outlet Size Range */}
            <NumericRangeFilter
              label='Outlet Size'
              range={filters.outletSizeRange}
              onRangeChange={(range) =>
                setFilters((prev) => ({ ...prev, outletSizeRange: range }))
              }
              unit='mm'
              placeholder={{ min: 'Min', max: 'Max' }}
            />

            {/* Temperature Range */}
            <NumericRangeFilter
              label='Pumped Liquid Temperature'
              range={filters.temperatureRange}
              onRangeChange={(range) =>
                setFilters((prev) => ({ ...prev, temperatureRange: range }))
              }
              unit='°C'
              placeholder={{ min: 'Min', max: 'Max' }}
            />
          </div>

          {/* Clear Filters Button */}
          {getActiveFilterCount() > 0 && (
            <Button onClick={clearAllFilters} variant='outline' size='sm'>
              Clear All Filters
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Operating Duty Info */}
      {systemCurveData.some(d => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0) && (
        <div className='text-muted-foreground bg-muted rounded p-2 text-xs'>
          <strong>Operating Duties ({dischargeCurveMode === 'and' ? 'AND Mode' : 'OR Mode'}):</strong>{' '}
          {systemCurveData.filter(d => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0).map((d, i) => (
            <span key={i}>
              {i > 0 && ' | '}
              {Number(d.operatingFlow).toFixed(1)} {flowUnit} at {Number(d.operatingHead).toFixed(1)} {headUnit}
            </span>
          ))}
          <br />
          <em>Pumps are sorted by suitability score (lower is better).</em>
        </div>
      )}

      {/* Results Count */}
      <div className='text-muted-foreground text-sm'>
        Showing {filteredPumps.length} of {allPumps.length} pumps
        {publicPumps.length > 0 && (
          <span className='ml-2 text-xs'>
            ({savedPumps.length} saved, {publicPumps.length} public)
          </span>
        )}
      </div>

      {/* Pumps List */}
      {filteredPumps.length === 0 ? (
        <div className='text-muted-foreground py-8 text-center'>
          {allPumps.length === 0
            ? 'No saved or public pumps available.'
            : 'No pumps match your search and filters.'}
        </div>
      ) : (
        <ul className='max-h-[400px] space-y-2 overflow-y-auto'>
          {filteredPumps.map((pump, index) => {
            const isOnChart = pumpsOnChart.includes(pump.id);
            return (
              <li
                key={pump.id}
                className={`flex items-center justify-between rounded border p-2 ${pump.canMeetDuty && pump.score <= 1.2
                  ? 'border-green-300 bg-green-100 dark:border-green-800 dark:bg-green-950'
                  : pump.canMeetDuty && pump.score > 1.2
                    ? 'border-yellow-300 bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-950'
                    : 'border-red-300 bg-red-100 dark:border-red-800 dark:bg-red-950'
                  }`}
              >
                <div className='mr-2 truncate'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className='flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 hover:underline'
                        style={{
                          all: 'unset',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onClick={() => handleViewPump(pump.id)}
                        aria-label='View pump curves'
                      >
                        <span className='font-medium'>{pump.name}</span>
                        {pump.isPublic && (
                          <span className='rounded bg-blue-600 px-1 py-0.5 text-xs text-white dark:bg-blue-700'>
                            PUBLIC
                          </span>
                        )}
                        {index === 0 && pump.canMeetDuty && (
                          <span className='rounded bg-green-600 px-1 py-0.5 text-xs text-white dark:bg-green-700'>
                            BEST
                          </span>
                        )}
                        {!pump.canMeetDuty && (
                          <span className='rounded bg-red-600 px-1 py-0.5 text-xs text-white dark:bg-red-700'>
                            UNABLE
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side='right' align='center'>
                      View pump curves
                    </TooltipContent>
                  </Tooltip>
                  <div className='text-muted-foreground text-xs'>
                    Head: {pump.convertedMaxHead.toFixed(1)} {headUnit}, Flow:{' '}
                    {pump.convertedMaxFlow.toFixed(1)} {flowUnit}
                  </div>
                  <div className='flex items-center gap-1 text-muted-foreground text-xs'>
                    Brand: {pump.brand} | Type:
                    <div className='flex flex-wrap gap-1 ml-1'>
                      {Array.isArray(pump.type) ? (
                        pump.type.map((t) => (
                          <Badge key={t} variant='secondary' className='px-1 py-0 text-[10px] h-4'>
                            {t}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant='secondary' className='px-1 py-0 text-[10px] h-4'>
                          {pump.type || 'N/A'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {systemCurveData.some(d => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0) && (
                    <div className='text-muted-foreground text-xs'>
                      BEP: {pump.bepFlow.toFixed(1)} {flowUnit} at{' '}
                      {pump.bepHead.toFixed(1)} {headUnit}
                      {pump.canMeetDuty && pump.score !== Infinity && (
                        <span className='ml-2 text-green-600 dark:text-green-400'>
                          (Score: {pump.score.toFixed(3)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className='flex shrink-0 gap-2'>
                  <Button
                    className='cursor-pointer border border-black'
                    variant={isOnChart ? 'destructive' : 'outline'}
                    size='sm'
                    onClick={() => togglePumpOnChart(pump)}
                  >
                    {isOnChart ? (
                      <X className='h-4 w-4' />
                    ) : (
                      <Plus className='h-4 w-4' />
                    )}
                  </Button>
                  {!pump.isPublic && (
                    <Button
                      className='cursor-pointer border border-black'
                      variant='secondary'
                      size='sm'
                      onClick={() => editPumpFromSaved(pump)}
                    >
                      <Pencil className='h-3 w-3' />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className='no-scrollbar max-h-[95vh] max-w-[95vw] min-w-[80vw] overflow-y-auto p-0'>
          {selectedPumpId && (
            <PumpDetailView
              pumpId={selectedPumpId}
              onClose={() => setIsDetailsModalOpen(false)}
              isModal={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
