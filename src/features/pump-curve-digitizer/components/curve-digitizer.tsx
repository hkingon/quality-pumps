'use client';

import { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  ShieldAlert, 
  FileSpreadsheet, 
  FileDown, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  Info, 
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DataPoint {
  flow: number;
  value: number;
}

interface Curve {
  name: string;
  unit: string;
  y_axis_id: string;
  data_points: DataPoint[];
}

interface AxisInfo {
  label: string;
  unit: string;
  min: number;
  max: number;
}

interface YAxisInfo extends AxisInfo {
  id: string;
  side: 'left' | 'right';
}

interface CurveData {
  graph_title?: string | null;
  pump_model?: string | null;
  speed_rpm?: string | null;
  axes: {
    x: AxisInfo;
    y_axes: YAxisInfo[];
  };
  curves: Curve[];
  notes?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function curveBgColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('head') || n === 'h') return 'bg-blue-600 text-white';
  if (n.includes('effic') || n.includes('eta') || n === 'η') return 'bg-emerald-600 text-white';
  if (n.includes('npsh') || n.includes('suction')) return 'bg-orange-600 text-white';
  if (n.includes('power') || n.includes('kw') || n.includes('hp')) return 'bg-purple-600 text-white';
  if (n.includes('rpm') || n.includes('speed')) return 'bg-slate-700 text-white';
  return 'bg-teal-600 text-white';
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return parseFloat(n.toFixed(3)).toString();
}

