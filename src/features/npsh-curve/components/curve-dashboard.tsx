'use client';
import { useState, useEffect, useRef } from 'react';
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
import { useRouter, useSearchParams } from 'next/navigation';
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

interface PerformancePoint {
  head: number;
  flow: number;
}

export function PumpCurveDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('L/min');
  const [headUnit, setHeadUnit] = useState<HeadUnit>('m');
  const [originalFlowUnit, setOriginalFlowUnit] = useState<FlowUnit>('L/min');
  const [originalHeadUnit, setOriginalHeadUnit] = useState<HeadUnit>('m');

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

  // Suction System Curves for NPSH
  // const [suctionCurveData, setSuctionCurveData] = useState<SuctionCurveData[]>([
  //   {
  //     id: '1',
  //     staticPressure: 10.1325,
  //     operatingFlow: 0,
  //     operatingNpsha: 0
  //   }
  // ]);
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
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Unit conversion handlers
  const handleFlowUnitChange = (newUnit: FlowUnit) => {
    setActiveSavedPumps((prev) =>
      prev.map((pump) => ({
        ...pump,
        maxFlow: convertFlow(pump.maxFlow, originalFlowUnit, newUnit),
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

    // setSuctionCurveData((prev) =>
    //   prev.map((suction) => ({
    //     ...suction,
    //     staticPressure: convertHead(
    //       suction.staticPressure,
    //       originalHeadUnit,
    //       newUnit
    //     ),
    //     operatingNpsha: convertHead(
    //       suction.operatingNpsha,
    //       originalHeadUnit,
    //       newUnit
    //     )
    //   }))
    // );

    setOriginalHeadUnit(newUnit);
    setHeadUnit(newUnit);
  };

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
          // setActiveTab('suction');
          // localStorage.removeItem('suctionCurves');
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

          // Static pressure = atmospheric pressure + static head
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

  // Load saved pumps
  useEffect(() => {
    const fetchPumps = async () => {
      if (!user?.id) {
        getPumpsFromLocalStorage();
        await fetchPublicPumps(); // Always fetch public pumps
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

      // Fetch public pumps
      if (!isAdmin) {
        await fetchPublicPumps();
      }
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
      setSegmentedNpshCurves([]);
      setSegmentedModifiedNpshCurves([]);
      setDischargeSystemCurvePoints([]);
      setSuctionCurvePoints([]);
      setBepPoints([]);
      setModifiedBepPoints([]);
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

      maxHeadDischarge = Math.max(maxHeadDischarge, pump.maxHead); // Update discharge max head
      // maxFlowDischarge = Math.max(maxFlowDischarge, pump.maxFlow); // Update discharge max flow
      // const combinedMaxFlow = pump.maxFlow * numberOfDutyPumps;
      // maxFlowDischarge = Math.max(maxFlowDischarge, combinedMaxFlow);
      maxFlowDischarge = Math.max(maxFlowDischarge, pump.maxFlow);

      // -- Pump P vs Q Curve
      let pumpPoints = [];
      let combinedPumpPoints = [];
      let bepFlow = 0;
      let bepHead = 0;

      if (pump.pvsq && pump.pvsq.length > 0) {
        pumpPoints = pump.pvsq.map((point) => ({
          flow: convertFlow(point.flow, 'L/min', flowUnit),
          head: convertHead(point.head, 'm', headUnit)
        }));

        combinedPumpPoints = pump.pvsq.map((point) => ({
          flow: convertFlow(point.flow * numberOfDutyPumps, 'L/min', flowUnit),
          head: convertHead(point.head, 'm', headUnit) // Head stays the same
        }));

        pumpPoints.sort((a, b) => a.flow - b.flow);
        combinedPumpPoints.sort((a, b) => a.flow - b.flow);

        // Find BEP (maximum efficiency point)
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
      } else {
        // Generate standard pump curve
        const numPoints = 100;
        let maxProduct = 0;
        for (let i = 0; i <= numPoints; i++) {
          const flow = (pump.maxFlow * i) / numPoints;
          const head = pump.maxHead * (1 - Math.pow(flow / pump.maxFlow, 2));
          pumpPoints.push({ flow, head });

          const combinedFlow = flow * numberOfDutyPumps;
          combinedPumpPoints.push({ flow: combinedFlow, head });

          const product = flow * head;
          if (product > maxProduct) {
            maxProduct = product;
            bepFlow = flow;
            bepHead = head;
          }
        }
      }

      // Update maxHeadDischarge with actual points if higher
      // maxHeadDischarge = Math.max(
      //   maxHeadDischarge,
      //   ...pumpPoints.map((p) => p.head)
      // );
      maxHeadDischarge = Math.max(
        maxHeadDischarge,
        ...pumpPoints.map((p) => p.head)
      );
      // maxHeadDischarge = Math.max(
      //   maxHeadDischarge,
      //   ...combinedPumpPoints.map((p) => p.head)
      // );

      newSegmentedPumpCurves.push(segmentCurve(pumpPoints, bepFlow));
      newSegmentedCombinedPumpCurves.push(
        segmentCurve(combinedPumpPoints, bepFlow * numberOfDutyPumps)
      );
      newBepPoints.push({ flow: bepFlow, head: bepHead });
      newCombinedBepPoints.push({
        flow: bepFlow * numberOfDutyPumps,
        head: bepHead
      });

      // --- NPSHr curve ---
      let npshPoints: PumpCurvePoint[] = [];
      let npshBepFlow = 0;
      let npshBepHead = 0;

      if (pump.npshRequired && pump.npshRequired.length > 0) {
        npshPoints = pump.npshRequired.map((point) => ({
          flow: convertFlow(point.flow, 'L/min', flowUnit),
          head: convertHead(point.head, 'm', headUnit)
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

        // Interpolate if needed
        if (npshPoints.length < 10) {
          const interpolatedPoints = [];
          const minFlow = Math.min(...npshPoints.map((p) => p.flow));
          const maxFlow = Math.max(...npshPoints.map((p) => p.flow));
          for (let i = 0; i <= 50; i++) {
            const targetFlow = minFlow + (maxFlow - minFlow) * (i / 50);
            const interpolatedHead = interpolateNpshValue(
              npshPoints,
              targetFlow
            );
            interpolatedPoints.push({
              flow: targetFlow,
              head: interpolatedHead
            });
          }
          npshPoints = interpolatedPoints;
        }
      } else {
        // Generate default NPSHr curve
        // const numPoints = 200;
        // let minNpshReq = Infinity;
        // for (let i = 0; i <= numPoints; i++) {
        //   const flow = (pump.maxFlow * i) / numPoints;
        //   const head =
        //     pump.maxHead *
        //     0.05 *
        //     (0.8 + 2.0 * Math.pow(flow / pump.maxFlow, 1.2));
        //   npshPoints.push({ flow, head });
        //   if (head < minNpshReq) {
        //     minNpshReq = head;
        //     npshBepFlow = flow;
        //     npshBepHead = head;
        //   }
        // }

        npshPoints = [];
        npshBepFlow = 0;
        npshBepHead = 0;
      }

      // Include in min/max NPSH calculations
      if (npshPoints.length > 0) {
        const npshMinVal = Math.min(...npshPoints.map((p) => p.head));
        const npshMaxVal = Math.max(...npshPoints.map((p) => p.head));
        minNpsh = Math.min(minNpsh, npshMinVal);
        maxNpshNpsh = Math.max(maxNpshNpsh, npshMaxVal); // Update NPSH max
      }

      maxFlowNpsh = Math.max(maxFlowNpsh, pump.maxFlow); // Update NPSH max flow
      newSegmentedNpshCurves.push(segmentCurve(npshPoints, npshBepFlow));
      newNpshBepPoints.push({ flow: npshBepFlow, head: npshBepHead });

      // --- Modified speed curves ---
      if (
        pump.oldSpeed &&
        pump.newSpeed &&
        pump.oldSpeed > 0 &&
        pump.newSpeed > 0 &&
        pump.newSpeed !== pump.oldSpeed
      ) {
        const ratio = pump.newSpeed / pump.oldSpeed;
        const headRatio = ratio * ratio;

        // Modified NPSHr
        let modifiedNpshPoints = [];
        let modifiedNpshBepFlow = 0;
        let modifiedNpshBepHead = 0;

        const modifiedMaxFlow = pump.maxFlow * ratio;

        if (pump.npshRequired && pump.npshRequired.length > 0) {
          modifiedNpshPoints = pump.npshRequired.map((point) => ({
            flow: convertFlow(point.flow * ratio, 'L/min', flowUnit),
            head: convertHead(point.head * headRatio, 'm', headUnit)
          }));
          modifiedNpshPoints.sort((a, b) => a.flow - b.flow);

          let modMinNpsh = Infinity;
          let modIdx = 0;
          modifiedNpshPoints.forEach((point, idx) => {
            if (point.head < modMinNpsh) {
              modMinNpsh = point.head;
              modIdx = idx;
            }
          });
          modifiedNpshBepFlow = modifiedNpshPoints[modIdx]?.flow || 0;
          modifiedNpshBepHead = modifiedNpshPoints[modIdx]?.head || 0;
        } else {
          const numPoints = 100;
          let modMinNpsh = Infinity;
          for (let i = 0; i <= numPoints; i++) {
            const flow = (modifiedMaxFlow * i) / numPoints;
            const head =
              pump.maxHead *
              0.05 *
              (0.8 + 2.0 * Math.pow(flow / modifiedMaxFlow, 1.2)) *
              headRatio;
            modifiedNpshPoints.push({ flow, head });
            if (head < modMinNpsh) {
              modMinNpsh = head;
              modifiedNpshBepFlow = flow;
              modifiedNpshBepHead = head;
            }
          }
        }

        // Include in min/max NPSH calculations
        if (modifiedNpshPoints.length > 0) {
          const modNpshMin = Math.min(...modifiedNpshPoints.map((p) => p.head));
          const modNpshMax = Math.max(...modifiedNpshPoints.map((p) => p.head));
          minNpsh = Math.min(minNpsh, modNpshMin);
          maxNpshNpsh = Math.max(maxNpshNpsh, modNpshMax); // Update NPSH max
        }

        maxFlowNpsh = Math.max(maxFlowNpsh, modifiedMaxFlow); // Update NPSH max flow for modified curve
        newSegmentedModifiedNpshCurves.push(
          segmentCurve(modifiedNpshPoints, modifiedNpshBepFlow)
        );
        newModifiedNpshBepPoints.push({
          flow: modifiedNpshBepFlow,
          head: modifiedNpshBepHead
        });
      } else {
        newSegmentedModifiedPumpCurves.push({ start: [], middle: [], end: [] });
        newModifiedBepPoints.push({ flow: 0, head: 0 });
        newSegmentedModifiedNpshCurves.push({ start: [], middle: [], end: [] });
        newModifiedNpshBepPoints.push({ flow: 0, head: 0 });
      }
    });

    // --- Discharge system curves (unchanged) ---
    if (showDischargeSystemCurve) {
      dischargeSystemCurveData.forEach((system) => {
        if (
          system.staticHead === undefined ||
          system.operatingFlow === undefined ||
          system.operatingHead === undefined ||
          system.operatingFlow <= 0
        )
          return;

        const points = [];
        const axisMaxFlow = Math.ceil(maxFlowDischarge / 10) * 10; // Use discharge-specific max
        const numPoints = 100;
        for (let i = 0; i <= numPoints; i++) {
          const flow = (axisMaxFlow * i) / numPoints;
          const head =
            system.staticHead +
            (system.operatingHead - system.staticHead) *
              Math.pow(flow / system.operatingFlow, 2);
          points.push({ flow, head });
        }
        newDischargeSystemCurvePoints.push(points);
        // maxFlowDischarge = Math.max(maxFlowDischarge, system.operatingFlow); // Update with operating flow
        // maxHeadDischarge = Math.max(
        //   maxHeadDischarge,
        //   ...points.map((p) => p.head)
        // ); // Update discharge max head
      });
    }

    // --- Suction system curves (NPSH available, allow negative) ---
    if (showSuctionCurve) {
      suctionCurveData.forEach((suction) => {
        if (
          suction.staticPressure === undefined ||
          suction.operatingFlow === undefined ||
          suction.operatingNpsha === undefined ||
          suction.operatingFlow <= 0
        )
          return;

        const points = [];
        const axisMaxFlow = Math.ceil(maxFlowNpsh / 10) * 10; // Use NPSH-specific max
        const numPoints = 100;

        if (suction.operatingFlow > maxFlowNpsh) {
          maxFlowNpsh = suction.operatingFlow;
        }

        // Calculate the exponential decay coefficient
        let k =
          (suction.staticPressure - suction.operatingNpsha) /
          Math.pow(suction.operatingFlow, 2);
        // Force k to be positive to ensure a decreasing curve
        if (k <= 0) {
          k = 0.0001;
        }

        // Ensure axisMaxFlow covers at least 1.5x the operating flow
        const minAxisFlow = Math.max(axisMaxFlow, suction.operatingFlow * 1.5);

        for (let i = 0; i <= numPoints; i++) {
          const flow = (minAxisFlow * i) / numPoints;
          // Exponential decrease formula: NPSHa = staticPressure - k * flow^2
          const npshAvailable = suction.staticPressure - k * Math.pow(flow, 2);
          points.push({ flow, head: npshAvailable });
        }

        // Update min/max NPSH with these points
        if (points.length > 0) {
          const localMin = Math.min(...points.map((p) => p.head));
          const localMax = Math.max(...points.map((p) => p.head));
          minNpsh = Math.min(minNpsh, localMin);
          maxNpshNpsh = Math.max(maxNpshNpsh, localMax); // Update NPSH max
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
    localStorage.setItem('dischargeCurves', JSON.stringify(updated));
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
    localStorage.setItem('suctionCurves', JSON.stringify(updatedCurves));
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
    const newPump = {
      id: savedPump.id,
      name: savedPump.name,
      maxHead: convertHead(savedPump.maxHead, savedPump.headUnit, headUnit),
      maxFlow: convertFlow(savedPump.maxFlow, savedPump.flowUnit, flowUnit),
      oldSpeed: savedPump.oldSpeed
        ? convertFlow(savedPump.oldSpeed, savedPump.flowUnit, flowUnit)
        : undefined,
      newSpeed: savedPump.newSpeed
        ? convertFlow(savedPump.newSpeed, savedPump.flowUnit, flowUnit)
        : undefined,
      pvsq: savedPump.pvsq || [],
      npshRequired: savedPump.npshRequired || [],
      motor_power: savedPump.motorPower || [],
      efficiency: savedPump.efficiency || []
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
    router.push(`/dashboard/pumps/edit/${pump.id}`);
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
      inlet: pump.inlet,
      outlet: pump.outlet,
      configuration: pump.configuration,
      type: pump.type,
      voltage: pump.voltage,
      amps: pump.amps,
      phases: pump.phases,
      maxTemp: pump.max_temp,
      efficiency: pump.efficiency || [],
      motorPower: pump.motor_power || [],
      is_public: pump.is_public || false
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
                  <Button
                    className='cursor-pointer'
                    variant='outline'
                    onClick={() =>
                      setShowDischargeSystemCurve(!showDischargeSystemCurve)
                    }
                  >
                    {showDischargeSystemCurve ? 'Hide' : 'Show'} Discharge
                    System Curves
                  </Button>
                </div>
                {showDischargeSystemCurve &&
                  dischargeSystemCurveData.map((system, index) => (
                    <SystemCurveInputs
                      key={system.id}
                      system={system}
                      index={index}
                      updateSystemCurve={updateDischargeSystemCurve}
                      removeSystemCurve={removeDischargeSystemCurve}
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
          />
        </Card>
      </div>
    </div>
  );
}
