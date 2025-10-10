'use client'

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TimeOfConcentrationProps {
  catchmentSize: number;
  setCatchmentSize: (value: number) => void;
  distanceToPit: number;
  setDistanceToPit: (value: number) => void;
  slopeGrade: number;
  setSlopeGrade: (value: number) => void;
  hortonValue: string;
  setHortonValue: (value: string) => void;
  customHortonValue: number | null;
  setCustomHortonValue: (value: number | null) => void;
  calculateTc: () => void;
}

export default function TimeOfConcentration({
  catchmentSize,
  setCatchmentSize,
  distanceToPit,
  setDistanceToPit,
  slopeGrade,
  setSlopeGrade,
  hortonValue,
  setHortonValue,
  customHortonValue,
  setCustomHortonValue,
  calculateTc,
}: TimeOfConcentrationProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateInputs = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!catchmentSize || catchmentSize <= 0) {
      newErrors.catchmentSize = "Catchment size must be greater than 0";
    }
    
    if (!distanceToPit || distanceToPit <= 0) {
      newErrors.distanceToPit = "Overland flow length must be greater than 0";
    }
    
    if (!slopeGrade || slopeGrade <= 0) {
      newErrors.slopeGrade = "Average Catchment slope must be greater than 0";
    }
    
    if (hortonValue === "Custom" && (!customHortonValue || customHortonValue <= 0)) {
      newErrors.customHortonValue = "Custom Horton value must be greater than 0";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (validateInputs()) {
      calculateTc();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="catchmentSize">Catchment Size (m²)</Label>
          <Input
            id="catchmentSize"
            type="number"
            value={catchmentSize || ''}
            onChange={(e) => setCatchmentSize(parseFloat(e.target.value) || 0)}
            placeholder="Enter catchment size"
          />
          {errors.catchmentSize && (
            <p className="text-sm text-destructive">{errors.catchmentSize}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="distanceToPit">Overland Flow Length (m)</Label>
          <Input
            id="distanceToPit"
            type="number"
            value={distanceToPit || ''}
            onChange={(e) => setDistanceToPit(parseFloat(e.target.value) || 0)}
            placeholder="Enter Overland flow length"
          />
          {errors.distanceToPit && (
            <p className="text-sm text-destructive">{errors.distanceToPit}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="slopeGrade">Average Catchment slope (%)</Label>
          <Input
            id="slopeGrade"
            type="number"
            value={slopeGrade || ''}
            onChange={(e) => setSlopeGrade(parseFloat(e.target.value) || 0)}
            placeholder="Enter slope percentage"
            step="0.01"
          />
          {errors.slopeGrade && (
            <p className="text-sm text-destructive">{errors.slopeGrade}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="hortonValue">Horton&apos;s Roughness Value (n)</Label>
          <Select
            value={hortonValue}
            onValueChange={setHortonValue}
          >
            <SelectTrigger id="hortonValue">
              <SelectValue placeholder="Select surface type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Paved Surface">Paved Surface (n=0.015)</SelectItem>
              <SelectItem value="Bare Soil Surface">Bare Soil Surface (n=0.0275)</SelectItem>
              <SelectItem value="Poorly Grassed Surface">Poorly Grassed Surface (n=0.035)</SelectItem>
              <SelectItem value="Average Grassed Surface">Average Grassed Surface (n=0.045)</SelectItem>
              <SelectItem value="Densely Grassed Surface">Densely Grassed Surface (n=0.06)</SelectItem>
              <SelectItem value="Custom">Custom Value</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {hortonValue === "Custom" && (
        <div className="space-y-2">
          <Label htmlFor="customHortonValue">Custom Horton Value</Label>
          <Input
            id="customHortonValue"
            type="number"
            value={customHortonValue || ''}
            onChange={(e) => setCustomHortonValue(parseFloat(e.target.value) || null)}
            placeholder="Enter custom Horton's n value"
            step="0.001"
          />
          {errors.customHortonValue && (
            <p className="text-sm text-destructive">{errors.customHortonValue}</p>
          )}
        </div>
      )}
      
      <div className="pt-2">
        <Button 
          onClick={handleCalculate}
          className="w-full md:w-auto cursor-pointer"
        >
          Calculate Time of Concentration
        </Button>
      </div>
      
      <Card className="bg-muted/30">
        <CardContent>
          <p className="text-sm">
            <strong>Note:</strong> Time of Concentration (Tc) is now calculated using Friend&apos;s equation:
            <br />
            <code className="bg-[#808080bf] py-1 px-2 rounded-[6px] " >T<sub>c</sub> = B × (n × L<sup>1/3</sup>) / S<sup>1/5</sup></code>
            <br />
            <code>

            <strong>B</strong> = constant (typically 107 for metric units) <br />
            </code>
            {/* Where: <br />
              <strong>T<sub>c</sub></strong> = time of concentration (minutes) <br />
              <strong>n</strong> = Horton&apos;s roughness value <br />
              <strong>L</strong> = overland flow length (meters) <br />
              <strong>S</strong> = average catchment slope (%) <br /> */}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}