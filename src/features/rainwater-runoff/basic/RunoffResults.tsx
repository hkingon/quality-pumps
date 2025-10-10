"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RunoffResultsProps {
  designFlowRate: number;
  individualResults: {
    id: number;
    area: number;
    coefficient: number;
    intensity: number;
    runoff: number;
    catchmentType: string;
    aepType: string | null;
  }[];
}

export default function RunoffResults({
  designFlowRate,
  individualResults
}: RunoffResultsProps) {

  const [showLitresPerSec, setShowLitresPerSec] = useState(false);

  const convertToLitresPerSecond = (cubicMetersPerHour: number) =>
    (cubicMetersPerHour * 1000) / 3600;

  const toggleUnits = () => setShowLitresPerSec((prev) => !prev);

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Runoff Results</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleUnits}
            disabled={designFlowRate === 0}
            className="text-xs cursor-pointer"
          >
            Show in {showLitresPerSec ? 'm³/hour' : 'L/s'}
          </Button>
        </div>

        {individualResults.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            Enter catchment details and click Calculate to see results
          </div>
        )}

        {individualResults.map((res, index) => {
          const runoffLps = convertToLitresPerSecond(res.runoff);
          return (
            <div
              key={res.id}
              className="border rounded p-4 bg-muted/20 space-y-1 text-sm"
            >
              <p className="font-medium">Catchment Area {index + 1}</p>
              <p>Area: <strong>{res.area} m²</strong></p>
              <p>Runoff Coefficient: <strong>{res.coefficient}</strong></p>
              <p>Catchment Type: <strong>{res.catchmentType}</strong></p>
              {res.aepType && <p>AEP: <strong>{res.aepType}</strong></p>}
              <p>Rainfall Intensity: <strong>{res.intensity} mm/hr</strong></p>
              <p>
                Runoff:{' '}
                <strong>
                  {showLitresPerSec
                    ? `${runoffLps.toFixed(2)} L/s`
                    : `${res.runoff.toFixed(2)} m³/hour`}
                </strong>
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Calculation: ({res.area} × {res.coefficient} × {res.intensity}) / 1000 ={' '}
                {res.runoff.toFixed(2)} m³/hour
              </p>
            </div>
          );
        })}

        {individualResults.length > 0 && (
          <div className="pt-4 border-t mt-6">
            <p className="text-lg font-medium">🌧️ Total Runoff:</p>
            <p className="text-base">
              <strong>
                {showLitresPerSec
                  ? `${convertToLitresPerSecond(designFlowRate).toFixed(2)} L/s`
                  : `${designFlowRate.toFixed(2)} m³/hour`}
              </strong>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}