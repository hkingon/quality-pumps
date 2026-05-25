import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"

export interface PipeTypeOption {
  id: string;
  name: string;
  description: string | null;
  standard: string | null;
}

export interface PipeSizeOption {
  id: string;
  pipe_type_id: string;
  nominal_size: string;
  internal_diameter_mm: number;
  hazen_williams_c: number;
}

type PipeSelectorProps = {
    pipeTypes: PipeTypeOption[]
    loading: boolean
    pipeTypeId: string
    setPipeTypeId: (value: string) => void
    nominalSize: string
    setNominalSize: (value: string) => void
    sizes: PipeSizeOption[]
}

export function PipeSelector({
    pipeTypes,
    loading,
    pipeTypeId,
    setPipeTypeId,
    nominalSize,
    setNominalSize,
    sizes
}: PipeSelectorProps) {
    const selectedType = pipeTypes.find((t) => t.id === pipeTypeId)
    const availableSizes = sizes.map((s) => s.nominal_size)

    // If the current nominal size is not available for this type, reset it
    if (nominalSize && availableSizes.length > 0 && !availableSizes.includes(nominalSize)) {
        // Only update if we're not still loading (avoid jitter)
        if (!loading) {
            // Don't call setState during render - parent should handle this via effect
        }
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">
                    Pipe Selection
                    {selectedType && (
                        <span className="block text-sm font-normal mt-1 text-muted-foreground">
                            {selectedType.description || selectedType.name.replace(/_/g, ' ').replace(/@/g, '.')}
                        </span>
                    )}
                </h3>
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : pipeTypes.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        No pipe types found in library. Please ask an admin to add pipe types.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Pipe Type</label>
                            <Select
                                value={pipeTypeId}
                                onValueChange={(value) => {
                                    setPipeTypeId(value)
                                    setNominalSize('')
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select pipe type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pipeTypes.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.name.replace(/_/g, ' ').replace(/@/g, '.')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Nominal Bore (mm)</label>
                            <Select
                                value={nominalSize}
                                onValueChange={setNominalSize}
                                disabled={!pipeTypeId || availableSizes.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select nominal bore" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSizes.map((size) => (
                                        <SelectItem key={size} value={size}>
                                            {size}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
