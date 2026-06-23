'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  X,
  ArrowLeft,
  Plus,
  Settings,
  Zap,
  Activity,
  FileText,
  Image as ImageIcon,
  Loader2,
  Thermometer
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { APPLICATION_OPTIONS, IMPELLER_TYPE_OPTIONS, INSTALLATION_CONFIG_OPTIONS, OTHER_TRAITS_OPTIONS, POLE_OPTIONS, PUMP_CLASS_OPTIONS, POWER_SOURCE_OPTIONS, WETTED_MATERIALS_OPTIONS } from '@/types/filters';
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
  minTemp?: number | null;
  poles?: number | null;
  installationConfiguration: string[];
  wettedMaterials: string[];
  powerSource?: string;
}

interface UploadedFiles {
  designSLD?: string;
  dataSheet?: string;
  image?: string;
}

const basePumpTypes = [
  'Centrifugal',
  'Positive Displacement',
  'Axial',
  'Mixed Flow',
  'Drainage Pump',
  'Horizontal Multistage',
  'EndSuction Centrifugal',
  'Submersible Vortex',
  'Grinder',
  'JetPressure Pump',
  'Submersible Drainage Pump'
];

const baseConfigurations = [
  'End Suction',
  'Split Case',
  'Vertical Turbine',
  'Inline',
  'Self Priming',
  'Single Pump'
];

const baseVoltageOptions = [
  '110',
  '220',
  '380',
  '415',
  '440',
  '480',
  '600',
  '230',
  '240',
  '277',
  '400',
  '575'
];

const pumpTypes = [...basePumpTypes, 'Add New'];
const configurations = [...baseConfigurations, 'Add New'];
const voltageOptions = [...baseVoltageOptions, 'Add New'];

interface ExistingPump {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  kw: number;
  inlet: number;
  outlet: number;
  configuration: string[];
  type: string[];
  voltage: number;
  amps: number;
  phases: number;
  max_temp: number;
  pvsq: Array<{ head: number; flow: number }>;
  npshr: Array<{ head: number; flow: number }>;
  motor_power: Array<{ kw: number; flow: number }>;
  efficiency: Array<{ eff: number; flow: number }>;
  design_sld: string | null;
  data_sheet: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
  rpm: number;
  hz: number;
  manual_bep_flow: number;
  pump_class: string[];
  application: string[];
}

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
  otherTraits: [] as string[],
  poles: null as number | null,
  minTemp: null as number | null,
  installationConfiguration: [],
  wettedMaterials: [],
  powerSource: '',
};

const dutyKeys: Record<string, string[]> = {
  pvsq: ['head', 'flow'],
  npshr: ['head', 'flow'],
  motorPower: ['kw', 'flow'],
  efficiency: ['eff', 'flow']
};

const phaseOptions = ['1', '3'];

/** Keep the legacy numeric `phases` column in sync with the new Power Source value. */
const powerSourceToPhases = (powerSource?: string): number => {
  if (!powerSource) return 0;
  if (powerSource.startsWith('1 Phase')) return 1;
  if (powerSource.startsWith('3 Phase')) return 3;
  return 0; // DC / engines have no phase count
};

