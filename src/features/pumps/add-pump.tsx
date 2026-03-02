'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ArrowLeft, Plus, Settings, Zap, Activity, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import {
  APPLICATION_OPTIONS,
  IMPELLER_TYPE_OPTIONS,
  OTHER_TRAITS_OPTIONS,
  POLE_OPTIONS,
  PUMP_CLASS_OPTIONS,
} from '@/types/filters';

import { MultiSelectFilter } from '@/components/multi-select-filter';


// Define interfaces for type safety
interface DutyPoint {
  head: string;
  flow: string;
}

interface MotorPowerPoint {
  kw: string;
  flow: string;
}

interface EfficiencyPoint {
  eff: string;
  flow: string;
}

interface PumpFormData {
  brand: string;
  model: string;
  kw: string;
  inlet: string;
  outlet: string;
  configuration: string[];
  type: string[];
  voltage: string;
  amps: string;
  phases: string;
  maxTemp: string;
  pvsq: DutyPoint[];
  npshr: DutyPoint[];
  motorPower: MotorPowerPoint[];
  efficiency: EfficiencyPoint[];
  designSLD: File | null;
  dataSheet: File | null;
  image: File | null;
  is_public?: boolean;
  rpm: string;
  hz: string;
  manualBepFlow?: string;

  pumpClass: string[];
  application: string[];
  impellerType?: string;
  otherTraits?: string[];
  poles?: number | null;
  minTemp?: number | null;
}

interface UploadedFiles {
  designSLD?: string;
  dataSheet?: string;
  image?: string;
}

const basePumpTypes = ['Centrifugal', 'PositiveDisplacement', 'Axial', 'MixedFlow', 'DrainagePump', 'HorizontalMultistage', 'EndSuctionCentrifugal', 'SubmersibleVortex', 'Grinder', 'JetPressurePump', 'SubmersibleDrainagePump'];
const baseConfigurations = ['EndSuction', 'SplitCase', 'VerticalTurbine', 'Inline', 'SelfPriming', 'SinglePump'];
const baseVoltageOptions = ['110', '220', '380', '415', '440', '480', '600', '230', '240', '277', '400', '575'];

const blankPump: PumpFormData = {
  brand: '',
  model: '',
  kw: '',
  inlet: '',
  outlet: '',
  configuration: [],
  type: [],
  voltage: '',
  amps: '',
  phases: '',
  maxTemp: '',
  pvsq: [],
  npshr: [],
  motorPower: [],
  efficiency: [],
  designSLD: null,
  dataSheet: null,
  image: null,
  is_public: false,
  rpm: '',
  hz: '',
  manualBepFlow: '',

  pumpClass: [],
  application: [],
  impellerType: '',
  otherTraits: [],
  poles: null,
  minTemp: null,
};

const dutyKeys: Record<string, string[]> = {
  pvsq: ['head', 'flow'],
  npshr: ['head', 'flow'],
  motorPower: ['kw', 'flow'],
  efficiency: ['eff', 'flow']
};

const phaseOptions = ['1', '3'];

