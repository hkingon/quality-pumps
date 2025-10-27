'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  Zap,
  Thermometer,
  Gauge,
  Settings,
  Activity,
  Globe
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';
import PumpCurveChart from './pump-curve-chart';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import PumpHeadFlowChart from '../pump-curve/components/PumpHeadFlowChart';
import EfficiencyChart from '../pump-curve/components/EfficiencyChart';
import MotorPowerChart from '../pump-curve/components/MotorPowerChart';
import { Textarea } from '@/components/ui/textarea';

// Define interfaces
interface DutyPoint {
  head: number;
  flow: number;
}

interface MotorPowerPoint {
  kw: number;
  flow: number;
}

interface EfficiencyPoint {
  eff: string;
  flow: string;
}

interface Pump {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  kw: number;
  inlet: number;
  outlet: number;
  configuration: string;
  type: string;
  voltage: number;
  amps: number;
  phases: number;
  max_temp: number;
  pvsq: DutyPoint[];
  npshr: DutyPoint[];
  motor_power: MotorPowerPoint[];
  efficiency: EfficiencyPoint[];
  design_sld: string | null;
  data_sheet: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  rpm: number;
  hz: number;
}

interface PumpDetailViewProps {
  pumpId?: string;
  onClose?: () => void;
  isModal?: boolean;
}