function allFlowValues(curves: Curve[]): number[] {
  const flows = new Set<number>();
  curves.forEach(c => c.data_points.forEach(p => flows.add(p.flow)));
  return Array.from(flows).sort((a, b) => a - b);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PumpCurveDigitizer() {
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curveData, setCurveData] = useState<CurveData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.user_metadata?.role === 'admin';

  const runExtraction = async (f: File) => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', f);
      const res = await fetch('/api/extract-curves', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error');
      setCurveData(data.curve_data);
      toast.success('Curve digitization completed successfully!');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      setError(msg);
      toast.error(`Extraction failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError(null);
    setCurveData(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
    runExtraction(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const reset = () => {
    setFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setCurveData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Downloads ──────────────────────────────────────────────────────────────

  const downloadCSV = () => {
    if (!curveData) return;
    const flows = allFlowValues(curveData.curves);
    const headers = [
      `${curveData.axes.x.label} (${curveData.axes.x.unit})`,
      ...curveData.curves.map(c => `${c.name} (${c.unit})`),
    ];
    const rows = flows.map(flow => [
      flow,
      ...curveData.curves.map(c => {
        const pt = c.data_points.find(p => Math.abs(p.flow - flow) < 0.0001);
        return pt !== undefined ? pt.value : '';
      }),
    ]);
    const lines: string[] = [];
    if (curveData.graph_title) lines.push(`"Graph Title","${curveData.graph_title}"`);
    if (curveData.pump_model) lines.push(`"Pump Model","${curveData.pump_model}"`);
    if (lines.length) lines.push('');
    lines.push(headers.map(h => `"${h}"`).join(','));
    rows.forEach(r => lines.push(r.join(',')));
    triggerDownload(new Blob([lines.join('\r\n')], { type: 'text/csv' }), 'pump_curves.csv');
  };

  const downloadExcel = () => {
    if (!curveData) return;
    const flows = allFlowValues(curveData.curves);
    const headers = [
      `${curveData.axes.x.label} (${curveData.axes.x.unit})`,
      ...curveData.curves.map(c => `${c.name} (${c.unit})`),
    ];
    const rows = flows.map(flow => [
      flow,
      ...curveData.curves.map(c => {
        const pt = c.data_points.find(p => Math.abs(p.flow - flow) < 0.0001);
        return pt !== undefined ? pt.value : null;
      }),
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Pump Curves');

    if (curveData.graph_title || curveData.pump_model || curveData.notes) {
      const info: (string | null)[][] = [];
      if (curveData.graph_title) info.push(['Graph Title', curveData.graph_title]);
      if (curveData.pump_model) info.push(['Pump Model', curveData.pump_model]);
      if (curveData.speed_rpm) info.push(['Speed', curveData.speed_rpm]);
      if (curveData.notes) info.push(['Notes', curveData.notes]);
      const wsInfo = XLSX.utils.aoa_to_sheet(info);
      wsInfo['!cols'] = [{ wch: 16 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');
    }
    XLSX.writeFile(wb, 'pump_curves.xlsx');
  };

  // ── Render Guard ────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying authorizations...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-12">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle className="text-lg font-bold">Access Denied</AlertTitle>
        <AlertDescription className="mt-2 text-sm leading-relaxed">
          Access Denied. This tool is configured for administrator-only usage. Please contact your manager if you require access to this utility.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls (Reset button when file selected) */}
      {(file || curveData) && (
        <div className="flex justify-end">
          <Button onClick={reset} variant="outline" size="sm" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Reset / Load New File
          </Button>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Extraction Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Zone */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200
            ${isDragging 
              ? 'border-primary bg-primary/5 scale-[0.99] shadow-inner' 
              : 'border-muted-foreground/25 hover:border-primary/50 bg-card hover:bg-accent/40'
            }
          `}
        >
          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
          <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8" />
          </div>
          <h3 className="font-semibold text-lg text-foreground mb-1">Upload Pump Performance Graph</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Drag and drop your image or PDF here, or click to choose from your computer.
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {['PDF', 'PNG', 'JPG', 'JPEG'].map(format => (
              <Badge key={format} variant="secondary" className="px-3 py-1 font-semibold text-xs tracking-wider">
                {format}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Loading analysis state */}
      {loading && (
        <Card className="p-12 text-center flex flex-col items-center justify-center animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <h4 className="font-semibold text-lg mb-1">Analyzing Pump Curves...</h4>
          <p className="text-sm text-muted-foreground max-w-md">
            Claude is reading the graph axes and extracting data coordinates. This typically takes 10 to 30 seconds.
          </p>
        </Card>
      )}

      {/* Results Workspace */}
      {curveData && preview && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: File Preview */}
          <Card className="lg:col-span-4 overflow-hidden border shadow-sm">
            <CardHeader className="py-3 bg-muted/50 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Graph Document Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {file?.type === 'application/pdf' ? (
                <embed
                  src={preview}
                  type="application/pdf"
                  className="w-full h-[500px] block"
                />
              ) : (
                <img 
                  src={preview} 
                  alt="Uploaded Pump Curve" 
                  className="w-full h-auto max-h-[500px] object-contain block bg-accent/20" 
                />
              )}
            </CardContent>
          </Card>

          {/* Right panel: Extracted Data */}
          <div className="lg:col-span-8 space-y-6">

            {/* Information Grid */}
            <Card className="shadow-sm border">
              <CardHeader className="py-3 bg-muted/50 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pump Meta Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x border-b">
                  <div className="p-4">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Graph Title</p>
                    <p className="text-sm font-semibold text-foreground truncate">{curveData.graph_title || '—'}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Pump Model</p>
                    <p className="text-sm font-semibold text-foreground truncate">{curveData.pump_model || '—'}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Motor Speed</p>
                    <p className="text-sm font-semibold text-foreground">{curveData.speed_rpm ? `${curveData.speed_rpm} RPM` : '—'}</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Curves Extracted</p>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {curveData.curves.length} curves
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Axes Info Card */}
            <Card className="shadow-sm border">
              <CardHeader className="py-3 bg-muted/50 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Detected Axes & Scale Ranges
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-wrap gap-2.5">
                {/* X Axis */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-accent/40 text-xs text-foreground font-medium">
                  <span className="font-bold text-primary uppercase">X Axis:</span>
                  <span>{curveData.axes.x.label}</span>
                  <span className="text-muted-foreground">({curveData.axes.x.unit})</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="bg-background px-1.5 py-0.5 rounded border text-[10px]">{curveData.axes.x.min} – {curveData.axes.x.max}</span>
                </div>

                {/* Y Axes */}
                {curveData.axes.y_axes.map((a, i) => (
                  <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-accent/40 text-xs text-foreground font-medium">
                    <span className="font-bold text-amber-600 uppercase">Y Axis ({a.side}):</span>
                    <span>{a.label}</span>
                    <span className="text-muted-foreground">({a.unit})</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="bg-background px-1.5 py-0.5 rounded border text-[10px]">{a.min} – {a.max}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Download and Export Buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button onClick={downloadExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" /> Download Excel Spreadsheet (.xlsx)
              </Button>
              <Button onClick={downloadCSV} variant="outline" className="flex items-center gap-2 cursor-pointer">
                <FileDown className="h-4 w-4" /> Download CSV
              </Button>
            </div>

            {/* Spreadsheet Preview Table */}
            <Card className="shadow-sm border overflow-hidden">
              <CardHeader className="py-4 bg-muted/30 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Extracted Spreadsheet Table</CardTitle>
                  <CardDescription className="text-xs">
                    Synthesized from {allFlowValues(curveData.curves).length} coordinate points
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-bold text-center text-foreground border-r">
                          {curveData.axes.x.label}
                          <div className="text-[10px] font-normal text-muted-foreground">{curveData.axes.x.unit}</div>
                        </TableHead>
                        {curveData.curves.map(c => (
                          <TableHead key={c.name} className="font-bold text-center text-foreground">
                            <div className="flex justify-center mb-1">
                              <Badge className={`px-2 py-0.5 text-[10px] border-none font-semibold uppercase tracking-wider ${curveBgColor(c.name)}`}>
                                {c.name}
                              </Badge>
                            </div>
                            <div className="text-[10px] font-normal text-muted-foreground">{c.unit}</div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allFlowValues(curveData.curves).map((flow) => (
                        <TableRow key={flow} className="hover:bg-muted/10">
                          <TableCell className="text-center font-semibold text-foreground bg-muted/10 border-r">
                            {fmtNum(flow)}
                          </TableCell>
                          {curveData.curves.map(c => {
                            const pt = c.data_points.find(p => Math.abs(p.flow - flow) < 0.0001);
                            return (
                              <TableCell key={c.name} className="text-center">
                                {pt !== undefined ? fmtNum(pt.value) : <span className="text-muted-foreground/30">—</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Notes box */}
                {curveData.notes && (
                  <div className="bg-yellow-500/10 border-t border-yellow-500/20 p-4 text-xs text-amber-800 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5 text-amber-900">Extracted System Notes:</strong>
                      {curveData.notes}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}