const AddPump: React.FC = () => {
  const [pumpForm, setPumpForm] = useState<PumpFormData>(blankPump);
  const [uploading, setUploading] = useState<boolean>(false);
  const [customType, setCustomType] = useState('');
  const [customConfiguration, setCustomConfiguration] = useState('');
  const [customVoltage, setCustomVoltage] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [showCustomConfiguration, setShowCustomConfiguration] = useState(false);
  const [showCustomVoltage, setShowCustomVoltage] = useState(false);
  const [dynamicPumpTypes, setDynamicPumpTypes] = useState<string[]>([]);
  const [dynamicConfigurations, setDynamicConfigurations] = useState<string[]>([]);
  const [dynamicVoltageOptions, setDynamicVoltageOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importTarget, setImportTarget] = useState<'pvsq' | 'npshr' | 'motorPower' | 'efficiency' | null>(null);

  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Fetch custom options from database on component mount
  useEffect(() => {
    const fetchCustomOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('pump_types')
          .select('name, category');

        if (error) throw error;

        if (data) {
          // Filter and organize by category
          const customTypes = data
            .filter(item => item.category === 'type')
            .map(item => item.name);
          const customConfigs = data
            .filter(item => item.category === 'configuration')
            .map(item => item.name);
          const customVoltages = data
            .filter(item => item.category === 'voltage')
            .map(item => item.name);

          // Merge with base options and add "AddNew"
          setDynamicPumpTypes([...basePumpTypes, ...customTypes, 'AddNew']);
          setDynamicConfigurations([...baseConfigurations, ...customConfigs, 'AddNew']);
          setDynamicVoltageOptions([...baseVoltageOptions, ...customVoltages, 'AddNew']);
        }
      } catch (err) {
        console.error('Error fetching custom options:', err);
        // Fallback to base options
        setDynamicPumpTypes([...basePumpTypes, 'AddNew']);
        setDynamicConfigurations([...baseConfigurations, 'AddNew']);
        setDynamicVoltageOptions([...baseVoltageOptions, 'AddNew']);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomOptions();
  }, []);

  const handleFormChange = (field: keyof PumpFormData, value: string): void => {
    setPumpForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDutyPointChange = (
    table: 'pvsq' | 'npshr' | 'motorPower' | 'efficiency',
    idx: number,
    key: string,
    value: string
  ): void => {
    setPumpForm((prev) => ({
      ...prev,
      [table]: prev[table].map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    }));
  };

  const addDutyPoint = (table: 'pvsq' | 'npshr' | 'motorPower' | 'efficiency'): void => {
    setPumpForm((prev) => ({
      ...prev,
      [table]: [...prev[table], Object.fromEntries(dutyKeys[table].map((k) => [k, '']))]
    }));
  };

  const removeDutyPoint = (table: 'pvsq' | 'npshr' | 'motorPower' | 'efficiency', idx: number): void => {
    setPumpForm((prev) => ({
      ...prev,
      [table]: prev[table].filter((_, i) => i !== idx)
    }));
  };

  const handleFileChange = (field: 'designSLD' | 'dataSheet' | 'image', file: File | null): void => {
    setPumpForm((prev) => ({ ...prev, [field]: file }));
  };

  const uploadToSupabase = async (file: File, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from('pump-assets').upload(path, file);
    if (error) throw error;
    return data.path;
  };

  // Save custom option to database (admin only)
  const saveCustomOption = async (name: string, category: 'type' | 'configuration' | 'voltage'): Promise<boolean> => {
    if (!isAdmin) {
      toast.error('Only admins can add custom options');
      return false;
    }

    try {
      const { error } = await supabase
        .from('pump_types')
        .insert([{ name, category, created_by: user?.id }]);

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505') {
          toast.info('This option already exists in the database');
          return true;
        }
        throw error;
      }

      toast.success(`Custom ${category} added and will be available to all users`);
      return true;
    } catch (err) {
      console.error('Error saving custom option:', err);
      toast.error('Failed to save custom option to database');
      return false;
    }
  };

  const handleSavePump = async (): Promise<void> => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setUploading(true);
    try {
      // Upload files to Supabase Storage
      const uploads: UploadedFiles = {};
      for (const key of ['designSLD', 'dataSheet', 'image'] as const) {
        if (pumpForm[key]) {
          const file = pumpForm[key] as File;
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${Date.now()}_${key}.${ext}`;
          uploads[key] = await uploadToSupabase(file, path);
        }
      }

      // Prepare pump data
      const pumpData = {
        brand: pumpForm.brand,
        model: pumpForm.model,
        kw: parseFloat(pumpForm.kw) || 0,
        inlet: parseFloat(pumpForm.inlet) || 0,
        outlet: parseFloat(pumpForm.outlet) || 0,
        configuration: pumpForm.configuration,
        type: pumpForm.type,
        voltage: parseFloat(pumpForm.voltage) || 0,
        amps: parseFloat(pumpForm.amps) || 0,
        phases: parseInt(pumpForm.phases) || 0,
        max_temp: parseFloat(pumpForm.maxTemp) || 0,
        pvsq: pumpForm.pvsq.map((p) => ({
          head: parseFloat(p.head) || 0,
          flow: parseFloat(p.flow) || 0
        })),
        npshr: pumpForm.npshr.map((p) => ({
          head: parseFloat(p.head) || 0,
          flow: parseFloat(p.flow) || 0
        })),
        motor_power: pumpForm.motorPower.map((p) => ({
          kw: parseFloat(p.kw) || 0,
          flow: parseFloat(p.flow) || 0
        })),
        efficiency: pumpForm.efficiency.map((p) => ({
          eff: parseFloat(p.eff) || 0,
          flow: parseFloat(p.flow) || 0
        })),
        user_id: user.id,
        design_sld: uploads.designSLD || null,
        data_sheet: uploads.dataSheet || null,
        image: uploads.image || null,
        is_public: isAdmin ? pumpForm.is_public || false : false,
        rpm: parseFloat(pumpForm.rpm) || 0,
        hz: parseFloat(pumpForm.hz) || 0,
        manual_bep_flow: pumpForm.manualBepFlow ? parseFloat(pumpForm.manualBepFlow) : null,

        pump_class: pumpForm.pumpClass || null,
        application: pumpForm.application || null,
        impeller_type: pumpForm.impellerType || null,
        other_traits: pumpForm.otherTraits?.length
          ? pumpForm.otherTraits
          : null,
        poles: pumpForm.poles,
        min_temp: pumpForm.minTemp,
      };

      // Save to Supabase table
      const { data, error } = await supabase.from('pumps').insert([pumpData]);
      if (error) throw error;

      toast.success('Pump added successfully!');
      router.push('/dashboard/pumps');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleTypeChange = (value: string): void => {
    if (value === 'AddNew') {
      setShowCustomType(true);
      setCustomType('');
    } else {
      setShowCustomType(false);
      handleFormChange('type', value);
    }
  };

  const handleConfigurationChange = (value: string): void => {
    if (value === 'AddNew') {
      setShowCustomConfiguration(true);
      setCustomConfiguration('');
    } else {
      setShowCustomConfiguration(false);
      handleFormChange('configuration', value);
    }
  };

  const handleVoltageChange = (value: string): void => {
    if (value === 'AddNew') {
      setShowCustomVoltage(true);
      setCustomVoltage('');
    } else {
      setShowCustomVoltage(false);
      handleFormChange('voltage', value);
    }
  };

  const handleCustomTypeSubmit = (): void => {
    if (customType.trim()) {
      const newType = customType.trim();

      if (!dynamicPumpTypes.includes(newType)) {
        const updatedTypes = [...basePumpTypes, newType, 'AddNew'];
        setDynamicPumpTypes(updatedTypes);
      }

      setPumpForm((prev) => ({
        ...prev,
        type: [...prev.type, newType]
      }));
      setShowCustomType(false);
      setCustomType('');
    }
  };

  const handleCustomConfigurationSubmit = (): void => {
    if (customConfiguration.trim()) {
      const newConfig = customConfiguration.trim();

      if (!dynamicConfigurations.includes(newConfig)) {
        const updatedConfigs = [...baseConfigurations, newConfig, 'AddNew'];
        setDynamicConfigurations(updatedConfigs);
      }

      setPumpForm((prev) => ({
        ...prev,
        configuration: [...prev.configuration, newConfig]
      }));
      setShowCustomConfiguration(false);
      setCustomConfiguration('');
    }
  };

  const handleCustomVoltageSubmit = (): void => {
    if (customVoltage.trim()) {
      const newVoltage = customVoltage.trim();

      if (!dynamicVoltageOptions.includes(newVoltage)) {
        const updatedVoltages = [...baseVoltageOptions, newVoltage, 'AddNew'];
        setDynamicVoltageOptions(updatedVoltages);
      }

      handleFormChange('voltage', newVoltage);
      setShowCustomVoltage(false);
      setCustomVoltage('');
    }
  };

  if (!user) {
    return (
      <div className='container mx-auto p-6'>
        <Alert>
          <AlertDescription>Please login to add a new pump.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='container mx-auto p-6 flex items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  const handleImportJSON = (
    table: 'pvsq' | 'npshr' | 'motorPower' | 'efficiency'
  ) => {
    try {
      const parsed = JSON.parse(jsonInput);

      // Validate the JSON structure based on table type
      if (!Array.isArray(parsed)) {
        toast.error('JSON must be an array of objects');
        return;
      }

      let validData;

      switch (table) {
        case 'pvsq':
        case 'npshr':
          validData = parsed.map((item: any) => ({
            head: item.head?.toString() || '',
            flow: item.flow?.toString() || ''
          }));
          break;
        case 'motorPower':
          validData = parsed.map((item: any) => ({
            kw: item.kw?.toString() || '',
            flow: item.flow?.toString() || ''
          }));
          break;
        case 'efficiency':
          validData = parsed.map((item: any) => ({
            eff: item.eff?.toString() || '',
            flow: item.flow?.toString() || ''
          }));
          break;
      }

      setPumpForm((prev) => ({
        ...prev,
        [table]: validData
      }));

      toast.success(`Successfully imported ${validData.length} data points`);
      setShowImportDialog(false);
      setJsonInput('');
      setImportTarget(null);
    } catch (error) {
      toast.error('Invalid JSON format. Please check your input.');
    }
  };

  return (
    <div className='container mx-auto space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='sm' onClick={() => router.back()}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
          <div>
            <h1 className='text-3xl font-bold'>Add New Pump</h1>
            <p className='text-muted-foreground'>
              Create a new pump entry with specifications and performance data
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() =>
                window.open('/dashboard/pumps/types/manage', '_blank')
              }
            >
              Manage Pump Types
            </Button>
          </div>
        )}
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Main Content */}
        <div className='lg:col-span-2'>
          <Tabs defaultValue='specifications' className='w-full'>
            <TabsList className='grid w-full grid-cols-4'>
              <TabsTrigger value='specifications'>Basic Info</TabsTrigger>
              <TabsTrigger value='performance'>Performance</TabsTrigger>
              <TabsTrigger value='motor'>Motor Data</TabsTrigger>
              <TabsTrigger value='files'>Files</TabsTrigger>
            </TabsList>

            <TabsContent value='specifications' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Settings className='h-5 w-5' />
                    General Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='brand'>Brand</Label>
                    <Input
                      id='brand'
                      value={pumpForm.brand}
                      onChange={(e) =>
                        handleFormChange('brand', e.target.value)
                      }
                      placeholder='Enter pump brand'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='model'>Model</Label>
                    <Input
                      id='model'
                      value={pumpForm.model}
                      onChange={(e) =>
                        handleFormChange('model', e.target.value)
                      }
                      placeholder='Enter pump model'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='type'>Type</Label>
                    <MultiSelectFilter
                      label=''
                      options={dynamicPumpTypes.filter(t => t !== 'AddNew' && t !== 'Add New')}
                      selected={pumpForm.type}
                      onSelectionChange={(selected) =>
                        setPumpForm((prev) => ({ ...prev, type: selected }))
                      }
                      placeholder='Select pump types...'
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      className='mt-2'
                      onClick={() => setShowCustomType(true)}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      Add Custom Type
                    </Button>
                    {showCustomType && (
                      <div className='mt-2 flex gap-2'>
                        <Input
                          placeholder='Enter custom pump type'
                          value={customType}
                          onChange={(e) => setCustomType(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomTypeSubmit();
                            }
                          }}
                        />
                        <Button size='sm' onClick={handleCustomTypeSubmit}>
                          Add
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => {
                            setShowCustomType(false);
                            setCustomType('');
                          }}
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='configuration'>Configuration</Label>
                    <MultiSelectFilter
                      label=''
                      options={dynamicConfigurations.filter(c => c !== 'AddNew' && c !== 'Add New')}
                      selected={pumpForm.configuration}
                      onSelectionChange={(selected) =>
                        setPumpForm((prev) => ({
                          ...prev,
                          configuration: selected
                        }))
                      }
                      placeholder='Select configurations...'
                    />
                    <Button
                      variant='outline'
                      size='sm'
                      className='mt-2'
                      onClick={() => setShowCustomConfiguration(true)}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      Add Custom Configuration
                    </Button>
                    {showCustomConfiguration && (
                      <div className='mt-2 flex gap-2'>
                        <Input
                          placeholder='Enter custom configuration'
                          value={customConfiguration}
                          onChange={(e) =>
                            setCustomConfiguration(e.target.value)
                          }
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomConfigurationSubmit();
                            }
                          }}
                        />
                        <Button
                          size='sm'
                          onClick={handleCustomConfigurationSubmit}
                        >
                          Add
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => {
                            setShowCustomConfiguration(false);
                            setCustomConfiguration('');
                          }}
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className='col-span-2'>
                    <h3 className='mb-4 border-b pb-2 text-lg font-semibold'>
                      Pump Classification
                    </h3>
                  </div>

                  {/* Pump Class */}
                  <div className='space-y-2'>
                    <Label>Pump Class</Label>
                    <MultiSelectFilter
                      label=''
                      options={Object.values(PUMP_CLASS_OPTIONS).flat()}
                      selected={pumpForm.pumpClass}
                      onSelectionChange={(selected) =>
                        setPumpForm((prev) => ({ ...prev, pumpClass: selected }))
                      }
                      placeholder='Select pump classes...'
                    />
                    <p className='text-muted-foreground text-xs'>
                      Primary pump classification category
                    </p>
                  </div>

                  {/* Application */}
                  <div className='space-y-2'>
                    <Label htmlFor='application'>Application</Label>
                    <MultiSelectFilter
                      label=''
                      options={APPLICATION_OPTIONS}
                      selected={pumpForm.application}
                      onSelectionChange={(selected) =>
                        setPumpForm((prev) => ({
                          ...prev,
                          application: selected
                        }))
                      }
                      placeholder='Select applications...'
                    />
                  </div>

                  {/* Impeller Type */}
                  <div className='space-y-2'>
                    <Label>Impeller Type</Label>
                    <Select
                      value={pumpForm.impellerType}
                      onValueChange={(value) =>
                        setPumpForm((prev) => ({
                          ...prev,
                          impellerType: value
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select impeller type...' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='null'>None</SelectItem>
                        {IMPELLER_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Poles */}
                  <div className='space-y-2'>
                    <Label>Poles</Label>
                    <Select
                      value={pumpForm.poles?.toString() || ''}
                      onValueChange={(value) =>
                        setPumpForm((prev) => ({
                          ...prev,
                          poles: value ? parseInt(value) : null
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select poles...' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='null'>None</SelectItem>
                        {POLE_OPTIONS.map((pole) => (
                          <SelectItem key={pole} value={pole}>
                            {pole} Poles
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className='text-muted-foreground text-xs'>
                      Number of motor poles (affects synchronous speed)
                    </p>
                  </div>

                  {/* Other Traits */}
                  <div className='col-span-2 space-y-2'>
                    <Label>Other Traits</Label>
                    <MultiSelectFilter
                      label=''
                      options={OTHER_TRAITS_OPTIONS}
                      selected={pumpForm.otherTraits || []}
                      onSelectionChange={(selected) =>
                        setPumpForm((prev) => ({
                          ...prev,
                          otherTraits: selected
                        }))
                      }
                      placeholder='Select pump traits...'
                    />
                    <p className='text-muted-foreground text-xs'>
                      Select all applicable traits (VFD compatible,
                      self-priming, etc.)
                    </p>
                  </div>

                  {/* Min Temperature */}
                  <div className='space-y-2'>
                    <Label>Min Temperature (°C)</Label>
                    <Input
                      type='number'
                      value={pumpForm.minTemp ?? ''}
                      onChange={(e) =>
                        setPumpForm((prev) => ({
                          ...prev,
                          minTemp: e.target.value
                            ? Number(e.target.value)
                            : null
                        }))
                      }
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='maxTemp'>Max Temperature (°C)</Label>
                    <Input
                      id='maxTemp'
                      type='number'
                      value={pumpForm.maxTemp}
                      onChange={(e) =>
                        handleFormChange('maxTemp', e.target.value)
                      }
                      placeholder='Maximum temperature'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='inlet'>Inlet (mm)</Label>
                    <Input
                      id='inlet'
                      type='number'
                      value={pumpForm.inlet}
                      onChange={(e) =>
                        handleFormChange('inlet', e.target.value)
                      }
                      placeholder='Inlet diameter'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='outlet'>Outlet (mm)</Label>
                    <Input
                      id='outlet'
                      type='number'
                      value={pumpForm.outlet}
                      onChange={(e) =>
                        handleFormChange('outlet', e.target.value)
                      }
                      placeholder='Outlet diameter'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='rpm'>RPM</Label>
                    <Input
                      id='rpm'
                      type='number'
                      value={pumpForm.rpm}
                      onChange={(e) => handleFormChange('rpm', e.target.value)}
                      placeholder='Rotations per minute'
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Zap className='h-5 w-5' />
                    Electrical Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='kw'>Power (kW)</Label>
                    <Input
                      id='kw'
                      type='number'
                      value={pumpForm.kw}
                      onChange={(e) => handleFormChange('kw', e.target.value)}
                      placeholder='Motor power'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='voltage'>Voltage (V)</Label>
                    <Select
                      value={pumpForm.voltage}
                      onValueChange={handleVoltageChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select voltage' />
                      </SelectTrigger>
                      <SelectContent>
                        {dynamicVoltageOptions.map((voltage) => (
                          <SelectItem key={voltage} value={voltage}>
                            {voltage === 'AddNew' ? voltage : `${voltage}V`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showCustomVoltage && (
                      <div className='mt-2 flex gap-2'>
                        <Input
                          placeholder='Enter custom voltage'
                          value={customVoltage}
                          onChange={(e) => setCustomVoltage(e.target.value)}
                          type='number'
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleCustomVoltageSubmit();
                            }
                          }}
                        />
                        <Button size='sm' onClick={handleCustomVoltageSubmit}>
                          Add
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => {
                            setShowCustomVoltage(false);
                            setCustomVoltage('');
                          }}
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='hz'>Frequency (Hz)</Label>
                    <Input
                      id='hz'
                      type='number'
                      value={pumpForm.hz}
                      onChange={(e) => handleFormChange('hz', e.target.value)}
                      placeholder='Frequency in Hz'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='amps'>Current (A)</Label>
                    <Input
                      id='amps'
                      type='number'
                      value={pumpForm.amps}
                      onChange={(e) => handleFormChange('amps', e.target.value)}
                      placeholder='Current rating'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='phases'>Phases</Label>
                    <Select
                      value={pumpForm.phases}
                      onValueChange={(value) =>
                        handleFormChange('phases', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select phases' />
                      </SelectTrigger>
                      <SelectContent>
                        {phaseOptions.map((phase) => (
                          <SelectItem key={phase} value={phase}>
                            {phase} Phase
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Settings className='h-5 w-5' />
                      Admin Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='is_public'
                        checked={pumpForm.is_public || false}
                        onCheckedChange={(checked) =>
                          setPumpForm((prev) => ({
                            ...prev,
                            is_public: checked as boolean
                          }))
                        }
                      />
                      <Label htmlFor='is_public'>
                        Make this pump public for all users
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value='performance' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Manual BEP Override
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='manualBepFlow'>
                      Manual BEP Flow Rate (Optional)
                    </Label>
                    <Input
                      id='manualBepFlow'
                      type='number'
                      value={pumpForm.manualBepFlow || ''}
                      onChange={(e) =>
                        handleFormChange('manualBepFlow', e.target.value)
                      }
                      placeholder={`Enter manual BEP flow rate (${'L/min'})`}
                    />
                    <p className='text-muted-foreground text-sm'>
                      If provided, this will override the automatically
                      calculated BEP and define the solid line region (70%-120%
                      of this flow rate).
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Head vs Flow Performance (PvsQ)
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {pumpForm.pvsq.map((row, i) => (
                    <div key={i} className='flex items-center gap-2'>
                      <Input
                        type='number'
                        placeholder='Head (m/head)'
                        value={row.head}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'pvsq',
                            i,
                            'head',
                            e.target.value
                          )
                        }
                      />
                      <Input
                        type='number'
                        placeholder='Flow (L/min)'
                        value={row.flow}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'pvsq',
                            i,
                            'flow',
                            e.target.value
                          )
                        }
                      />
                      <Button
                        size='icon'
                        variant='ghost'
                        onClick={() => removeDutyPoint('pvsq', i)}
                        type='button'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size='sm'
                    variant='outline'
                    className='mr-2'
                    onClick={() => addDutyPoint('pvsq')}
                    type='button'
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Add Performance Point
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setImportTarget('pvsq');
                      setShowImportDialog(true);
                    }}
                    type='button'
                  >
                    <FileText className='mr-2 h-4 w-4' />
                    Import from JSON
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    NPSHR Data
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {pumpForm.npshr.map((row, i) => (
                    <div key={i} className='flex items-center gap-2'>
                      <Input
                        type='number'
                        placeholder='NPSHR (m/head)'
                        value={row.head}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'npshr',
                            i,
                            'head',
                            e.target.value
                          )
                        }
                      />
                      <Input
                        type='number'
                        placeholder='Flow (L/min)'
                        value={row.flow}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'npshr',
                            i,
                            'flow',
                            e.target.value
                          )
                        }
                      />
                      <Button
                        size='icon'
                        variant='ghost'
                        onClick={() => removeDutyPoint('npshr', i)}
                        type='button'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size='sm'
                    variant='outline'
                    className='mr-2'
                    onClick={() => addDutyPoint('npshr')}
                    type='button'
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Add NPSHR Point
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setImportTarget('npshr');
                      setShowImportDialog(true);
                    }}
                    type='button'
                  >
                    <FileText className='mr-2 h-4 w-4' />
                    Import from JSON
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Pump Efficiency Data
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {pumpForm.efficiency.map((row, i) => (
                    <div key={i} className='flex items-center gap-2'>
                      <Input
                        type='number'
                        placeholder='Efficiency (η)'
                        value={row.eff}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'efficiency',
                            i,
                            'eff',
                            e.target.value
                          )
                        }
                      />
                      <Input
                        type='number'
                        placeholder='Flow (L/min)'
                        value={row.flow}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'efficiency',
                            i,
                            'flow',
                            e.target.value
                          )
                        }
                      />
                      <Button
                        size='icon'
                        variant='ghost'
                        onClick={() => removeDutyPoint('efficiency', i)}
                        type='button'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size='sm'
                    variant='outline'
                    className='mr-2'
                    onClick={() => addDutyPoint('efficiency')}
                    type='button'
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Add Efficiency Point
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setImportTarget('efficiency');
                      setShowImportDialog(true);
                    }}
                    type='button'
                  >
                    <FileText className='mr-2 h-4 w-4' />
                    Import from JSON
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='motor' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Zap className='h-5 w-5' />
                    Motor Power Curve Data
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {pumpForm.motorPower.map((row, i) => (
                    <div key={i} className='flex items-center gap-2'>
                      <Input
                        type='number'
                        placeholder='Power (kW)'
                        value={row.kw}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'motorPower',
                            i,
                            'kw',
                            e.target.value
                          )
                        }
                      />
                      <Input
                        type='number'
                        placeholder='Flow (L/min)'
                        value={row.flow}
                        onChange={(e) =>
                          handleDutyPointChange(
                            'motorPower',
                            i,
                            'flow',
                            e.target.value
                          )
                        }
                      />
                      <Button
                        size='icon'
                        variant='ghost'
                        onClick={() => removeDutyPoint('motorPower', i)}
                        type='button'
                      >
                        <X className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size='sm'
                    variant='outline'
                    className='mr-2'
                    onClick={() => addDutyPoint('motorPower')}
                    type='button'
                  >
                    <Plus className='mr-2 h-4 w-4' />
                    Add Motor Power Point
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setImportTarget('motorPower');
                      setShowImportDialog(true);
                    }}
                    type='button'
                  >
                    <FileText className='mr-2 h-4 w-4' />
                    Import from JSON
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='files' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <FileText className='h-5 w-5' />
                    File Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-6'>
                  <div className='space-y-2'>
                    <Label htmlFor='designSLD'>Design SLD File</Label>
                    <Input
                      id='designSLD'
                      type='file'
                      accept='.sld,.sldprt'
                      onChange={(e) =>
                        handleFileChange(
                          'designSLD',
                          e.target.files?.[0] || null
                        )
                      }
                    />
                    {pumpForm.designSLD && (
                      <p className='text-muted-foreground text-sm'>
                        Selected: {pumpForm.designSLD.name}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='dataSheet'>Data Sheet (PDF)</Label>
                    <Input
                      id='dataSheet'
                      type='file'
                      accept='.pdf'
                      onChange={(e) =>
                        handleFileChange(
                          'dataSheet',
                          e.target.files?.[0] || null
                        )
                      }
                    />
                    {pumpForm.dataSheet && (
                      <p className='text-muted-foreground text-sm'>
                        Selected: {pumpForm.dataSheet.name}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='image'>Pump Image</Label>
                    <Input
                      id='image'
                      type='file'
                      accept='image/*'
                      onChange={(e) =>
                        handleFileChange('image', e.target.files?.[0] || null)
                      }
                    />
                    {pumpForm.image && (
                      <div className='mt-2'>
                        <img
                          src={URL.createObjectURL(pumpForm.image)}
                          alt='Pump preview'
                          className='h-32 w-full rounded border object-cover'
                        />
                        <p className='text-muted-foreground mt-1 text-sm'>
                          Selected: {pumpForm.image.name}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ImageIcon className='h-5 w-5' />
                Image Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pumpForm.image ? (
                <img
                  src={URL.createObjectURL(pumpForm.image)}
                  alt='Pump preview'
                  className='h-48 w-full rounded-lg border object-cover'
                />
              ) : (
                <div className='bg-muted flex h-48 w-full items-center justify-center rounded-lg'>
                  <ImageIcon className='text-muted-foreground h-12 w-12' />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Summary</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>
                  Performance Points
                </span>
                <span className='font-medium'>{pumpForm.pvsq.length}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>NPSHR Points</span>
                <span className='font-medium'>{pumpForm.npshr.length}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>
                  Motor Power Points
                </span>
                <span className='font-medium'>
                  {pumpForm.motorPower.length}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Efficiency Points</span>
                <span className='font-medium'>
                  {pumpForm.efficiency.length}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Files Attached</span>
                <span className='font-medium'>
                  {
                    [
                      pumpForm.designSLD,
                      pumpForm.dataSheet,
                      pumpForm.image
                    ].filter(Boolean).length
                  }
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            className='w-full'
            onClick={handleSavePump}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving Pump...
              </>
            ) : (
              'Save Pump'
            )}
          </Button>
        </div>
      </div>
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              Import {importTarget?.toUpperCase()} Data from JSON
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>JSON Data</Label>
              <textarea
                className='min-h-[300px] w-full rounded-md border p-3 font-mono text-sm'
                placeholder={`Paste your JSON here. Example:\n${importTarget === 'pvsq' || importTarget === 'npshr'
                  ? '[\n  { "head": 25, "flow": 100 },\n  { "head": 20, "flow": 150 }\n]'
                  : importTarget === 'motorPower'
                    ? '[\n  { "kw": 5.5, "flow": 100 },\n  { "kw": 7.5, "flow": 150 }\n]'
                    : '[\n  { "eff": 75, "flow": 100 },\n  { "eff": 80, "flow": 150 }\n]'
                  }`}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setShowImportDialog(false);
                  setJsonInput('');
                  setImportTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => importTarget && handleImportJSON(importTarget)}
              >
                Import Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddPump;
