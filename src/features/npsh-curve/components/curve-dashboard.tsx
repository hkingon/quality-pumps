'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { DischargeCurveChart } from './discharge-curve-chart';
import { NpshCurveChart } from './npsh-curve-chart';
import { PumpInputs } from '@/components/pump-inputs';
import { SystemCurveInputs } from '@/components/system-curve-inputs';
import { SuctionCurveInputs } from './suction-curve-inputs';
import { SavedPumpsList } from '@/components/saved-pumps-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  PumpData,
  SystemCurveData,
  SuctionCurveData,
  SavedPump,
  PumpCurvePoint,
  SystemCurvePoint,
  SuctionCurvePoint,
  SegmentedPumpCurve
} from '@/types';
import jsPDF from 'jspdf';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FlowUnit, HeadUnit, convertFlow, convertHead } from '@/lib/units';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { Input } from '@/components/ui/input';
import { MotorSpeedControl, CardMetrics } from './MotorSpeedControl';
import { PumpReport } from './PumpReport';
import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  scorePumpForDuties,
  computePAbsBestPerDuty,
  representativeDuty,
  energyIntensityKWhPerML,
  getSuitabilityBadge
} from '@/lib/pump-scoring';

interface PerformancePoint {
  head: number;
  flow: number;
}

// Storage keys used to persist the tool's working state across navigation
// (e.g. opening the pump edit page and returning via the back button).
// Discharge / suction values reuse the existing localStorage handoff keys so
// the mount-time restore logic below picks them up. UI preferences (mode, duty
// count, visibility toggles) live in sessionStorage alongside activeSavedPumps.
const DISCHARGE_CURVES_KEY = 'dischargeCurves';
const SUCTION_CURVES_KEY = 'suctionCurves';
const UI_PREFS_KEY = 'npshDashboardUiPrefs';


interface EnergySavingsDisplayProps {
  baseRpm: number;
  currentRpm: number;
  basePower: number; // Power at BEP, base speed
  operatingHoursPerDay?: number;
  electricityCostPerKwh?: number;
}

function EnergySavingsDisplay({
  baseRpm,
  currentRpm,
  basePower,
  operatingHoursPerDay = 24,
  electricityCostPerKwh = 0.15
}: EnergySavingsDisplayProps) {
  const speedRatio = currentRpm / baseRpm;
  const powerRatio = Math.pow(speedRatio, 3);
  const currentPower = basePower * powerRatio;
  const powerSavings = basePower - currentPower;
  const percentSavings = ((1 - powerRatio) * 100).toFixed(1);

  const dailySavings =
    powerSavings * operatingHoursPerDay * electricityCostPerKwh;
  const annualSavings = dailySavings * 365;

  if (speedRatio >= 0.99 && speedRatio <= 1.01) {
    return null; // No significant speed change
  }

  return (
    <div className='bg-card rounded-lg border p-4 text-sm'>
      <h4 className='mb-2 flex items-center gap-2 font-semibold'>
        <Zap className='h-4 w-4' />
        Energy Impact
      </h4>
      <div className='grid grid-cols-2 gap-3'>
        <div>
          <p className='text-muted-foreground text-xs'>Power at Base Speed</p>
          <p className='font-medium'>{basePower.toFixed(2)} kW</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>
            Power at Current Speed
          </p>
          <p className='font-medium'>{currentPower.toFixed(2)} kW</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>Power Change</p>
          <Badge variant={powerSavings > 0 ? 'default' : 'destructive'}>
            {powerSavings > 0 ? '-' : '+'}
            {Math.abs(powerSavings).toFixed(2)} kW ({percentSavings}%)
          </Badge>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>Annual Savings</p>
          <p className='font-medium text-green-600'>
            ${annualSavings.toFixed(0)}/year
          </p>
        </div>
      </div>
      <p className='text-muted-foreground mt-2 text-xs'>
        Based on {operatingHoursPerDay}h/day @ ${electricityCostPerKwh}/kWh
      </p>
    </div>
  );
}


