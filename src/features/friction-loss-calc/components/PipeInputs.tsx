import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type PipeInputsProps = {
  flowRate: number;
  setFlowRate: (value: number) => void;
  pipeLength: number;
  setPipeLength: (value: number) => void;
  staticHead: number;
  setStaticHead: (value: number) => void;
  flowRateUnit: 'L/sec' | 'L/min' | 'm³/hr';
};

export function PipeInputs({
  flowRate,
  setFlowRate,
  pipeLength,
  setPipeLength,
  staticHead,
  setStaticHead,
  flowRateUnit
}: PipeInputsProps) {
  return (
    <Card>
      <CardContent className='space-y-4 pt-4'>
        <h3 className='mb-4 text-lg font-semibold'>Input Parameters</h3>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div>
            <label className='mb-1 block text-sm font-medium'>
              Flow Rate ({flowRateUnit})
            </label>
            <Input
              type='number'
              value={flowRate}
              onChange={(e) => setFlowRate(+e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium'>
              Pipe Length (m)
            </label>
            <Input
              type='number'
              value={pipeLength}
              onChange={(e) => setPipeLength(+e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>
          <div>
            <label className='mb-1 block text-sm font-medium'>
              Static Head (m)
            </label>
            <Input
              type='number'
              min={-1000}
              value={staticHead || ''}
              onChange={(e) => {
                const value = e.target.value;
                const numValue = value === '' ? 0 : Number(value);
                if (!isNaN(numValue)) {
                  setStaticHead(numValue);
                }
              }}
              onFocus={(e) => e.target.select()}
              step='any'
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
