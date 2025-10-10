'use client';

import { useState, useEffect, useRef } from 'react';
import { PumpCurveChart } from '@/components/pump-curve-chart';
import { PumpInputs } from '@/components/pump-inputs';
import { SystemCurveInputs } from '@/components/system-curve-inputs';
import { SavedPumpsList } from '@/components/saved-pumps-list';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  PumpData,
  SystemCurveData,
  SavedPump,
  PumpCurvePoint,
  SystemCurvePoint,
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
  const [activeSavedPumps, setActiveSavedPumps] = useState<PumpData[]>([]);
  const [editingPumpId, setEditingPumpId] = useState<string | null>(null);
  const [pumpData, setPumpData] = useState<PumpData[]>([
    {
      id: '1',
      maxHead: 0,
      maxFlow: 0,
      oldSpeed: undefined,
      newSpeed: undefined
    }
  ]);

  const [systemCurveData, setSystemCurveData] = useState<SystemCurveData[]>([
    {
      id: '1',
      staticHead: 0,
      operatingFlow: 0,
      operatingHead: 0
    }
  ]);

  const [savedPumps, setSavedPumps] = useState<SavedPump[]>([]);
  const [pumpCurvePoints, setPumpCurvePoints] = useState<PumpCurvePoint[][]>(
    []
  );
  const [modifiedPumpCurvePoints, setModifiedPumpCurvePoints] = useState<
    PumpCurvePoint[][]
  >([]);
  const [systemCurvePoints, setSystemCurvePoints] = useState<
    SystemCurvePoint[][]
  >([]);
  const [bepPoints, setBepPoints] = useState<PumpCurvePoint[]>([]);
  const [modifiedBepPoints, setModifiedBepPoints] = useState<PumpCurvePoint[]>(
    []
  );
  const [overallMaxHead, setOverallMaxHead] = useState(0);
  const [overallMaxFlow, setOverallMaxFlow] = useState(0);
  const [showSystemCurve, setShowSystemCurve] = useState(true);
  const [activeTab, setActiveTab] = useState('system');

  const chartRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();

  const handleFlowUnitChange = (newUnit: FlowUnit) => {
    // Convert all flow values when unit changes
    setActiveSavedPumps((prev) =>
      prev.map((pump) => ({
        ...pump,
        maxFlow: convertFlow(pump.maxFlow, originalFlowUnit, newUnit),
        ...(pump.oldSpeed && pump.newSpeed
          ? {
              oldSpeed: convertFlow(pump.oldSpeed, originalFlowUnit, newUnit),
              newSpeed: convertFlow(pump.newSpeed, originalFlowUnit, newUnit)
            }
          : {})
      }))
    );

    setSystemCurveData((prev) =>
      prev.map((system) => ({
        ...system,
        operatingFlow: convertFlow(
          system.operatingFlow,
          originalFlowUnit,
          newUnit
        )
      }))
    );

    setOriginalFlowUnit(newUnit);
    setFlowUnit(newUnit);
  };

  const handleHeadUnitChange = (newUnit: HeadUnit) => {
    // Convert all head values when unit changes
    setActiveSavedPumps((prev) =>
      prev.map((pump) => ({
        ...pump,
        maxHead: convertHead(pump.maxHead, originalHeadUnit, newUnit)
      }))
    );

    setSystemCurveData((prev) =>
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

  useEffect(() => {
    const staticHeadStr = searchParams.get('staticHead');
    const operatingFlowStr = searchParams.get('operatingFlow');
    const operatingHeadStr = searchParams.get('operatingHead');

    const headUnitFromURL = searchParams.get('headUnit') as HeadUnit | null;
    const flowUnitFromURL = searchParams.get('flowUnit') as FlowUnit | null;

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

      setSystemCurveData([
        {
          id: '1',
          staticHead,
          operatingFlow,
          operatingHead
        }
      ]);

      setActiveTab('system');
      setShowSystemCurve(true);
    }
  }, [searchParams]);

  // Load saved pumps from localStorage on component mount
  // useEffect(() => {
  //   const savedPumpsData = localStorage.getItem('savedPumps');
  //   if (savedPumpsData) {
  //     const parsed: any[] = JSON.parse(savedPumpsData);

  //     const updatedSavedPumps = parsed.map((pump) => ({
  //       ...pump,
  //       headUnit: pump.headUnit || 'm',
  //       flowUnit: pump.flowUnit || 'L/min'
  //     }));

  //     setSavedPumps(updatedSavedPumps);
  //   }
  // }, []);

  // Utility function to extract max head and flow from pvsq array
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
      headUnit: 'm',
      flowUnit: 'L/min',
      pvsq: pump.pvsq || []
    };
  }

  useEffect(() => {
    if (!user?.id) return;

    const fetchPumps = async () => {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        getPumpsFromLocalStorage();
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        const mapped: any = data.map(mapSupabasePumpToAppPump);
        setSavedPumps(mapped);
      } else {
        getPumpsFromLocalStorage();
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

  // Generate curve points whenever pump or system data changes
  // useEffect(() => {
  //     generateCurves()
  // }, [pumpData, systemCurveData, showSystemCurve])
  useEffect(() => {
    generateCurves();
  }, [activeSavedPumps, systemCurveData, showSystemCurve]);

  const generateCurves = () => {
    if (activeSavedPumps.length === 0) {
      setSegmentedPumpCurves([]);
      setSegmentedModifiedPumpCurves([]);
      setSystemCurvePoints([]);
      setBepPoints([]);
      setModifiedBepPoints([]);
      setOverallMaxHead(0);
      setOverallMaxFlow(0);
      return;
    }

    let maxHead = 0;
    let overallMaxFlow = 0;

    const newSegmentedPumpCurves: SegmentedPumpCurve[] = [];
    const newSegmentedModifiedPumpCurves: SegmentedPumpCurve[] = [];

    const newBepPoints: PumpCurvePoint[] = [];
    const newModifiedBepPoints: PumpCurvePoint[] = [];

    const newSystemCurvePoints: SystemCurvePoint[][] = [];

    const segmentCurve = (
      points: PumpCurvePoint[],
      bepFlow: number
    ): SegmentedPumpCurve => {
      if (points.length < 3) {
        return { start: points, middle: [], end: [] };
      }

      // Define BEP range - 70% to 120% of BEP flow for optimal efficiency
      const bepRangeStart = bepFlow * 0.7;
      const bepRangeEnd = bepFlow * 1.2;

      // Sort points by flow to ensure proper segmentation
      const sortedPoints = [...points].sort((a, b) => a.flow - b.flow);

      // Helper function to interpolate head at a specific flow
      const interpolateHead = (targetFlow: number): number => {
        for (let i = 0; i < sortedPoints.length - 1; i++) {
          const p1 = sortedPoints[i];
          const p2 = sortedPoints[i + 1];

          if (targetFlow >= p1.flow && targetFlow <= p2.flow) {
            // Linear interpolation
            const ratio = (targetFlow - p1.flow) / (p2.flow - p1.flow);
            return p1.head + ratio * (p2.head - p1.head);
          }
        }
        // If outside range, return closest point
        if (targetFlow <= sortedPoints[0].flow) return sortedPoints[0].head;
        return sortedPoints[sortedPoints.length - 1].head;
      };

      // Create enhanced points array with interpolated BEP range boundaries
      const enhancedPoints = [...sortedPoints];

      // Add interpolated start point if it doesn't exist
      const hasStartPoint = sortedPoints.some(
        (p) => Math.abs(p.flow - bepRangeStart) < 0.1
      );
      if (!hasStartPoint) {
        const startHead = interpolateHead(bepRangeStart);
        enhancedPoints.push({ flow: bepRangeStart, head: startHead });
      }

      // Add interpolated end point if it doesn't exist
      const hasEndPoint = sortedPoints.some(
        (p) => Math.abs(p.flow - bepRangeEnd) < 0.1
      );
      if (!hasEndPoint) {
        const endHead = interpolateHead(bepRangeEnd);
        enhancedPoints.push({ flow: bepRangeEnd, head: endHead });
      }

      // Re-sort with new interpolated points
      enhancedPoints.sort((a, b) => a.flow - b.flow);

      // Find indices for BEP range with exact values
      let bepStartIndex = 0;
      let bepEndIndex = enhancedPoints.length - 1;

      // Find the start of BEP range (exact match or closest)
      for (let i = 0; i < enhancedPoints.length; i++) {
        if (enhancedPoints[i].flow >= bepRangeStart - 0.1) {
          bepStartIndex = i;
          break;
        }
      }

      // Find the end of BEP range (exact match or closest)
      for (let i = enhancedPoints.length - 1; i >= 0; i--) {
        if (enhancedPoints[i].flow <= bepRangeEnd + 0.1) {
          bepEndIndex = i;
          break;
        }
      }

      // Ensure we have at least one point in the middle section
      if (bepStartIndex >= bepEndIndex) {
        const bepIndex =
          enhancedPoints.findIndex((p) => p.flow >= bepFlow) ||
          Math.floor(enhancedPoints.length / 2);
        bepStartIndex = Math.max(0, bepIndex - 1);
        bepEndIndex = Math.min(enhancedPoints.length - 1, bepIndex + 1);
      }

      return {
        start: enhancedPoints.slice(0, bepStartIndex + 1),
        middle: enhancedPoints.slice(bepStartIndex, bepEndIndex + 1),
        end: enhancedPoints.slice(bepEndIndex)
      };
    };

    // Generate segmented curves for each pump
    activeSavedPumps.forEach((pump) => {
      if (!pump.maxHead || !pump.maxFlow) return;

      maxHead = Math.max(maxHead, pump.maxHead);
      overallMaxFlow = Math.max(overallMaxFlow, pump.maxFlow);

      let points: PumpCurvePoint[] = [];
      let bepFlow = 0;
      let bepHead = 0;

      // Check if pump has pvsq data
      if (pump.pvsq && pump.pvsq.length > 0) {
        // Use pvsq duty points and convert units if needed
        points = pump.pvsq.map((point) => ({
          flow: convertFlow(point.flow, 'L/min', flowUnit), // Assuming pvsq is in L/min
          head: convertHead(point.head, 'm', headUnit) // Assuming pvsq is in meters
        }));

        // Sort points by flow for proper curve display
        points.sort((a, b) => a.flow - b.flow);

        // Calculate BEP using the same logic as SavedPumpsList - find max(flow * head)
        let maxProduct = 0;
        let bepIndex = 0;

        points.forEach((point, index) => {
          const product = point.flow * point.head;
          if (product > maxProduct) {
            maxProduct = product;
            bepIndex = index;
          }
        });

        bepFlow = points[bepIndex]?.flow || 0;
        bepHead = points[bepIndex]?.head || 0;
      } else {
        // Use the EXACT same BEP calculation logic as SavedPumpsList
        // Generate curve points using the parabolic formula: head = Hmax * (1 - (flow / Qmax)^2)
        const numPoints = 100;
        let maxProduct = 0;

        for (let i = 0; i <= numPoints; i++) {
          const flow = (pump.maxFlow * i) / numPoints;
          const head = pump.maxHead * (1 - Math.pow(flow / pump.maxFlow, 2));
          points.push({ flow, head });

          // Find BEP by maximizing flow * head product
          const product = flow * head;
          if (product > maxProduct) {
            maxProduct = product;
            bepFlow = flow;
            bepHead = head;
          }
        }
      }

      newSegmentedPumpCurves.push(segmentCurve(points, bepFlow));
      newBepPoints.push({ flow: bepFlow, head: bepHead });

      // Modified curve logic (speed variation)
      if (
        pump.oldSpeed &&
        pump.newSpeed &&
        pump.oldSpeed > 0 &&
        pump.newSpeed > 0 &&
        pump.newSpeed !== pump.oldSpeed
      ) {
        const ratio = pump.newSpeed / pump.oldSpeed;
        const headRatio = ratio * ratio;

        let modifiedPoints: PumpCurvePoint[] = [];
        let modifiedBepFlow = 0;
        let modifiedBepHead = 0;

        if (pump.pvsq && pump.pvsq.length > 0) {
          // Apply affinity laws to pvsq data
          modifiedPoints = pump.pvsq.map((point) => ({
            flow: convertFlow(point.flow * ratio, 'L/min', flowUnit),
            head: convertHead(point.head * headRatio, 'm', headUnit)
          }));

          // Sort modified points by flow
          modifiedPoints.sort((a, b) => a.flow - b.flow);

          // Find modified BEP using max(flow * head)
          let modifiedMaxProduct = 0;
          let modifiedBepIndex = 0;

          modifiedPoints.forEach((point, index) => {
            const product = point.flow * point.head;
            if (product > modifiedMaxProduct) {
              modifiedMaxProduct = product;
              modifiedBepIndex = index;
            }
          });

          modifiedBepFlow = modifiedPoints[modifiedBepIndex]?.flow || 0;
          modifiedBepHead = modifiedPoints[modifiedBepIndex]?.head || 0;
        } else {
          // Apply affinity laws to the original max values
          const modifiedMaxHead = pump.maxHead * headRatio;
          const modifiedMaxFlow = pump.maxFlow * ratio;

          // Use the EXACT same BEP calculation logic as SavedPumpsList for modified curve
          const numPoints = 100;
          let modifiedMaxProduct = 0;

          for (let i = 0; i <= numPoints; i++) {
            const flow = (modifiedMaxFlow * i) / numPoints;
            const head =
              modifiedMaxHead * (1 - Math.pow(flow / modifiedMaxFlow, 2));
            modifiedPoints.push({ flow, head });

            // Find modified BEP by maximizing flow * head product
            const product = flow * head;
            if (product > modifiedMaxProduct) {
              modifiedMaxProduct = product;
              modifiedBepFlow = flow;
              modifiedBepHead = head;
            }
          }
        }

        const modifiedMaxHead = Math.max(...modifiedPoints.map((p) => p.head));
        const modifiedMaxFlow = Math.max(...modifiedPoints.map((p) => p.flow));

        maxHead = Math.max(maxHead, modifiedMaxHead);
        overallMaxFlow = Math.max(overallMaxFlow, modifiedMaxFlow);

        newSegmentedModifiedPumpCurves.push(
          segmentCurve(modifiedPoints, modifiedBepFlow)
        );
        newModifiedBepPoints.push({
          flow: modifiedBepFlow,
          head: modifiedBepHead
        });
      } else {
        newSegmentedModifiedPumpCurves.push({ start: [], middle: [], end: [] });
        newModifiedBepPoints.push({ flow: 0, head: 0 });
      }
    });

    // System curve generation remains the same
    if (showSystemCurve) {
      systemCurveData.forEach((system) => {
        if (
          system.staticHead === undefined ||
          system.operatingFlow === undefined ||
          system.operatingHead === undefined ||
          system.operatingFlow <= 0
        )
          return;

        const points: SystemCurvePoint[] = [];
        const axisMaxFlow = Math.ceil(overallMaxFlow / 10) * 10;
        const numPoints = 100;

        for (let i = 0; i <= numPoints; i++) {
          const flow = (axisMaxFlow * i) / numPoints;
          const head =
            system.staticHead +
            (system.operatingHead - system.staticHead) *
              Math.pow(flow / system.operatingFlow, 2);
          points.push({ flow, head });
        }

        newSystemCurvePoints.push(points);
      });
    }

    // Set all state
    setOverallMaxHead(Math.ceil(maxHead / 10) * 10);
    setOverallMaxFlow(Math.ceil(overallMaxFlow / 10) * 10);
    setSegmentedPumpCurves(newSegmentedPumpCurves);
    setSegmentedModifiedPumpCurves(newSegmentedModifiedPumpCurves);
    setSystemCurvePoints(newSystemCurvePoints);
    setBepPoints(newBepPoints);
    setModifiedBepPoints(newModifiedBepPoints);
  };

  const exportChart = async () => {
    const svgElement = chartRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgClone = svgElement.cloneNode(true) as SVGElement;

    const allElements = svgClone.querySelectorAll('*');
    allElements.forEach((element) => {
      const computedStyle = window.getComputedStyle(element);
      const importantStyles = [
        'fill',
        'stroke',
        'stroke-width',
        'opacity',
        'display',
        'visibility',
        'transform',
        'd',
        'points'
      ];

      importantStyles.forEach((style) => {
        const value = computedStyle.getPropertyValue(style);
        if (value) {
          element.setAttribute(style, value);
        }
      });
    });

    const paths = svgClone.querySelectorAll('path');
    paths.forEach((path) => {
      path.style.display = 'inline';
      path.style.visibility = 'visible';

      const originalPath = svgElement.querySelector(
        `path[d="${path.getAttribute('d')}"]`
      );
      if (originalPath) {
        const stroke = window
          .getComputedStyle(originalPath)
          .getPropertyValue('stroke');
        const strokeWidth = window
          .getComputedStyle(originalPath)
          .getPropertyValue('stroke-width');
        if (stroke) path.setAttribute('stroke', stroke);
        if (strokeWidth) path.setAttribute('stroke-width', strokeWidth);
      }
    });

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 10, 10, pageWidth - 20, pageHeight - 20);
      pdf.save('pump-curve.pdf');
    };
    img.src = url;
  };

  const addPump = () => {
    setPumpData([
      ...pumpData,
      {
        id: Date.now().toString(),
        maxHead: 100,
        maxFlow: 200,
        oldSpeed: undefined,
        newSpeed: undefined
      }
    ]);
  };

  const updatePump = (id: string, updatedPump: Partial<PumpData>) => {
    setPumpData(
      pumpData.map((pump) =>
        pump.id === id ? { ...pump, ...updatedPump } : pump
      )
    );
  };

  const removePump = (id: string) => {
    setPumpData(pumpData.filter((pump) => pump.id !== id));
  };

  const addSystemCurve = () => {
    setSystemCurveData([
      ...systemCurveData,
      {
        id: Date.now().toString(),
        staticHead: 20,
        operatingFlow: 100,
        operatingHead: 60
      }
    ]);
  };

  const updateSystemCurve = (
    id: string,
    updatedSystem: Partial<SystemCurveData>
  ) => {
    setSystemCurveData(
      systemCurveData.map((system) =>
        system.id === id ? { ...system, ...updatedSystem } : system
      )
    );
  };

  const removeSystemCurve = (id: string) => {
    setSystemCurveData(systemCurveData.filter((system) => system.id !== id));
  };

  const savePump = (pump: PumpData) => {
    const pumpName = prompt('Enter a name for this pump:');
    if (!pumpName) return;

    const newSavedPump: SavedPump = {
      id: Date.now().toString(),
      name: pumpName,
      maxHead: pump.maxHead,
      maxFlow: pump.maxFlow,
      oldSpeed: pump.oldSpeed,
      newSpeed: pump.newSpeed,
      headUnit,
      flowUnit
    };

    const updatedSavedPumps = [...savedPumps, newSavedPump];
    setSavedPumps(updatedSavedPumps);
    localStorage.setItem('savedPumps', JSON.stringify(updatedSavedPumps));
  };

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
      pvsq: savedPump.pvsq || []
    };

    setActiveSavedPumps((prev) => [...prev, newPump]);
  };

  const removeSavedPumpFromChart = (savedPump: SavedPump) => {
    setActiveSavedPumps((prev) => {
      const updated = prev.filter((p) => p.id !== savedPump.id);

      return updated;
    });
    // setPumpCurvePoints((prev) => prev.filter((_, i) => activeSavedPumps[i].id !== savedPump.id))
  };

  const editPumpFromSaved = (pump: SavedPump) => {
    // const editablePump: PumpData = {
    //   id: pump.id,
    //   maxHead: pump.maxHead,
    //   name: pump?.name,
    //   maxFlow: pump.maxFlow,
    //   oldSpeed: pump.oldSpeed,
    //   newSpeed: pump.newSpeed
    // };
    // setPumpData([editablePump]);
    // setEditingPumpId(pump.id);
    // setActiveTab('pumps');
    router.push(`dashboard/pumps/${pump.id}`);
  };

  const updateSavedPump = (updatedPump: PumpData) => {
    const updatedSavedPumps = savedPumps.map((pump) =>
      pump.id === updatedPump.id ? { ...pump, ...updatedPump } : pump
    );
    setSavedPumps(updatedSavedPumps);
    localStorage.setItem('savedPumps', JSON.stringify(updatedSavedPumps));
    setEditingPumpId(null);
    setPumpData([]);
  };

  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
      <div className='grid grid-cols-1 gap-6 lg:col-span-2'>
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className='w-full'>
              {/* <TabsTrigger value='pumps' className='flex-1 cursor-pointer'>
                Pump Curves
              </TabsTrigger> */}
              <TabsTrigger value='system' className='flex-1 cursor-pointer'>
                System Curves
              </TabsTrigger>
            </TabsList>

            {/* <TabsContent value='pumps' className='space-y-4'>
              <Card className='flex flex-col justify-between p-4'>
                <h2 className='mb-4 text-xl font-semibold'>
                  Pump Curve Parameters
                </h2>
                {pumpData.map((pump, index) => (
                  <PumpInputs
                    key={pump.id}
                    pump={pump}
                    index={index}
                    updatePump={updatePump}
                    removePump={removePump}
                    savePump={savePump}
                    isEditing={editingPumpId === pump.id}
                    onUpdate={updateSavedPump}
                    flowUnit={flowUnit}
                    headUnit={headUnit}
                  />
                ))}
                <Button
                  onClick={addPump}
                  className='mt-4 w-full cursor-pointer'
                >
                  Add Pump
                </Button>
              </Card>
            </TabsContent> */}

            <TabsContent value='system' className='space-y-4'>
              <Card className='flex flex-col justify-between p-4'>
                <div className='mb-4 flex flex-col items-start'>
                  <h2 className='mb-2 text-xl font-semibold'>
                    System Curve Parameters
                  </h2>
                  <Button
                    className='cursor-pointer'
                    variant='outline'
                    onClick={() => setShowSystemCurve(!showSystemCurve)}
                  >
                    {showSystemCurve ? 'Hide' : 'Show'} System Curves
                  </Button>
                </div>

                {showSystemCurve &&
                  systemCurveData.map((system, index) => (
                    <SystemCurveInputs
                      key={system.id}
                      system={system}
                      index={index}
                      updateSystemCurve={updateSystemCurve}
                      removeSystemCurve={removeSystemCurve}
                    />
                  ))}

                {showSystemCurve && (
                  <Button
                    onClick={addSystemCurve}
                    className='mt-4 w-full cursor-pointer'
                  >
                    Add System Curve
                  </Button>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Chart */}
        <div>
          <Card className='p-4'>
            <h2 className='mb-4 text-xl font-semibold'>
              Pump and System Curves
            </h2>
            <div ref={chartRef}>
              <PumpCurveChart
                pumpData={activeSavedPumps}
                // pumpCurvePoints={pumpCurvePoints}
                // modifiedPumpCurvePoints={modifiedPumpCurvePoints}
                systemCurveData={systemCurveData}
                systemCurvePoints={systemCurvePoints}
                bepPoints={bepPoints}
                modifiedBepPoints={modifiedBepPoints}
                overallMaxHead={overallMaxHead}
                overallMaxFlow={overallMaxFlow}
                flowUnit={flowUnit}
                headUnit={headUnit}
                segmentedPumpCurves={segmentedPumpCurves}
                segmentedModifiedPumpCurves={segmentedModifiedPumpCurves}
              />
            </div>
          </Card>
          {/* <Button disabled={segmentedPumpCurves.length === 0}
                        className="bg-primary mt-2.5 mb-2.5 text-white cursor-pointer " variant="outline" onClick={exportChart}>Export(PDF)</Button> */}
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
          <h2 className='mb-4 text-xl font-semibold'>Saved Pumps</h2>
          <SavedPumpsList
            savedPumps={savedPumps}
            systemCurveData={systemCurveData}
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
