'use client';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { SavedPump, SystemCurveData } from '@/types';
import {
  Pencil,
  Plus,
  Search,
  Trash,
  X,
  Filter,
  ChevronDown
} from 'lucide-react';
import { convertFlow, convertHead, FlowUnit, HeadUnit } from '@/lib/units';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import Link from 'next/link';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PumpDetailView from '@/features/pumps/pump-details-view';

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
}

interface FilterState {
  type: string;
  configuration: string;
  brand: string;
  powerRange: string;
  phases: string;
  voltage: string;
  inletSize: string;
  current: string;
  model: string;
  outletSize: string;
  temperatureRange: string;
  flowRange: string;
  headRange: string;
}

const initialFilters: FilterState = {
  type: '',
  configuration: '',
  brand: '',
  powerRange: '',
  phases: '',
  voltage: '',
  inletSize: '',
  model: '',
  current: '',
  outletSize: '',
  temperatureRange: '',
  flowRange: '',
  headRange: ''
};

// Filter options based on your pump types
// const pumpTypes = [
//   'Centrifugal',
//   'Positive Displacement',
//   'Axial',
//   'Mixed Flow',
//   'Drainage Pump',
//   'Horizontal Multistage',
//   'End Suction Centrifugal',
//   'Submersible Vortex',
//   'Grinder',
//   'Jet Pressure Pump',
//   'Submersible Drainage Pump'
// ];
// const configurations = [
//   'End Suction',
//   'Split Case',
//   'Vertical Turbine',
//   'Inline',
//   'Self Priming',
//   'Single Pump'
// ];
const phaseOptions = ['1', '3'];
// const voltageRanges = ['110-240V', '380-480V', '500V+'];
const powerRanges = ['0-1 kW', '1-5 kW', '5-15 kW', '15-50 kW', '50+ kW'];
const sizeRanges = ['15-25mm', '25-50mm', '50-100mm', '100-200mm', '200mm+'];
const temperatureRanges = ['0-40°C', '40-80°C', '80-120°C', '120°C+'];
const currentRanges = ['0-10A', '10-25A', '25-50A', '50-100A', '100A+'];