export function PumpCurveDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('L/min');
  const [headUnit, setHeadUnit] = useState<HeadUnit>('m');
  const [originalFlowUnit, setOriginalFlowUnit] = useState<FlowUnit>('L/min');
  const [originalHeadUnit, setOriginalHeadUnit] = useState<HeadUnit>('m');

  const [motorSpeedControls, setMotorSpeedControls] = useState<{
    [pumpId: string]: {
      baseRpm: number;
      baseHz: number;
      currentRpm: number;
      currentHz: number;
      enabled: boolean;
    };
  }>({});

  const [segmentedPumpCurves, setSegmentedPumpCurves] = useState<
    SegmentedPumpCurve[]
  >([]);
  const [segmentedModifiedPumpCurves, setSegmentedModifiedPumpCurves] =
    useState<SegmentedPumpCurve[]>([]);
  const [segmentedNpshCurves, setSegmentedNpshCurves] = useState<
    SegmentedPumpCurve[]
  >([]);
  const [segmentedModifiedNpshCurves, setSegmentedModifiedNpshCurves] =
    useState<SegmentedPumpCurve[]>([]);

  const [activeSavedPumps, setActiveSavedPumps] = useState<PumpData[]>([]);
  const [editingPumpId, setEditingPumpId] = useState<string | null>(null);

  // Discharge System Curves (renamed from original system curves)
  const [dischargeSystemCurveData, setDischargeSystemCurveData] = useState<
    SystemCurveData[]
  >([
    {
      id: '1',
      staticHead: 0,
      operatingFlow: 0,
      operatingHead: 0
    }
  ]);

  const [suctionCurveData, setSuctionCurveData] = useState<SuctionCurveData[]>(
    []
  );

  const [savedPumps, setSavedPumps] = useState<SavedPump[]>([]);
  const [publicPumps, setPublicPumps] = useState<SavedPump[]>([]);
  const [pumpCurvePoints, setPumpCurvePoints] = useState<PumpCurvePoint[][]>(
    []
  );
  const [modifiedPumpCurvePoints, setModifiedPumpCurvePoints] = useState<
    PumpCurvePoint[][]
  >([]);
  const [npshCurvePoints, setNpshCurvePoints] = useState<PumpCurvePoint[][]>(
    []
  );
  const [modifiedNpshCurvePoints, setModifiedNpshCurvePoints] = useState<
    PumpCurvePoint[][]
  >([]);
  const [dischargeSystemCurvePoints, setDischargeSystemCurvePoints] = useState<
    SystemCurvePoint[][]
  >([]);
  const [suctionCurvePoints, setSuctionCurvePoints] = useState<
    SuctionCurvePoint[][]
  >([]);

  const [bepPoints, setBepPoints] = useState<PumpCurvePoint[]>([]);
  const [modifiedBepPoints, setModifiedBepPoints] = useState<PumpCurvePoint[]>(
    []
  );
  const [npshBepPoints, setNpshBepPoints] = useState<PumpCurvePoint[]>([]);
  const [modifiedNpshBepPoints, setModifiedNpshBepPoints] = useState<
    PumpCurvePoint[]
  >([]);

  const [overallMaxHead, setOverallMaxHead] = useState(0);
  const [overallMaxFlowNpsh, setOverallMaxFlowNpsh] = useState(0);
  const [overallMaxFlowDischarge, setOverallMaxFlowDischarge] = useState(0);
  const [overallMaxNpsh, setOverallMaxNpsh] = useState(0);
  const [overallMinNpsh, setOverallMinNpsh] = useState(0);

  const [showDischargeSystemCurve, setShowDischargeSystemCurve] =
    useState(true);
  const [dischargeCurveMode, setDischargeCurveMode] = useState<'and' | 'or'>('and');
  const [showSuctionCurve, setShowSuctionCurve] = useState(true);
  const [activeTab, setActiveTab] = useState('discharge');
  const [numberOfDutyPumps, setNumberOfDutyPumps] = useState(1);
  const [segmentedCombinedPumpCurves, setSegmentedCombinedPumpCurves] =
    useState<SegmentedPumpCurve[]>([]);
  const [
    segmentedModifiedCombinedPumpCurves,
    setSegmentedModifiedCombinedPumpCurves
  ] = useState<SegmentedPumpCurve[]>([]);
  const [combinedBepPoints, setCombinedBepPoints] = useState<PumpCurvePoint[]>(
    []
  );
  const [modifiedCombinedBepPoints, setModifiedCombinedBepPoints] = useState<
    PumpCurvePoint[]
  >([]);

  const chartRef = useRef<HTMLDivElement>(null);
  // Becomes true once persisted state has been restored on mount, so the
  // persist effects below don't overwrite saved data with initial defaults.
  const hydratedRef = useRef(false);
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Unit conversion handlers
  const handleFlowUnitChange = (newUnit: FlowUnit) => {
    setActiveSavedPumps((prev) =>
      prev.map((pump) => ({
        ...pump,
        maxFlow: convertFlow(pump.maxFlow, originalFlowUnit, newUnit),
        manualBepFlow:
          pump.manualBepFlow && pump.manualBepFlow > 0
            ? convertFlow(pump.manualBepFlow, originalFlowUnit, newUnit)
            : pump.manualBepFlow,
        // Fix: Convert efficiency and motor_power flow values
        efficiency:
          pump.efficiency?.map((point) => ({
            ...point,
            flow: convertFlow(
              Number(point.flow),
              originalFlowUnit,
              newUnit
            ).toString()
          })) || [],
        motor_power:
          pump.motor_power?.map((point) => ({
            ...point,
            flow: convertFlow(point.flow, originalFlowUnit, newUnit)
          })) || [],
        ...(pump.oldSpeed && pump.newSpeed
          ? {
            oldSpeed: convertFlow(pump.oldSpeed, originalFlowUnit, newUnit),
            newSpeed: convertFlow(pump.newSpeed, originalFlowUnit, newUnit)
          }
          : {})
      }))
    );

    setDischargeSystemCurveData((prev) =>
      prev.map((system) => ({
        ...system,
        operatingFlow: convertFlow(
          system.operatingFlow,
          originalFlowUnit,
          newUnit
        )
      }))
    );

    setSuctionCurveData((prev) =>
      prev.map((suction) => ({
        ...suction,
        operatingFlow: convertFlow(
          suction.operatingFlow,
          originalFlowUnit,
          newUnit
        )
      }))
    );

    setOriginalFlowUnit(newUnit);
    setFlowUnit(newUnit);
  };

  const handleHeadUnitChange = (newUnit: HeadUnit) => {
    setActiveSavedPumps((prev) =>
      prev.map((pump) => ({
        ...pump,
        maxHead: convertHead(pump.maxHead, originalHeadUnit, newUnit)
      }))
    );

    setDischargeSystemCurveData((prev) =>
      prev.map((system) => ({
        ...system,
        staticHead: convertHead(system.staticHead, originalHeadUnit, newUnit),
        operatingHead: convertHead(
          system.operatingHead,
          originalHeadUnit,
          newUnit
        )
      }))
    );


    setOriginalHeadUnit(newUnit);
    setHeadUnit(newUnit);
  };

  const handleMotorSpeedChange = (pumpId: string, rpm: number, hz: number) => {
    setMotorSpeedControls((prev) => ({
      ...prev,
      [pumpId]: {
        ...prev[pumpId],
        currentRpm: rpm,
        currentHz: hz
      }
    }));

    // Update the active pump with new speed settings
    setActiveSavedPumps((prev) =>
      prev.map((pump) => {
        if (pump.id === pumpId) {
          const speedRatio = rpm / (pump.baseRpm || 2900);
          return {
            ...pump,
            currentRpm: rpm,
            currentHz: hz,
            // Store the old and new speeds for affinity law calculations
            oldSpeed: pump.baseRpm || 2900,
            newSpeed: rpm
          };
        }
        return pump;
      })
    );
  };

  // 3. ADD enableSpeedAdjustment handler
  const handleSpeedEnabledChange = (pumpId: string, enabled: boolean) => {
    setMotorSpeedControls((prev) => ({
      ...prev,
      [pumpId]: {
        ...prev[pumpId],
        enabled
      }
    }));

    // If disabling, reset to base speed
    if (!enabled) {
      setActiveSavedPumps((prev) =>
        prev.map((pump) => {
          if (pump.id === pumpId) {
            return {
              ...pump,
              currentRpm: pump.baseRpm,
              currentHz: pump.baseHz,
              oldSpeed: undefined,
              newSpeed: undefined
            };
          }
          return pump;
        })
      );
    }
  };

  // Which pump's full report dialog is open (null = closed)
  const [reportPumpId, setReportPumpId] = useState<string | null>(null);

  // Full library set (saved + public), used as the scoring benchmark population.
  const allPumps = useMemo(
    () => [...savedPumps, ...publicPumps],
    [savedPumps, publicPumps]
  );

  // Remove a pump from the chart via its card, keeping speed controls and the
  // SavedPumpsList checkbox (pumpsOnChart) in sync.
  const handleRemoveFromCard = (pumpId: string) => {
    const active = activeSavedPumps.find((p) => p.id === pumpId);
    if (active) removeSavedPumpFromChart(active as unknown as SavedPump);
    setMotorSpeedControls((prev) => {
      const next = { ...prev };
      delete next[pumpId];
      return next;
    });
    try {
      const stored = sessionStorage.getItem('pumpsOnChart');
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        sessionStorage.setItem(
          'pumpsOnChart',
          JSON.stringify(ids.filter((id) => id !== pumpId))
        );
      }
    } catch {
      /* ignore */
    }
    if (reportPumpId === pumpId) setReportPumpId(null);
  };

  // Per-active-pump selection metrics for the cards (and report), scored against
  // the discharge system curves at each pump's current card speed.
  const activePumpMetrics = useMemo<Record<string, CardMetrics>>(() => {
    const validDuties = dischargeSystemCurveData.filter(
      (d) => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0
    );
    const map: Record<string, CardMetrics> = {};
    if (validDuties.length === 0) {
      for (const active of activeSavedPumps) {
        const orig = allPumps.find((p) => p.id === active.id);
        map[active.id] = {
          capable: false,
          score: Infinity,
          badge: { label: '—', colorClass: 'bg-gray-400' },
          model: orig?.model,
          pumpType: orig?.type?.join(', ')
        };
      }
      return map;
    }

    const pAbsBest = computePAbsBestPerDuty(
      allPumps,
      validDuties,
      flowUnit,
      headUnit,
      numberOfDutyPumps
    );

    for (const active of activeSavedPumps) {
      const orig = allPumps.find((p) => p.id === active.id);
      if (!orig) continue;
      const control = motorSpeedControls[active.id];
      const r =
        control && control.baseRpm ? control.currentRpm / control.baseRpm : 1;

      const result = scorePumpForDuties(
        orig,
        validDuties,
        flowUnit,
        headUnit,
        dischargeCurveMode,
        pAbsBest,
        numberOfDutyPumps,
        r
      );
      const rep = representativeDuty(result.dutyMetrics, dischargeCurveMode);

      if (!rep || result.isHidden) {
        map[active.id] = {
          capable: false,
          score: result.finalScore,
          badge: getSuitabilityBadge(result.finalScore, true),
          model: orig.model,
          pumpType: orig.type?.join(', ')
        };
        continue;
      }

      // operatingPoint.flow and pAbs are combined-system values (all N pumps).
      // Divide by N so the card shows what one pump is doing.
      const combinedFlow = convertFlow(rep.operatingPoint.flow, orig.flowUnit, flowUnit);
      const dutyFlow = combinedFlow / numberOfDutyPumps;
      const dutyHead = convertHead(rep.operatingPoint.head, orig.headUnit, headUnit);
      const absorbedKWPerPump = rep.pAbs / numberOfDutyPumps;
      map[active.id] = {
        capable: true,
        score: result.finalScore,
        badge: getSuitabilityBadge(result.finalScore, false),
        model: orig.model,
        pumpType: orig.type?.join(', '),
        dutyFlow,
        dutyHead,
        efficiencyPct: rep.eta * 100,
        absorbedKW: absorbedKWPerPump,
        kwhPerML: energyIntensityKWhPerML(absorbedKWPerPump, dutyFlow, flowUnit),
        bepPct: rep.rqo * 100
      };
    }
    return map;
  }, [
    activeSavedPumps,
    motorSpeedControls,
    dischargeSystemCurveData,
    flowUnit,
    headUnit,
    dischargeCurveMode,
    numberOfDutyPumps,
    allPumps
  ]);


  useEffect(() => {
    if (activeSavedPumps.length > 0) {
      sessionStorage.setItem(
        'activeSavedPumps',
        JSON.stringify(activeSavedPumps)
      );
    }
  }, [activeSavedPumps]);

  useEffect(() => {
    const storedActivePumps = sessionStorage.getItem('activeSavedPumps');
    if (storedActivePumps) {
      try {
        const parsed = JSON.parse(storedActivePumps);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveSavedPumps(parsed);
        }
      } catch (error) {
        console.error('Error parsing active pumps from sessionStorage:', error);
      }
    }
  }, [savedPumps, publicPumps]);

  // Sync motor speed controls with active pumps (Restoration/Initialization)
  useEffect(() => {
    if (activeSavedPumps.length === 0) return;

    setMotorSpeedControls((prev) => {
      const newControls = { ...prev };
      let hasChanges = false;

      activeSavedPumps.forEach((pump) => {
        if (!newControls[pump.id]) {
          const baseRpm = pump.baseRpm || 2900;
          const baseHz = pump.baseHz || 50;

          // If the pump was restored from session, it might have currentRpm set
          // We can infer 'enabled' if currentRpm differs from baseRpm, OR if newSpeed is stored.
          // handleSpeedEnabledChange sets newSpeed to undefined when disabled.
          const isEnabled = !!(pump.newSpeed);

          newControls[pump.id] = {
            baseRpm,
            baseHz,
            currentRpm: pump.currentRpm || baseRpm,
            currentHz: pump.currentHz || baseHz,
            enabled: isEnabled
          };
          hasChanges = true;
        }
      });

      return hasChanges ? newControls : prev;
    });
  }, [activeSavedPumps]);

  // Restore UI preferences (mode, duty count, visibility toggles) on mount.
  // Declared before the curve-loading effect so the latter still wins for
  // genuine cross-tool handoffs (URL params / friction calculator data).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UI_PREFS_KEY);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.dischargeCurveMode === 'and' || prefs.dischargeCurveMode === 'or') {
          setDischargeCurveMode(prefs.dischargeCurveMode);
        }
        if (typeof prefs.numberOfDutyPumps === 'number' && prefs.numberOfDutyPumps > 0) {
          setNumberOfDutyPumps(prefs.numberOfDutyPumps);
        }
        if (typeof prefs.showDischargeSystemCurve === 'boolean') {
          setShowDischargeSystemCurve(prefs.showDischargeSystemCurve);
        }
        if (typeof prefs.showSuctionCurve === 'boolean') {
          setShowSuctionCurve(prefs.showSuctionCurve);
        }
      }
    } catch (error) {
      console.error('Error restoring dashboard UI preferences:', error);
    }
  }, []);

  // Load curves from localStorage on mount
  useEffect(() => {
    // Handle URL parameters first
    const staticHeadStr = searchParams.get('staticHead');
    const operatingFlowStr = searchParams.get('operatingFlow');
    const operatingHeadStr = searchParams.get('operatingHead');
    const headUnitFromURL = searchParams.get('headUnit') as HeadUnit | null;
    const flowUnitFromURL = searchParams.get('flowUnit') as FlowUnit | null;
    const activeTabFromURL = searchParams.get('activeTab') || 'discharge';

    if (
      staticHeadStr &&
      operatingFlowStr &&
      operatingHeadStr &&
      headUnitFromURL &&
      flowUnitFromURL
    ) {
      const staticHead = convertHead(
        parseFloat(staticHeadStr),
        headUnitFromURL,
        headUnit
      );

      const operatingFlow = convertFlow(
        parseFloat(operatingFlowStr),
        flowUnitFromURL,
        flowUnit
      );

      const operatingHead = convertHead(
        parseFloat(operatingHeadStr),
        headUnitFromURL,
        headUnit
      );

      setDischargeSystemCurveData([
        {
          id: '1',
          staticHead,
          operatingFlow,
          operatingHead
        }
      ]);

      setActiveTab('discharge');
      setShowDischargeSystemCurve(true);
    }

    // Handle localStorage data
    const storedDischargeCurves = localStorage.getItem('dischargeCurves');
    if (storedDischargeCurves) {
      try {
        const parsedCurves = JSON.parse(storedDischargeCurves);
        if (Array.isArray(parsedCurves) && parsedCurves.length > 0) {
          // Convert curves to current units
          const convertedCurves = parsedCurves.map((curve) => ({
            ...curve,
            staticHead: convertHead(
              curve.staticHead,
              curve.headUnit || 'm',
              headUnit
            ),
            operatingFlow: convertFlow(
              curve.operatingFlow,
              curve.flowUnit || 'L/min',
              flowUnit
            ),
            operatingHead: convertHead(
              curve.operatingHead,
              curve.headUnit || 'm',
              headUnit
            )
          }));
          setDischargeSystemCurveData(convertedCurves);
          // setActiveTab('discharge');
          // localStorage.removeItem('dischargeCurves');
        }
      } catch (error) {
        console.error(
          'Error parsing discharge curves from localStorage:',
          error
        );
      }
    }

    const storedSuctionCurves = localStorage.getItem('suctionCurves');
    if (storedSuctionCurves) {
      try {
        const parsedCurves = JSON.parse(storedSuctionCurves);
        if (Array.isArray(parsedCurves) && parsedCurves.length > 0) {
          // Convert curves to current units
          const convertedCurves = parsedCurves.map((curve) => ({
            ...curve,
            staticPressure: convertHead(
              curve.staticPressure || 10.1325,
              curve.headUnit || 'm',
              headUnit
            ),
            operatingFlow: convertFlow(
              curve.operatingFlow,
              curve.flowUnit || 'L/min',
              flowUnit
            ),
            operatingNpsha: convertHead(
              curve.operatingNpsha || 0,
              curve.headUnit || 'm',
              headUnit
            )
          }));
          setSuctionCurveData(convertedCurves);
        }
      } catch (error) {
        console.error('Error parsing suction curves from localStorage:', error);
      }
    }

    const clearStoredCurves = () => {
      localStorage.removeItem('dischargeCurves');
      localStorage.removeItem('suctionCurves');
      localStorage.removeItem('frictionLossData');
    };

    // Check for friction loss data from calculator
    const storedFrictionData = localStorage.getItem('frictionLossData');
    if (storedFrictionData) {
      try {
        const parsedData = JSON.parse(storedFrictionData);
        if (parsedData && typeof parsedData === 'object') {
          // Convert flow properly
          const convertedFlow = convertFlow(
            parsedData.flow || 0,
            parsedData.flowUnit || 'L/min',
            flowUnit
          );

          // Convert head values
          const staticHead = convertHead(
            parsedData.staticHead || 0,
            parsedData.headUnit || 'm',
            headUnit
          );
          const frictionLoss = convertHead(
            parsedData.frictionLoss || 0,
            parsedData.headUnit || 'm',
            headUnit
          );
          const velocityHead = convertHead(
            parsedData.velocityHead || 0,
            parsedData.headUnit || 'm',
            headUnit
          );

          const staticPressure = 10.1325 + staticHead;

          // Calculate operating NPSH available
          const operatingNpsha = staticPressure - frictionLoss - velocityHead;

          setSuctionCurveData([
            {
              id: '1',
              staticPressure: convertHead(staticPressure, 'm', headUnit),
              operatingFlow: convertedFlow,
              operatingNpsha: convertHead(operatingNpsha, 'm', headUnit)
            }
          ]);
          localStorage.removeItem('frictionLossData');
        }
      } catch (error) {
        console.error(
          'Error parsing friction loss data from localStorage:',
          error
        );
      }
    }

    setActiveTab(activeTabFromURL);
  }, [searchParams]);

  // Persist discharge system curves so manually entered values survive
  // navigation. Stamped with the current units so the mount-time restore can
  // convert them back correctly. Gated by hydratedRef so the initial default
  // doesn't overwrite previously saved data before restoration completes.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        DISCHARGE_CURVES_KEY,
        JSON.stringify(
          dischargeSystemCurveData.map((curve) => ({
            ...curve,
            headUnit,
            flowUnit
          }))
        )
      );
    } catch (error) {
      console.error('Error saving discharge curves:', error);
    }
  }, [dischargeSystemCurveData, flowUnit, headUnit]);

  // Persist suction curves (same approach as discharge curves above).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        SUCTION_CURVES_KEY,
        JSON.stringify(
          suctionCurveData.map((curve) => ({
            ...curve,
            headUnit,
            flowUnit
          }))
        )
      );
    } catch (error) {
      console.error('Error saving suction curves:', error);
    }
  }, [suctionCurveData, flowUnit, headUnit]);

  // Persist UI preferences (mode, duty count, visibility toggles).
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(
        UI_PREFS_KEY,
        JSON.stringify({
          dischargeCurveMode,
          numberOfDutyPumps,
          showDischargeSystemCurve,
          showSuctionCurve
        })
      );
    } catch (error) {
      console.error('Error saving dashboard UI preferences:', error);
    }
  }, [
    dischargeCurveMode,
    numberOfDutyPumps,
    showDischargeSystemCurve,
    showSuctionCurve
  ]);

  // Mark hydration complete. Declared after the persist effects so that on the
  // initial commit they see hydratedRef === false and skip; they then run with
  // restored values on the next render.
  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  // Load saved pumps
  useEffect(() => {
    const fetchPumps = async () => {
      if (!user?.id) {
        getPumpsFromLocalStorage();
        await fetchPublicPumps();
        return;
      }

      // Fetch user's saved pumps
      const { data: userData, error: userError } = await supabase
        .from('pumps')
        .select('*')
        .eq('user_id', user.id);

      if (userError) {
        getPumpsFromLocalStorage();
      } else if (Array.isArray(userData) && userData.length > 0) {
        const mapped: any = userData.map(mapSupabasePumpToAppPump);
        setSavedPumps(mapped);
      } else {
        getPumpsFromLocalStorage();
      }

      // Fetch public pumps unconditionally for everyone
      await fetchPublicPumps();
    };

    const fetchPublicPumps = async () => {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mappedPublicPumps = data.map(mapSupabasePumpToAppPump);
        setPublicPumps(mappedPublicPumps);
      }
    };

    const getPumpsFromLocalStorage = () => {
      const savedPumpsData = localStorage.getItem('savedPumps');
      if (savedPumpsData) {
        try {
          const parsed = JSON.parse(savedPumpsData);
          const updatedSavedPumps = parsed.map((pump: any) => ({
            ...pump,
            headUnit: pump.headUnit || 'm',
            flowUnit: pump.flowUnit || 'L/min'
          }));
          setSavedPumps(updatedSavedPumps);
        } catch (e) {
          setSavedPumps([]);
        }
      } else {
        setSavedPumps([]);
      }
    };

    fetchPumps();
  }, [user?.id]);

  // Generate curves when data changes
  useEffect(() => {
    generateCurves();
  }, [
    activeSavedPumps,
    dischargeSystemCurveData,
    suctionCurveData,
    showDischargeSystemCurve,
    showSuctionCurve,
    numberOfDutyPumps
  ]);

  const generateCurves = () => {
    if (activeSavedPumps.length === 0) {
      setSegmentedPumpCurves([]);
      setSegmentedModifiedPumpCurves([]);
      setSegmentedCombinedPumpCurves([]);
      setSegmentedModifiedCombinedPumpCurves([]);
      setSegmentedNpshCurves([]);
      setSegmentedModifiedNpshCurves([]);
      setDischargeSystemCurvePoints([]);
      setSuctionCurvePoints([]);
      setBepPoints([]);
      setModifiedBepPoints([]);
      setCombinedBepPoints([]);
      setModifiedCombinedBepPoints([]);
      setNpshBepPoints([]);
      setModifiedNpshBepPoints([]);
      setOverallMaxHead(0); // Separate state for discharge head
      setOverallMaxFlowDischarge(0); // Separate state for discharge flow
      setOverallMaxFlowNpsh(0); // Separate state for NPSH flow
      setOverallMaxNpsh(0); // Separate state for NPSH NPSH
      setOverallMinNpsh(0);
      return;
    }

    let maxHeadDischarge = 0; // Max head for discharge curves
    let maxNpshNpsh = -Infinity; // Max NPSH for NPSH curves
    let minNpsh = Infinity;
    let maxFlowDischarge = 0; // Max flow for discharge curves
    let maxFlowNpsh = 0; // Max flow for NPSH curves

    const newSegmentedPumpCurves: SegmentedPumpCurve[] = [];
    const newSegmentedModifiedPumpCurves: SegmentedPumpCurve[] = [];
    const newSegmentedCombinedPumpCurves: SegmentedPumpCurve[] = [];
    const newSegmentedModifiedCombinedPumpCurves: SegmentedPumpCurve[] = [];
    const newSegmentedNpshCurves: SegmentedPumpCurve[] = [];
    const newSegmentedModifiedNpshCurves: SegmentedPumpCurve[] = [];
    const newBepPoints: PumpCurvePoint[] = [];
    const newModifiedBepPoints: PumpCurvePoint[] = [];
    const newCombinedBepPoints: PumpCurvePoint[] = [];
    const newModifiedCombinedBepPoints: PumpCurvePoint[] = [];
    const newNpshBepPoints: PumpCurvePoint[] = [];
    const newModifiedNpshBepPoints: PumpCurvePoint[] = [];
    const newDischargeSystemCurvePoints: SystemCurvePoint[][] = [];
    const newSuctionCurvePoints: SuctionCurvePoint[][] = [];

    // --- Generate pump curves (P vs Q) ------

    activeSavedPumps.forEach((pump) => {
      if (!pump.maxHead || !pump.maxFlow) return;

      const hasSpeedChange =
        pump.currentRpm && pump.baseRpm && pump.currentRpm !== pump.baseRpm;
      const speedRatio = hasSpeedChange ? pump.currentRpm! / pump.baseRpm! : 1;

      // Apply affinity laws to max values
      const adjustedMaxFlow = pump.maxFlow * speedRatio;
      const adjustedMaxHead = pump.maxHead * speedRatio ** 2;

      maxHeadDischarge = Math.max(maxHeadDischarge, adjustedMaxHead);
      const individualMaxFlow = adjustedMaxFlow;
      const combinedMaxFlow = adjustedMaxFlow * numberOfDutyPumps;
      maxFlowDischarge = Math.max(
        maxFlowDischarge,
        individualMaxFlow,
        combinedMaxFlow
      );

      // -- Pump P vs Q Curve
      let pumpPoints: { flow: number; head: number }[] = [];
      let combinedPumpPoints: { flow: number; head: number }[] = [];

      let bepFlow = 0;
      let bepHead = 0;

      // FIRST: Generate pump points from pvsq data or formula
      if (pump.pvsq && pump.pvsq.length > 0) {
        pumpPoints = pump.pvsq.map((point) => ({
          flow: convertFlow(point.flow * speedRatio, 'L/min', flowUnit),
          head: convertHead(point.head * speedRatio ** 2, 'm', headUnit)
        }));

        combinedPumpPoints = pump.pvsq.map((point) => ({
          flow: convertFlow(
            point.flow * speedRatio * numberOfDutyPumps,
            'L/min',
            flowUnit
          ),
          head: convertHead(point.head * speedRatio ** 2, 'm', headUnit)
        }));

        pumpPoints.sort((a, b) => a.flow - b.flow);
        combinedPumpPoints.sort((a, b) => a.flow - b.flow);
      } else {
        // Generate standard pump curve
        const numPoints = 100;
        for (let i = 0; i <= numPoints; i++) {
          const baseFlow = (pump.maxFlow * i) / numPoints;
          const baseHead =
            pump.maxHead * (1 - Math.pow(baseFlow / pump.maxFlow, 2));

          // Apply affinity laws
          const flow = baseFlow * speedRatio;
          const head = baseHead * speedRatio ** 2;

          pumpPoints.push({ flow, head });

          const combinedFlow = flow * numberOfDutyPumps;
          combinedPumpPoints.push({ flow: combinedFlow, head });
        }
      }

      // SECOND: Now determine BEP (manual or automatic)
      if (pump.manualBepFlow && pump.manualBepFlow > 0) {
        bepFlow = pump.manualBepFlow * speedRatio;
        if (pumpPoints.length > 0) {
          bepHead = interpolateHeadAtFlow(pumpPoints, bepFlow);
        }
      } else {
        // Use automatic BEP calculation (maximum flow * head product)
        let maxProduct = 0;
        let bepIndex = 0;

        pumpPoints.forEach((point, index) => {
          const product = point.flow * point.head;
          if (product > maxProduct) {
            maxProduct = product;
            bepIndex = index;
          }
        });

        bepFlow = pumpPoints[bepIndex]?.flow || 0;
        bepHead = pumpPoints[bepIndex]?.head || 0;
      }

      newSegmentedPumpCurves.push(segmentCurve(pumpPoints, bepFlow));
      newSegmentedCombinedPumpCurves.push(
        segmentCurve(combinedPumpPoints, bepFlow * numberOfDutyPumps)
      );
      newBepPoints.push({ flow: bepFlow, head: bepHead });
      newCombinedBepPoints.push({
        flow: bepFlow * numberOfDutyPumps,
        head: bepHead
      });

      if (pumpPoints.length > 0) {
        maxHeadDischarge = Math.max(
          maxHeadDischarge,
          ...pumpPoints.map((p) => p.head)
        );
        maxFlowDischarge = Math.max(
          maxFlowDischarge,
          ...pumpPoints.map((p) => p.flow)
        );
      }

      if (combinedPumpPoints.length > 0) {
        maxHeadDischarge = Math.max(
          maxHeadDischarge,
          ...combinedPumpPoints.map((p) => p.head)
        );
        maxFlowDischarge = Math.max(
          maxFlowDischarge,
          ...combinedPumpPoints.map((p) => p.flow)
        );
      }

      // --- NPSHr curve ---
      let npshPoints: PumpCurvePoint[] = [];
      let npshBepFlow = 0;
      let npshBepHead = 0;

      if (pump.npshRequired && pump.npshRequired.length > 0) {
        npshPoints = pump.npshRequired.map((point) => ({
          flow: convertFlow(point.flow * speedRatio, 'L/min', flowUnit),
          head: convertHead(point.head * speedRatio ** 2, 'm', headUnit)
        }));
        npshPoints.sort((a, b) => a.flow - b.flow);

        // For NPSHr, BEP is at minimum NPSH (often but not always)
        let minNpshReq = Infinity;
        let npshBepIndex = 0;
        npshPoints.forEach((point, idx) => {
          if (point.head < minNpshReq) {
            minNpshReq = point.head;
            npshBepIndex = idx;
          }
        });
        npshBepFlow = npshPoints[npshBepIndex]?.flow || 0;
        npshBepHead = npshPoints[npshBepIndex]?.head || 0;
      }
      if (npshPoints.length > 0) {
        const npshMinVal = Math.min(...npshPoints.map((p) => p.head));
        const npshMaxVal = Math.max(...npshPoints.map((p) => p.head));
        minNpsh = Math.min(minNpsh, npshMinVal);
        maxNpshNpsh = Math.max(maxNpshNpsh, npshMaxVal);
      }
      maxFlowNpsh = Math.max(maxFlowNpsh, adjustedMaxFlow);

      newSegmentedNpshCurves.push(segmentCurve(npshPoints, npshBepFlow));
      newNpshBepPoints.push({ flow: npshBepFlow, head: npshBepHead });
    });

    // --- Discharge system curves ---
    if (showDischargeSystemCurve) {
      dischargeSystemCurveData.forEach((system) => {
        // Fallback to legacy single-component logic if components array is empty
        const useComponents = system.components && system.components.length > 0;

        if (
          !useComponents && (
            system.staticHead === undefined ||
            system.operatingFlow === undefined ||
            system.operatingHead === undefined ||
            system.operatingFlow <= 0
          )
        )
          return;

        const points = [];
        const axisMaxFlow = Math.ceil(maxFlowDischarge / 10) * 10;
        const numPoints = 100;

        for (let i = 0; i <= numPoints; i++) {
          const flow = (axisMaxFlow * i) / numPoints;
          let head = 0;

          if (useComponents) {
            // Sum of heads from all components:
            // Head_total(Q) = Sum( Static_i + Friction_i(Q) )
            // Friction_i(Q) = (OperatingHead_i - StaticHead_i) * (Q / OperatingFlow_i)^2
            // Note: operatingHead in component is Total Head at Operating Flow.

            let totalHeadAtFlow = 0;
            system.components?.forEach(comp => {
              // If component flow is 0, avoid division by zero (shouldn't happen if validated)
              if (!comp.operatingFlow || comp.operatingFlow <= 0) {
                totalHeadAtFlow += comp.staticHead; // Just static
                return;
              }

              // Friction k = (H_op - H_static) / Q_op^2
              // H_friction(Q) = k * Q^2
              // Component Head(Q) = H_static + k * Q^2

              // Important: Units. 
              // Component has its own flowUnit and headUnit (optional).
              // We should normalize them.
              // However, the inputs saved `operatingFlow` and `operatingHead` in the component as NUMBERS.
              // `FrictionLossModal` saved them.
              // If we assume they are consistent with the system (usually are), we can use raw values?
              // `SystemCurveInputs` displays them as `comp.flowUnit` etc.
              // But `FrictionLossModal` converts calc results to `headUnit`? 
              // Wait, `FrictionLossModal` saved:
              // `operatingHead`: calculatedHead (Total Head).
              // `staticHead`: input.
              // `flowUnit`: selected unit.
              // `operatingFlow`: input value in that unit.

              // We MUST normalize flows to the CHART'S current flowUnit.
              // And Heads to the CHART'S current headUnit.

              const compFlow = convertFlow(comp.operatingFlow, comp.flowUnit || 'L/min', flowUnit); // Q_op in current chart unit
              const compStatic = convertHead(comp.staticHead, 'm', headUnit); // Static in current chart unit (Assuming saved as 'm' is effectively standard or we trust label?)
              // Wait, `SystemCurveInputs` allowed user to input `Static Head`.
              // The Modal had `Head Unit` selector.
              // `convertHead(totalHeadLoss, 'm/Head', headUnit)` was used for display.
              // The `onSave` used `staticHead` (raw input) and `calculatedHead` (raw output?).
              // I need to be careful.
              // In my `FrictionLossModal` implementation:
              // `totalHeadLoss` was calculated in METERS (standard Hazen Williams).
              // `staticHead` was raw input.
              // `totalHead` = `totalHeadLoss + staticHead`.
              // `converted` = `convertHead(totalHead, 'm/Head', headUnit)`.
              // So if user selected 'kPa', they saw kPa.
              // But `onSave` saved `staticHead` (raw).
              // If user entered '10' thinking it is kPa?
              // The modal treated `staticHead` as additive to Meters? No, `totalHeadLoss` is Meters.
              // If user entered 10 (kPa) and TotalLoss=5 (m).
              // Total = 15. Converted to kPa = 150? No.
              // The Modal logic I wrote:
              // `totalHead = totalHeadLoss + staticHead`.
              // This implies staticHead MUST be in Meters for the math to hold before conversion.
              // So I will assume `staticHead` and `operatingHead` in Component are in METERS (or at least consistent).

              // Let's assume all stored data is effectively "Meters" or "Standard" for calculation, 
              // OR we have to trust the units stored.
              // `FrictionLossModal` implementation I just wrote:
              // `onSave` saved raw `staticHead`.
              // And `operatingHead` = `staticHead + totalHeadLoss`.
              // `totalHeadLoss` is definitely Meters.
              // So `staticHead` MUST be interpreted as Meters for that addition to make sense.
              // So Component Data is in METERS.
              // Component Flow is in `comp.flowUnit`.

              // So conversion:
              // Q_op_converted = convertFlow(comp.operatingFlow, comp.flowUnit, flowUnit);
              // H_static_converted = convertHead(comp.staticHead, 'm', headUnit); // Source is 'm'
              // H_op_converted = convertHead(comp.operatingHead, 'm', headUnit);  // Source is 'm'

              const qOp = convertFlow(comp.operatingFlow, comp.flowUnit || 'L/min', flowUnit);
              const hStatic = convertHead(comp.staticHead, 'm', headUnit);
              const hOp = convertHead(comp.operatingHead, 'm', headUnit);

              if (qOp <= 0) {
                totalHeadAtFlow += hStatic;
                return;
              }

              // Friction part
              const frictionHeadAtOp = hOp - hStatic;
              const frictionAtQ = frictionHeadAtOp * Math.pow(flow / qOp, 2);

              totalHeadAtFlow += (hStatic + frictionAtQ);
            });
            head = totalHeadAtFlow;
          } else {
            // Legal Logic
            const opHead = system.operatingHead; // Assumed to match current units?
            // Legacy `dischargeSystemCurveData` usually just holds numbers entered in the INPUT boxes.
            // The input boxes didn't have unit contexts stored explicitly on them before?
            // `curve-dashboard` top level selected `flowUnit` / `headUnit`.
            // The legacy inputs just took numbers.
            // `generateCurves` assumes those numbers ARE in the currently selected units.
            // So no conversion needed for legacy path.

            head = system.staticHead +
              (system.operatingHead - system.staticHead) *
              Math.pow(flow / system.operatingFlow, 2);
          }

          points.push({ flow, head });
        }
        newDischargeSystemCurvePoints.push(points);
      });
    }

    // --- Suction system curves ---
    if (showSuctionCurve) {
      suctionCurveData.forEach((suction) => {
        const useComponents = suction.components && suction.components.length > 0;

        if (
          !useComponents && (
            suction.staticPressure === undefined ||
            suction.operatingFlow === undefined ||
            suction.operatingNpsha === undefined ||
            suction.operatingFlow <= 0
          )
        )
          return;

        const points = [];
        const axisMaxFlow = Math.ceil(maxFlowNpsh / 10) * 10;
        const numPoints = 100;

        let opFlowForAxis = suction.operatingFlow || 0;
        if (useComponents) {
          // Find max flow among components to size axis
          opFlowForAxis = Math.max(...(suction.components?.map(c =>
            convertFlow(c.operatingFlow, c.flowUnit || 'L/min', flowUnit)
          ) || [0]));
        }

        if (opFlowForAxis > maxFlowNpsh) {
          maxFlowNpsh = opFlowForAxis;
        }

        const minAxisFlow = Math.max(axisMaxFlow, opFlowForAxis * 1.5);

        for (let i = 0; i <= numPoints; i++) {
          const flow = (minAxisFlow * i) / numPoints;
          let npshAvailable = 0;

          if (useComponents) {
            // Suction Aggregation:
            // NPSHa_total = StaticPressure_total - Sum(Friction_i)
            // StaticPressure_total = 10.1325 (or base) + Sum(StaticGeo_i) ?
            // In `SuctionCurveInputs`, we decided:
            // `staticPressure` field on Suction object serves as the Total Base Pressure (Source).
            // Components contribute Friction Loss.
            // Do components contribute Static Height?
            // In the Modal for Suction, `totalHead = 10.1325 + staticHead - totalHeadLoss`.
            // `staticHead` there was "Height difference".
            // So YES, components have Static Head.
            // NPSHa(Q) = 10.1325 + Sum(Static_i) - Sum(Friction_i(Q)) - Sum(VelocityHead_i(Q))?
            // Usually velocity head is only relevant at the suction flange.
            // Intermediate velocity heads cancel out (approx) or purely loss.
            // Let's stick to the Modal's logic:
            // Modal calculates `operatingHead` (NPSHa) for that segment.
            // Segment NPSHa = 10.1325 + Static - Friction - V^2/2g.

            // If we have multiple segments?
            // Series:
            // NPSHa at pump = P_source + H_static_total - H_friction_total - V_pump_inlet^2/2g.
            // The components might represent different pipe sections.
            // Start Pressure i=0 is 10.1325 (Atm).
            // We accumulate Static gains/losses and Friction losses.
            // Velocity Head at the end (pump inlet) is the one that matters for NPSHa.
            // Which component is at the pump inlet? Probably the last one.
            // But the Modal calculates V^2/2g for EACH component.

            // Simplified Multi-Component Suction model:
            // NPSHa(Q) = (10.1325 + Sum(Static_i)) - Sum( Friction_i(Q) ) - V_last_component(Q)^2/2g ?
            // Or if we just sum the "Losses" from the "Operating Head" derived in components?

            // Component `c`:
            // H_op = 10.1325 + H_static - H_friction - H_vel.
            // This `H_op` is "NPSHa if this was the whole system".
            // We can extract "Effective Loss at Q_op" = (10.1325 + H_static) - H_op.
            // Loss L_i = H_friction + H_vel.

            // So NPSHa_total(Q) = P_atm + Sum(H_static_i) - Sum( L_i(Q) ).
            // Where L_i(Q) scales with Q^2.
            // L_i(Q_op) = (10.1325 + H_static_i) - H_op_i. (All in Meters).
            // Wait, `10.1325` is in H_op calculation.
            // If we sum losses, we shouldn't sum 10.1325 multiple times.
            // Correct.

            // Calculation:
            // 1. Total Static Head (Physical) = Sum(c.staticHead).
            // 2. Base Pressure = 10.1325 (m).
            // 3. For each component `c`:
            //    Calculate `Loss_Coeff_i`:
            //    Loss_i_at_Op = (10.1325 + c.staticHead) - c.operatingHead.
            //    (This recovers Friction + VelHead).
            //    k_i = Loss_i_at_Op / c.operatingFlow^2.
            // 4. Total NPSHa(Q) = (10.1325 + TotalStatic) - Sum( k_i * Q^2 ).

            // Unit considerations:
            // `c.staticHead` and `c.operatingHead` are in Meters (stored by Modal).
            // `c.operatingFlow` in component unit.

            let totalStaticGeo = 0;
            let totalLossCoeff = 0;

            suction.components?.forEach(c => {
              const hStat = c.staticHead; // Meters
              const hOp = c.operatingHead; // Meters
              const qOp = convertFlow(c.operatingFlow, c.flowUnit || 'L/min', flowUnit); // Chart Unit

              totalStaticGeo += hStat;

              // Loss at Q_op (Meters)
              // Note: Modal calc: opHead = 10.1325 + static - losses
              // So Losses = 10.1325 + static - opHead.
              // This assumes Modal used 10.1325 exactly.
              // Ideally we should store `frictionHead` directly to avoid this reverse math dependent on constants.
              // But for now, reverse math is consistent with Modal.

              const lossAtOp = (10.1325 + hStat) - hOp;
              if (qOp > 0) {
                const k = lossAtOp / Math.pow(qOp, 2);
                totalLossCoeff += k;
              }
            });

            // Total NPSHa in Meters
            const npshaMeters = (10.1325 + totalStaticGeo) - (totalLossCoeff * Math.pow(flow, 2));

            // Convert to Display Unit
            npshAvailable = convertHead(npshaMeters, 'm', headUnit);

          } else {
            // Legacy Logic
            // Calculate k based on inputs
            let k =
              (suction.staticPressure - suction.operatingNpsha) /
              Math.pow(suction.operatingFlow, 2);
            if (k <= 0) k = 0.0001;

            npshAvailable = suction.staticPressure - k * Math.pow(flow, 2);
          }

          points.push({ flow, head: npshAvailable });
        }

        // Update min/max NPSH with these points
        if (points.length > 0) {
          const localMin = Math.min(...points.map((p) => p.head));
          const localMax = Math.max(...points.map((p) => p.head));
          minNpsh = Math.min(minNpsh, localMin);
          maxNpshNpsh = Math.max(maxNpshNpsh, localMax);
        }

        newSuctionCurvePoints.push(points);
      });
    }

    // ----- Update state -----
    setOverallMaxHead(Math.ceil(maxHeadDischarge / 10) * 10); // Set discharge max head
    setOverallMaxFlowDischarge(Math.ceil(maxFlowDischarge / 10) * 10); // Set discharge max flow
    setOverallMaxFlowNpsh(Math.ceil(maxFlowNpsh / 10) * 10); // Set NPSH max flow
    setOverallMaxNpsh(
      maxNpshNpsh === -Infinity ? 0 : Math.ceil(maxNpshNpsh / 10) * 10
    ); // Set NPSH max NPSH
    setOverallMinNpsh(minNpsh === Infinity ? 0 : Math.floor(minNpsh / 10) * 10);

    setSegmentedPumpCurves(newSegmentedPumpCurves);
    setSegmentedModifiedPumpCurves(newSegmentedModifiedPumpCurves);
    setSegmentedNpshCurves(newSegmentedNpshCurves);
    setSegmentedModifiedNpshCurves(newSegmentedModifiedNpshCurves);
    setDischargeSystemCurvePoints(newDischargeSystemCurvePoints);
    setSuctionCurvePoints(newSuctionCurvePoints);
    setBepPoints(newBepPoints);
    setModifiedBepPoints(newModifiedBepPoints);
    setNpshBepPoints(newNpshBepPoints);
    setModifiedNpshBepPoints(newModifiedNpshBepPoints);
    setSegmentedCombinedPumpCurves(newSegmentedCombinedPumpCurves);
    setSegmentedModifiedCombinedPumpCurves(
      newSegmentedModifiedCombinedPumpCurves
    );
    setCombinedBepPoints(newCombinedBepPoints);
    setModifiedCombinedBepPoints(newModifiedCombinedBepPoints);

    // Helper moved outside for clarity
    function interpolateNpshValue(
      points: PumpCurvePoint[],
      targetFlow: number
    ) {
      if (points.length === 0) return 0;
      if (points.length === 1) return points[0].head;

      let lowerPoint = points[0];
      let upperPoint = points[points.length - 1];

      for (let i = 0; i < points.length - 1; i++) {
        if (points[i].flow <= targetFlow && points[i + 1].flow >= targetFlow) {
          lowerPoint = points[i];
          upperPoint = points[i + 1];
          break;
        }
      }

      if (lowerPoint.flow === upperPoint.flow) {
        return lowerPoint.head;
      }

      const ratio =
        (targetFlow - lowerPoint.flow) / (upperPoint.flow - lowerPoint.flow);
      return lowerPoint.head + ratio * (upperPoint.head - lowerPoint.head);
    }
  };


  function interpolateHeadAtFlow(
    points: PumpCurvePoint[],
    targetFlow: number
  ): number {
    if (points.length === 0) return 0;
    if (points.length === 1) return points[0].head;

    let lowerPoint = points[0];
    let upperPoint = points[points.length - 1];

    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].flow <= targetFlow && points[i + 1].flow >= targetFlow) {
        lowerPoint = points[i];
        upperPoint = points[i + 1];
        break;
      }
    }

    if (lowerPoint.flow === upperPoint.flow) {
      return lowerPoint.head;
    }

    const ratio =
      (targetFlow - lowerPoint.flow) / (upperPoint.flow - lowerPoint.flow);
    return lowerPoint.head + ratio * (upperPoint.head - lowerPoint.head);
  }

  // Helper function to segment curves
  const segmentCurve = (
    points: PumpCurvePoint[],
    bepFlow: number
  ): SegmentedPumpCurve => {
    if (points.length < 3) {
      return { start: points, middle: [], end: [] };
    }

    const bepRangeStart = bepFlow * 0.7; // 49 L/min for bepFlow = 70
    let bepRangeEnd = bepFlow * 1.2; // 84 L/min for bepFlow = 70
    const sortedPoints = [...points].sort((a, b) => a.flow - b.flow);
    const maxFlow = sortedPoints[sortedPoints.length - 1].flow; // 110 L/min

    // Cap bepRangeEnd at maxFlow if it exceeds
    if (bepRangeEnd > maxFlow) {
      bepRangeEnd = maxFlow;
    }

    // Find indices for interpolation
    let bepStartIndex = 0;
    for (let i = 0; i < sortedPoints.length; i++) {
      if (sortedPoints[i].flow >= bepRangeStart) {
        bepStartIndex = i > 0 ? i - 1 : i;
        break;
      }
    }
    let bepEndIndex = sortedPoints.length - 1;
    for (let i = sortedPoints.length - 1; i >= 0; i--) {
      if (sortedPoints[i].flow <= bepRangeEnd) {
        bepEndIndex = i;
        break;
      }
    }

    // Interpolate points
    let interpolatedPoints: PumpCurvePoint[] = [...sortedPoints];
    let startInsertedIndex = -1;
    let endInsertedIndex = -1;

    if (
      sortedPoints[bepStartIndex].flow < bepRangeStart &&
      bepStartIndex + 1 < sortedPoints.length
    ) {
      const startPoint = sortedPoints[bepStartIndex];
      const endPoint = sortedPoints[bepStartIndex + 1];
      const ratio =
        (bepRangeStart - startPoint.flow) / (endPoint.flow - startPoint.flow);
      const interpolatedHead =
        startPoint.head + ratio * (endPoint.head - startPoint.head);
      startInsertedIndex = bepStartIndex + 1;
      interpolatedPoints.splice(startInsertedIndex, 0, {
        flow: bepRangeStart,
        head: interpolatedHead
      });
      bepStartIndex = startInsertedIndex; // Include interpolated start point
    }

    if (
      sortedPoints[bepEndIndex].flow < bepRangeEnd &&
      bepEndIndex + 1 < sortedPoints.length
    ) {
      const startPoint = sortedPoints[bepEndIndex];
      const endPoint = sortedPoints[bepEndIndex + 1];
      const ratio =
        (bepRangeEnd - startPoint.flow) / (endPoint.flow - startPoint.flow);
      const interpolatedHead =
        startPoint.head + ratio * (endPoint.head - startPoint.head);
      endInsertedIndex = bepEndIndex + 1;
      interpolatedPoints.splice(endInsertedIndex, 0, {
        flow: bepRangeEnd,
        head: interpolatedHead
      });
      bepEndIndex = endInsertedIndex; // Include interpolated end point
    } else if (
      sortedPoints[bepEndIndex].flow > bepRangeEnd &&
      bepEndIndex > 0
    ) {
      const startPoint = sortedPoints[bepEndIndex - 1];
      const endPoint = sortedPoints[bepEndIndex];
      const ratio =
        (bepRangeEnd - startPoint.flow) / (endPoint.flow - startPoint.flow);
      const interpolatedHead =
        startPoint.head + ratio * (endPoint.head - startPoint.head);
      endInsertedIndex = bepEndIndex;
      interpolatedPoints.splice(endInsertedIndex, 0, {
        flow: bepRangeEnd,
        head: interpolatedHead
      });
      bepEndIndex = endInsertedIndex; // Include interpolated end point
    }

    // Define segments
    return {
      start: interpolatedPoints.slice(0, bepStartIndex),
      middle: interpolatedPoints.slice(bepStartIndex, bepEndIndex + 1),
      end: interpolatedPoints.slice(bepEndIndex + 1)
    };
  };

  // Discharge system curve handlers
  const addDischargeSystemCurve = () => {
    setDischargeSystemCurveData([
      ...dischargeSystemCurveData,
      {
        id: Date.now().toString(),
        staticHead: 20,
        operatingFlow: 100,
        operatingHead: 60
      }
    ]);
  };

  const updateDischargeSystemCurve = (
    id: string,
    updatedSystem: Partial<SystemCurveData>
  ) => {
    setDischargeSystemCurveData(
      dischargeSystemCurveData.map((system) =>
        system.id === id ? { ...system, ...updatedSystem } : system
      )
    );
  };

  const removeDischargeSystemCurve = (id: string) => {
    const updated = dischargeSystemCurveData.filter(
      (system) => system.id !== id
    );
    setDischargeSystemCurveData(updated);
    // Persistence is handled by the discharge-curves effect (stamped with units).
  };

  // Suction curve handlers
  const addSuctionCurve = () => {
    setSuctionCurveData([
      ...suctionCurveData,
      {
        id: Date.now().toString(),
        staticPressure: 10.1325,
        operatingFlow: 0,
        operatingNpsha: 0
      }
    ]);
  };

  const updateSuctionCurve = (
    id: string,
    updatedSuction: Partial<SuctionCurveData>
  ) => {
    // Continuing from where the code was cut off...

    setSuctionCurveData(
      suctionCurveData.map((suction) =>
        suction.id === id ? { ...suction, ...updatedSuction } : suction
      )
    );
  };

  const removeSuctionCurve = (id: string) => {
    const updatedCurves = suctionCurveData.filter(
      (suction) => suction.id !== id
    );
    setSuctionCurveData(updatedCurves);
    // Persistence is handled by the suction-curves effect (stamped with units).
  };

  // Saved pumps handlers
  const removeSavedPump = (id: string) => {
    if (
      confirm('Are you sure you want to remove this pump from the saved list?')
    ) {
      const updatedSavedPumps = savedPumps.filter((pump) => pump.id !== id);
      setSavedPumps(updatedSavedPumps);
      localStorage.setItem('savedPumps', JSON.stringify(updatedSavedPumps));

      const pumpToRemove = savedPumps.find((pump) => pump.id === id);
      const isPumpActive = activeSavedPumps.some((pump) => pump.id === id);

      if (isPumpActive && pumpToRemove) {
        removeSavedPumpFromChart(pumpToRemove);
      }
    }
  };

  const addSavedPumpToChart = (savedPump: SavedPump) => {
    console.log('Adding saved pump to chart:', savedPump);
    const baseRpm = savedPump.rpm || 2900;
    const baseHz = savedPump.hz || 50;

    // Initialize motor speed control for this pump
    setMotorSpeedControls((prev) => ({
      ...prev,
      [savedPump.id]: {
        baseRpm,
        baseHz,
        currentRpm: baseRpm,
        currentHz: baseHz,
        enabled: false
      }
    }));

    const newPump = {
      id: savedPump.id,
      name: savedPump.name,
      baseRpm,
      baseHz,
      currentRpm: baseRpm,
      currentHz: baseHz,
      maxHead: convertHead(savedPump.maxHead, savedPump.headUnit, headUnit),
      maxFlow: convertFlow(savedPump.maxFlow, savedPump.flowUnit, flowUnit),
      oldSpeed: savedPump.oldSpeed
        ? convertFlow(savedPump.oldSpeed, savedPump.flowUnit, flowUnit)
        : undefined,
      newSpeed: savedPump.newSpeed
        ? convertFlow(savedPump.newSpeed, savedPump.flowUnit, flowUnit)
        : undefined,
      manualBepFlow: savedPump.manualBepFlow
        ? convertFlow(savedPump.manualBepFlow, savedPump.flowUnit, flowUnit)
        : null,
      pvsq:
        savedPump.pvsq?.map((p) => ({
          flow: convertFlow(p.flow, savedPump.flowUnit, 'L/min'),
          head: convertHead(p.head, savedPump.headUnit, 'm')
        })) || [],
      npshRequired:
        savedPump.npshRequired?.map((p: any) => ({
          flow: convertFlow(p.flow, savedPump.flowUnit, 'L/min'),
          head: convertHead(p.head, savedPump.headUnit, 'm')
        })) || [],
      motor_power:
        savedPump.motorPower?.map((p) => ({
          ...p,
          flow: convertFlow(p.flow, savedPump.flowUnit, flowUnit)
        })) || [],
      efficiency:
        savedPump.efficiency?.map((p) => ({
          ...p,
          flow: convertFlow(Number(p.flow), savedPump.flowUnit, flowUnit).toString()
        })) || []
    };
    setActiveSavedPumps((prev) => [...prev, newPump]);
  };

  const removeSavedPumpFromChart = (savedPump: SavedPump) => {
    setActiveSavedPumps((prev) => {
      const updated = prev.filter((p) => p.id !== savedPump.id);
      if (updated.length === 0) {
        sessionStorage.removeItem('activeSavedPumps');
      } else {
        sessionStorage.setItem('activeSavedPumps', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const editPumpFromSaved = (pump: SavedPump) => {
    // Pass the current tool path so the edit page can return here after saving
    // instead of redirecting to the pump library.
    const returnTo = encodeURIComponent(pathname);
    router.push(`/dashboard/pumps/edit/${pump.id}?returnTo=${returnTo}`);
  };

  // Helper function to map Supabase pump to app pump
  function getMaxHeadAndFlow(pvsq: PerformancePoint[] = []) {
    if (!Array.isArray(pvsq) || pvsq.length === 0) {
      return { maxHead: null, maxFlow: null };
    }

    let maxHead = -Infinity;
    let maxFlow = -Infinity;

    for (const pt of pvsq) {
      if (typeof pt.head === 'number' && pt.head > maxHead) maxHead = pt.head;
      if (typeof pt.flow === 'number' && pt.flow > maxFlow) maxFlow = pt.flow;
    }

    return {
      maxHead: maxHead === -Infinity ? null : maxHead,
      maxFlow: maxFlow === -Infinity ? null : maxFlow
    };
  }

  function mapSupabasePumpToAppPump(pump: any) {
    const { maxHead, maxFlow } = getMaxHeadAndFlow(pump.pvsq);
    return {
      id: pump.id,
      name: `${pump.model || ''}`.trim(),
      maxHead: maxHead ?? 0,
      maxFlow: maxFlow ?? 0,
      headUnit: (pump.head_unit as HeadUnit) || 'm',
      flowUnit: (pump.flow_unit as FlowUnit) || 'L/min',
      pvsq: pump.pvsq || [],
      npshRequired: pump.npshr
        ? pump.npshr.map((point: any) => ({
          flow: point.flow,
          head: point.head
        }))
        : [],
      brand: pump.brand,
      model: pump.model,
      kw: pump.kw,
      rpm: pump.rpm,
      hz: pump.hz,
      inlet: pump.inlet,
      outlet: pump.outlet,
      configuration: pump.configuration,
      type: pump.type,
      voltage: pump.voltage,
      amps: pump.amps,
      phases: pump.phases,
      maxTemp: pump.max_temp,
      efficiency: pump.efficiency || [],
      manualBepFlow: pump.manual_bep_flow || undefined,
      motorPower: pump.motor_power || [],
      is_public: pump.is_public || false,

      pumpClass: pump.pump_class,
      application: pump.application,
      impellerType: pump.impeller_type,
      otherTraits: pump.other_traits || [],
      poles: pump.poles,
      minTemp: pump.min_temp,
      installationConfiguration: pump.installation_configuration || [],
      powerSource: pump.power_source || undefined,
      wettedMaterials: pump.wetted_materials || [],
    };
  }

  // Export to PDF function
  const exportToPDF = () => {
    const pdf = new jsPDF();
    pdf.text('Pump Curve Analysis Report', 20, 20);

    // Add pump information
    let yPosition = 40;
    activeSavedPumps.forEach((pump, index) => {
      pdf.text(`Pump ${index + 1}: ${pump.name}`, 20, yPosition);
      pdf.text(
        `Max Head: ${pump.maxHead.toFixed(2)} ${headUnit}`,
        20,
        yPosition + 10
      );
      pdf.text(
        `Max Flow: ${pump.maxFlow.toFixed(2)} ${flowUnit}`,
        20,
        yPosition + 20
      );
      yPosition += 40;
    });

    // Add system curve information
    if (showDischargeSystemCurve && dischargeSystemCurveData.length > 0) {
      pdf.text('Discharge System Curves:', 20, yPosition);
      yPosition += 10;
      dischargeSystemCurveData.forEach((system, index) => {
        pdf.text(
          `System ${index + 1}: Static Head ${system.staticHead} ${headUnit}, Operating Point (${system.operatingFlow} ${flowUnit}, ${system.operatingHead} ${headUnit})`,
          20,
          yPosition
        );
        yPosition += 10;
      });
    }

    if (showSuctionCurve && suctionCurveData.length > 0) {
      pdf.text('Suction System Curves:', 20, yPosition);
      yPosition += 10;
      suctionCurveData.forEach((suction, index) => {
        pdf.text(
          `Suction ${index + 1}: Static Pressure ${suction.staticPressure} ${headUnit}, Operating Point (${suction.operatingFlow} ${flowUnit}, ${suction.operatingNpsha} ${headUnit})`,
          20,
          yPosition
        );
        yPosition += 10;
      });
    }

    pdf.save('pump-curve-analysis.pdf');
  };

  const clearChartData = () => {
    setActiveSavedPumps([]);
    sessionStorage.removeItem('activeSavedPumps');
    sessionStorage.removeItem('pumpsOnChart');
  };

  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
      <div className='grid grid-cols-1 gap-6 lg:col-span-2'>
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className='w-full'>
              <TabsTrigger value='discharge' className='flex-1 cursor-pointer'>
                Discharge System Curves
              </TabsTrigger>
              <TabsTrigger value='suction' className='flex-1 cursor-pointer'>
                Suction System Curves
              </TabsTrigger>
            </TabsList>

            <TabsContent value='discharge' className='space-y-4'>
              <Card className='flex flex-col justify-between p-4'>
                <div className='mb-4 flex flex-col items-start'>
                  <h2 className='mb-2 text-xl font-semibold'>
                    Discharge System Curve Parameters
                  </h2>
                  <div className='flex gap-2'>
                    <Button
                      className='cursor-pointer'
                      variant='outline'
                      onClick={() =>
                        setShowDischargeSystemCurve(!showDischargeSystemCurve)
                      }
                    >
                      {showDischargeSystemCurve ? 'Hide' : 'Show'} Discharge System Curves
                    </Button>
                    <Button
                      className='cursor-pointer'
                      variant='outline'
                      onClick={() =>
                        setDischargeCurveMode(prev => prev === 'and' ? 'or' : 'and')
                      }
                    >
                      Mode: {dischargeCurveMode.toUpperCase()}
                    </Button>
                  </div>
                </div>
                {showDischargeSystemCurve &&
                  dischargeSystemCurveData.map((system, index) => (
                    <SystemCurveInputs
                      key={system.id}
                      system={system}
                      index={index}
                      updateSystemCurve={updateDischargeSystemCurve}
                      removeSystemCurve={removeDischargeSystemCurve}
                      globalFlowUnit={flowUnit}
                      globalHeadUnit={headUnit}
                      onGlobalFlowUnitChange={handleFlowUnitChange}
                      onGlobalHeadUnitChange={handleHeadUnitChange}
                    />
                  ))}
                {showDischargeSystemCurve && (
                  <Button
                    onClick={addDischargeSystemCurve}
                    className='mt-4 w-full cursor-pointer'
                  >
                    Add Discharge System Curve
                  </Button>
                )}
              </Card>
            </TabsContent>

            <TabsContent value='suction' className='space-y-4'>
              <Card className='flex flex-col justify-between p-4'>
                <div className='mb-4 flex flex-col items-start'>
                  <h2 className='mb-2 text-xl font-semibold'>
                    Suction System Curve Parameters
                  </h2>
                  <Button
                    className='cursor-pointer'
                    variant='outline'
                    onClick={() => setShowSuctionCurve(!showSuctionCurve)}
                  >
                    {showSuctionCurve ? 'Hide' : 'Show'} Suction System Curves
                  </Button>
                </div>
                {showSuctionCurve &&
                  suctionCurveData.map((suction, index) => (
                    <SuctionCurveInputs
                      key={suction.id + Date.now}
                      suction={suction}
                      index={index}
                      updateSuctionCurve={updateSuctionCurve}
                      removeSuctionCurve={removeSuctionCurve}
                      globalFlowUnit={flowUnit}
                      globalHeadUnit={headUnit}
                      onGlobalFlowUnitChange={handleFlowUnitChange}
                      onGlobalHeadUnitChange={handleHeadUnitChange}
                    />
                  ))}
                {showSuctionCurve && (
                  <Button
                    onClick={addSuctionCurve}
                    className='mt-4 w-full cursor-pointer'
                  >
                    Add Suction System Curve
                  </Button>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Discharge Chart */}
        <div>
          <Card className='p-4'>
            <h2 className='mb-4 text-xl font-semibold'>
              Discharge Curves (P vs Q)
            </h2>

            <div className='mb-4 flex items-center gap-4 border-b pb-4'>
              <label className='text-sm font-medium whitespace-nowrap'>
                Number of Duty Pumps:
              </label>
              <Input
                type='number'
                min='1'
                max='10'
                value={numberOfDutyPumps}
                onChange={(e) =>
                  setNumberOfDutyPumps(
                    Math.max(1, parseInt(e.target.value) || 1)
                  )
                }
                className='w-20'
              />
              {numberOfDutyPumps > 1 && (
                <span className='text-muted-foreground text-xs'>
                  Showing combined curves (solid) and individual curves (faded)
                </span>
              )}
            </div>

            {activeSavedPumps.length > 0 && (
              <div className='space-y-3'>
                <h3 className='text-sm font-semibold'>
                  Motor Speed Adjustment (Affinity Laws)
                </h3>

                {activeSavedPumps.map((pump) => {
                  const control = motorSpeedControls[pump.id];
                  if (!control) return null;

                  // Render MotorSpeedControl ALWAYS
                  return (
                    <div key={pump.id}>
                      <MotorSpeedControl
                        pumpId={pump.id}
                        pumpName={pump.name || 'Unnamed Pump'}
                        baseRpm={control.baseRpm}
                        baseHz={control.baseHz}
                        currentRpm={control.currentRpm}
                        currentHz={control.currentHz}
                        enabled={control.enabled}
                        onSpeedChange={handleMotorSpeedChange}
                        onEnabledChange={handleSpeedEnabledChange}
                        metrics={activePumpMetrics[pump.id]}
                        flowUnit={flowUnit}
                        headUnit={headUnit}
                        onRemove={handleRemoveFromCard}
                        onShowReport={setReportPumpId}
                      />

                      {/* Conditionally render EnergySavingsDisplay */}
                      {/* {pump.motor_power &&
                        pump.motor_power.length > 0 &&
                        (() => {
                          let maxProduct = 0;
                          let bepPower = 0;

                          pump.motor_power.forEach((point) => {
                            const product = point.flow * point.kw;
                            if (product > maxProduct) {
                              maxProduct = product;
                              bepPower = point.kw;
                            }
                          });

                          return (
                            <EnergySavingsDisplay
                              baseRpm={pump.baseRpm || 2900}
                              currentRpm={
                                pump.currentRpm || pump.baseRpm || 2900
                              }
                              basePower={bepPower}
                            />
                          );
                        })()} */}
                    </div>
                  );
                })}
              </div>
            )}

            <div ref={chartRef}>
              <DischargeCurveChart
                pumpData={activeSavedPumps}
                dischargeSystemCurveData={dischargeSystemCurveData}
                dischargeSystemCurvePoints={dischargeSystemCurvePoints}
                bepPoints={bepPoints}
                modifiedBepPoints={modifiedBepPoints}
                overallMaxHead={overallMaxHead}
                overallMaxFlow={overallMaxFlowDischarge}
                flowUnit={flowUnit}
                headUnit={headUnit}
                segmentedPumpCurves={segmentedPumpCurves}
                segmentedModifiedPumpCurves={segmentedModifiedPumpCurves}
                numberOfDutyPumps={numberOfDutyPumps}
                segmentedCombinedPumpCurves={segmentedCombinedPumpCurves}
                segmentedModifiedCombinedPumpCurves={
                  segmentedModifiedCombinedPumpCurves
                }
                combinedBepPoints={combinedBepPoints}
                modifiedCombinedBepPoints={modifiedCombinedBepPoints}
              />
            </div>
          </Card>
        </div>

        {/* NPSH Chart */}
        <div>
          <Card className='p-4'>
            <h2 className='mb-4 text-xl font-semibold'>
              NPSH and Suction Curves
            </h2>
            <div>
              <NpshCurveChart
                pumpData={activeSavedPumps}
                suctionCurveData={suctionCurveData}
                suctionCurvePoints={suctionCurvePoints}
                npshBepPoints={npshBepPoints}
                modifiedNpshBepPoints={modifiedNpshBepPoints}
                overallMaxNpsh={overallMaxNpsh}
                overallMinNpsh={overallMinNpsh}
                overallMaxFlow={overallMaxFlowNpsh}
                flowUnit={flowUnit}
                headUnit={headUnit}
                segmentedNpshCurves={segmentedNpshCurves}
                segmentedModifiedNpshCurves={segmentedModifiedNpshCurves}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Right side: Saved Pumps */}
      <div className='relative lg:col-span-1'>
        <Card className='sticky top-4 h-fit p-4'>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-2'>
              <span>
                <strong>Flow Unit:</strong>
              </span>
              <Select value={flowUnit} onValueChange={handleFlowUnitChange}>
                <SelectTrigger>
                  <SelectValue placeholder='Select Flow Unit' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='L/min'>L/min</SelectItem>
                  <SelectItem value='L/sec'>L/sec</SelectItem>
                  <SelectItem value='m³/hr'>m³/hr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='flex items-center gap-2'>
              <span>
                <strong>Head Unit:</strong>
              </span>
              <Select value={headUnit} onValueChange={handleHeadUnitChange}>
                <SelectTrigger>
                  <SelectValue placeholder='Select Head Unit' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='m'>m</SelectItem>
                  <SelectItem value='kPa'>kPa</SelectItem>
                  <SelectItem value='psi'>psi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='flex gap-2'>
            <Button
              onClick={exportToPDF}
              className='flex-1 cursor-pointer'
              variant='outline'
            >
              Export PDF
            </Button>
          </div>

          <h2 className='text-xl font-semibold'>Saved Pumps</h2>
          <SavedPumpsList
            savedPumps={savedPumps}
            publicPumps={publicPumps}
            systemCurveData={dischargeSystemCurveData}
            addSavedPumpToChart={addSavedPumpToChart}
            removeSavedPumpFromChart={removeSavedPumpFromChart}
            removeSavedPump={removeSavedPump}
            editPumpFromSaved={editPumpFromSaved}
            headUnit={headUnit}
            flowUnit={flowUnit}
            dischargeCurveMode={dischargeCurveMode}
            numberOfDutyPumps={numberOfDutyPumps}
            activePumpIds={activeSavedPumps.map((p) => p.id)}
          />
        </Card>
      </div>

      {reportPumpId &&
        (() => {
          const reportPump = allPumps.find((p) => p.id === reportPumpId);
          const idx = activeSavedPumps.findIndex((p) => p.id === reportPumpId);
          if (!reportPump || idx < 0) return null;
          const c = motorSpeedControls[reportPumpId];
          const speedRatio = c && c.baseRpm ? c.currentRpm / c.baseRpm : 1;

          // Single-pump slices of the dashboard's per-pump chart arrays.
          const dischargeChartProps = {
            pumpData: [activeSavedPumps[idx]],
            dischargeSystemCurveData,
            dischargeSystemCurvePoints,
            bepPoints: bepPoints[idx] ? [bepPoints[idx]] : [],
            modifiedBepPoints: modifiedBepPoints[idx] ? [modifiedBepPoints[idx]] : [],
            overallMaxHead,
            overallMaxFlow: overallMaxFlowDischarge,
            flowUnit,
            headUnit,
            segmentedPumpCurves: segmentedPumpCurves[idx] ? [segmentedPumpCurves[idx]] : [],
            segmentedModifiedPumpCurves: segmentedModifiedPumpCurves[idx]
              ? [segmentedModifiedPumpCurves[idx]]
              : [],
            numberOfDutyPumps: 1,
            segmentedCombinedPumpCurves: [],
            segmentedModifiedCombinedPumpCurves: [],
            combinedBepPoints: [],
            modifiedCombinedBepPoints: []
          };
          const npshChartProps = {
            pumpData: [activeSavedPumps[idx]],
            suctionCurveData,
            suctionCurvePoints,
            npshBepPoints: npshBepPoints[idx] ? [npshBepPoints[idx]] : [],
            modifiedNpshBepPoints: modifiedNpshBepPoints[idx]
              ? [modifiedNpshBepPoints[idx]]
              : [],
            overallMaxNpsh,
            overallMinNpsh,
            overallMaxFlow: overallMaxFlowNpsh,
            flowUnit,
            headUnit,
            segmentedNpshCurves: segmentedNpshCurves[idx] ? [segmentedNpshCurves[idx]] : [],
            segmentedModifiedNpshCurves: segmentedModifiedNpshCurves[idx]
              ? [segmentedModifiedNpshCurves[idx]]
              : []
          };

          return (
            <PumpReport
              pump={reportPump}
              speedRatio={speedRatio}
              dischargeSystemCurveData={dischargeSystemCurveData}
              suctionCurveData={suctionCurveData}
              flowUnit={flowUnit}
              headUnit={headUnit}
              dischargeCurveMode={dischargeCurveMode}
              numberOfDutyPumps={numberOfDutyPumps}
              pAbsBestPerDuty={computePAbsBestPerDuty(
                allPumps,
                dischargeSystemCurveData.filter(
                  (d) => (d.operatingFlow || 0) > 0 && (d.operatingHead || 0) > 0
                ),
                flowUnit,
                headUnit,
                numberOfDutyPumps
              )}
              dischargeChartProps={dischargeChartProps}
              npshChartProps={npshChartProps}
              onClose={() => setReportPumpId(null)}
            />
          );
        })()}
    </div>
  );
}
