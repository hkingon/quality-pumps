import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { pipeLookup, PipeType, pipeTypeLabels } from "./lookupTables"

type PipeSelectorProps = {
    pipeType: PipeType
    setPipeType: (value: PipeType) => void
    nominalBore: string
    setNominalBore: (value: string) => void
}

export function PipeSelector({
    pipeType,
    setPipeType,
    nominalBore,
    setNominalBore,
}: PipeSelectorProps) {
    const availableBores = Object.keys(pipeLookup[pipeType] || {})

    return (
        <Card >
            <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Pipe Selection{pipeType && (
                    <span className="block text-sm font-normal mt-1 text-muted-foreground">
                        {pipeTypeLabels[pipeType]}
                    </span>
                )}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Pipe Type</label>
                        <Select
                            value={pipeType}
                            onValueChange={(value) => setPipeType(value as PipeType)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select pipe type" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(pipeLookup).map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type.replace(/_/g, ' ').replace(/@/g, '.')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Nominal Bore (mm)</label>
                        <Select value={nominalBore} onValueChange={setNominalBore}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select nominal bore" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableBores.map((bore) => (
                                    <SelectItem key={bore} value={bore}>
                                        {bore}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