export function SavedPumpsList({
  savedPumps,
  publicPumps = [],
  systemCurveData = [],
  addSavedPumpToChart,
  removeSavedPumpFromChart,
  removeSavedPump,
  editPumpFromSaved,
  headUnit,
  flowUnit
}: SavedPumpsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pumpsOnChart, setPumpsOnChart] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const allPumps = useMemo(() => {
  // For admins: only show saved pumps (owned), don't mix with public pumps
  // This prevents showing the same pump twice (once as owned, once as public)
  const ownedPumps = savedPumps.map((pump) => ({
    ...pump,
    isPublic: false,
    isOwned: true
  }));

  // For non-admins: show their saved pumps + public pumps from others
  // Filter out public pumps that are already in their saved pumps
  const savedPumpIds = new Set(savedPumps.map(p => p.id));
  const uniquePublicPumps = publicPumps
    .filter(pump => !savedPumpIds.has(pump.id))
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

  // Get operating conditions from the first system curve
  const operatingFlow = systemCurveData[0]?.operatingFlow || 0;
  const operatingHead = systemCurveData[0]?.operatingHead || 0;

  // Get unique values for filter dropdowns
  const uniqueBrands = [
    ...new Set(savedPumps.map((p) => p.brand).filter((b): b is string => !!b))
  ];
  const uniqueModels = [
    ...new Set(savedPumps.map((p) => p.model).filter((m): m is string => !!m))
  ];

  const uniqueTypes = [
    ...new Set(savedPumps.map((p) => p.type).filter((t): t is string => !!t))
  ];
  const uniqueConfigurations = [
    ...new Set(
      savedPumps.map((p) => p.configuration).filter((c): c is string => !!c)
    )
  ];

  const uniqueVoltages = [
    ...new Set(
      savedPumps.map((p) => p.voltage).filter((v): v is number => v != null)
    )
  ];
  const voltageOptions = [
    ...uniqueVoltages.map((v) => `${v}V`),
    '110-240V',
    '380-480V',
    '500V+'
  ].filter((v, i, arr) => arr.indexOf(v) === i);

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
    return Object.values(filters).filter((value) => value !== '').length;
  };

  // Helper functions for range filtering
  const isInPowerRange = (power: number, range: string) => {
    switch (range) {
      case '0-1 kW':
        return power >= 0 && power <= 1;
      case '1-5 kW':
        return power > 1 && power <= 5;
      case '5-15 kW':
        return power > 5 && power <= 15;
      case '15-50 kW':
        return power > 15 && power <= 50;
      case '50+ kW':
        return power > 50;
      default:
        return true;
    }
  };

  const isInSizeRange = (size: number, range: string) => {
    switch (range) {
      case '15-25mm':
        return size >= 15 && size <= 25;
      case '25-50mm':
        return size > 25 && size <= 50;
      case '50-100mm':
        return size > 50 && size <= 100;
      case '100-200mm':
        return size > 100 && size <= 200;
      case '200mm+':
        return size > 200;
      default:
        return true;
    }
  };

  const isInTemperatureRange = (temp: number, range: string) => {
    switch (range) {
      case '0-40°C':
        return temp >= 0 && temp <= 40;
      case '40-80°C':
        return temp > 40 && temp <= 80;
      case '80-120°C':
        return temp > 80 && temp <= 120;
      case '120°C+':
        return temp > 120;
      default:
        return true;
    }
  };

  const isInVoltageRange = (voltage: number, range: string) => {
    if (range.endsWith('V') && !range.includes('-') && !range.includes('+')) {
      const targetVoltage = parseInt(range.replace('V', ''));
      return voltage === targetVoltage;
    }

    switch (range) {
      case '110-240V':
        return voltage >= 110 && voltage <= 240;
      case '380-480V':
        return voltage >= 380 && voltage <= 480;
      case '500V+':
        return voltage > 500;
      default:
        return true;
    }
  };

  const isInCurrentRange = (current: number, range: string) => {
    switch (range) {
      case '0-10A':
        return current >= 0 && current <= 10;
      case '10-25A':
        return current > 10 && current <= 25;
      case '25-50A':
        return current > 25 && current <= 50;
      case '50-100A':
        return current > 50 && current <= 100;
      case '100A+':
        return current > 100;
      default:
        return true;
    }
  };

  const filteredPumps = useMemo(() => {
    return allPumps
      .filter((pump) => {
        if (
          searchQuery &&
          !pump.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        if (filters.type && pump.type !== filters.type) return false;
        if (
          filters.configuration &&
          pump.configuration !== filters.configuration
        )
          return false;
        if (filters.brand && pump.brand !== filters.brand) return false;
        if (filters.model && pump.model !== filters.model) return false;
        if (filters.phases && pump.phases?.toString() !== filters.phases)
          return false;

        // Range filters
        if (
          filters.powerRange &&
          !isInPowerRange(pump.kw || 0, filters.powerRange)
        )
          return false;
        if (
          filters.voltage &&
          !isInVoltageRange(pump.voltage || 0, filters.voltage)
        )
          return false;
        if (
          filters.current &&
          !isInCurrentRange(pump.amps || 0, filters.current)
        )
          return false;
        if (
          filters.inletSize &&
          !isInSizeRange(pump.inlet || 0, filters.inletSize)
        )
          return false;
        if (
          filters.outletSize &&
          !isInSizeRange(pump.outlet || 0, filters.outletSize)
        )
          return false;
        if (
          filters.temperatureRange &&
          !isInTemperatureRange(pump.maxTemp || 0, filters.temperatureRange)
        )
          return false;

        return true;
      })
      .map((pump) => {
        const pumpMaxFlow = convertFlow(pump.maxFlow, pump.flowUnit, flowUnit);
        const pumpMaxHead = convertHead(pump.maxHead, pump.headUnit, headUnit);

        // Convert operating duty to pump's original units for proper comparison
        const operatingFlowInPumpUnits = convertFlow(
          operatingFlow,
          flowUnit,
          pump.flowUnit
        );
        const operatingHeadInPumpUnits = convertHead(
          operatingHead,
          headUnit,
          pump.headUnit
        );

        // Check if pump can meet duty (operating point should be below pump curve)
        let canMeetDuty = false;

        if (
          operatingFlowInPumpUnits > 0 &&
          operatingHeadInPumpUnits > 0 &&
          operatingFlowInPumpUnits <= pump.maxFlow
        ) {
          // Check if pump has actual PvsQ data points
          if (pump.pvsq && pump.pvsq.length > 0) {
            // Use actual pump curve data
            const sortedPoints = [...pump.pvsq].sort((a, b) => a.flow - b.flow);

            // Find interpolated head at operating flow
            let pumpHeadAtOperatingFlow = 0;

            // Find the two points that bracket the operating flow
            let lowerPoint = sortedPoints[0];
            let upperPoint = sortedPoints[sortedPoints.length - 1];

            for (let i = 0; i < sortedPoints.length - 1; i++) {
              if (
                sortedPoints[i].flow <= operatingFlowInPumpUnits &&
                sortedPoints[i + 1].flow >= operatingFlowInPumpUnits
              ) {
                lowerPoint = sortedPoints[i];
                upperPoint = sortedPoints[i + 1];
                break;
              }
            }

            // Interpolate or extrapolate the head value
            if (lowerPoint.flow === upperPoint.flow) {
              pumpHeadAtOperatingFlow = lowerPoint.head;
            } else {
              const ratio =
                (operatingFlowInPumpUnits - lowerPoint.flow) /
                (upperPoint.flow - lowerPoint.flow);
              pumpHeadAtOperatingFlow =
                lowerPoint.head + ratio * (upperPoint.head - lowerPoint.head);
            }

            // Check if operating head is below pump curve (with small tolerance for measurement errors)
            const tolerance = 0.1; // 10cm tolerance
            canMeetDuty =
              operatingHeadInPumpUnits <= pumpHeadAtOperatingFlow + tolerance;
          } else {
            // Use standard pump curve equation: H = Hmax * (1 - (Q/Qmax)^2)
            const pumpHeadAtOperatingFlow =
              pump.maxHead *
              (1 - Math.pow(operatingFlowInPumpUnits / pump.maxFlow, 2));

            // Check if operating head is below pump curve (with small tolerance)
            const tolerance = 0.1; // 10cm tolerance
            canMeetDuty =
              operatingHeadInPumpUnits <= pumpHeadAtOperatingFlow + tolerance;
          }
        } else {
          // If operating flow exceeds pump max flow, pump cannot meet duty
          canMeetDuty = false;
        }

        // Calculate BEP using actual pump curve data when available
        let bepFlow = 0;
        let bepHead = 0;

        if (pump.pvsq && pump.pvsq.length > 0) {
          // Use actual pump curve data to find BEP (maximum efficiency point)
          // For pumps with actual data, BEP is typically around the point with maximum power (flow * head)
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
          // Use standard calculation for theoretical BEP
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

        // Convert BEP values to display units for consistency
        const bepFlowConverted = convertFlow(bepFlow, pump.flowUnit, flowUnit);
        const bepHeadConverted = convertHead(bepHead, pump.headUnit, headUnit);

        // Calculate score using converted values for display consistency
        let score = Infinity;
        if (
          canMeetDuty &&
          operatingFlow > 0 &&
          operatingHead > 0 &&
          bepFlowConverted > 0 &&
          bepHeadConverted > 0
        ) {
          const k = 1;
          const etaDuty = 0.65;
          const flowRatio = operatingFlow / bepFlowConverted;
          const headRatio = operatingHead / bepHeadConverted;

          if (flowRatio > 0 && headRatio > 0) {
            const flowTerm = Math.pow(Math.log(flowRatio), 2);
            const headTerm = Math.pow(Math.log(headRatio), 2);
            const efficiencyTerm = k * (1 - etaDuty);
            score = Math.sqrt(flowTerm + headTerm) + efficiencyTerm;
          }
        }

        const bepDistance = Math.sqrt(
          Math.pow(bepFlowConverted - operatingFlow, 2) +
            Math.pow(bepHeadConverted - operatingHead, 2)
        );

        return {
          ...pump,
          bepDistance,
          canMeetDuty,
          score,
          bepFlow: bepFlowConverted,
          bepHead: bepHeadConverted,
          convertedMaxFlow: pumpMaxFlow,
          convertedMaxHead: pumpMaxHead
        };
      })
      .sort((a, b) => {
        // First priority: Pumps that can meet duty vs those that cannot
        if (a.canMeetDuty && !b.canMeetDuty) return -1;
        if (!a.canMeetDuty && b.canMeetDuty) return 1;

        // Second priority: Among pumps that can meet duty, sort by score (lower is better)
        if (a.canMeetDuty && b.canMeetDuty) {
          return a.score - b.score;
        }

        // For pumps that cannot meet duty, sort by BEP distance as fallback
        return a.bepDistance - b.bepDistance;
      });
  }, [
    allPumps,
    searchQuery,
    filters,
    operatingFlow,
    operatingHead,
    flowUnit,
    headUnit
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
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2'>
            {/* Type Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Type</label>
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Types' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Configuration Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Configuration</label>
              <Select
                value={filters.configuration}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, configuration: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Configurations' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Configurations</SelectItem>
                  {uniqueConfigurations.map((config) => (
                    <SelectItem key={config} value={config}>
                      {config}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Brand</label>
              <Select
                value={filters.brand}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, brand: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Brands' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Brands</SelectItem>
                  {uniqueBrands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Power Range Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Power Range</label>
              <Select
                value={filters.powerRange}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, powerRange: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Power Ranges' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Power Ranges</SelectItem>
                  {powerRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model filters */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Model</label>
              <Select
                value={filters.model}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, model: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Models' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Models</SelectItem>
                  {uniqueModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Range Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Current Range</label>
              <Select
                value={filters.current}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, current: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Current Ranges' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Current Ranges</SelectItem>
                  {currentRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phases Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Phases</label>
              <Select
                value={filters.phases}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, phases: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Phases' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Phases</SelectItem>
                  {phaseOptions.map((phase) => (
                    <SelectItem key={phase} value={phase}>
                      {phase} Phase
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voltage Range Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Voltage Range</label>
              <Select
                value={filters.voltage}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, voltage: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Voltages' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Voltages</SelectItem>
                  {voltageOptions
                    .sort((a, b) => {
                      const aNum = parseInt(a.replace(/[^0-9]/g, ''));
                      const bNum = parseInt(b.replace(/[^0-9]/g, ''));
                      return aNum - bNum;
                    })
                    .map((voltage) => (
                      <SelectItem key={voltage} value={voltage}>
                        {voltage}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Inlet Size Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Inlet Size</label>
              <Select
                value={filters.inletSize}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, inletSize: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Inlet Sizes' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Inlet Sizes</SelectItem>
                  {sizeRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Outlet Size Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Outlet Size</label>
              <Select
                value={filters.outletSize}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, outletSize: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Outlet Sizes' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Outlet Sizes</SelectItem>
                  {sizeRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature Range Filter */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Temperature Range</label>
              <Select
                value={filters.temperatureRange}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, temperatureRange: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='All Temperatures' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Temperatures</SelectItem>
                  {temperatureRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
      {operatingFlow > 0 && operatingHead > 0 && (
        <div className='text-muted-foreground bg-muted rounded p-2 text-xs'>
          <strong>Operating Duty:</strong> {operatingFlow.toFixed(1)} {flowUnit}{' '}
          at {operatingHead.toFixed(1)} {headUnit}
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
                className={`flex items-center justify-between rounded border p-2 ${
                  pump.canMeetDuty
                    ? 'border-green-300 bg-green-100 dark:border-green-800 dark:bg-green-950'
                    : 'border-red-300 bg-red-100 dark:border-red-800 dark:bg-red-950'
                }`}
              >
                <div className='mr-2 truncate'>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* <Link href={`/dashboard/pumps/${pump.id}`}> */}
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
                      {/* </Link> */}
                    </TooltipTrigger>
                    <TooltipContent side='right' align='center'>
                      View pump curves
                    </TooltipContent>
                  </Tooltip>
                  <div className='text-muted-foreground text-xs'>
                    Head: {pump.convertedMaxHead.toFixed(1)} {headUnit}, Flow:{' '}
                    {pump.convertedMaxFlow.toFixed(1)} {flowUnit}
                  </div>
                  {pump.brand && (
                    <div className='text-muted-foreground text-xs'>
                      Brand: {pump.brand} | Type: {pump.type || 'N/A'}
                    </div>
                  )}
                  {operatingFlow > 0 && operatingHead > 0 && (
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
