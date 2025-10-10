"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { PumpData } from "@/types"
import { Trash } from "lucide-react"
import { FlowUnit, HeadUnit } from "@/lib/units"

interface PumpInputsProps {
  pump: PumpData
  index: number
  updatePump: (id: string, updatedPump: Partial<PumpData>) => void
  removePump: (id: string) => void
  savePump: (pump: PumpData) => void
  isEditing?: boolean
  onUpdate?: (updatedPump: PumpData) => void
  flowUnit?: FlowUnit
  headUnit?: HeadUnit
}

export function PumpInputs({ pump, index, updatePump, removePump, savePump, isEditing, onUpdate, flowUnit = "L/min",
  headUnit = "m" }: PumpInputsProps) {
  const handleInputChange = (field: keyof PumpData, value: string) => {
    const numValue = value === "" ? undefined : Number(value)
    updatePump(pump.id, { [field]: numValue })
  }

  return (
    <Card className="p-4 mb-4 border">
      <h3 className="font-medium mb-2">{pump?.name ?? `Pump ${"Name"}`}</h3>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-4">
          <div className="grid gap-1.5 flex-1 min-w-[200px]">
            <Label htmlFor={`maxHead-${pump.id}`}>Pump Max Head ({headUnit}):</Label>
            <Input
              id={`maxHead-${pump.id}`}
              type="number"
              value={pump.maxHead || ""}
              onChange={(e) => handleInputChange("maxHead", e.target.value)}
              placeholder={`Enter pump max head (${headUnit})`}
              step="any"
            />
          </div>

          <div className="grid gap-1.5 flex-1 min-w-[200px]">
            <Label htmlFor={`maxFlow-${pump.id}`}>Pump Max Flow ({flowUnit}):</Label>
            <Input
              id={`maxFlow-${pump.id}`}
              type="number"
              value={pump.maxFlow || ""}
              onChange={(e) => handleInputChange("maxFlow", e.target.value)}
              placeholder={`Enter pump max flow (${flowUnit})`}
              step="any"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">

          <div className="grid gap-1.5 flex-1 min-w-[200px]">
            <Label htmlFor={`oldSpeed-${pump.id}`}>Old RPM/Impeller (Optional):</Label>
            <Input
              id={`oldSpeed-${pump.id}`}
              type="number"
              value={pump.oldSpeed || ""}
              onChange={(e) => handleInputChange("oldSpeed", e.target.value)}
              placeholder="Enter original speed/diameter"
              step="any"
            />
          </div>

          <div className="grid gap-1.5 flex-1 min-w-[200px]">
            <Label htmlFor={`newSpeed-${pump.id}`}>New RPM/Impeller (Optional):</Label>
            <Input
              id={`newSpeed-${pump.id}`}
              type="number"
              value={pump.newSpeed || ""}
              onChange={(e) => handleInputChange("newSpeed", e.target.value)}
              placeholder="Enter new speed/diameter"
              step="any"
            />
          </div>
        </div>


        <div className="flex gap-2 mt-4">
          {isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate?.(pump)}
              disabled={!pump.maxHead || !pump.maxFlow}
            >
              Update Pump
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => savePump(pump)}
              className=' cursor-pointer'
              disabled={!pump.maxHead || !pump.maxFlow}
            >
              Save Pump
            </Button>
          )}
          <Button className=' cursor-pointer'  variant="destructive" size="sm" onClick={() => removePump(pump.id)}>
            <Trash className="h-2 w-2" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
