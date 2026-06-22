'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/* Re-export for legacy sub-components */
export interface HyetographDataPoint {
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
import { Download, Trash2, Plus, Save, Upload, CheckCircle, Calculator, Loader2, Info, Search, MapPin, CloudRain, ExternalLink, Globe } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';
import {
  InfiltrationType,
  AMC,
  INFILTRATION_TYPES,
  AMC_OPTIONS,
  SOIL_TYPES,
  infiltrationIntensity
} from '@/lib/stormwater/horton-infiltration';

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
  toc: number;
  aep: string;
  infiltrationType: InfiltrationType; // soil/ground type for Horton infiltration
  amc: AMC; // antecedent moisture condition (soil types only)
  customF0?: number; // mm/h, when infiltrationType === 'Custom'
  customFc?: number; // mm/h, when infiltrationType === 'Custom'
  coefficient?: number; // legacy runoff coefficient — ignored by calc, kept for back-compat
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
  hyetograph: HydroPoint[];
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

/**
 * Normalize catchments loaded from storage. Legacy projects only have a runoff
 * coefficient and no infiltration fields, so default them to Hardstand (zero loss).
 */
const normalizeCatchments = (catchments: Catchment[] = []): Catchment[] =>
  catchments.map((c) => ({
    ...c,
    infiltrationType: c.infiltrationType ?? 'Hardstand',
    amc: c.amc ?? 'Max'
  }));

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
  const router = useRouter();

  /* -- Catchments -- */
  const [catchments, setCatchments] = useState<Catchment[]>([
    { id: uid(), area: 0, toc: 10, aep: '20%', infiltrationType: 'Hardstand', amc: 'Max' }
  ]);

  /* -- Units -- */
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('m3/s');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('min');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('m3');

  /* -- Flow / Detention -- */
  const [flowRate, setFlowRate] = useState<number>(0);
  const [pumpWellVolume, setPumpWellVolume] = useState<number | null>(null);
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

  /* -- Auto-Fetch / Geocoding -- */
  const [ifdSourceMode, setIfdSourceMode] = useState<'auto' | 'upload'>('auto');
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [inputLatitude, setInputLatitude] = useState('');
  const [inputLongitude, setInputLongitude] = useState('');
  const [isFetchingIFD, setIsFetchingIFD] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  
  /* -- Address Autocomplete Suggestions -- */
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  /* -- All triangles -- */
  const [allResults, setAllResults] = useState<DurationResult[]>([]);
  const [showAllHyetographs, setShowAllHyetographs] = useState(true);

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
      { id: uid(), area: 0, toc: 10, aep: '20%', infiltrationType: 'Hardstand', amc: 'Max' }
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
  const parseIFDText = (csvText: string, fileName: string) => {
    setCsvFileName(fileName);
    setCsvError('');
    
    Papa.parse(csvText, {
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

          // Detect if the CSV contains Depth (mm) instead of Intensity (mm/h)
          let isDepth = false;
          for (let i = 0; i < Math.min(rows.length, 10); i++) {
            if (rows[i] && rows[i][0]) {
              const rowStr = rows[i].join(' ').toLowerCase();
              if (rowStr.includes('depth') && rowStr.includes('(mm)')) {
                isDepth = true;
                break;
              }
            }
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
            setCsvError('Could not find AEP header row. Please check the CSV format.');
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
              let val = parseFloat(row[j + 2]);
              if (!isNaN(val) && val > 0) {
                if (isDepth) {
                  // Convert Depth (mm) to Intensity (mm/h)
                  val = (val * 60) / durationInMinutes;
                }
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
          setAllResults([]);
          setWorstDuration(null);
          setDetentionVolume(null);
          setShowAllHyetographs(true);

          if (isDepth) {
            toast.success('Successfully loaded and auto-converted Depth (mm) to Intensity (mm/h).');
          }
        } catch {
          setCsvError('Error processing CSV data.');
        }
      },
      error: (err: any) => setCsvError(`Error reading CSV: ${err.message}`)
    });
  };

