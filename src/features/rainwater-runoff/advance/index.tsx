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
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, Plus, Save, Upload, CheckCircle, Calculator, Loader2 } from 'lucide-react';
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

interface Project {
  id: string;
  name: string;
  catchments: Catchment[];
  flowRate: number;
  detentionVolume: number;
  stormDuration: number;
  created_at: string;
}

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

/* ---------- Component ---------- */
export default function AdvancedStormwaterCalculator() {
  const { user } = useAuth();

  /* -- Catchments -- */
  const [catchments, setCatchments] = useState<Catchment[]>([
    { id: uid(), area: 0, coefficient: 1, toc: 10, aep: '20%' }
  ]);

  /* -- Global inputs -- */
  const [flowRate, setFlowRate] = useState<number>(20);
  const [detentionVolume, setDetentionVolume] = useState<number | null>(null);
  const [stormDuration, setStormDuration] = useState<number>(60);

  /* -- IFD / CSV -- */
  const [csvData, setCsvData] = useState<IFDData[] | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [rainfallEvent, setRainfallEvent] = useState('');

  /* -- Hydrograph -- */
  const [hydrographData, setHydrographData] = useState<HydroPoint[] | null>(null);
  const [peakFlow, setPeakFlow] = useState<number>(0);

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
          setRainfallEvent('');
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
          return I1 + (I2 - I1) * ((targetDuration - d1) / (d2 - d1));
        }
      }
      return null;
    },
    [csvData]
  );

  /* ---------- Calculate Hydrograph ---------- */
  const calculateHydrograph = () => {
    if (!csvData || !stormDuration) {
      toast.error('Upload IFD CSV and set storm duration.');
      return;
    }

    let maxPeak = 0;
    const combined: HydroPoint[] = [];

    // Build hydrograph per catchment and sum them up
    const perCatchment: HydroPoint[][] = [];

    for (const c of catchments) {
      if (!c.area || !c.coefficient || !c.toc || !c.aep) continue;
      const I_tc = interpolateIntensity(c.toc, c.aep);
      if (!I_tc) {
        toast.warning(`No IFD data for catchment at Tc=${c.toc} min with AEP ${c.aep}`);
        continue;
      }
      // Q(Tc) in m3/s: (C * I * A) / 3_600_000
      const Q_tc = (c.coefficient * I_tc * c.area) / 3_600_000;

      const points: HydroPoint[] = [];
      for (let t = 0; t <= stormDuration; t++) {
        let Q: number;
        if (t <= c.toc) {
          Q = (t / c.toc) * Q_tc;
        } else {
          const I_t = interpolateIntensity(t, c.aep);
          Q = I_t !== null ? (c.coefficient * I_t * c.area) / 3_600_000 : 0;
        }
        points.push({ time: t, flowRate: Q });
      }
      perCatchment.push(points);
    }

    if (perCatchment.length === 0) {
      toast.error('No valid catchments could generate a hydrograph. Check AEPs and CSV data.');
      return;
    }

    // Sum all catchments minute-by-minute
    for (let t = 0; t <= stormDuration; t++) {
      let totalQ = 0;
      for (const series of perCatchment) {
        totalQ += series[t]?.flowRate ?? 0;
      }
      combined.push({ time: t, flowRate: totalQ });
    }

    // FIX: Peak flow is the maximum of the COMBINED hydrograph
    maxPeak = Math.max(...combined.map((p) => p.flowRate));

    setHydrographData(combined);
    setPeakFlow(maxPeak);

    // Detention volume
    let vol = 0;
    for (let i = 0; i < combined.length - 1; i++) {
      const q1 = Math.max(0, combined[i].flowRate - flowRate);
      const q2 = Math.max(0, combined[i + 1].flowRate - flowRate);
      const avg = (q1 + q2) / 2; // m3/s
      vol += avg * 60; // 60 seconds
    }
    setDetentionVolume(parseFloat(vol.toFixed(2)));
    toast.success('Hydrograph generated successfully.');
  };

  /* ---------- Chart ---------- */
  const chartMaxFlow = useMemo(() => {
    if (!hydrographData || hydrographData.length === 0) return 1;
    const maxHydro = Math.max(...hydrographData.map((p) => p.flowRate));
    // Auto-scale: max of hydrograph or pump flow, whichever makes the chart readable
    // If pump is > 10× hydrograph, cap axis at 1.5× hydrograph max so hydrograph is visible
    if (flowRate > maxHydro * 10) {
      return maxHydro * 1.5;
    }
    return Math.max(maxHydro, flowRate) * 1.1;
  }, [hydrographData, flowRate]);

  const chartData = useMemo(() => {
    if (!hydrographData) return { labels: [], datasets: [] };
    const labels = hydrographData.map((p) => `${p.time}`);

    const maxHydro = Math.max(...hydrographData.map((p) => p.flowRate));
    const pumpOffScale = flowRate > maxHydro * 10;

    const datasets: any[] = [
      {
        label: 'Hydrograph',
        data: hydrographData.map((p) => p.flowRate),
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0)',
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4
      }
    ];

    if (!pumpOffScale) {
      datasets.push({
        label: 'Pump Discharge',
        data: Array(hydrographData.length).fill(flowRate),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      });

      if (detentionVolume !== null && detentionVolume > 0) {
        datasets.push({
          label: 'Detention Area',
          data: hydrographData.map((p) =>
            p.flowRate > flowRate ? p.flowRate : flowRate
          ),
          borderColor: 'rgba(239, 68, 68, 0)',
          backgroundColor: 'rgba(239, 68, 68, 0.25)',
          pointRadius: 0,
          fill: { target: 1, above: 'rgba(239, 68, 68, 0.25)' }
        });
      }
    }

    return { labels, datasets };
  }, [hydrographData, flowRate, detentionVolume]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, boxWidth: 8 }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(4)} m³/s`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Time (mins)', font: { size: 12 } },
        grid: { display: true, color: 'rgba(0,0,0,0.05)' },
        ticks: { stepSize: 5 }
      },
      y: {
        title: { display: true, text: 'Flow (m³/s)', font: { size: 12 } },
        beginAtZero: true,
        max: chartMaxFlow,
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
          stormDuration: d.storm_duration,
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
        storm_duration: stormDuration,
        csv_data: csvData,
        rainfall_event: rainfallEvent,
        selected_duration: stormDuration,
        hydrograph_data: hydrographData
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
    setStormDuration(p.stormDuration);
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

        {/* CSV Upload & AEP */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <Upload className='h-5 w-5' />
              IFD Data & AEP
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
              <div className='w-64 space-y-2'>
                <Label>AEP / Rainfall Event</Label>
                <Select
                  value={rainfallEvent}
                  onValueChange={setRainfallEvent}
                  disabled={!csvData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select AEP' />
                  </SelectTrigger>
                  <SelectContent>
                    {aepOptions.map((aep) => (
                      <SelectItem key={aep} value={`1 in ${Math.round(1 / (parseFloat(aep) / 100))} Years (${aep} AEP)`}>
                        1 in {Math.round(1 / (parseFloat(aep) / 100))} Years ({aep} AEP)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='w-40 space-y-2'>
                <Label>Storm Duration (min)</Label>
                <Input
                  type='number'
                  value={stormDuration || ''}
                  onChange={(e) => setStormDuration(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Catchments Table */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-lg'>Catchments</CardTitle>
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

        {/* Flow / Detention / Duration */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Flow & Detention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label>Flow Rate (m³/sec)</Label>
                <Input
                  type='number'
                  value={flowRate || ''}
                  onChange={(e) => setFlowRate(parseFloat(e.target.value) || 0)}
                  step='0.01'
                />
              </div>
              <div className='space-y-2'>
                <Label>Detention Volume (m³)</Label>
                <Input
                  type='number'
                  value={detentionVolume ?? ''}
                  readOnly
                  className='bg-muted'
                />
              </div>
              <div className='space-y-2'>
                <Label>Storm Duration (min)</Label>
                <Input
                  type='number'
                  value={stormDuration || ''}
                  onChange={(e) => setStormDuration(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className='mt-4 flex flex-wrap gap-3'>
              <Button onClick={calculateHydrograph} className='cursor-pointer'>
                <Calculator className='mr-2 h-4 w-4' />
                Calculate Hydrograph
              </Button>
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
        {hydrographData && (
          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <CardTitle className='text-lg'>Hydrograph</CardTitle>
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
              {/* Off-scale pump annotation */}
              {(() => {
                if (!hydrographData) return null;
                const maxHydro = Math.max(...hydrographData.map((p) => p.flowRate));
                if (flowRate > maxHydro * 10) {
                  return (
                    <div className='mt-2 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
                      <span className='inline-block h-1.5 w-6 border-b-2 border-dashed border-red-500'></span>
                      Pump Discharge: {flowRate.toFixed(2)} m³/s (off-scale — axis capped to show hydrograph)
                    </div>
                  );
                }
                return null;
              })()}
              <div className='mt-4 grid grid-cols-2 gap-4 text-sm'>
                <div className='rounded bg-muted p-3'>
                  <p className='text-muted-foreground'>Peak Flow</p>
                  <p className='text-lg font-bold'>{peakFlow.toFixed(4)} m³/s</p>
                </div>
                <div className='rounded bg-muted p-3'>
                  <p className='text-muted-foreground'>Detention Volume</p>
                  <p className='text-lg font-bold'>
                    {detentionVolume !== null ? `${detentionVolume.toFixed(2)} m³` : '- '}
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
                setFlowRate(20);
                setDetentionVolume(null);
                setStormDuration(60);
                setHydrographData(null);
                setCsvData(null);
                setCsvFileName('');
                setRainfallEvent('');
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