const PumpDetailView: React.FC<PumpDetailViewProps> = ({ 
  pumpId: propPumpId, 
  onClose, 
  isModal = false 
}) => {
  const [pump, setPump] = useState<Pump | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [saveNotesLoading, setSaveNotesLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const { user, profile } = useAuth();
  const pumpId = propPumpId || (params.pumpId as string);

  // Fetch pump details
  const fetchPump = async (): Promise<void> => {
    if (!user?.id || !pumpId) return;

    setLoading(true);
    try {
      // First try to get the pump (will work for own pumps and public pumps due to RLS policy)
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('id', pumpId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Pump not found or access denied');
          if (isModal && onClose) {
            onClose();
          } else {
            router.push('/dashboard/pumps');
          }
          return;
        }
        throw error;
      }

      // Check if user has access to this pump (either owns it or it's public)
      if (data.user_id !== user.id && !data.is_public) {
        toast.error('Access denied - this pump is private');
        if (isModal && onClose) {
          onClose();
        } else {
          router.push('/dashboard/pumps');
        }
        return;
      }

      setPump(data);

      // Load image if exists
      if (data.image) {
        const { data: imageData } = await supabase.storage
          .from('pump-assets')
          .createSignedUrl(data.image, 3600); // 1 hour expiry

        if (imageData) {
          setImageUrl(imageData.signedUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching pump:', error);
      toast.error('Failed to load pump details');
    } finally {
      setLoading(false);
    }
  };

  // Download file
  const handleDownloadFile = async (
    filePath: string,
    fileName: string
  ): Promise<void> => {
    try {
      const { data, error } = await supabase.storage
        .from('pump-assets')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${fileName} downloaded successfully`);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  // Delete pump
  const handleDeletePump = async (): Promise<void> => {
    if (!pump || !isOwner) {
      toast.error('You can only delete your own pumps');
      return;
    }

    setDeleteLoading(true);
    try {
      // Delete associated files from storage
      const fileFields = [pump.design_sld, pump.data_sheet, pump.image].filter(
        (f): f is string => typeof f === 'string'
      );

      if (fileFields.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('pump-assets')
          .remove(fileFields);

        if (storageError) {
          console.warn('Failed to delete some files:', storageError);
        }
      }

      // Delete pump record
      const { error } = await supabase.from('pumps').delete().eq('id', pump.id);

      if (error) throw error;

      toast.success('Pump deleted successfully');
      if (isModal && onClose) {
        onClose();
      } else {
        router.push('/dashboard/pumps');
      }
    } catch (error) {
      console.error('Error deleting pump:', error);
      toast.error('Failed to delete pump');
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchNotes = async (): Promise<void> => {
    if (!user?.id || !pumpId) return;

    try {
      const { data, error } = await supabase
        .from('pump_notes')
        .select('*')
        .eq('pump_id', pumpId)
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setNotes(data.notes || '');
        setLastUpdated(data.updated_at);
      }
    } catch (error) {
      // Notes don't exist yet, which is fine
    }
  };

  // Save notes
  // Updated save notes function
  const handleSaveNotes = async (): Promise<void> => {
    if (!user?.id || !pumpId) return;

    setSaveNotesLoading(true);
    try {
      // First, try to find existing note
      const { data: existingNote, error: fetchError } = await supabase
        .from('pump_notes')
        .select('id')
        .eq('pump_id', pumpId)
        .eq('user_id', user.id)
        .single();

      const noteData = {
        pump_id: pumpId,
        user_id: user.id,
        notes: notes,
        updated_at: new Date().toISOString()
      };

      let error;

      if (existingNote) {
        // Update existing note
        const { error: updateError } = await supabase
          .from('pump_notes')
          .update(noteData)
          .eq('id', existingNote.id);
        error = updateError;
      } else {
        // Insert new note
        const { error: insertError } = await supabase
          .from('pump_notes')
          .insert(noteData);
        error = insertError;
      }

      if (error) throw error;

      toast.success('Notes saved successfully');
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save notes');
    } finally {
      setSaveNotesLoading(false);
    }
  };

  useEffect(() => {
    fetchPump();
    fetchNotes();
  }, [user?.id, pumpId]);

  const isAdmin = user?.user_metadata?.role === 'admin';
  const isOwner = pump?.user_id === user?.id;

  if (!user) {
    return (
      <div className='container mx-auto p-6'>
        <Alert>
          <AlertDescription>
            Please log in to view pump details.
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

  if (!pump) {
    return (
      <div className='container mx-auto p-6'>
        <Alert>
          <AlertDescription>
            Pump not found or you don&apos;t have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className='container mx-auto space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              if (isModal && onClose) {
                onClose();
              } else {
                router.back();
              }
            }}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            {isModal ? 'Close' : 'Back'}
          </Button>
          <div>
            <h1 className='text-3xl font-bold'>
              {pump.brand} {pump.model}
            </h1>
            <p className='text-muted-foreground'>
              Added on {new Date(pump.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          {pump?.is_public && (
            <Badge variant='default' className='flex items-center gap-1'>
              <Globe className='h-3 w-3' />
              Public
            </Badge>
          )}
          {isOwner && (
            <>
              <Button
                variant='outline'
                onClick={() => router.push(`/dashboard/pumps/edit/${pump.id}`)}
              >
                <Edit className='mr-2 h-4 w-4' />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant='destructive' disabled={deleteLoading}>
                    <Trash2 className='mr-2 h-4 w-4' />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Pump</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{pump.brand}{' '}
                      {pump.model}&quot;? This action cannot be undone and will
                      also delete any associated files.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeletePump}
                      className='bg-destructive hover:bg-destructive/90 text-white'
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Main Info */}
        <div className='lg:col-span-2'>
          <Tabs defaultValue='specifications' className='w-full'>
            <TabsList className='grid w-full grid-cols-4'>
              <TabsTrigger value='specifications'>Specifications</TabsTrigger>
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
                <CardContent className='grid grid-cols-2 gap-4'>
                  <div className='space-y-3'>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Brand
                      </p>
                      <p className='font-semibold'>{pump.brand}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Model
                      </p>
                      <p className='font-semibold'>{pump.model}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Type
                      </p>
                      <Badge variant='secondary'>{pump.type}</Badge>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Configuration
                      </p>
                      <Badge variant='outline'>{pump.configuration}</Badge>
                    </div>
                  </div>
                  <div className='space-y-3'>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Power (kW)
                      </p>
                      <p className='font-semibold'>{pump.kw} kW</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        RPM
                      </p>
                      <p className='font-semibold'>{pump.rpm} RPM</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Inlet (mm)
                      </p>
                      <p className='font-semibold'>{pump.inlet} mm</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Outlet (mm)
                      </p>
                      <p className='font-semibold'>{pump.outlet} mm</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-sm font-medium'>
                        Max Temperature
                      </p>
                      <p className='flex items-center gap-1 font-semibold'>
                        <Thermometer className='h-4 w-4' />
                        {pump.max_temp}°C
                      </p>
                    </div>
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
                <CardContent className='grid grid-cols-3 gap-4'>
                  <div>
                    <p className='text-muted-foreground text-sm font-medium'>
                      Voltage
                    </p>
                    <p className='font-semibold'>{pump.voltage}V</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-sm font-medium'>
                      Frequency
                    </p>
                    <p className='font-semibold'>{pump.hz} Hz</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-sm font-medium'>
                      Current
                    </p>
                    <p className='font-semibold'>{pump.amps}A</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-sm font-medium'>
                      Phases
                    </p>
                    <p className='font-semibold'>{pump.phases} Phase</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='performance' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Head vs Flow Performance Curve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PumpHeadFlowChart
                    pvsqData={pump.pvsq || []}
                    npshrData={pump.npshr || []}
                    className='mb-4'
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Gauge className='h-5 w-5' />
                    Pump Efficiency Curve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EfficiencyChart
                    efficiencyData={pump.efficiency || []}
                    className='mb-4'
                  />
                </CardContent>
              </Card>

              {/* <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Zap className='h-5 w-5' />
                    Motor Power Curve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MotorPowerChart
                    motorPowerData={pump.motor_power || []}
                    className="mb-4"
                  />
                </CardContent>
              </Card> */}

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Activity className='h-5 w-5' />
                    Performance Data (P vs Q)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pump.pvsq && pump.pvsq.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Head (m/head)</TableHead>
                          <TableHead>Flow (L/min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pump.pvsq.map((point, index) => (
                          <TableRow key={index}>
                            <TableCell className='font-medium'>
                              {point.head}
                            </TableCell>
                            <TableCell>{point.flow}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className='text-muted-foreground'>
                      No performance data available
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Gauge className='h-5 w-5' />
                    NPSHR Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pump.npshr && pump.npshr.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NPSHR (m/head)</TableHead>
                          <TableHead>Flow (L/min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pump.npshr.map((point, index) => (
                          <TableRow key={index}>
                            <TableCell className='font-medium'>
                              {point.head}
                            </TableCell>
                            <TableCell>{point.flow}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className='text-muted-foreground'>
                      No NPSHR data available
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Gauge className='h-5 w-5' />
                    Pump Efficiency Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pump.efficiency && pump.efficiency.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Efficiency (η)</TableHead>
                          <TableHead>Flow (L/min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pump.efficiency.map((point, index) => (
                          <TableRow key={index}>
                            <TableCell className='font-medium'>
                              {point.eff}
                            </TableCell>
                            <TableCell>{point.flow}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className='text-muted-foreground'>
                      No pump efficiency data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='motor' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Zap className='h-5 w-5' />
                    Motor Power Curve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MotorPowerChart
                    motorPowerData={pump.motor_power || []}
                    className='mb-4'
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Zap className='h-5 w-5' />
                    Motor Power Curve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pump.motor_power && pump.motor_power.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Power (kW)</TableHead>
                          <TableHead>Flow (L/min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pump.motor_power.map((point, index) => (
                          <TableRow key={index}>
                            <TableCell className='font-medium'>
                              {point.kw}
                            </TableCell>
                            <TableCell>{point.flow}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className='text-muted-foreground'>
                      No motor power data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='files' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <FileText className='h-5 w-5' />
                    Associated Files
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {pump.design_sld && (
                    <div className='flex items-center justify-between rounded-lg border p-3'>
                      <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4' />
                        <span>Design SLD</span>
                      </div>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          handleDownloadFile(pump.design_sld!, 'design.sld')
                        }
                      >
                        <Download className='mr-2 h-4 w-4' />
                        Download
                      </Button>
                    </div>
                  )}

                  {pump.data_sheet && (
                    <div className='flex items-center justify-between rounded-lg border p-3'>
                      <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4' />
                        <span>Data Sheet (PDF)</span>
                      </div>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() =>
                          handleDownloadFile(pump.data_sheet!, 'datasheet.pdf')
                        }
                      >
                        <Download className='mr-2 h-4 w-4' />
                        Download
                      </Button>
                    </div>
                  )}

                  {!pump.design_sld && !pump.data_sheet && (
                    <p className='text-muted-foreground'>No files attached</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Image */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ImageIcon className='h-5 w-5' />
                Pump Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              {imageUrl ? (
                <Dialog>
                  <DialogTrigger>
                    <img
                      src={imageUrl}
                      alt={`${pump.brand} ${pump.model}`}
                      className='h-48 w-full cursor-pointer rounded-lg border object-cover hover:opacity-90'
                    />
                  </DialogTrigger>
                  <DialogContent className='no-scrollbar max-h-[80vh] max-w-[80vw] overflow-auto'>
                    <DialogHeader>
                      <DialogTitle>Pump Image Preview</DialogTitle>
                    </DialogHeader>
                    <img
                      src={imageUrl}
                      alt={`${pump.brand} ${pump.model}`}
                      className='max-h-[70vh] w-full rounded-lg object-contain'
                    />
                  </DialogContent>
                </Dialog>
              ) : (
                <div className='bg-muted flex h-48 w-full items-center justify-center rounded-lg'>
                  <ImageIcon className='text-muted-foreground h-12 w-12' />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Notes */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <FileText className='h-5 w-5' />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {(isOwner || isAdmin) && (
                <div className='space-y-2'>
                  <Label htmlFor='pump-notes'>
                    {isAdmin && pump.is_public
                      ? 'Admin Notes (Public)'
                      : 'Private Notes'}
                  </Label>
                  <Textarea
                    id='pump-notes'
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      isAdmin && pump.is_public
                        ? 'Add notes about this public pump that all users can see...'
                        : 'Add your private notes about this pump...'
                    }
                    rows={4}
                    className='resize-none'
                  />
                  <Button
                    onClick={handleSaveNotes}
                    disabled={saveNotesLoading}
                    size='sm'
                    className='cursor-pointer'
                  >
                    {saveNotesLoading ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
              )}

              {notes && (
                <div className='bg-muted/50 rounded-lg border p-3'>
                  <p className='text-sm whitespace-pre-wrap'>{notes}</p>
                  {lastUpdated && (
                    <p className='text-muted-foreground mt-2 text-xs'>
                      Last updated: {new Date(lastUpdated).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {!notes && !(isOwner || isAdmin) && (
                <p className='text-muted-foreground text-sm'>
                  No notes available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {/* <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>
                  Performance Points
                </span>
                <span className='font-medium'>{pump.pvsq?.length || 0}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>NPSHR Points</span>
                <span className='font-medium'>{pump.npshr?.length || 0}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>
                  Motor Power Points
                </span>
                <span className='font-medium'>
                  {pump.motor_power?.length || 0}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>
                  Pump Efficeincy Points
                </span>
                <span className='font-medium'>
                  {pump.efficiency?.length || 0}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Files Attached</span>
                <span className='font-medium'>
                  {
                    [pump.design_sld, pump.data_sheet, pump.image].filter(
                      Boolean
                    ).length
                  }
                </span>
              </div>
            </CardContent>
          </Card> */}

          {/* <Card className='mt-4 p-4'>
            <Label className='mb-2 font-semibold'>Head vs. Flow Curve</Label>
            <PumpCurveChart data={pump.pvsq} />
          </Card> */}

          {/* <Card className='mt-4'>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className='mb-2 font-semibold block'>Head vs. Flow Curve</Label>
                <PumpHeadFlowChart
                  pvsqData={pump.pvsq || []}
                  npshrData={pump.npshr || []}
                  className="h-48"
                />
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>
    </div>
  );
};

export default PumpDetailView;