const EditPump: React.FC = () => {
  const [pumpForm, setPumpForm] = useState<PumpFormData>(blankPump);
  const [uploading, setUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [existingFiles, setExistingFiles] = useState<{
    designSLD?: string;
    dataSheet?: string;
    image?: string;
  }>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customType, setCustomType] = useState('');
  const [customConfiguration, setCustomConfiguration] = useState('');
  const [customVoltage, setCustomVoltage] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [showCustomConfiguration, setShowCustomConfiguration] = useState(false);
  const [showCustomVoltage, setShowCustomVoltage] = useState(false);

  const [dynamicPumpTypes, setDynamicPumpTypes] = useState(pumpTypes);
  const [dynamicConfigurations, setDynamicConfigurations] =
    useState(configurations);
  const [dynamicVoltageOptions, setDynamicVoltageOptions] =
    useState(voltageOptions);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [importTarget, setImportTarget] = useState<'pvsq' | 'npshr' | 'motorPower' | 'efficiency' | null>(null);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';
  const pumpId = params.pumpId as string;
  // When opened from a tool (e.g. the pump curve dashboard) this holds the path
  // to return to after saving; otherwise we fall back to the pump library.
  const returnTo = searchParams.get('returnTo') || '/dashboard/pumps';

  // Fetch existing pump data
  const fetchPump = async (): Promise<void> => {
    if (!user?.id || !pumpId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('id', pumpId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Pump not found');
          router.push('/dashboard/pumps');
          return;
        }
        throw error;
      }

      const { data: pumpTypes, error: pumpTypesError } = await supabase
        .from('pump_types')
        .select('name, category');

      if (pumpTypesError) throw pumpTypesError;

      const pump: ExistingPump = data;

      // Convert pump data to form format
      setPumpForm({
        brand: pump.brand,
        model: pump.model,
        kw: pump.kw.toString(),
        inlet: pump.inlet.toString(),
        outlet: pump.outlet.toString(),
        configuration: pump.configuration || [],
        type: pump.type || [],
        voltage: pump.voltage.toString(),
        amps: pump.amps.toString(),
        phases: pump.phases.toString(),
        maxTemp: pump.max_temp.toString(),
        pvsq: pump.pvsq.map((p) => ({
          head: p.head.toString(),
          flow: p.flow.toString()
        })),
        npshr: pump.npshr.map((p) => ({
          head: p.head.toString(),
          flow: p.flow.toString()
        })),
        motorPower: pump.motor_power.map((p) => ({
          kw: p.kw.toString(),
          flow: p.flow.toString()
        })),
        efficiency: pump.efficiency.map((p) => ({
          eff: p.eff.toString(),
          flow: p.flow.toString()
        })),
        designSLD: null,
        dataSheet: null,
        image: null,
        rpm: pump.rpm.toString(),
        hz: pump.hz.toString(),
        manualBepFlow: pump.manual_bep_flow?.toString() || '',

        pumpClass: data.pump_class || [],
        application: data.application || [],
        impellerType: data.impeller_type || '',
        otherTraits: data.other_traits || [],
        poles: data.poles || null,
        minTemp: data.min_temp || null,
        installationConfiguration: data.installation_configuration || [],
        wettedMaterials: data.wetted_materials || [],
        powerSource: data.power_source || '',
      });

      const handleExistingCustomValues = () => {
        let updatedTypes = [...basePumpTypes];
        let updatedConfigs = [...baseConfigurations];
        let updatedVoltages = [...baseVoltageOptions];

        // Get custom types from pump_types table
        if (pumpTypes) {
          const customTypes = pumpTypes
            .filter((item) => item.category === 'type')
            .map((item) => item.name);

          // Add custom types from database (avoid duplicates)
          customTypes.forEach((type) => {
            if (!updatedTypes.includes(type)) {
              updatedTypes.push(type);
            }
          });
        }

        // Check if current pump types are not in the list
        if (pump.type && Array.isArray(pump.type)) {
          pump.type.forEach((t) => {
            if (t && !updatedTypes.includes(t) && t !== 'Add New') {
              updatedTypes.push(t);
            }
          });
        }

        // Add 'Add New' at the end
        updatedTypes.push('Add New');

        // Get custom configurations from pump_types table
        if (pumpTypes) {
          const customConfigs = pumpTypes
            .filter((item) => item.category === 'configuration')
            .map((item) => item.name);

          // Add custom configs from database (avoid duplicates)
          customConfigs.forEach((config) => {
            if (!updatedConfigs.includes(config)) {
              updatedConfigs.push(config);
            }
          });
        }

        // Check if current pump configurations are not in the list
        if (pump.configuration && Array.isArray(pump.configuration)) {
          pump.configuration.forEach((c) => {
            if (c && !updatedConfigs.includes(c) && c !== 'Add New') {
              updatedConfigs.push(c);
            }
          });
        }

        // Add 'Add New' at the end
        updatedConfigs.push('Add New');

        // Get custom voltages from pump_types table
        if (pumpTypes) {
          const customVoltages = pumpTypes
            .filter((item) => item.category === 'voltage')
            .map((item) => item.name);

          // Add custom voltages from database (avoid duplicates)
          customVoltages.forEach((voltage) => {
            if (!updatedVoltages.includes(voltage)) {
              updatedVoltages.push(voltage);
            }
          });
        }

        const voltageStr = pump.voltage.toString();

        // Check if current pump voltage is not in the list
        if (
          voltageStr &&
          !updatedVoltages.includes(voltageStr) &&
          voltageStr !== 'Add New'
        ) {
          updatedVoltages.push(voltageStr);
        }

        // Add 'Add New' at the end
        updatedVoltages.push('Add New');

        setDynamicPumpTypes(updatedTypes);
        setDynamicConfigurations(updatedConfigs);
        setDynamicVoltageOptions(updatedVoltages);
      };

      handleExistingCustomValues();

      // Store existing file paths
      setExistingFiles({
        designSLD: pump.design_sld || undefined,
        dataSheet: pump.data_sheet || undefined,
        image: pump.image || undefined
      });

      // Load existing image preview
      if (pump.image) {
        const { data: imageData } = await supabase.storage
          .from('pump-assets')
          .createSignedUrl(pump.image, 3600);
        if (imageData) {
          setImagePreview(imageData.signedUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching pump:', error);
      toast.error('Failed to load pump details');
      router.push('/dashboard/pumps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDynamicPumpTypes([...basePumpTypes, 'Add New']);
    setDynamicConfigurations([...baseConfigurations, 'Add New']);
    setDynamicVoltageOptions([...baseVoltageOptions, 'Add New']);
  }, []);

  useEffect(() => {
    fetchPump();
  }, [user?.id, pumpId]);

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
      [table]: prev[table].map((row, i) =>
        i === idx ? { ...row, [key]: value } : row
      )
    }));
  };

  const handleTypeChange = (value: string): void => {
    if (value === 'Add New') {
      setShowCustomType(true);
      setCustomType('');
    } else {
      setShowCustomType(false);
      handleFormChange('type', value);
    }
  };

  const handleConfigurationChange = (value: string): void => {
    if (value === 'Add New') {
      setShowCustomConfiguration(true);
      setCustomConfiguration('');
    } else {
      setShowCustomConfiguration(false);
      handleFormChange('configuration', value);
    }
  };

  const handleVoltageChange = (value: string): void => {
    if (value === 'Add New') {
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
        const updatedTypes = [...basePumpTypes, newType, 'Add New'];
        setDynamicPumpTypes(updatedTypes);
      }

      setPumpForm((prev) => ({
        ...prev,
        type: [...(prev.type || []), newType]
      }));
      setShowCustomType(false);
      setCustomType('');
    }
  };

  const handleCustomConfigurationSubmit = (): void => {
    if (customConfiguration.trim()) {
      const newConfig = customConfiguration.trim();

      if (!dynamicConfigurations.includes(newConfig)) {
        const updatedConfigs = [...baseConfigurations, newConfig, 'Add New'];
        setDynamicConfigurations(updatedConfigs);
      }

      setPumpForm((prev) => ({
        ...prev,
        configuration: [...(prev.configuration || []), newConfig]
      }));
      setShowCustomConfiguration(false);
      setCustomConfiguration('');
    }
  };

  const handleCustomVoltageSubmit = (): void => {
    if (customVoltage.trim()) {
      const newVoltage = customVoltage.trim();

      if (!dynamicVoltageOptions.includes(newVoltage)) {
        const updatedVoltages = [...baseVoltageOptions, newVoltage, 'Add New'];
        setDynamicVoltageOptions(updatedVoltages);
      }

      handleFormChange('voltage', newVoltage);
      setShowCustomVoltage(false);
      setCustomVoltage('');
    }
  };

  const addDutyPoint = (
    table: 'pvsq' | 'npshr' | 'motorPower' | 'efficiency'
  ): void => {
    setPumpForm((prev) => ({
      ...prev,
      [table]: [
        ...prev[table],
        Object.fromEntries(dutyKeys[table].map((k) => [k, '']))
      ]
    }));
  };

  const removeDutyPoint = (
    table: 'pvsq' | 'npshr' | 'motorPower' | 'efficiency',
    idx: number
  ): void => {
    setPumpForm((prev) => ({
      ...prev,
      [table]: prev[table].filter((_, i) => i !== idx)
    }));
  };

  const handleFileChange = (
    field: 'designSLD' | 'dataSheet' | 'image',
    file: File | null
  ): void => {
    setPumpForm((prev) => ({ ...prev, [field]: file }));

    // Update image preview for new uploads
    if (field === 'image' && file) {
      const newPreview = URL.createObjectURL(file);
      setImagePreview(newPreview);
    } else if (field === 'image' && !file) {
      // Reset to existing image if new file is removed
      if (existingFiles.image) {
        supabase.storage
          .from('pump-assets')
          .createSignedUrl(existingFiles.image, 3600)
          .then(({ data }) => {
            if (data) setImagePreview(data.signedUrl);
          });
      } else {
        setImagePreview(null);
      }
    }
  };

  const uploadToSupabase = async (
    file: File,
    path: string
  ): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('pump-assets')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return data.path;
  };

  const deleteOldFile = async (filePath: string): Promise<void> => {
    const { error } = await supabase.storage
      .from('pump-assets')
      .remove([filePath]);
    if (error) {
      console.warn('Failed to delete old file:', error);
    }
  };

  const handleUpdatePump = async (): Promise<void> => {
    if (!user?.id || !pumpId) {
      toast.error('User not authenticated or pump ID missing');
      return;
    }

    setUploading(true);
    try {
      // Handle file uploads
      const uploads: UploadedFiles = {};
      for (const key of ['designSLD', 'dataSheet', 'image'] as const) {
        if (pumpForm[key]) {
          // New file uploaded
          const file = pumpForm[key] as File;
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${Date.now()}_${key}.${ext}`;

          // Delete old file if it exists
          if (existingFiles[key]) {
            await deleteOldFile(existingFiles[key]);
          }

          uploads[key] = await uploadToSupabase(file, path);
        } else if (existingFiles[key]) {
          // Keep existing file
          uploads[key] = existingFiles[key];
        }
      }

      // Prepare pump data
      const pumpData = {
        brand: pumpForm.brand,
        model: pumpForm.model,
        kw: parseFloat(pumpForm.kw) || 0,
        inlet: parseFloat(pumpForm.inlet) || 0,
        outlet: parseFloat(pumpForm.outlet) || 0,
        voltage: parseFloat(pumpForm.voltage) || 0,
        amps: parseFloat(pumpForm.amps) || 0,
        // Numeric phases kept in sync from Power Source (electrical display / back-compat)
        phases: powerSourceToPhases(pumpForm.powerSource),
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
        design_sld: uploads.designSLD || null,
        data_sheet: uploads.dataSheet || null,
        image: uploads.image || null,
        updated_at: new Date().toISOString(),
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
        installation_configuration: pumpForm.installationConfiguration?.length
          ? pumpForm.installationConfiguration
          : null,
        wetted_materials: pumpForm.wettedMaterials?.length
          ? pumpForm.wettedMaterials
          : null,
        power_source: pumpForm.powerSource || null,
      };

      // Update pump in Supabase
      const { error } = await supabase
        .from('pumps')
        .update(pumpData)
        .eq('id', pumpId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Pump updated successfully!');
      router.push(returnTo);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };


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


  if (!user) {
    return (
      <div className='container mx-auto p-6'>
        <Alert>
          <AlertDescription>
            Please login to edit pump details.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='container mx-auto p-6'>
        <div className='flex items-center justify-center py-8'>
          <div className='border-primary h-8 w-8 animate-spin rounded-full border-b-2'></div>
        </div>
      </div>
    );
  }

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
            <h1 className='text-3xl font-bold'>Edit Pump</h1>
            <p className='text-muted-foreground'>
              Update pump specifications and performance data
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
                  <>
                    {/* Classification Section */}
                    <div className='col-span-2'>
                      <h3 className='mb-4 border-b pb-2 text-lg font-semibold'>
                        Pump Classification
                      </h3>
                    </div>

                    {/* Pump Class - Hierarchical Select */}
                    <div className='space-y-2'>
                      <Label htmlFor='pumpClass'>
                        Pump Class <span className='text-red-500'>*</span>
                      </Label>
                      <MultiSelectFilter
                        label=''
                        options={PUMP_CLASS_OPTIONS}
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

                    {/* Installation Configuration */}
                    <div className='space-y-2'>
                      <Label htmlFor='installationConfiguration'>
                        Installation Configuration
                      </Label>
                      <MultiSelectFilter
                        label=''
                        options={INSTALLATION_CONFIG_OPTIONS}
                        selected={pumpForm.installationConfiguration}
                        onSelectionChange={(selected) =>
                          setPumpForm((prev) => ({
                            ...prev,
                            installationConfiguration: selected
                          }))
                        }
                        placeholder='Select installation...'
                      />
                    </div>

                    {/* Impeller Type */}
                    <div className='space-y-2'>
                      <Label htmlFor='impellerType'>Impeller Type</Label>
                      <Select
                        value={pumpForm.impellerType}
                        onValueChange={(value) =>
                          setPumpForm((prev) => ({
                            ...prev,
                            impellerType: value
                          }))
                        }
                      >
                        <SelectTrigger id='impellerType'>
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
                      <Label htmlFor='poles'>Poles</Label>
                      <Select
                        value={pumpForm.poles?.toString() || ''}
                        onValueChange={(value) =>
                          setPumpForm((prev) => ({
                            ...prev,
                            poles: value ? parseInt(value) : null
                          }))
                        }
                      >
                        <SelectTrigger id='poles'>
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

                    {/* Other Traits - Multi-Select */}
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

                    {/* Power Source */}
                    <div className='space-y-2'>
                      <Label htmlFor='powerSource'>Power Source</Label>
                      <Select
                        value={pumpForm.powerSource || ''}
                        onValueChange={(value) =>
                          setPumpForm((prev) => ({ ...prev, powerSource: value }))
                        }
                      >
                        <SelectTrigger id='powerSource'>
                          <SelectValue placeholder='Select power source...' />
                        </SelectTrigger>
                        <SelectContent>
                          {POWER_SOURCE_OPTIONS.map((ps) => (
                            <SelectItem key={ps} value={ps}>
                              {ps}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className='text-muted-foreground text-xs'>
                        Poles only apply to electric pumps — leave blank for
                        engine-driven.
                      </p>
                    </div>

                    {/* Wetted Materials - Multi-Select */}
                    <div className='col-span-2 space-y-2'>
                      <Label>Wetted Materials</Label>
                      <MultiSelectFilter
                        label=''
                        options={WETTED_MATERIALS_OPTIONS}
                        selected={pumpForm.wettedMaterials}
                        onSelectionChange={(selected) =>
                          setPumpForm((prev) => ({
                            ...prev,
                            wettedMaterials: selected
                          }))
                        }
                        placeholder='Select wetted materials...'
                      />
                    </div>

                    {/* Min Temperature - NEW FIELD */}
                    <div className='space-y-2'>
                      <Label htmlFor='minTemp'>Min Temperature (°C)</Label>
                      <Input
                        id='minTemp'
                        type='number'
                        step='1'
                        placeholder='e.g., 0'
                        value={pumpForm.minTemp ?? ''}
                        onChange={(e) =>
                          setPumpForm((prev) => ({
                            ...prev,
                            minTemp: e.target.value
                              ? parseFloat(e.target.value)
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

                  </>

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
                            {voltage === 'Add New' ? voltage : `${voltage}V`}
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
                </CardContent>
              </Card>
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
                    {existingFiles.designSLD && (
                      <p className='text-muted-foreground text-sm'>
                        Current: {existingFiles.designSLD.split('/').pop()}
                      </p>
                    )}
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
                      <p className='text-sm text-green-600'>
                        New file selected: {pumpForm.designSLD.name}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='dataSheet'>Data Sheet (PDF)</Label>
                    {existingFiles.dataSheet && (
                      <p className='text-muted-foreground text-sm'>
                        Current: {existingFiles.dataSheet.split('/').pop()}
                      </p>
                    )}
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
                      <p className='text-sm text-green-600'>
                        New file selected: {pumpForm.dataSheet.name}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='image'>Pump Image</Label>
                    {existingFiles.image && (
                      <p className='text-muted-foreground text-sm'>
                        Current: {existingFiles.image.split('/').pop()}
                      </p>
                    )}
                    <Input
                      id='image'
                      type='file'
                      accept='image/*'
                      onChange={(e) =>
                        handleFileChange('image', e.target.files?.[0] || null)
                      }
                    />
                    {pumpForm.image && (
                      <p className='text-sm text-green-600'>
                        New file selected: {pumpForm.image.name}
                      </p>
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
              {imagePreview ? (
                <img
                  src={imagePreview}
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
                      pumpForm.designSLD || existingFiles.designSLD,
                      pumpForm.dataSheet || existingFiles.dataSheet,
                      pumpForm.image || existingFiles.image
                    ].filter(Boolean).length
                  }
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            className='w-full'
            onClick={handleUpdatePump}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Updating Pump...
              </>
            ) : (
              'Update Pump'
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

export default EditPump;
