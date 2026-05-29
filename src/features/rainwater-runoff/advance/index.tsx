'use client';

import { useState, useCallback, useMemo, useRef } from 'react';

/* Re-export for legacy sub-components */
export interface HydrographDataPoint {
  time: number;
  flowRate: number;
}

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  Filler
} from 'chart.js';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Download, Trash2, Plus, Save, Upload, CheckCircle, Calculator, Loader2, Info } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* ---------- Types ---------- */
interface Catchment {
  id: string;
  area: number;
  coefficient: number;
  toc: number;
  aep: string;
}

interface IFDData {
  duration: number;
  durationLabel: string;
  intensities: Record<string, number>;
}

interface HydroPoint {
  time: number;
  flowRate: number;
}

interface DurationResult {
  duration: number;
  durationLabel: string;
  hydrograph: HydroPoint[];
  peakFlow: number;
  detentionVolume: number;
}

interface Project {
  id: string;
  name: string;
  catchments: Catchment[];
  flowRate: number;
  detentionVolume: number;
  worstDuration: number;
  maxDuration: number;
  maxDurationUnit: TimeUnit;
  created_at: string;
}

type FlowUnit = 'm3/s' | 'L/s' | 'm3/hr';
type TimeUnit = 'min' | 'hr';
type VolumeUnit = 'm3' | 'L' | 'kL';

/* ---------- Helpers ---------- */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const aepOptions = [
  '63.2%',
  '50%',
  '20%',
  '10%',
  '5%',
  '2%',
  '1%'
];

const hortonValues: Record<string, number> = {
  'Paved Surface': 0.015,
  'Bare Soil Surface': 0.0275,
  'Poorly Grassed Surface': 0.035,
  'Average Grassed Surface': 0.045,
  'Densely Grassed Surface': 0.06
};

/* Unit conversions */
const convertFlow = (val: number, from: FlowUnit, to: FlowUnit) => {
  // Normalize to m3/s first
  let m3s = val;
  if (from === 'L/s') m3s = val / 1000;
  if (from === 'm3/hr') m3s = val / 3600;
  // Convert to target
  if (to === 'm3/s') return m3s;
  if (to === 'L/s') return m3s * 1000;
  if (to === 'm3/hr') return m3s * 3600;
  return m3s;
};

const convertTime = (val: number, from: TimeUnit, to: TimeUnit) => {
  let min = val;
  if (from === 'hr') min = val * 60;
  if (to === 'min') return min;
  if (to === 'hr') return min / 60;
  return min;
};

const convertVolume = (val: number, from: VolumeUnit, to: VolumeUnit) => {
  // Normalize to m3 first
  let m3 = val;
  if (from === 'L') m3 = val / 1000;
  if (from === 'kL') m3 = val; // 1 kL = 1 m3
  // Convert to target
  if (to === 'm3') return m3;
  if (to === 'L') return m3 * 1000;
  if (to === 'kL') return m3; // 1 m3 = 1 kL
  return m3;
};

const flowUnitLabel = (u: FlowUnit) => {
  if (u === 'm3/s') return 'm³/s';
  if (u === 'L/s') return 'L/s';
  return 'm³/hr';
};

const timeUnitLabel = (u: TimeUnit) => {
  if (u === 'min') return 'min';
  return 'hr';
};

const volumeUnitLabel = (u: VolumeUnit) => {
  if (u === 'm3') return 'm³';
  if (u === 'L') return 'L';
  return 'kL';
};

const formatDurationLabel = (min: number): string => {
  if (min < 60) return `${min} min`;
  const hr = min / 60;
  if (Number.isInteger(hr)) {
    return `${hr} hr`;
  }
  return `${hr.toFixed(1)} hr`;
};

