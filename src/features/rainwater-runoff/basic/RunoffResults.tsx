'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

interface RunoffResultsProps {
  results: {
    computedDepth: number;
    computedIntensity: number;
    runoffVolume: number;
    minimumStorage: number;
    activeStorage: number;
    pumpWindowVolume: number;
    combinedStorage: number;
    requiredPumpWithMinimumNote: number;
    requiredStorageAtSelectedPump: number;
    recommendedFlowWithMinimumStorage: number;
    storagePass: boolean;
    wetWellMinPass: boolean;
    areaWarn: boolean;
    pumpMinWarn: boolean;
    allowableFail: boolean;
    recommendationAllowableFail: boolean;
    hasAllowable: boolean;
    limit: number;
    A: number;
    C: number;
    duration: number;
    windowMin: number;
    pumpFlow: number;
    minPump: number;
  };
}

export default function RunoffResults({ results }: RunoffResultsProps) {
  const {
    computedDepth,
    runoffVolume,
    minimumStorage,
    activeStorage,
    pumpWindowVolume,
    combinedStorage,
    requiredPumpWithMinimumNote,
    requiredStorageAtSelectedPump,
    recommendedFlowWithMinimumStorage,
    storagePass,
    wetWellMinPass,
    areaWarn,
    pumpMinWarn,
    allowableFail,
    recommendationAllowableFail,
    hasAllowable,
    limit,
    A,
    C,
    duration,
    windowMin,
    pumpFlow,
    minPump
  } = results;

  const fmt = (val: number, decimals: number = 2) => {
    if (typeof val !== 'number' || isNaN(val)) return '—';
    return val.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Determine overall compliance status
  const isFailed = !storagePass || !wetWellMinPass || allowableFail;
  const isWarning = areaWarn || pumpMinWarn || !hasAllowable || recommendationAllowableFail;

  let statusConfig = {
    bgClass: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400',
    title: 'Compliant with Section 9 storage checks',
    desc: 'The entered wet well storage and selected duty pump flow provide enough combined effective storage for the entered storm runoff volume.'
  };

  if (isFailed) {
    statusConfig = {
      bgClass: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400',
      title: 'Not compliant on entered values',
      desc: 'The entered arrangement fails one or more critical checks. Increase wet well active volume, change pump flow, or check the allowable discharge limit.'
    };
  } else if (isWarning) {
    statusConfig = {
      bgClass: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400',
      title: 'Passes main checks, but needs review',
      desc: 'The combined storage check passes, but one or more cautions should be reviewed before final design.'
    };
  }

  return (
    <div className="space-y-4 w-full">
      {/* Compliance Status Banner */}
      <div className={`rounded-xl border p-4 shadow-sm ${statusConfig.bgClass}`}>
        <h3 className="text-lg font-bold flex items-center gap-2">
          {isFailed ? '❌' : isWarning ? '⚠️' : '✅'} {statusConfig.title}
        </h3>
        <p className="text-sm mt-1 opacity-90">{statusConfig.desc}</p>
      </div>

      {/* Calculated Results Grid */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Calculated Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Runoff Volume</span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(runoffVolume)} <span className="text-sm font-medium text-muted-foreground">m³</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">10 year storm runoff volume for selected duration.</span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Minimum Active Wet Well Storage</span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(minimumStorage)} <span className="text-sm font-medium text-muted-foreground">m³</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">Greater of 1% of catchment area or 3 m³.</span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Active Storage Used</span>
                <Badge variant={wetWellMinPass ? 'default' : 'destructive'} className="h-4 px-1 text-[9px] uppercase">
                  {wetWellMinPass ? 'OK' : 'Low'}
                </Badge>
              </span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(activeStorage)} <span className="text-sm font-medium text-muted-foreground">m³</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">
                {wetWellMinPass
                  ? 'Meets minimum active wet well storage.'
                  : `Below minimum by ${fmt(minimumStorage - activeStorage)} m³.`}
              </span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Volume Pumped in Storage Window</span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(pumpWindowVolume)} <span className="text-sm font-medium text-muted-foreground">m³</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">Based on selected duty pump flow in {duration} min.</span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Combined Effective Storage</span>
                <Badge variant={storagePass ? 'default' : 'destructive'} className="h-4 px-1 text-[9px] uppercase">
                  {storagePass ? 'OK' : 'Short'}
                </Badge>
              </span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(combinedStorage)} <span className="text-sm font-medium text-muted-foreground">m³</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">
                {storagePass
                  ? 'Meets runoff volume target.'
                  : `Short by ${fmt(runoffVolume - combinedStorage)} m³.`}
              </span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Required Duty Pump Flow</span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(requiredPumpWithMinimumNote)} <span className="text-sm font-medium text-muted-foreground">L/s</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">For active storage entered, including min note.</span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Required Active Storage</span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(requiredStorageAtSelectedPump)} <span className="text-sm font-medium text-muted-foreground">m³</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">Required storage for selected duty pump flow.</span>
            </div>

            <div className="border rounded-xl p-3 bg-muted/5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">Rec. Flow Using Min. Storage</span>
              <div className="text-2xl font-extrabold mt-1">
                {fmt(recommendedFlowWithMinimumStorage)} <span className="text-sm font-medium text-muted-foreground">L/s</span>
              </div>
              <span className="text-[11px] text-muted-foreground block mt-1">Flow at min storage, including min pump capacity.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Check Table */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Detailed Check Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Check</TableHead>
                <TableHead className="w-1/5">Result</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Catchment area check */}
              <TableRow>
                <TableCell className="font-semibold">Catchment area</TableCell>
                <TableCell>
                  <Badge variant={areaWarn ? 'secondary' : 'default'} className="h-5">
                    {areaWarn ? 'CHECK' : 'OK'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {areaWarn
                    ? `Area exceeds 2000 m². Section 9 says pumped systems are normally for areas less than 2000 m².`
                    : `Within normal Section 9 area range (${fmt(A, 0)} m²).`}
                </TableCell>
              </TableRow>

              {/* Rainfall depth check */}
              <TableRow>
                <TableCell className="font-semibold">Rainfall depth used</TableCell>
                <TableCell className="font-medium text-sm">{fmt(computedDepth, 1)} mm</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  Duration used: {fmt(duration, 0)} minutes.
                </TableCell>
              </TableRow>

              {/* Runoff volume check */}
              <TableRow>
                <TableCell className="font-semibold">Runoff volume</TableCell>
                <TableCell className="font-medium text-sm">{fmt(runoffVolume)} m³</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  A × C × d / 1000 = {fmt(A, 0)} × {fmt(C, 2)} × {fmt(computedDepth, 1)} / 1000.
                </TableCell>
              </TableRow>

              {/* Minimum wet well active storage check */}
              <TableRow>
                <TableCell className="font-semibold">Minimum active wet well storage</TableCell>
                <TableCell>
                  <Badge variant={wetWellMinPass ? 'default' : 'destructive'} className="h-5">
                    {wetWellMinPass ? 'PASS' : 'FAIL'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  Minimum required = max(1% × {fmt(A, 0)} m², 3 m³) = {fmt(minimumStorage)} m³. Active storage used = {fmt(activeStorage)} m³.
                </TableCell>
              </TableRow>

              {/* Combined effective storage check */}
              <TableRow>
                <TableCell className="font-semibold">Combined effective storage</TableCell>
                <TableCell>
                  <Badge variant={storagePass ? 'default' : 'destructive'} className="h-5">
                    {storagePass ? 'PASS' : 'FAIL'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  Active storage + pumped volume in {fmt(windowMin, 0)} min = {fmt(combinedStorage)} m³. Required runoff volume = {fmt(runoffVolume)} m³.
                </TableCell>
              </TableRow>

              {/* Selected duty pump flow check */}
              <TableRow>
                <TableCell className="font-semibold">Selected duty pump flow</TableCell>
                <TableCell className="font-medium text-sm">{fmt(pumpFlow)} L/s</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  Pumps should be in duplicate. This calculator treats selected value as flow of one duty pump.
                </TableCell>
              </TableRow>

              {/* Minimum pump capacity check */}
              <TableRow>
                <TableCell className="font-semibold">Minimum pump capacity note</TableCell>
                <TableCell>
                  <Badge variant={pumpMinWarn ? 'secondary' : 'default'} className="h-5">
                    {pumpMinWarn ? 'BELOW 10 L/s' : 'OK'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {pumpMinWarn
                    ? `Selected pump flow is below the minimum note value of ${fmt(minPump)} L/s.`
                    : `Selected pump flow is not below the minimum note value of ${fmt(minPump)} L/s.`}
                </TableCell>
              </TableRow>

              {/* Required duty pump flow for active storage */}
              <TableRow>
                <TableCell className="font-semibold">Required duty pump flow for active storage</TableCell>
                <TableCell className="font-medium text-sm">{fmt(requiredPumpWithMinimumNote)} L/s</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  Required flow using active storage entered, including minimum pump capacity note.
                </TableCell>
              </TableRow>

              {/* Required active storage for selected pump */}
              <TableRow>
                <TableCell className="font-semibold">Required active storage for selected pump</TableCell>
                <TableCell className="font-medium text-sm">{fmt(requiredStorageAtSelectedPump)} m³</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  If selected flow is fixed at {fmt(pumpFlow)} L/s, active storage should be at least this value.
                </TableCell>
              </TableRow>

              {/* Allowable discharge limit check */}
              <TableRow>
                <TableCell className="font-semibold">Allowable discharge limit</TableCell>
                <TableCell>
                  <Badge variant={hasAllowable ? (allowableFail ? 'destructive' : 'default') : 'secondary'} className="h-5">
                    {!hasAllowable ? 'NOT ENTERED' : allowableFail ? 'EXCEEDS' : 'OK'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {hasAllowable
                    ? allowableFail
                      ? `Selected duty pump flow exceeds receiving-system limit by ${fmt(pumpFlow - limit)} L/s.`
                      : `Selected duty pump flow is within receiving-system limit of ${fmt(limit)} L/s.`
                    : 'Enter the receiving-system capacity if it is known. The pump capacity should not exceed the system receiving the discharge.'}
                </TableCell>
              </TableRow>

              {/* Recommended flow vs discharge limit */}
              <TableRow>
                <TableCell className="font-semibold">Recommended flow vs discharge limit</TableCell>
                <TableCell>
                  <Badge variant={hasAllowable ? (recommendationAllowableFail ? 'destructive' : 'default') : 'secondary'} className="h-5">
                    {!hasAllowable ? 'NOT ENTERED' : recommendationAllowableFail ? 'CONFLICT' : 'OK'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {hasAllowable
                    ? recommendationAllowableFail
                      ? `Using only minimum wet well storage would require ${fmt(recommendedFlowWithMinimumStorage)} L/s, which exceeds allowable discharge. Increase active storage or seek authority direction.`
                      : `Recommended flow using minimum storage is within allowable discharge.`
                    : 'Discharge limit check is omitted if allowable discharge is not entered.'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Formula Basis Card */}
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Formula Basis & Engineering Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <div className="bg-muted/5 border rounded-lg p-2 font-mono space-y-1">
            <div>• Rainfall depth from intensity: d = I × (t / 60)</div>
            <div>• Runoff volume: Vrunoff = A × C × d / 1000</div>
            <div>• Minimum active wet well storage: Vwell,min = max(0.01 × A, 3)</div>
            <div>• Volume pumped in storage window: Vpump = Qpump × window × 60 / 1000</div>
            <div>• Combined effective storage: Vcombined = Vwell + Vpump</div>
            <div>• Required pump flow: Qrequired = max(0, (Vrunoff − Vwell) × 1000 / (window × 60))</div>
          </div>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>The selected pump flow is treated as the duty flow of a single operating pump, not the combined flow of duplicate pumps.</li>
            <li>Section 9 of AS/NZS 3500.3:2003 applies to pumped systems serving catchments normally smaller than 2000 m².</li>
            <li>This tool is for preliminary design sizing. Final engineering designs must verify exact levels, inlets, hydraulic losses, electrical codes, and localized authority constraints.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}