  const parseIFDFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        parseIFDText(text, file.name);
      }
    };
    reader.onerror = () => {
      setCsvError('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseIFDFile(file);
  };

  /* ---------- Actions: Auto-Fetch & Geocoding ---------- */
  const handleGeocode = async () => {
    if (!addressSearchQuery.trim()) {
      toast.error('Please enter an address to search.');
      return;
    }
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(addressSearchQuery)}`,
        {
          headers: {
            'User-Agent': 'Quality-Pumps-Stormwater-Calculator/1.0'
          }
        }
      );
      if (!response.ok) throw new Error('Geocoding service unavailable.');
      const data = await response.json();
      if (data && data.length > 0) {
        const firstMatch = data[0];
        // OpenStreetMap returns lat/lon as strings
        setInputLatitude(parseFloat(firstMatch.lat).toFixed(6));
        setInputLongitude(parseFloat(firstMatch.lon).toFixed(6));
        toast.success(`Located: ${firstMatch.display_name.split(',').slice(0, 3).join(',')}`);
      } else {
        toast.error('No matching coordinates found for the address. Please enter coordinates manually.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Geocoding failed.');
    } finally {
      setIsGeocoding(false);
    }
  };
  
  // Address Autocomplete Suggestions from Nominatim
  useEffect(() => {
    if (!addressSearchQuery.trim() || addressSearchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(addressSearchQuery)}`,
          {
            headers: {
              'User-Agent': 'Quality-Pumps-Stormwater-Calculator/1.0'
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [addressSearchQuery]);

  const handleSelectSuggestion = (item: any) => {
    setAddressSearchQuery(item.display_name);
    setInputLatitude(parseFloat(item.lat).toFixed(6));
    setInputLongitude(parseFloat(item.lon).toFixed(6));
    setSuggestions([]);
    setShowSuggestions(false);
    toast.success(`Coordinates updated for selected address.`);
  };

  const handleFetchBOMIFD = async () => {
    if (!inputLatitude || !inputLongitude) {
      toast.error('Please specify both latitude and longitude.');
      return;
    }
    const lat = parseFloat(inputLatitude);
    const lon = parseFloat(inputLongitude);
    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Latitude and longitude must be valid numbers.');
      return;
    }

    setIsFetchingIFD(true);
    setLoadingProgress('Connecting to Bureau of Meteorology...');
    setCsvError('');

    try {
      const response = await fetch(
        `/api/stormwater/fetch-ifd?latitude=${lat}&longitude=${lon}&label=${encodeURIComponent(addressSearchQuery || 'Site')}`
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `BOM fetch failed (status ${response.status})`);
      }

      setLoadingProgress('Downloading CSV data...');
      const csvText = await response.text();
      
      setLoadingProgress('Parsing rainfall data...');
      parseIFDText(csvText, `BOM_IFD_${lat.toFixed(4)}_${lon.toFixed(4)}.csv`);
      toast.success('BOM Intensity-Frequency-Duration data loaded successfully.');
    } catch (err: any) {
      setCsvError(err.message || 'Failed to fetch BOM IFD data.');
      toast.error(err.message || 'Failed to fetch BOM IFD data.');
    } finally {
      setIsFetchingIFD(false);
      setLoadingProgress('');
    }
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

  /* ---------- Build Hyetograph for One Duration ---------- */
  const buildHyetograph = (duration: number): HydroPoint[] => {
    const points: HydroPoint[] = [];
    const maxTcRaw = Math.max(...catchments.map((c) => c.toc || 0));
    const maxTc = Math.max(1, Math.round(maxTcRaw));

    // Generate combined hyetograph by summing individual catchment trapezoids.
    // Each catchment uses its own Tc and AEP to compute its gross rainfall flow
    // contribution at every time step, then subtracts the Horton infiltration
    // rate at that time (mm/h). The per-catchment net flow is floored at 0 before
    // the pointwise sum, matching the reference spreadsheet.
    const totalTime = duration + maxTc;
    for (let t = 0; t <= totalTime; t++) {
      let flowRate = 0;
      for (const c of catchments) {
        if (!c.area || !c.toc) continue;
        const I = interpolateIntensity(duration, c.aep);
        if (!I) continue;
        // Gross rainfall flow (coefficient = 1) shaped by the time-of-concentration trapezoid.
        const grossPeak = (I * c.area) / 3_600_000;
        const tc = Math.max(1, Math.round(c.toc));
        const ramp1 = Math.max(0, Math.min(t, tc));
        const ramp2 = Math.max(0, Math.min(t - duration, tc));
        const rainfallAtT = (grossPeak / tc) * (ramp1 - ramp2);
        // Horton infiltration loss at this time step (t in minutes from storm start).
        const fIntensity = infiltrationIntensity(c, t);
        const infiltrationFlow = (fIntensity * c.area) / 3_600_000;
        flowRate += Math.max(0, rainfallAtT - infiltrationFlow);
      }
      points.push({ time: t, flowRate });
    }

    return points;
  };

  /* ---------- Solver: Required Flow from Well Volume ---------- */
  const getRequiredFlowForWellVolume = (resultsArray: DurationResult[], targetVolM3: number) => {
    if (resultsArray.length === 0) return { flowRateM3s: 0, finalDetentionM3: 0 };
    
    const target = Math.max(0, targetVolM3);
    const maxPeakFlowM3s = Math.max(...resultsArray.map((r) => r.peakFlow));

    const getDetentionForFlow = (flowM3s: number): number => {
      let maxVol = 0;
      for (const r of resultsArray) {
        let vol = 0;
        for (let i = 0; i < r.hyetograph.length - 1; i++) {
          const q1 = Math.max(0, r.hyetograph[i].flowRate - flowM3s);
          const q2 = Math.max(0, r.hyetograph[i + 1].flowRate - flowM3s);
          const avg = (q1 + q2) / 2;
          vol += avg * 60;
        }
        if (vol > maxVol) {
          maxVol = vol;
        }
      }
      return maxVol;
    };

    const maxDetentionAtZeroFlow = getDetentionForFlow(0);
    if (target >= maxDetentionAtZeroFlow) {
      return { flowRateM3s: 0, finalDetentionM3: maxDetentionAtZeroFlow };
    }

    let low = 0;
    let high = maxPeakFlowM3s;
    let iterations = 0;

    while (high - low > 1e-9 && iterations < 50) {
      const mid = (low + high) / 2;
      const vol = getDetentionForFlow(mid);
      if (vol < target) {
        high = mid;
      } else {
        low = mid;
      }
      iterations++;
    }

    return { flowRateM3s: high, finalDetentionM3: getDetentionForFlow(high) };
  };

  const handleWellVolumeChange = (volumeVal: number) => {
    setPumpWellVolume(volumeVal);
    if (allResults.length === 0) return;

    const targetVolM3 = convertVolume(volumeVal, volumeUnit, 'm3');
    const { flowRateM3s: solvedFlowM3s } = getRequiredFlowForWellVolume(allResults, targetVolM3);

    const flowInUnit = convertFlow(solvedFlowM3s, 'm3/s', flowUnit);
    const finalFlow = parseFloat(flowInUnit.toFixed(4));
    setFlowRate(finalFlow);

    // Recalculate detention for all results
    const updated = allResults.map((r) => {
      let vol = 0;
      for (let i = 0; i < r.hyetograph.length - 1; i++) {
        const q1 = Math.max(0, r.hyetograph[i].flowRate - solvedFlowM3s);
        const q2 = Math.max(0, r.hyetograph[i + 1].flowRate - solvedFlowM3s);
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
  };

  /* ---------- Calculate All Durations ---------- */
  const calculateAllHyetographs = () => {
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

    const minTcRaw = Math.min(...catchments.filter((c) => c.toc > 0).map((c) => c.toc));
    const minTc = Math.max(1, Math.round(minTcRaw));

    // Create storm durations at 6-minute intervals starting at minTc
    const targetDurations: number[] = [];
    const firstDuration = minTc;
    targetDurations.push(firstDuration);
    const nextMultipleOf6 = Math.ceil((firstDuration + 0.0001) / 6) * 6;
    for (let d = nextMultipleOf6; d <= maxDurationMin; d += 6) {
      targetDurations.push(d);
    }

    if (targetDurations.length === 0) {
      toast.error('No storms within the selected max duration. Increase the limit.');
      return;
    }

    for (const duration of targetDurations) {
      const hyetograph = buildHyetograph(duration);
      const peak = Math.max(...hyetograph.map((p) => p.flowRate));

      // Detention volume for this trapezoid (above pump line)
      let vol = 0;
      for (let i = 0; i < hyetograph.length - 1; i++) {
        const q1 = Math.max(0, hyetograph[i].flowRate - flowRateM3s);
        const q2 = Math.max(0, hyetograph[i + 1].flowRate - flowRateM3s);
        const avg = (q1 + q2) / 2;
        vol += avg * 60; // 60 seconds per minute step
      }

      results.push({
        duration: duration,
        durationLabel: formatDurationLabel(duration),
        hyetograph,
        peakFlow: peak,
        detentionVolume: vol
      });
    }

    if (results.length === 0) {
      toast.error('Could not generate hyetographs. Check catchment data and CSV.');
      return;
    }

    let finalFlowRateM3s = flowRateM3s;
    if (pumpWellVolume !== null && pumpWellVolume > 0) {
      const targetVolM3 = convertVolume(pumpWellVolume, volumeUnit, 'm3');
      const { flowRateM3s: solvedFlowM3s } = getRequiredFlowForWellVolume(results, targetVolM3);
      finalFlowRateM3s = solvedFlowM3s;

      const flowInUnit = convertFlow(solvedFlowM3s, 'm3/s', flowUnit);
      setFlowRate(parseFloat(flowInUnit.toFixed(4)));
    }

    // Now recalculate detention volume for all results using finalFlowRateM3s
    const updatedResults = results.map((r) => {
      let vol = 0;
      for (let i = 0; i < r.hyetograph.length - 1; i++) {
        const q1 = Math.max(0, r.hyetograph[i].flowRate - finalFlowRateM3s);
        const q2 = Math.max(0, r.hyetograph[i + 1].flowRate - finalFlowRateM3s);
        const avg = (q1 + q2) / 2;
        vol += avg * 60;
      }
      return { ...r, detentionVolume: vol };
    });

    // Find worst case (max detention)
    const worst = updatedResults.reduce((max, r) =>
      r.detentionVolume > max.detentionVolume ? r : max,
      updatedResults[0]
    );

    setAllResults(updatedResults);
    setWorstDuration(worst.duration);
    setDetentionVolume(convertVolume(worst.detentionVolume, 'm3', volumeUnit));
    setShowAllHyetographs(true);
    toast.success(`Generated ${updatedResults.length} hyetographs. Worst case: ${worst.durationLabel}`);
  };

  /* ---------- Chart ---------- */
  const activeResult = useMemo(() => {
    if (allResults.length === 0) return null;
    if (showAllHyetographs) return null; // show all
    return allResults.find((r) => r.duration === worstDuration) || allResults[0];
  }, [allResults, worstDuration, showAllHyetographs]);

  const chartData = useMemo(() => {
    if (allResults.length === 0) return { labels: [], datasets: [] };

    const flowRateM3s = convertFlow(flowRate, flowUnit, 'm3/s');

    if (showAllHyetographs) {
      // Show all trapezoids overlaid, lighter lines
      const maxTime = Math.max(...allResults.map((r) => r.hyetograph[r.hyetograph.length - 1]?.time || r.duration));
      const labels = Array.from({ length: maxTime + 1 }, (_, i) => `${i}`);

      const datasets: any[] = allResults.map((r, idx) => ({
        label: `${r.durationLabel}`,
        data: Array(maxTime + 1).fill(null).map((_, t) => {
          const pt = r.hyetograph.find((p) => p.time === t);
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

      const labels = r.hyetograph.map((p) => `${p.time}`);

      const datasets: any[] = [
        {
          label: `Hyetograph (${r.durationLabel})`,
          data: r.hyetograph.map((p) => convertFlow(p.flowRate, 'm3/s', flowUnit)),
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0)',
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 0
        },
        {
          label: 'Pump Discharge',
          data: Array(r.hyetograph.length).fill(convertFlow(flowRateM3s, 'm3/s', flowUnit)),
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
          data: r.hyetograph.map((p) => {
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
  }, [allResults, activeResult, showAllHyetographs, flowRate, flowUnit, volumeUnit]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          filter: (legendItem) => {
            if (showAllHyetographs) {
              return legendItem.text === 'Pump Discharge';
            }
            return true;
          }
        }
      },
      title: { display: false },
      tooltip: {
        mode: 'nearest',
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
          catchments: normalizeCatchments(d.catchments),
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
        hyetograph_data: allResults.map((r) => ({ duration: r.duration, hyetograph: r.hyetograph }))
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
        <h1 className='text-2xl font-bold'>Stormwater Hyetograph</h1>

        {/* Step 1: IFD Data */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-lg'>
              <span className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold'>1</span>
              IFD Data
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Tab Selector */}
            <div className='flex border-b border-muted mb-4'>
              <button
                type='button'
                onClick={() => setIfdSourceMode('auto')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  ifdSourceMode === 'auto'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className='h-4 w-4' />
                Auto-Fetch from BOM
              </button>
              <button
                type='button'
                onClick={() => setIfdSourceMode('upload')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  ifdSourceMode === 'upload'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload className='h-4 w-4' />
                Manual CSV Upload
              </button>
            </div>

            {ifdSourceMode === 'auto' ? (
              <div className='space-y-4'>
                {/* Geocoding address search */}
                <div className='space-y-2'>
                  <Label htmlFor='addressSearch'>Site Address / Location</Label>
                  <div className='flex gap-2'>
                    <div className='relative flex-1'>
                      <Input
                        id='addressSearch'
                        type='text'
                        value={addressSearchQuery}
                        onChange={(e) => {
                          setAddressSearchQuery(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => {
                          // Small timeout to allow clicking on a suggestion item
                          setTimeout(() => setShowSuggestions(false), 250);
                        }}
                        placeholder='e.g. 100 Adelaide St, Brisbane QLD'
                        className='pr-8'
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleGeocode();
                          }
                        }}
                      />
                      <Search className='absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground' />

                      {/* Suggestions Dropdown */}
                      {showSuggestions && (suggestions.length > 0 || isSearchingSuggestions) && (
                        <div className='absolute z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg max-h-60 overflow-y-auto'>
                          {isSearchingSuggestions && suggestions.length === 0 ? (
                            <div className='p-3 text-xs text-muted-foreground flex items-center gap-2'>
                              <Loader2 className='h-3 w-3 animate-spin' />
                              Searching addresses...
                            </div>
                          ) : (
                            <ul className='py-1 divide-y divide-border/40'>
                              {suggestions.map((item) => (
                                <li
                                  key={item.place_id}
                                  onClick={() => handleSelectSuggestion(item)}
                                  className='px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left leading-normal break-words'
                                >
                                  {item.display_name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant='secondary'
                      onClick={handleGeocode}
                      disabled={isGeocoding || isFetchingIFD}
                      className='cursor-pointer flex items-center gap-1 shrink-0'
                    >
                      {isGeocoding ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <MapPin className='h-4 w-4' />
                      )}
                      Locate
                    </Button>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Search by address or place name to resolve geographic coordinates.
                  </p>
                </div>

                {/* Coordinate Fields */}
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='latitude'>Latitude (S)</Label>
                    <Input
                      id='latitude'
                      type='text'
                      value={inputLatitude}
                      onChange={(e) => setInputLatitude(e.target.value)}
                      placeholder='e.g. -27.4678'
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='longitude'>Longitude (E)</Label>
                    <Input
                      id='longitude'
                      type='text'
                      value={inputLongitude}
                      onChange={(e) => setInputLongitude(e.target.value)}
                      placeholder='e.g. 153.0281'
                    />
                  </div>
                </div>
                <p className='text-xs text-muted-foreground'>
                  BOM calculations require decimal degree coordinates within Australia (S latitude is negative, E longitude is positive).
                </p>

                {/* Actions */}
                <div className='flex flex-wrap items-center gap-3 pt-2'>
                  <Button
                    onClick={handleFetchBOMIFD}
                    disabled={isFetchingIFD || isGeocoding || !inputLatitude || !inputLongitude}
                    className='cursor-pointer flex items-center gap-1.5'
                  >
                    {isFetchingIFD ? (
                      <>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        {loadingProgress || 'Fetching...'}
                      </>
                    ) : (
                      <>
                        <CloudRain className='h-4 w-4' />
                        Fetch Stormwater IFD Data
                      </>
                    )}
                  </Button>

                  {inputLatitude && inputLongitude && (
                    <a
                      href={`https://www.bom.gov.au/water/designRainfalls/revised-ifd/?year=2016&coordinate_type=dd&latitude=${inputLatitude}&longitude=${inputLongitude}&sdmin=true&sdhr=true&sdday=true&user_label=${encodeURIComponent(addressSearchQuery || 'Site')}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors py-2 px-3 rounded-md bg-sky-50 hover:bg-sky-100 font-medium'
                    >
                      Verify on BOM Website
                      <ExternalLink className='h-3.5 w-3.5' />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='flex flex-wrap gap-4'>
                  <div className='flex-1 space-y-2'>
                    <Label htmlFor='csvFileInput'>Upload IFD CSV</Label>
                    <Input
                      id='csvFileInput'
                      type='file'
                      accept='.csv'
                      onChange={handleFileUpload}
                    />
                  </div>
                  <div className='flex items-end'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setShowBomHelp(!showBomHelp)}
                      className='cursor-pointer flex items-center gap-1'
                    >
                      <Info className='h-4 w-4' />
                      How to get IFD data
                    </Button>
                  </div>
                </div>

                {showBomHelp && (
                  <div className='rounded border border-sky-200 bg-sky-50 p-4 text-sm'>
                    <strong className='text-sky-800 font-semibold'>How to Download CSV from the BOM Website:</strong>
                    <ol className='mt-2 list-inside list-decimal space-y-1.5 text-sky-700'>
                      <li>
                        Go to:{' '}
                        <a
                          href='http://www.bom.gov.au/water/designRainfalls/revised-ifd/'
                          target='_blank'
                          rel='noreferrer'
                          className='text-blue-600 underline font-medium'
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
                        className='inline-flex items-center gap-1 text-blue-600 underline font-medium'
                      >
                        <Download className='h-3.5 w-3.5' />
                        Download Sample CSV
                      </a>
                    </div>
                    <div className='mt-4 rounded border border-amber-200 bg-amber-50 p-3'>
                      <strong className='text-amber-800 font-semibold'>⚠️ Model Limitations</strong>
                      <ul className='mt-1 list-inside list-disc space-y-1.5 text-amber-700'>
                        <li>
                          The hyetograph method calculates a <strong>theoretical maximum</strong> detention volume.
                        </li>
                        <li>
                          It does <strong>not</strong> model soil absorption, evaporation, or saturation.
                        </li>
                        <li>
                          For small catchments &lt; 2000m², the{' '}
                          <button
                            type='button'
                            className='text-blue-600 underline font-medium cursor-pointer bg-transparent border-0 p-0 hover:text-blue-800'
                            onClick={() => router.push('/dashboard/rain-water-run-off-basic')}
                          >
                            AS/NZS3500.3 method
                          </button>{' '}
                          should be used.
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
              </div>
            )}

            {csvError && (
              <p className='text-sm text-red-500 font-medium bg-red-50 border border-red-100 p-2.5 rounded-md mt-2'>{csvError}</p>
            )}

            {csvData && (
              <div className='flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 p-3 rounded-md mt-2'>
                <CheckCircle className='h-4 w-4 shrink-0 text-green-600' />
                <div className='flex-1 min-w-0'>
                  <p className='font-semibold'>IFD Data Loaded Successfully</p>
                  <p className='text-xs opacity-90 truncate'>{csvFileName} ({csvData.length} duration points)</p>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setCsvData(null);
                    setCsvFileName('');
                  }}
                  className='h-7 hover:bg-green-100 text-green-800 cursor-pointer'
                >
                  Clear
                </Button>
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
                    <TableHead>Infiltration</TableHead>
                    <TableHead>AMC / Custom (mm/h)</TableHead>
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
                        <Select
                          value={c.infiltrationType}
                          onValueChange={(val) =>
                            updateCatchment(c.id, 'infiltrationType', val as InfiltrationType)
                          }
                        >
                          <SelectTrigger className='w-36'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INFILTRATION_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {SOIL_TYPES.includes(c.infiltrationType) ? (
                          <Select
                            value={c.amc}
                            onValueChange={(val) =>
                              updateCatchment(c.id, 'amc', val as AMC)
                            }
                          >
                            <SelectTrigger className='w-24'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AMC_OPTIONS.map((a) => (
                                <SelectItem key={a} value={a}>
                                  {a === 'Max' ? 'Max' : `AMC ${a}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : c.infiltrationType === 'Custom' ? (
                          <div className='flex items-center gap-1'>
                            <Input
                              type='number'
                              value={c.customF0 ?? ''}
                              min='0'
                              placeholder='f₀'
                              title='Initial infiltration rate f₀ (mm/h)'
                              onChange={(e) =>
                                updateCatchment(c.id, 'customF0', parseFloat(e.target.value) || 0)
                              }
                              className='w-20'
                            />
                            <Input
                              type='number'
                              value={c.customFc ?? ''}
                              min='0'
                              placeholder='f꜀'
                              title='Final infiltration rate f꜀ (mm/h)'
                              onChange={(e) =>
                                updateCatchment(c.id, 'customFc', parseFloat(e.target.value) || 0)
                              }
                              className='w-20'
                            />
                          </div>
                        ) : (
                          <span className='text-muted-foreground text-sm'>—</span>
                        )}
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
                    const oldUnit = flowUnit;
                    setFlowUnit(newUnit);
                    
                    // Convert flowRate state to the new unit
                    let newFlowRateVal = flowRate;
                    if (flowRate > 0) {
                      newFlowRateVal = parseFloat(convertFlow(flowRate, oldUnit, newUnit).toFixed(4));
                      setFlowRate(newFlowRateVal);
                    }

                    // Recalculate detention if results exist
                    if (allResults.length > 0) {
                      const pumpM3s = convertFlow(newFlowRateVal, newUnit, 'm3/s');
                      const updated = allResults.map((r) => {
                        let vol = 0;
                        for (let i = 0; i < r.hyetograph.length - 1; i++) {
                          const q1 = Math.max(0, r.hyetograph[i].flowRate - pumpM3s);
                          const q2 = Math.max(0, r.hyetograph[i + 1].flowRate - pumpM3s);
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
                <Select
                  value={volumeUnit}
                  onValueChange={(v) => {
                    const newUnit = v as VolumeUnit;
                    const oldUnit = volumeUnit;
                    setVolumeUnit(newUnit);
                    
                    // Convert pump well volume if set
                    if (pumpWellVolume !== null && pumpWellVolume !== undefined && !isNaN(pumpWellVolume)) {
                      const converted = convertVolume(pumpWellVolume, oldUnit, newUnit);
                      setPumpWellVolume(parseFloat(converted.toFixed(2)));
                    }

                    // Convert detention volume output if results exist
                    if (allResults.length > 0) {
                      const worst = allResults.reduce((max, r) =>
                        r.detentionVolume > max.detentionVolume ? r : max,
                        allResults[0]
                      );
                      setDetentionVolume(convertVolume(worst.detentionVolume, 'm3', newUnit));
                    }
                  }}
                >
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
                        toast.info('Click "Calculate Hyetographs" to apply the new duration limit.');
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
                        toast.info('Click "Calculate Hyetographs" to apply the new duration limit.');
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

            {/* Pump Well Volume, Flow Rate, and Required Detention Volume */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label>Pump Well Volume ({volumeUnitLabel(volumeUnit)})</Label>
                <Input
                  type='number'
                  value={pumpWellVolume !== null ? pumpWellVolume : ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                    if (val === null || isNaN(val)) {
                      setPumpWellVolume(null);
                    } else {
                      handleWellVolumeChange(val);
                    }
                  }}
                  placeholder="e.g. 5.0"
                  step='0.1'
                />
                <p className="text-[11px] text-muted-foreground">
                  Active wet-well volume. Entering this automatically calculates the required pump flow rate.
                </p>
              </div>
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
                        for (let i = 0; i < r.hyetograph.length - 1; i++) {
                          const q1 = Math.max(0, r.hyetograph[i].flowRate - flowM3s);
                          const q2 = Math.max(0, r.hyetograph[i + 1].flowRate - flowM3s);
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
                <p className="text-[11px] text-muted-foreground">
                  The discharge rate of the duty pump. Modifying this recalculates the required detention volume.
                </p>
              </div>
              <div className='space-y-2'>
                <Label>Required Detention Volume ({volumeUnitLabel(volumeUnit)})</Label>
                <Input
                  type='number'
                  value={detentionVolume !== null ? parseFloat(detentionVolume.toFixed(2)) : ''}
                  readOnly
                  className='bg-muted font-semibold text-foreground'
                />
                <p className="text-[11px] text-muted-foreground">
                  Theoretical minimum storage volume required for the selected pump flow rate.
                </p>
              </div>
            </div>

            {/* Compliance Alert */}
            {pumpWellVolume !== null && detentionVolume !== null && (
              <div className="mt-2">
                {detentionVolume > pumpWellVolume ? (
                  <Alert variant="destructive">
                    <AlertDescription className="flex items-center gap-2 font-medium">
                      <span>⚠️ <strong>Not Compliant:</strong> Required detention volume ({detentionVolume.toFixed(2)} {volumeUnitLabel(volumeUnit)}) exceeds pump well volume ({pumpWellVolume} {volumeUnitLabel(volumeUnit)}). Increase pump flow rate or well volume.</span>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/15 dark:border-green-900/30 dark:text-green-400">
                    <AlertDescription className="flex items-center gap-2 font-medium">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span><strong>Compliant:</strong> Required detention volume ({detentionVolume.toFixed(2)} {volumeUnitLabel(volumeUnit)}) is within the pump well volume ({pumpWellVolume} {volumeUnitLabel(volumeUnit)}).</span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

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
                  {showAllHyetographs
                    ? 'Showing all duration hyetographs overlaid'
                    : 'Showing worst-case hyetograph only'}
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
              <Button onClick={calculateAllHyetographs} className='cursor-pointer' disabled={!csvData}>
                <Calculator className='mr-2 h-4 w-4' />
                Calculate Hyetographs
              </Button>
              {allResults.length > 0 && (
                <Button
                  variant='outline'
                  onClick={() => setShowAllHyetographs(!showAllHyetographs)}
                  className='cursor-pointer'
                >
                  {showAllHyetographs ? 'Show Worst Case Only' : 'Show All Hyetographs'}
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
                  {showAllHyetographs ? 'All Duration Hyetographs' : 'Worst-Case Hyetograph'}
              </CardTitle>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  if (chartRef.current) {
                    const link = document.createElement('a');
                    link.download = 'hyetograph.png';
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
                setCatchments([{ id: uid(), area: 0, toc: 10, aep: '20%', infiltrationType: 'Hardstand', amc: 'Max' }]);
                setFlowRate(0);
                setPumpWellVolume(null);
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
