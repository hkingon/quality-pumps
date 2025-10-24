'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Eye,
  AlertCircle,
  Globe,
  User
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { toast } from 'sonner';
import { CSVImportDialog } from '@/components/csv-import-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PumpDetailView from './pump-details-view';

// Define interfaces
interface DutyPoint {
  head: number;
  flow: number;
}
interface EfficiencyDutyPoint {
  eff: number;
  flow: number;
}

interface MotorPowerPoint {
  kw: number;
  flow: number;
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
  efficiency: EfficiencyDutyPoint[];
  motor_power: MotorPowerPoint[];
  design_sld: string | null;
  data_sheet: string | null;
  image: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

const PumpLibraryPage: React.FC = () => {
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [publicPumps, setPublicPumps] = useState<Pump[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('my-pumps');
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  const [selectedPumpId, setSelectedPumpId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const router = useRouter();
  const { user, profile } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Fetch user's pumps from Supabase
  const fetchMyPumps = async (): Promise<void> => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPumps(data || []);
    } catch (error) {
      console.error('Error fetching pumps:', error);
      toast.error('Failed to fetch your pumps');
    }
  };

  // Fetch public pumps from Supabase
  const fetchPublicPumps = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('teh public Pumps::', data);

      setPublicPumps(data || []);
    } catch (error) {
      console.error('Error fetching public pumps:', error);
      toast.error('Failed to fetch public pumps');
    }
  };

  // Load pumps on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (user?.id) {
        await fetchMyPumps();
      }
      await fetchPublicPumps();
      setLoading(false);
    };

    loadData();
  }, [user?.id]);

  // Get current pumps based on active tab
  const getCurrentPumps = () => {
    return activeTab === 'my-pumps' ? pumps : publicPumps;
  };

  // Filtering logic
  const currentPumps = getCurrentPumps();
  const brands = [...new Set(currentPumps.map((p) => p.brand))];
  const filteredPumps = currentPumps.filter((pump) => {
    const matchSearch =
      pump.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pump.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBrand =
      filterBrand === 'all' ? true : pump.brand === filterBrand;
    return matchSearch && matchBrand;
  });

  // Toggle public status (admin only)
  const handleTogglePublic = async (
    pumpId: string,
    currentStatus: boolean
  ): Promise<void> => {
    if (!isAdmin) {
      toast.error('Only admins can change public status');
      return;
    }

    setToggleLoading(pumpId);
    try {
      const { error } = await supabase
        .from('pumps')
        .update({ is_public: !currentStatus })
        .eq('id', pumpId);

      if (error) throw error;

      // Update local state
      setPumps(
        pumps.map((p) =>
          p.id === pumpId ? { ...p, is_public: !currentStatus } : p
        )
      );

      // Refresh public pumps
      await fetchPublicPumps();

      toast.success(
        `Pump ${!currentStatus ? 'made public' : 'made private'} successfully`
      );
    } catch (error) {
      console.error('Error toggling public status:', error);
      toast.error('Failed to update pump status');
    } finally {
      setToggleLoading(null);
    }
  };

  // Delete pump
  const handleDeletePump = async (pumpId: string): Promise<void> => {
    const pumpToDelete = pumps.find((p) => p.id === pumpId);
    if (!pumpToDelete || pumpToDelete.user_id !== user?.id) {
      toast.error('You can only delete your own pumps');
      return;
    }

    setDeleteLoading(pumpId);
    try {
      // First, get the pump data to check for files
      const { data: pumpData, error: fetchError } = await supabase
        .from('pumps')
        .select('design_sld, data_sheet, image')
        .eq('id', pumpId)
        .single();

      if (fetchError) throw fetchError;

      // Delete associated files from storage
      type PumpFileFields = 'design_sld' | 'data_sheet' | 'image';
      const fileFields: PumpFileFields[] = [
        'design_sld',
        'data_sheet',
        'image'
      ];

      for (const field of fileFields) {
        if (pumpData[field]) {
          const { error: storageError } = await supabase.storage
            .from('pump-assets')
            .remove([pumpData[field]]);

          if (storageError) {
            console.warn(`Failed to delete ${field}:`, storageError);
          }
        }
      }

      // Delete pump record
      const { error } = await supabase.from('pumps').delete().eq('id', pumpId);

      if (error) throw error;

      // Update local state
      setPumps(pumps.filter((p) => p.id !== pumpId));
      // Also refresh public pumps in case this pump was public
      await fetchPublicPumps();

      toast.success('Pump deleted successfully');
    } catch (error) {
      console.error('Error deleting pump:', error);
      toast.error('Failed to delete pump');
    } finally {
      setDeleteLoading(null);
    }
  };

  // const handleViewPump = (pumpId: string): void => {
  //   router.push(`/dashboard/pumps/${pumpId}`);
  // };
  const handleViewPump = (pumpId: string): void => {
    setSelectedPumpId(pumpId);
    setIsDetailsModalOpen(true);
  };

  // Navigate to edit pump
  const handleEditPump = (pumpId: string): void => {
    const pump = pumps.find((p) => p.id === pumpId);
    if (!pump || pump.user_id !== user?.id) {
      toast.error('You can only edit your own pumps');
      return;
    }
    router.push(`/dashboard/pumps/edit/${pumpId}`);
  };

  // CSV Export
  const handleExportCSV = (): void => {
    const currentPumps = getCurrentPumps();
    if (currentPumps.length === 0) {
      toast.error('No pumps to export');
      return;
    }

    const headers = [
      'Brand',
      'Model',
      'KW',
      'Inlet(mm)',
      'Outlet(mm)',
      'Configuration',
      'Type',
      'Voltage',
      'Amps',
      'Phases',
      'MaxTemp',
      'Public',
      'PvsQ',
      'NPSHr',
      'MotorPower',
      'Efficiency'
    ];

    // Helper function to escape CSV values
    const escapeCSVValue = (value: any): string => {
      if (value === null || value === undefined) return '';

      const stringValue = String(value);

      // If value contains comma, quotes, or newlines, wrap in quotes and escape existing quotes
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const rows = currentPumps.map((p) => {
      return [
        escapeCSVValue(p.brand),
        escapeCSVValue(p.model),
        escapeCSVValue(p.kw),
        escapeCSVValue(p.inlet),
        escapeCSVValue(p.outlet),
        escapeCSVValue(p.configuration),
        escapeCSVValue(p.type),
        escapeCSVValue(p.voltage),
        escapeCSVValue(p.amps),
        escapeCSVValue(p.phases),
        escapeCSVValue(p.max_temp),
        p.is_public ? 'Yes' : 'No',
        escapeCSVValue(JSON.stringify(p.pvsq)),
        escapeCSVValue(JSON.stringify(p.npshr)),
        escapeCSVValue(JSON.stringify(p.motor_power)),
        escapeCSVValue(JSON.stringify(p.efficiency || []))
      ].join(',');
    });

    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}_pumps_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  if (!user) {
    return (
      <div className='container mx-auto p-6'>
        <Alert>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Please log in to access the pump library.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className='container mx-auto space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Pump Management System</h1>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={handleExportCSV}
            disabled={filteredPumps.length === 0}
          >
            <Download className='mr-2 h-4 w-4' />
            Export CSV
          </Button>
          <CSVImportDialog
            onImportComplete={() => {
              fetchMyPumps();
            }}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='my-pumps' className='flex items-center gap-2'>
            <User className='h-4 w-4' />
            My Pumps ({pumps.length})
          </TabsTrigger>
          <TabsTrigger value='public-pumps' className='flex items-center gap-2'>
            <Globe className='h-4 w-4' />
            Public Library ({publicPumps.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value='my-pumps' className='mt-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>My Pump Library</CardTitle>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {pumps.length} pump{pumps.length !== 1 ? 's' : ''} in your
                    personal library
                  </p>
                </div>
                <Button onClick={() => router.push('/dashboard/pumps/add')}>
                  <Plus className='mr-2 h-4 w-4' />
                  ADD NEW PUMP
                </Button>
              </div>
              <div className='mt-4 flex gap-4'>
                <div className='relative flex-1'>
                  <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
                  <Input
                    placeholder='Search pumps by brand or model...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
                <Select value={filterBrand} onValueChange={setFilterBrand}>
                  <SelectTrigger className='w-[200px]'>
                    <SelectValue placeholder='All Brands' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='border-primary h-8 w-8 animate-spin rounded-full border-b-2'></div>
                </div>
              ) : filteredPumps.length === 0 ? (
                <div className='py-8 text-center'>
                  <p className='text-muted-foreground'>
                    {pumps.length === 0
                      ? 'No pumps in your library yet. Add your first pump to get started!'
                      : 'No pumps match your search criteria.'}
                  </p>
                  {pumps.length === 0 && (
                    <Button
                      className='mt-4'
                      onClick={() => router.push('/dashboard/pumps/add')}
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      Add Your First Pump
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Power (kW)</TableHead>
                      <TableHead>Inlet (mm)</TableHead>
                      <TableHead>Outlet (mm)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Configuration</TableHead>
                      {isAdmin && <TableHead>Public</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPumps.map((pump) => (
                      <TableRow key={pump.id}>
                        <TableCell className='font-medium'>
                          {pump.brand}
                        </TableCell>
                        <TableCell>{pump.model}</TableCell>
                        <TableCell>{pump.kw}</TableCell>
                        <TableCell>{pump.inlet}</TableCell>
                        <TableCell>{pump.outlet}</TableCell>
                        <TableCell>
                          <Badge variant='secondary' className='text-xs'>
                            {pump.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline' className='text-xs'>
                            {pump.configuration}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className='flex items-center space-x-2'>
                              <Checkbox
                                id={`public-${pump.id}`}
                                checked={pump.is_public}
                                disabled={toggleLoading === pump.id}
                                onCheckedChange={() =>
                                  handleTogglePublic(pump.id, pump.is_public)
                                }
                              />
                              <Label
                                htmlFor={`public-${pump.id}`}
                                className='text-xs'
                              >
                                {pump.is_public ? (
                                  <Badge variant='default' className='text-xs'>
                                    <Globe className='mr-1 h-3 w-3' />
                                    Public
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant='secondary'
                                    className='text-xs'
                                  >
                                    <User className='mr-1 h-3 w-3' />
                                    Private
                                  </Badge>
                                )}
                              </Label>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className='flex gap-1'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleViewPump(pump.id)}
                              title='View Details'
                            >
                              <Eye className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleEditPump(pump.id)}
                              title='Edit Pump'
                              disabled={pump.user_id !== user?.id}
                            >
                              <Edit className='h-4 w-4' />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  title='Delete Pump'
                                  disabled={
                                    deleteLoading === pump.id ||
                                    pump.user_id !== user?.id
                                  }
                                >
                                  <Trash2 className='h-4 w-4' />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Pump
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the pump
                                    &quot;{pump.brand} {pump.model}&quot;? This
                                    action cannot be undone and will also delete
                                    any associated files.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePump(pump.id)}
                                    className='bg-destructive hover:bg-destructive/90 text-white'
                                  >
                                    {deleteLoading === pump.id
                                      ? 'Deleting...'
                                      : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='public-pumps' className='mt-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <Globe className='h-5 w-5' />
                    Public Pump Library
                  </CardTitle>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {publicPumps.length} pump
                    {publicPumps.length !== 1 ? 's' : ''} available to all users
                  </p>
                </div>
              </div>
              <div className='mt-4 flex gap-4'>
                <div className='relative flex-1'>
                  <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
                  <Input
                    placeholder='Search public pumps by brand or model...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
                <Select value={filterBrand} onValueChange={setFilterBrand}>
                  <SelectTrigger className='w-[200px]'>
                    <SelectValue placeholder='All Brands' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Brands</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='border-primary h-8 w-8 animate-spin rounded-full border-b-2'></div>
                </div>
              ) : filteredPumps.length === 0 ? (
                <div className='py-8 text-center'>
                  <Globe className='text-muted-foreground mx-auto h-12 w-12' />
                  <p className='text-muted-foreground mt-2'>
                    {publicPumps.length === 0
                      ? 'No public pumps available yet.'
                      : 'No public pumps match your search criteria.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Power (kW)</TableHead>
                      <TableHead>Inlet (mm)</TableHead>
                      <TableHead>Outlet (mm)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Configuration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPumps.map((pump) => (
                      <TableRow key={pump.id}>
                        <TableCell className='font-medium'>
                          {pump.brand}
                        </TableCell>
                        <TableCell>{pump.model}</TableCell>
                        <TableCell>{pump.kw}</TableCell>
                        <TableCell>{pump.inlet}</TableCell>
                        <TableCell>{pump.outlet}</TableCell>
                        <TableCell>
                          <Badge variant='secondary' className='text-xs'>
                            {pump.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline' className='text-xs'>
                            {pump.configuration}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className='flex gap-1'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => handleViewPump(pump.id)}
                              title='View Details'
                            >
                              <Eye className='h-4 w-4' />
                            </Button>
                            <Badge variant='default' className='text-xs'>
                              <Globe className='mr-1 h-3 w-3' />
                              Public
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className='no-scrollbar max-h-[95vh] max-w-[95vw] min-w-[80vw] overflow-y-auto p-0'>
          {selectedPumpId && (
            <PumpDetailView
              pumpId={selectedPumpId}
              onClose={() => setIsDetailsModalOpen(false)}
              isModal={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PumpLibraryPage;
