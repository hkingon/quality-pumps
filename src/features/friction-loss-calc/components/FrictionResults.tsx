import { Card, CardContent } from "@/components/ui/card"
import { ReactNode } from "react"

type FrictionResultsProps = {
  totalHeadLoss: number
  totalSystemDuty: string
  velocity: number
  minID: number
  maxID: number
  units: {
    velocity: string
    id: string
    flowRate: string
    head: string
  }
  children: ReactNode
}

export function FrictionResults({
  totalHeadLoss,
  totalSystemDuty,
  velocity,
  minID,
  maxID,
  units,
  children
}: FrictionResultsProps) {

  const velocityWarning = (velocity: number) => {
    if (velocity < 0.6) return "⚠️ Velocity is too low – may cause sediment buildup.";
    if (velocity > 2.0) return "⚠️ Velocity is too high – may cause pipe erosion.";
    return "✅ Velocity is within optimal range.";
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="text-lg font-semibold mb-4">Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Total Head Loss:</strong> {totalHeadLoss.toFixed(2)} {units.head}
          </div>
          <div>
            <strong>Total System Duty:</strong> {totalSystemDuty}
          </div>
          <div>
            <strong>Velocity:</strong> {velocity} {units.velocity}
            <p className="text-sm text-muted-foreground">
              {velocityWarning(velocity)}
            </p>
          </div>
          <div className="group">
            <div>
              <strong>Min ID:</strong> {minID} {units.id}
            </div>
            <div>
              <strong>Max ID:</strong> {maxID} {units.id}
            </div>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
