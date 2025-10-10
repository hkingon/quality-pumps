'use client';
import { useState, useMemo, useEffect } from 'react';
import { PipeInputs } from './PipeInputs';
import { FrictionResults } from './FrictionResults';
import { PipeSelector } from './PipeSelector';
import { pipeLookup, PipeType } from './lookupTables';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
function mapHeadUnitToInternal(
  unit: 'm/Head' | 'Bar' | 'kPa'
): 'm' | 'kPa' | 'psi' {
  switch (unit) {
    case 'm/Head':
      return 'm';
    case 'kPa':
      return 'kPa';
    case 'Bar':
      return 'kPa';
    default:
      return 'm';
  }
}
export default function FrictionLossPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flowRate, setFlowRate] = useState(() =>
    parseFloat(searchParams.get('flowRate') || '0')
  );
  const [flowRateUnit, setFlowRateUnit] = useState<'L/sec' | 'L/min' | 'm³/hr'>(
    () =>
      (searchParams.get('flowRateUnit') as 'L/sec' | 'L/min' | 'm³/hr') ||
      'L/sec'
  );
  const [pipeLength, setPipeLength] = useState(() =>
    parseFloat(searchParams.get('pipeLength') || '0')
  );
  const [staticHead, setStaticHead] = useState(() =>
    parseFloat(searchParams.get('staticHead') || '0')
  );
  const [nominalBore, setNominalBore] = useState(
    () => searchParams.get('nominalBore') || '40'
  );
  const [pipeType, setPipeType] = useState<PipeType>(
    () => (searchParams.get('pipeType') as PipeType) || 'PE_PN12@5'
  );
  const [headUnit, setHeadUnit] = useState<'m/Head' | 'Bar' | 'kPa'>(
    () => (searchParams.get('headUnit') as 'm/Head' | 'Bar' | 'kPa') || 'm/Head'
  );
  const [isDischargeMode, setIsDischargeMode] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams();
    if (flowRate > 0) params.set('flowRate', flowRate.toString());
    if (flowRateUnit !== 'L/sec') params.set('flowRateUnit', flowRateUnit);
    if (pipeLength > 0) params.set('pipeLength', pipeLength.toString());
    if (!isNaN(staticHead)) params.set('staticHead', staticHead.toString());
    if (nominalBore !== '40') params.set('nominalBore', nominalBore);
    if (pipeType !== 'PE_PN12@5') params.set('pipeType', pipeType);
    if (headUnit !== 'm/Head') params.set('headUnit', headUnit);
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [
    flowRate,
    flowRateUnit,
    pipeLength,
    staticHead,
    nominalBore,
    pipeType,
    headUnit
  ]);
  const { id, c } = useMemo(() => {
    const data = pipeLookup[pipeType]?.[nominalBore];
    return data || { id: 160, c: 150 }; // Adjusted c to 150 for PE PN12.5
  }, [nominalBore, pipeType]);
  function convertHead(
    value: number,
    fromUnit: 'm/Head' | 'Bar' | 'kPa',
    toUnit: 'm/Head' | 'Bar' | 'kPa' = 'm/Head'
  ) {
    let standardValue = value;
    if (fromUnit === 'Bar') {
      standardValue = value * 10;
    } else if (fromUnit === 'kPa') {
      standardValue = value / 10;
    }
    if (toUnit === fromUnit) return value;
    if (toUnit === 'm/Head') return standardValue;
    if (toUnit === 'Bar') return standardValue / 10;
    if (toUnit === 'kPa') return standardValue * 10;
    return standardValue;
  }
  const standardizedFlowRate = useMemo(() => {
    switch (flowRateUnit) {
      case 'L/min':
        return flowRate / 60;
      case 'm³/hr':
        return flowRate / 3.6;
      case 'L/sec':
      default:
        return flowRate;
    }
  }, [flowRate, flowRateUnit]);
  const totalHeadLoss = useMemo(() => {
    const Q = standardizedFlowRate / 1000; // Convert L/sec to m³/s
    const L = pipeLength;
    const D = id / 1000; // Convert mm to m
    const C = c;
    if (!D || !C || Q <= 0) return 0;
    const headLoss =
      (10.67 * L * Math.pow(Q, 1.852)) /
      (Math.pow(C, 1.852) * Math.pow(D, 4.87));
    return parseFloat(headLoss.toFixed(4));
  }, [standardizedFlowRate, pipeLength, id, c]);
  const units = {
    flowRate: flowRateUnit,
    head: headUnit,
    id: 'mm',
    velocity: 'm/s'
  };
  const velocity = useMemo(() => {
    const radius = id / 2 / 1000; // m
    const area = Math.PI * radius * radius;
    return +(standardizedFlowRate / 1000 / area).toFixed(3);
  }, [id, standardizedFlowRate]);

  const velocityHead = useMemo(() => {
    return velocity ** 2 / (2 * 9.81); // m
  }, [velocity]);

  const totalSystemDuty = useMemo(() => {
    let totalHead;

    if (isDischargeMode) {
      // Discharge: Friction + Static Head
      totalHead = totalHeadLoss + staticHead;
    } else {
      // Suction: Static Pressure (10.1325 + staticHead) - Friction - Velocity Head
      totalHead = 10.1325 + staticHead - totalHeadLoss - velocityHead;
    }

    const converted = convertHead(totalHead, 'm/Head', headUnit).toFixed(2);
    return `${flowRate.toFixed(2)}${flowRateUnit} @ ${converted}${headUnit}`;
  }, [
    flowRate,
    flowRateUnit,
    totalHeadLoss,
    staticHead,
    headUnit,
    isDischargeMode,
    velocityHead
  ]);

  const minID = +(1.128 * Math.sqrt((standardizedFlowRate * 1000) / 3)).toFixed(
    2
  );
  const maxID = +(
    1.128 * Math.sqrt((standardizedFlowRate * 1000) / 0.8)
  ).toFixed(2);
  const addToPumpCurve = () => {
    const operatingFlow = flowRate;
    const operatingHead = totalHeadLoss;
    const headUnitInternal = mapHeadUnitToInternal(headUnit);
    const url = `/dashboard/pump-curve?staticHead=${staticHead}&headUnit=${headUnitInternal}&operatingFlow=${operatingFlow}&flowUnit=${flowRateUnit}&operatingHead=${operatingHead}`;
    router.push(url);
  };
  const handleAddDischargeClicked = () => {
    const currentCurve = {
      id: Date.now().toString(),
      staticHead: staticHead,
      operatingFlow: flowRate,
      operatingHead: staticHead + totalHeadLoss,
      name: `Discharge Curve ${Date.now()}`,
      type: 'discharge',
      flowUnit: flowRateUnit,
      headUnit: headUnit
    };
    const existingDischarge = JSON.parse(
      localStorage.getItem('dischargeCurves') || '[]'
    );
    existingDischarge.push(currentCurve);
    localStorage.setItem('dischargeCurves', JSON.stringify(existingDischarge));
    router.push('/dashboard/pump-curve?activeTab=discharge');
  };
  const handleReplaceDischargeClicked = () => {
    const currentCurve = {
      id: Date.now().toString(),
      staticHead: staticHead,
      operatingFlow: flowRate,
      operatingHead: staticHead + totalHeadLoss,
      name: `Discharge Curve ${Date.now()}`,
      type: 'discharge',
      flowUnit: flowRateUnit,
      headUnit: headUnit
    };
    localStorage.setItem('dischargeCurves', JSON.stringify([currentCurve]));
    router.push('/dashboard/pump-curve?activeTab=discharge');
  };
  const handleAddSuctionClicked = () => {
    const velocityHeadCalc = velocityHead;
    const staticPressure = 10.1325 + staticHead;
    const operatingNpsha = staticPressure - totalHeadLoss - velocityHeadCalc;
    const currentCurve = {
      id: Date.now().toString(),
      staticPressure,
      operatingFlow: flowRate,
      operatingNpsha,
      name: `Suction Curve ${Date.now()}`,
      type: 'suction',
      flowUnit: flowRateUnit,
      headUnit: headUnit
    };
    const existingSuction = JSON.parse(
      localStorage.getItem('suctionCurves') || '[]'
    );
    existingSuction.push(currentCurve);
    localStorage.setItem('suctionCurves', JSON.stringify(existingSuction));
    console.log('Added suction curve:', currentCurve);
    router.push('/dashboard/pump-curve?activeTab=suction');
  };
  const handleReplaceSuctionClicked = () => {
    const velocityHeadCalc = velocityHead; // m/s to m head
    const staticPressure = 10.1325 + staticHead; // in m
    const operatingNpsha = staticPressure - totalHeadLoss - velocityHeadCalc; // NPSHa
    const currentCurve = {
      id: Date.now().toString(),
      staticPressure,
      operatingFlow: flowRate,
      operatingNpsha,
      name: `Suction Curve ${Date.now()}`,
      type: 'suction',
      flowUnit: flowRateUnit,
      headUnit: headUnit
    };
    localStorage.setItem('suctionCurves', JSON.stringify([currentCurve]));
    console.log('Replaced suction curve:', currentCurve);
    router.push('/dashboard/pump-curve?activeTab=suction');
  };
  return (
    <div className='mb-4 flex w-full flex-col items-center gap-6 lg:flex-col'>
      <div className='w-full space-y-4 lg:w-1/2'>
        <PipeSelector
          pipeType={pipeType}
          setPipeType={setPipeType}
          nominalBore={nominalBore}
          setNominalBore={setNominalBore}
        />
        <div className='flex flex-wrap items-center gap-4'>
          <div className='flex items-center gap-2'>
            <span>
              <strong>Head Loss Unit:</strong>
            </span>
            <Select
              value={headUnit}
              onValueChange={(val) =>
                setHeadUnit(val as 'm/Head' | 'Bar' | 'kPa')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Select Head Unit' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='m/Head'>m/Head</SelectItem>
                <SelectItem value='Bar'>Bar</SelectItem>
                <SelectItem value='kPa'>kPa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center gap-2'>
            <span>
              <strong>Flow Rate Unit:</strong>
            </span>
            <Select
              value={flowRateUnit}
              onValueChange={(val) =>
                setFlowRateUnit(val as 'L/sec' | 'L/min' | 'm³/hr')
              }
            >
              <SelectTrigger className='h-7 w-24'>
                <SelectValue placeholder='Unit' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='L/sec'>L/sec</SelectItem>
                <SelectItem value='L/min'>L/min</SelectItem>
                <SelectItem value='m³/hr'>m³/hr</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <PipeInputs
          flowRate={flowRate}
          setFlowRate={setFlowRate}
          pipeLength={pipeLength}
          setPipeLength={setPipeLength}
          staticHead={staticHead}
          setStaticHead={setStaticHead}
          flowRateUnit={flowRateUnit}
        />
      </div>
      <div className='w-full space-y-4 lg:w-1/2'>
        <FrictionResults
          totalHeadLoss={convertHead(totalHeadLoss, 'm/Head', headUnit)}
          totalSystemDuty={totalSystemDuty}
          velocity={velocity}
          minID={minID}
          maxID={maxID}
          units={{ ...units, head: headUnit }}
        >
          <div className='mt-6 space-y-4'>
            <div className='flex items-center gap-2'>
              <span>
                <strong>Mode:</strong>
              </span>
              <span>Suction</span>
              <Switch
                checked={isDischargeMode}
                onCheckedChange={setIsDischargeMode}
              />
              <span>Discharge</span>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <Button
                onClick={
                  isDischargeMode
                    ? handleAddDischargeClicked
                    : handleAddSuctionClicked
                }
                className='cursor-pointer'
                variant='default'
                disabled={!standardizedFlowRate || !totalHeadLoss}
              >
                Add {isDischargeMode ? 'Discharge' : 'Suction'} Curve
              </Button>
              <Button
                onClick={
                  isDischargeMode
                    ? handleReplaceDischargeClicked
                    : handleReplaceSuctionClicked
                }
                className='cursor-pointer'
                variant='outline'
                disabled={!standardizedFlowRate || !totalHeadLoss}
              >
                Replace {isDischargeMode ? 'Discharge' : 'Suction'} Curve
              </Button>
            </div>
          </div>
        </FrictionResults>
      </div>
    </div>
  );
}