/* ---------- Component ---------- */
export default function AdvancedStormwaterCalculator() {
  const { user } = useAuth();

  /* -- Catchments -- */
  const [catchments, setCatchments] = useState<Catchment[]>([
    { id: uid(), area: 0, coefficient: 1, toc: 10, aep: '20%' }
  ]);

  /* -- Units -- */
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('m3/s');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('min');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('m3');

  /* -- Flow / Detention -- */
  const [flowRate, setFlowRate] = useState<number>(0);
  const [detentionVolume, setDetentionVolume] = useState<number | null>(null);
  const [worstDuration, setWorstDuration] = useState<number | null>(null);
  const [maxDuration, setMaxDuration] = useState<number>(6);
  const [maxDurationUnit, setMaxDurationUnit] = useState<TimeUnit>('hr');

  /* -- Refs for synchronous reads in callbacks (stale-closure fix) -- */
  const flowRateRef = useRef<number>(0);
  const flowUnitRef = useRef<FlowUnit>('m3/s');
  flowRateRef.current = flowRate;
  flowUnitRef.current = flowUnit;

  /* -- IFD / CSV -- */
  const [csvData, setCsvData] = useState<IFDData[] | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [showBomHelp, setShowBomHelp] = useState(false);

  /* -- All triangles -- */
  const [allResults, setAllResults] = useState<DurationResult[]>([]);
  const [showAllTriangles, setShowAllTriangles] = useState(true);

  /* -- Saved projects -- */
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  /* -- Tc Calculator Dialog -- */
  const [showTcDialog, setShowTcDialog] = useState(false);
  const [tcCatchmentId, setTcCatchmentId] = useState<string | null>(null);
  const [tcLength, setTcLength] = useState(70);
  const [tcSlope, setTcSlope] = useState(4.4);
  const [tcHorton, setTcHorton] = useState('Average Grassed Surface');
  const [tcCustom, setTcCustom] = useState<number | null>(null);
  const [tcResult, setTcResult] = useState<number | null>(null);

  const chartRef = useRef<ChartJS<'line'>>(null);

  /* ---------- Actions: Catchments ---------- */
  const addCatchment = () => {
    setCatchments((prev) => [
      ...prev,
      { id: uid(), area: 0, coefficient: 1, toc: 10, aep: '20%' }
    ]);
  };

  const removeCatchment = (id: string) => {
    setCatchments((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCatchment = (id: string, field: keyof Catchment, value: any) => {
    setCatchments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  /* ---------- IFD Parsing ---------- */
  const parseIFDFile = (file: File) => {
    setCsvFileName(file.name);
    setCsvError('');
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            setCsvError('Error parsing CSV file.');
            return;
          }
          const rows = results.data as string[][];
          if (rows.length === 0) {
            setCsvError('CSV file is empty.');
            return;
          }
          let headerRowIndex = -1;
          let aepColumns: string[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (
              row[0] &&
              row[0].toLowerCase().includes('duration') &&
              row.some((cell) => cell && cell.includes('%'))
            ) {
              headerRowIndex = i;
              aepColumns = row.slice(2).filter((cell) => cell && cell.includes('%'));
              break;
            }
          }
          if (headerRowIndex === -1 || aepColumns.length === 0) {
            setCsvError('Could not find AEP header row.');
            return;
          }
          const parsedData: IFDData[] = [];
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[0] || !row[1]) continue;
            const durationLabel = row[0].trim();
            const durationInMinutes = parseFloat(row[1]);
            if (isNaN(durationInMinutes) || durationInMinutes <= 0) continue;
            const intensities: Record<string, number> = {};
            let hasValid = false;
            for (let j = 0; j < aepColumns.length; j++) {
              const val = parseFloat(row[j + 2]);
              if (!isNaN(val) && val > 0) {
                intensities[aepColumns[j]] = val;
                hasValid = true;
              }
            }
            if (hasValid) {
              parsedData.push({ duration: durationInMinutes, durationLabel, intensities });
            }
          }
          parsedData.sort((a, b) => a.duration - b.duration);
          setCsvData(parsedData);
          // Reset previous results when new CSV loaded
          setAllResults([]);
          setWorstDuration(null);
          setDetentionVolume(null);
          setShowAllTriangles(true);
        } catch {
          setCsvError('Error processing CSV file.');
        }
      },
      error: (err) => setCsvError(`Error reading file: ${err.message}`)
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseIFDFile(file);
  };

  /* ---------- Interpolation ---------- */
  const interpolateIntensity = useCallback(
    (targetDuration: number, aep: string): number | null => {
      if (!csvData) return null;
      const exact = csvData.find((d) => d.duration === targetDuration);
      if (exact && exact.intensities[aep] !== undefined) return exact.intensities[aep];
      const sorted = csvData
        .filter((d) => d.intensities[aep] !== undefined)
        .sort((a, b) => a.duration - b.duration);
      if (sorted.length === 0) return null;
      if (targetDuration <= sorted[0].duration) return sorted[0].intensities[aep];
      if (targetDuration >= sorted[sorted.length - 1].duration)
        return sorted[sorted.length - 1].intensities[aep];
      for (let i = 0; i < sorted.length - 1; i++) {
        const d1 = sorted[i].duration;
        const d2 = sorted[i + 1].duration;
        if (targetDuration >= d1 && targetDuration <= d2) {
          const I1 = sorted[i].intensities[aep];
          const I2 = sorted[i + 1].intensities[aep];
          if (I1 <= 0 || I2 <= 0 || targetDuration <= 0 || d1 <= 0 || d2 <= 0) {
            return I1 + (I2 - I1) * ((targetDuration - d1) / (d2 - d1));
          }
          // Log-log interpolation
          return Math.exp(
            Math.log(I1) +
              ((Math.log(I2) - Math.log(I1)) * (Math.log(targetDuration) - Math.log(d1))) /
                (Math.log(d2) - Math.log(d1))
          );
        }
      }
      return null;
    },
    [csvData]
  );

  /* ---------- Build Triangle for One Duration ---------- */
  const buildTriangle = (duration: number, aep: string): HydroPoint[] => {
    const points: HydroPoint[] = [];
    const maxTcRaw = Math.max(...catchments.map((c) => c.toc || 0));
    const maxTc = Math.max(1, Math.round(maxTcRaw));

    // Calculate combined peak flow at 'duration' (td) using log-log interpolated intensity
    let peakFlow = 0;
    for (const c of catchments) {
      if (!c.area || !c.coefficient || !c.toc) continue;
      const I = interpolateIntensity(duration, c.aep);
      if (!I) continue;
      peakFlow += (c.coefficient * I * c.area) / 3_600_000;
    }

    // Generate trapezoidal hydrograph points using Modified Rational Method
    // Rising limb: tc, Falling limb: tc, Plateau: td - tc (total time is td + tc)
    const totalTime = duration + maxTc;
    for (let t = 0; t <= totalTime; t++) {
      let flowRate = 0;
      if (maxTc > 0) {
        const ramp1 = Math.max(0, Math.min(t, maxTc));
        const ramp2 = Math.max(0, Math.min(t - duration, maxTc));
        flowRate = (peakFlow / maxTc) * (ramp1 - ramp2);
      } else {
        flowRate = t <= duration ? peakFlow : 0;
      }
      points.push({ time: t, flowRate });
    }

    return points;
  };

  /* ---------- Calculate All Durations ---------- */
  const calculateAllTriangles = () => {
    if (!csvData) {
      toast.error('Upload IFD CSV first.');
      return;
    }
    if (catchments.length === 0 || catchments.every((c) => !c.area)) {
      toast.error('Add at least one catchment with an area.');
      return;
    }

    const results: DurationResult[] = [];
    const flowRateM3s = convertFlow(flowRateRef.current, flowUnitRef.current, 'm3/s');
    const maxDurationMin = convertTime(maxDuration, maxDurationUnit, 'min');

    const maxTcRaw = Math.max(...catchments.map((c) => c.toc || 0));
    const maxTc = Math.max(1, Math.round(maxTcRaw));

    // Create storm durations at 6-minute intervals starting at maxTc
    const targetDurations: number[] = [];
    if (maxTc <= 6) {
      for (let d = 6; d <= maxDurationMin; d += 6) {
        targetDurations.push(d);
      }
    } else {
      // First event is at maxTc
      targetDurations.push(maxTc);
      // Subsequent events are at multiples of 6 greater than maxTc
      const nextMultipleOf6 = Math.ceil((maxTc + 0.0001) / 6) * 6;
      for (let d = nextMultipleOf6; d <= maxDurationMin; d += 6) {
        targetDurations.push(d);
      }
    }

    if (targetDurations.length === 0) {
      toast.error('No storms within the selected max duration. Increase the limit.');
      return;
    }

    for (const duration of targetDurations) {
      const stormAep = catchments[0]?.aep || '20%';

      const hydrograph = buildTriangle(duration, stormAep);
      const peak = Math.max(...hydrograph.map((p) => p.flowRate));

      // Detention volume for this trapezoid (above pump line)
      let vol = 0;
      for (let i = 0; i < hydrograph.length - 1; i++) {
        const q1 = Math.max(0, hydrograph[i].flowRate - flowRateM3s);
        const q2 = Math.max(0, hydrograph[i + 1].flowRate - flowRateM3s);
        const avg = (q1 + q2) / 2;
        vol += avg * 60; // 60 seconds per minute step
      }

      results.push({
        duration: duration,
        durationLabel: formatDurationLabel(duration),
        hydrograph,
        peakFlow: peak,
        detentionVolume: vol
      });
    }

    if (results.length === 0) {
      toast.error('Could not generate hydrographs. Check catchment data and CSV.');
      return;
    }

    // Find worst case (max detention)
    const worst = results.reduce((max, r) =>
      r.detentionVolume > max.detentionVolume ? r : max,
      results[0]
    );

    setAllResults(results);
    setWorstDuration(worst.duration);
    setDetentionVolume(convertVolume(worst.detentionVolume, 'm3', volumeUnit));
    setShowAllTriangles(true);
    toast.success(`Generated ${results.length} hydrographs. Worst case: ${worst.durationLabel}`);
  };

  /* ---------- Chart ---------- */
  const activeResult = useMemo(() => {
    if (allResults.length === 0) return null;
    if (showAllTriangles) return null; // show all
    return allResults.find((r) => r.duration === worstDuration) || allResults[0];
  }, [allResults, worstDuration, showAllTriangles]);

  const chartData = useMemo(() => {
    if (allResults.length === 0) return { labels: [], datasets: [] };

    const flowRateM3s = convertFlow(flowRate, flowUnit, 'm3/s');

    if (showAllTriangles) {
      // Show all trapezoids overlaid, lighter lines
      const maxTime = Math.max(...allResults.map((r) => r.hydrograph[r.hydrograph.length - 1]?.time || r.duration));
      const labels = Array.from({ length: maxTime + 1 }, (_, i) => `${i}`);

      const datasets: any[] = allResults.map((r, idx) => ({
        label: `${r.durationLabel}`,
        data: Array(maxTime + 1).fill(null).map((_, t) => {
          const pt = r.hydrograph.find((p) => p.time === t);
          return pt ? convertFlow(pt.flowRate, 'm3/s', flowUnit) : null;
        }),
        borderColor: `rgba(37, 99, 235, ${0.3 + (idx / allResults.length) * 0.4})`,
        backgroundColor: 'rgba(0,0,0,0)',
        borderWidth: 1.5,
        fill: false,
        tension: 0,
        pointRadius: 0,
        spanGaps: false
      }));

      // Add pump line if visible
      const maxPeak = Math.max(...allResults.map((r) => r.peakFlow));
      if (flowRateM3s <= maxPeak * 2) {
        datasets.push({
          label: 'Pump Discharge',
          data: Array(maxTime + 1).fill(convertFlow(flowRateM3s, 'm3/s', flowUnit)),
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        });
      }

      return { labels, datasets };
    } else {
      // Show only worst case triangle with shaded detention
      const r = activeResult;
      if (!r) return { labels: [], datasets: [] };

      const labels = r.hydrograph.map((p) => `${p.time}`);

      const datasets: any[] = [
        {
          label: `Hydrograph (${r.durationLabel})`,
          data: r.hydrograph.map((p) => convertFlow(p.flowRate, 'm3/s', flowUnit)),
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0)',
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0
        },
        {
          label: 'Pump Discharge',
          data: Array(r.hydrograph.length).fill(convertFlow(flowRateM3s, 'm3/s', flowUnit)),
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }
      ];

      // Shaded detention area
      if (r.detentionVolume > 0) {
        datasets.push({
          label: 'Detention Area',
          data: r.hydrograph.map((p) => {
            const f = convertFlow(p.flowRate, 'm3/s', flowUnit);
            const pumpF = convertFlow(flowRateM3s, 'm3/s', flowUnit);
            return f > pumpF ? f : pumpF;
          }),
          borderColor: 'rgba(239, 68, 68, 0)',
          backgroundColor: 'rgba(239, 68, 68, 0.25)',
          pointRadius: 0,
          fill: { target: 1, above: 'rgba(239, 68, 68, 0.25)' }
        });
      }

      return { labels, datasets };
    }
  }, [allResults, activeResult, showAllTriangles, flowRate, flowUnit, volumeUnit]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, boxWidth: 8 }
      },
      title: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(4) ?? '-'} ${flowUnitLabel(flowUnit)}`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: `Time (${timeUnitLabel(timeUnit)})`, font: { size: 12 } },
        grid: { display: true, color: 'rgba(0,0,0,0.05)' }
      },
      y: {
        title: { display: true, text: `Flow (${flowUnitLabel(flowUnit)})`, font: { size: 12 } },
        beginAtZero: true,
        grid: { display: true, color: 'rgba(0,0,0,0.05)' }
      }
    }
  };

  /* ---------- Save / Load ---------- */
  const fetchProjects = async () => {
    if (!user?.id) return;
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('stormwater_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const mapped: Project[] =
        data?.map((d) => ({
          id: d.id,
          name: d.name,
          catchments: d.catchments,
          flowRate: d.flow_rate,
          detentionVolume: d.detention_volume,
          worstDuration: d.worst_duration,
          maxDuration: d.max_duration,
          maxDurationUnit: d.max_duration_unit,
          created_at: d.created_at
        })) ?? [];
      setProjects(mapped);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const saveProject = async () => {
    if (!user?.id) {
      toast.error('Please sign in to save projects.');
      return;
    }
    if (!projectName.trim()) {
      toast.error('Please enter a project name.');
      return;
    }
    try {
      const { error } = await supabase.from('stormwater_projects').insert({
        user_id: user.id,
        name: projectName.trim(),
        catchments: catchments,
        flow_rate: flowRate,
        detention_volume: detentionVolume ?? 0,
        worst_duration: worstDuration ?? 0,
        max_duration: convertTime(maxDuration, maxDurationUnit, 'min'),
        max_duration_unit: maxDurationUnit,
        csv_data: csvData,
        hydrograph_data: allResults.map((r) => ({ duration: r.duration, hydrograph: r.hydrograph }))
      });
      if (error) throw error;
      toast.success('Project saved!');
      setShowSaveDialog(false);
      setProjectName('');
      fetchProjects();
    } catch {
      toast.error('Failed to save project');
    }
  };

  const loadProject = (p: Project) => {
    setCatchments(p.catchments.length ? p.catchments : []);
    setFlowRate(p.flowRate);
    setDetentionVolume(p.detentionVolume);
    setWorstDuration(p.worstDuration);
    setMaxDuration(p.maxDuration ?? 6);
    setMaxDurationUnit(p.maxDurationUnit ?? 'hr');
    toast.success(`Loaded project: ${p.name}`);
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from('stormwater_projects').delete().eq('id', id);
      if (error) throw error;
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('Project deleted');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  /* ---------- Tc Calculator Dialog ---------- */
  const openTcForCatchment = (id: string) => {
    setTcCatchmentId(id);
    setTcResult(null);
    setShowTcDialog(true);
  };

  const calculateTc = () => {
    const n =
      tcHorton === 'Custom' && tcCustom ? tcCustom : hortonValues[tcHorton] ?? 0.045;
    const B = 107;
    const tc = (B * (n * Math.pow(tcLength, 1 / 3))) / Math.pow(tcSlope, 1 / 5);
    setTcResult(parseFloat(tc.toFixed(2)));
  };

  const applyTc = () => {
    if (tcCatchmentId && tcResult !== null) {
      updateCatchment(tcCatchmentId, 'toc', tcResult);
      setShowTcDialog(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className='mx-auto flex max-w-7xl gap-6 p-4'>
      {/* Main Content */}
      <div className='flex-1 space-y-6'>
        <h1 className='text-2xl font-bold'>Stormwater Hydrograph</h1>

        {/* Step 1: IFD Data */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>1</span>
              IFD Data
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex flex-wrap gap-4'>
              <div className='flex-1 space-y-2'>
                <Label>Upload IFD CSV</Label>
                <Input type='file' accept='.csv' onChange={handleFileUpload} />
                {csvError && (
                  <p className='text-sm text-red-500'>{csvError}</p>
                )}
                {csvData && (
                  <div className='flex items-center gap-2 text-sm text-green-700'>
                    <CheckCircle className='h-4 w-4' />
                    {csvFileName} ({csvData.length} points)
                  </div>
                )}
              </div>
              <div className='flex items-end'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowBomHelp(!showBomHelp)}
                  className='cursor-pointer'
                >
                  <Info className='mr-1 h-4 w-4' />
                  How to get IFD data
                </Button>
              </div>
            </div>

            {showBomHelp && (
              <div className='rounded border border-sky-200 bg-sky-50 p-4 text-sm'>
                <strong className='text-sky-800'>How to Download CSV from the BOM Website:</strong>
                <ol className='mt-2 list-inside list-decimal space-y-1 text-sky-700'>
                  <li>
                    Go to:{' '}
                    <a
                      href='http://www.bom.gov.au/water/designRainfalls/revised-ifd/'
                      target='_blank'
                      rel='noreferrer'
                      className='text-blue-600 underline'
                    >
                      BOM IFD Calculator
                    </a>
                  </li>
                  <li>On the left sidebar, click <strong>Select from Map</strong> under the Search.</li>
                  <li>Click anywhere on the map to choose your location/region.</li>
                  <li>Once selected, the coordinates will populate in the fields.</li>
                  <li>Click <strong>Submit</strong> on the left panel to generate results.</li>
                  <li>In the right-hand results table, change the unit from <strong>mm</strong> to <strong>mm/hr</strong>.</li>
                  <li>Click the <strong>CSV download icon</strong> at the top right of the table to download your data.</li>
                </ol>
                <div className='mt-3'>
                  <a
                    href='/sample-idf.csv'
                    download='sample-idf.csv'
                    className='inline-flex items-center gap-1 text-blue-600 underline'
                  >
                    <Download className='h-3 w-3' />
                    Download Sample CSV
                  </a>
                </div>
                <div className='mt-4 rounded border border-amber-200 bg-amber-50 p-3'>
                  <strong className='text-amber-800'>⚠️ Model Limitations</strong>
                  <ul className='mt-1 list-inside list-disc space-y-1 text-amber-700'>
                    <li>
                      The triangle method calculates a <strong>theoretical maximum</strong> detention volume.
                    </li>
                    <li>
                      It does <strong>not</strong> model soil absorption, evaporation, or saturation.
                    </li>
                    <li>
                      For small urban catchments (&lt; 2,000 m²), we recommend limiting analysis to <strong>≤ 6 hours</strong>.
                    </li>
                    <li>
                      Results for multi-day storms (24h+) may <strong>overestimate</strong> real detention needs.
                    </li>
                    <li>
                      For larger sites or complex soil conditions, consult a hydraulic engineer.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Catchments */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-lg flex items-center gap-2'>
              <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>2</span>
              Catchments
            </CardTitle>
            <Button variant='outline' size='sm' onClick={addCatchment} className='cursor-pointer'>
              <Plus className='mr-1 h-4 w-4' />
              Add Catchment
            </Button>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area (m²)</TableHead>
                    <TableHead>Runoff Coefficient</TableHead>
                    <TableHead>ToC (min)</TableHead>
                    <TableHead>ARI/AEP</TableHead>
                    <TableHead className='w-24'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catchments.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Input
                          type='number'
                          value={c.area || ''}
                          onChange={(e) =>
                            updateCatchment(c.id, 'area', parseFloat(e.target.value) || 0)
                          }
                          className='w-28'
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type='number'
                          value={c.coefficient || ''}
                          step='0.01'
                          min='0'
                          max='1'
                          onChange={(e) =>
                            updateCatchment(
                              c.id,
                              'coefficient',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className='w-28'
                        />
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <Input
                            type='number'
                            value={c.toc || ''}
                            onChange={(e) =>
                              updateCatchment(c.id, 'toc', parseFloat(e.target.value) || 0)
                            }
                            className='w-20'
                          />
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => openTcForCatchment(c.id)}
                            className='h-8 px-2 cursor-pointer'
                          >
                            <Calculator className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.aep}
                          onValueChange={(val) => updateCatchment(c.id, 'aep', val)}
                        >
                          <SelectTrigger className='w-28'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {aepOptions.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => removeCatchment(c.id)}
                          disabled={catchments.length <= 1}
                          className='cursor-pointer text-red-500'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Flow & Detention */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm'>3</span>
              Flow & Detention
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Unit selectors */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label>Flow Unit</Label>
                <Select
                  value={flowUnit}
                  onValueChange={(v) => {
                    const newUnit = v as FlowUnit;
                    setFlowUnit(newUnit);
                    // Recalculate detention if results exist
                    if (allResults.length > 0) {
                      const pumpM3s = convertFlow(flowRateRef.current, newUnit, 'm3/s');
                      const updated = allResults.map((r) => {
                        let vol = 0;
                        for (let i = 0; i < r.hydrograph.length - 1; i++) {
                          const q1 = Math.max(0, r.hydrograph[i].flowRate - pumpM3s);
                          const q2 = Math.max(0, r.hydrograph[i + 1].flowRate - pumpM3s);
                          const avg = (q1 + q2) / 2;
                          vol += avg * 60;
                        }
                        return { ...r, detentionVolume: vol };
                      });
                      const worst = updated.reduce((max, r) =>
                        r.detentionVolume > max.detentionVolume ? r : max,
                        updated[0]
                      );
                      setAllResults(updated);
                      setWorstDuration(worst.duration);
                      setDetentionVolume(convertVolume(worst.detentionVolume, 'm3', volumeUnit));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='m3/s'>m³/s</SelectItem>
                    <SelectItem value='L/s'>L/s</SelectItem>
                    <SelectItem value='m3/hr'>m³/hr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Time Unit</Label>
                <Select value={timeUnit} onValueChange={(v) => setTimeUnit(v as TimeUnit)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='min'>minutes</SelectItem>
                    <SelectItem value='hr'>hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Volume Unit</Label>
                <Select value={volumeUnit} onValueChange={(v) => setVolumeUnit(v as VolumeUnit)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='m3'>m³</SelectItem>
                    <SelectItem value='L'>L</SelectItem>
                    <SelectItem value='kL'>kL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Max Storm Duration</Label>
                <div className='flex gap-2'>
                  <Input
                    type='number'
                    value={maxDuration}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setMaxDuration(val);
                      if (allResults.length > 0) {
                        toast.info('Click "Calculate Hydrographs" to apply the new duration limit.');
                      }
                    }}
                    min={1}
                    step={1}
                    className='flex-1'
                  />
                  <Select
                    value={maxDurationUnit}
                    onValueChange={(v) => {
                      setMaxDurationUnit(v as TimeUnit);
                      if (allResults.length > 0) {
                        toast.info('Click "Calculate Hydrographs" to apply the new duration limit.');
                      }
                    }}
                  >
                    <SelectTrigger className='w-28'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='min'>minutes</SelectItem>
                      <SelectItem value='hr'>hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className='text-muted-foreground text-xs'>
                  Only storms up to this duration are analyzed. Recommended: ≤6 hours for small urban catchments.
                </p>
              </div>
            </div>

            {/* Flow rate & calculate */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Pump Flow Rate ({flowUnitLabel(flowUnit)})</Label>
                <Input
                  type='number'
                  value={flowRate || ''}
                  onChange={(e) => {
                    setFlowRate(parseFloat(e.target.value) || 0);
                    // Recalculate detention if results exist
                    if (allResults.length > 0) {
                      const flowM3s = convertFlow(parseFloat(e.target.value) || 0, flowUnit, 'm3/s');
                      const updated = allResults.map((r) => {
                        let vol = 0;
                        for (let i = 0; i < r.hydrograph.length - 1; i++) {
                          const q1 = Math.max(0, r.hydrograph[i].flowRate - flowM3s);
                          const q2 = Math.max(0, r.hydrograph[i + 1].flowRate - flowM3s);
                          const avg = (q1 + q2) / 2;
                          vol += avg * 60;
                        }
                        return { ...r, detentionVolume: vol };
                      });
                      const worst = updated.reduce((max, r) =>
                        r.detentionVolume > max.detentionVolume ? r : max,
                        updated[0]
                      );
                      setAllResults(updated);
                      setWorstDuration(worst.duration);
                      setDetentionVolume(convertVolume(worst.detentionVolume, 'm3', volumeUnit));
                    }
                  }}
                  step='0.01'
                />
              </div>
              <div className='space-y-2'>
                <Label>Detention Volume ({volumeUnitLabel(volumeUnit)})</Label>
                <Input
                  type='number'
                  value={detentionVolume !== null ? detentionVolume.toFixed(2) : ''}
                  readOnly
                  className='bg-muted'
                />
              </div>
            </div>

            {worstDuration !== null && allResults.length > 0 && (
              <div className='rounded bg-muted p-3 text-sm'>
                <p className='text-muted-foreground'>
                  Worst-case storm duration:{' '}
                  <strong>
                    {allResults.find((r) => r.duration === worstDuration)?.durationLabel}
                  </strong>
                </p>
                <p className='text-muted-foreground mt-1'>
                  Storms analyzed: {allResults[0]?.durationLabel} – {allResults[allResults.length - 1]?.durationLabel} ({allResults.length} of {csvData?.length ?? 0} durations)
                </p>
                <p className='text-muted-foreground mt-1'>
                  {showAllTriangles
                    ? 'Showing all duration triangles overlaid'
                    : 'Showing worst-case triangle only'}
                </p>
              </div>
            )}

            {/* Zero detention warning */}
            {allResults.length > 0 &&
              allResults.every((r) => r.detentionVolume === 0) && (
              <Alert variant='destructive' className='mt-2'>
                <AlertDescription>
                  Pump capacity exceeds all storm peaks — no detention required.
                  Try reducing the pump flow rate.
                </AlertDescription>
              </Alert>
            )}

            <div className='flex flex-wrap gap-3'>
              <Button onClick={calculateAllTriangles} className='cursor-pointer' disabled={!csvData}>
                <Calculator className='mr-2 h-4 w-4' />
                Calculate Hydrographs
              </Button>
              {allResults.length > 0 && (
                <Button
                  variant='outline'
                  onClick={() => setShowAllTriangles(!showAllTriangles)}
                  className='cursor-pointer'
                >
                  {showAllTriangles ? 'Show Worst Case Only' : 'Show All Triangles'}
                </Button>
              )}
              <Button
                variant='outline'
                onClick={() => {
                  setShowSaveDialog(true);
                  fetchProjects();
                }}
                className='cursor-pointer'
              >
                <Save className='mr-2 h-4 w-4' />
                Save Project
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        {allResults.length > 0 && (
          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <CardTitle className='text-lg'>
                {showAllTriangles ? 'All Duration Hydrographs' : 'Worst-Case Hydrograph'}
              </CardTitle>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  if (chartRef.current) {
                    const link = document.createElement('a');
                    link.download = 'hydrograph.png';
                    link.href = chartRef.current.toBase64Image();
                    link.click();
                  }
                }}
                className='cursor-pointer'
              >
                <Download className='mr-1 h-4 w-4' />
                PNG
              </Button>
            </CardHeader>
            <CardContent>
              <div className='relative h-96'>
                <Line data={chartData} options={chartOptions} ref={chartRef} />
              </div>
              <div className='mt-4 grid grid-cols-2 gap-4 text-sm'>
                <div className='rounded bg-muted p-3'>
                  <p className='text-muted-foreground'>Peak Flow (max)</p>
                  <p className='text-lg font-bold'>
                    {(() => {
                      if (allResults.length > 0) {
                        const maxPeak = Math.max(...allResults.map((r) => r.peakFlow));
                        return `${convertFlow(maxPeak, 'm3/s', flowUnit).toFixed(4)} ${flowUnitLabel(flowUnit)}`;
                      }
                      return '- ';
                    })()}
                  </p>
                </div>
                <div className='rounded bg-muted p-3'>
                  <p className='text-muted-foreground'>Detention Volume</p>
                  <p className='text-lg font-bold'>
                    {detentionVolume !== null
                      ? `${detentionVolume.toFixed(2)} ${volumeUnitLabel(volumeUnit)}`
                      : '- '}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar: Saved Projects */}
      <div className='w-72 shrink-0 space-y-4'>
        <Card className='bg-primary text-primary-foreground'>
          <CardHeader>
            <CardTitle className='text-lg'>Saved Projects</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {loadingProjects ? (
              <div className='flex items-center justify-center py-4'>
                <Loader2 className='h-5 w-5 animate-spin' />
              </div>
            ) : projects.length === 0 ? (
              <p className='text-sm opacity-90'>No saved projects yet.</p>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  className='flex items-center justify-between rounded bg-white/10 p-2 text-sm'
                >
                  <span className='truncate font-medium'>{p.name}</span>
                  <div className='flex gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => loadProject(p)}
                      className='h-7 px-2 text-primary-foreground hover:bg-white/20 cursor-pointer'
                    >
                      View
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => deleteProject(p.id)}
                      className='h-7 px-2 text-primary-foreground hover:bg-white/20 cursor-pointer'
                    >
                      <Trash2 className='h-3 w-3' />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button
              variant='secondary'
              size='sm'
              className='w-full cursor-pointer'
              onClick={() => {
                setCatchments([{ id: uid(), area: 0, coefficient: 1, toc: 10, aep: '20%' }]);
                setFlowRate(0);
                setDetentionVolume(null);
                setWorstDuration(null);
                setMaxDuration(6);
                setMaxDurationUnit('hr');
                setAllResults([]);
                setCsvData(null);
                setCsvFileName('');
              }}
            >
              <Plus className='mr-1 h-4 w-4' />
              New Project
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Project</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder='e.g. Tamworth SS'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowSaveDialog(false)} className='cursor-pointer'>
              Cancel
            </Button>
            <Button onClick={saveProject} className='cursor-pointer'>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tc Calculator Dialog */}
      <Dialog open={showTcDialog} onOpenChange={setShowTcDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Time of Concentration Calculator</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label>Length (m)</Label>
                <Input
                  type='number'
                  value={tcLength || ''}
                  onChange={(e) => setTcLength(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className='space-y-2'>
                <Label>Average Grade (%)</Label>
                <Input
                  type='number'
                  value={tcSlope || ''}
                  step='0.1'
                  onChange={(e) => setTcSlope(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label>Horton&apos;s Value (n)</Label>
              <Select value={tcHorton} onValueChange={setTcHorton}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(hortonValues).map((k) => (
                    <SelectItem key={k} value={k}>
                      {k} (n={hortonValues[k]})
                    </SelectItem>
                  ))}
                  <SelectItem value='Custom'>Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tcHorton === 'Custom' && (
              <div className='space-y-2'>
                <Label>Custom n</Label>
                <Input
                  type='number'
                  step='0.001'
                  value={tcCustom ?? ''}
                  onChange={(e) =>
                    setTcCustom(parseFloat(e.target.value) || null)
                  }
                />
              </div>
            )}
            <Button onClick={calculateTc} className='w-full cursor-pointer'>
              Calculate Tc
            </Button>
            {tcResult !== null && (
              <Alert className='bg-primary/10'>
                <AlertDescription>
                  Time of Concentration: <strong>{tcResult} minutes</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowTcDialog(false)} className='cursor-pointer'>
              Cancel
            </Button>
            <Button onClick={applyTc} disabled={tcResult === null} className='cursor-pointer'>
              Apply to Catchment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
