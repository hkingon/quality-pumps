'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Globe, User, Save, X } from 'lucide-react';
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { sortPipeSizesByNominal } from '@/lib/pipe-sort';
import { toast } from 'sonner';

interface PipeType {
  id: string;
  name: string;
  description: string | null;
  standard: string | null;
  created_by: string | null;
}

interface PipeSize {
  id: string;
  pipe_type_id: string;
  nominal_size: string;
  internal_diameter_mm: number;
  hazen_williams_c: number;
  created_by: string | null;
}

interface PipeTypeWithSizes extends PipeType {
  sizes: PipeSize[];
}

export default function PipeLibraryPage() {
  const [pipeTypes, setPipeTypes] = useState<PipeTypeWithSizes[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<PipeTypeWithSizes | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [editSizeId, setEditSizeId] = useState<string | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editID, setEditID] = useState('');
  const [editC, setEditC] = useState('');

  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: types, error: typeErr } = await supabase
        .from('pipe_types')
        .select('*')
        .order('name', { ascending: true });
      if (typeErr) throw typeErr;

      const { data: sizes, error: sizeErr } = await supabase
        .from('pipe_sizes')
        .select('*')
        .order('nominal_size', { ascending: true });
      if (sizeErr) throw sizeErr;

      const combined = (types || []).map((t) => ({
        ...t,
        sizes: sortPipeSizesByNominal(
          (sizes || []).filter((s) => s.pipe_type_id === t.id)
        )
      }));
      setPipeTypes(combined);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load pipe library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCurrentTypes = () => pipeTypes;

  const currentTypes = getCurrentTypes();
  const typeNames = [...new Set(currentTypes.map((t) => t.name))];
  const filteredTypes = currentTypes.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.sizes.some((s) => s.nominal_size.includes(searchTerm));
    const matchType = filterType === 'all' ? true : t.name === filterType;
    return matchSearch && matchType;
  });

  const handleDeleteSize = async (sizeId: string) => {
    if (!isAdmin) {
      toast.error('Only admins can delete pipe sizes');
      return;
    }
    setDeleteLoading(sizeId);
    try {
      const { error } = await supabase.from('pipe_sizes').delete().eq('id', sizeId);
      if (error) throw error;
      toast.success('Pipe size deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete pipe size');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleUpdateSize = async (sizeId: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('pipe_sizes')
        .update({
          nominal_size: editNominal.trim(),
          internal_diameter_mm: parseFloat(editID),
          hazen_williams_c: parseFloat(editC)
        })
        .eq('id', sizeId);
      if (error) throw error;
      toast.success('Pipe size updated');
      setEditSizeId(null);
      fetchData();
    } catch {
      toast.error('Failed to update pipe size');
    }
  };

  const handleAddSize = async (typeId: string) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('pipe_sizes').insert({
        pipe_type_id: typeId,
        nominal_size: editNominal.trim(),
        internal_diameter_mm: parseFloat(editID),
        hazen_williams_c: parseFloat(editC),
        created_by: user?.id
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('This nominal size already exists for this pipe type');
        } else {
          throw error;
        }
        return;
      }
      toast.success('Pipe size added');
      setEditNominal('');
      setEditID('');
      setEditC('');
      fetchData();
    } catch {
      toast.error('Failed to add pipe size');
    }
  };

  const startEditSize = (size: PipeSize) => {
    setEditSizeId(size.id);
    setEditNominal(size.nominal_size);
    setEditID(size.internal_diameter_mm.toString());
    setEditC(size.hazen_williams_c.toString());
  };

  const cancelEdit = () => {
    setEditSizeId(null);
    setEditNominal('');
    setEditID('');
    setEditC('');
  };

  if (!user) {
    return (
      <div className='container mx-auto p-6'>
        <Alert>
          <AlertDescription>Please log in to access the pipe library.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className='container mx-auto space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Pipework Library</h1>
        <div className='flex gap-2'>
          {isAdmin && (
            <Button variant='outline' onClick={() => router.push('/dashboard/pipes/types/manage')}>
              Manage Pipe Types
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-1'>
          <TabsTrigger value='all' className='flex items-center gap-2'>
            <Globe className='h-4 w-4' />
            All Pipe Sizes ({pipeTypes.reduce((sum, t) => sum + t.sizes.length, 0)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value='all' className='mt-6'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>Pipe Library</CardTitle>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    Browse pipe sizes by material / standard. Admin users can add and edit sizes.
                  </p>
                </div>
              </div>
              <div className='mt-4 flex gap-4'>
                <div className='relative flex-1'>
                  <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
                  <Input
                    placeholder='Search by type, size, or description...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className='w-[220px]'>
                    <SelectValue placeholder='All Pipe Types' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Pipe Types</SelectItem>
                    {typeNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name.replace(/_/g, ' ').replace(/@/g, '.')}
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
              ) : filteredTypes.length === 0 ? (
                <div className='py-8 text-center'>
                  <p className='text-muted-foreground'>
                    No pipe types found. Admin users can add pipe types via the Manage button.
                  </p>
                </div>
              ) : (
                <div className='space-y-6'>
                  {filteredTypes.map((type) => (
                    <div key={type.id}>
                      <div className='mb-2 flex items-center gap-2'>
                        <h3 className='text-lg font-semibold'>
                          {type.name.replace(/_/g, ' ').replace(/@/g, '.')}
                        </h3>
                        {type.standard && (
                          <Badge variant='outline'>{type.standard}</Badge>
                        )}
                        {isAdmin && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => {
                              setSelectedType(type);
                              setIsDetailsOpen(true);
                            }}
                            className='cursor-pointer'
                          >
                            <Plus className='mr-1 h-4 w-4' />
                            Add Size
                          </Button>
                        )}
                      </div>
                      {type.description && (
                        <p className='text-muted-foreground mb-2 text-sm'>{type.description}</p>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nominal Size</TableHead>
                            <TableHead>Internal Diameter (mm)</TableHead>
                            <TableHead>Hazen-Williams C</TableHead>
                            {isAdmin && <TableHead className='text-right'>Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {type.sizes.map((size) => (
                            <TableRow key={size.id}>
                              <TableCell>
                                {editSizeId === size.id ? (
                                  <Input
                                    value={editNominal}
                                    onChange={(e) => setEditNominal(e.target.value)}
                                    className='w-24'
                                  />
                                ) : (
                                  size.nominal_size
                                )}
                              </TableCell>
                              <TableCell>
                                {editSizeId === size.id ? (
                                  <Input
                                    type='number'
                                    step='0.01'
                                    value={editID}
                                    onChange={(e) => setEditID(e.target.value)}
                                    className='w-24'
                                  />
                                ) : (
                                  size.internal_diameter_mm
                                )}
                              </TableCell>
                              <TableCell>
                                {editSizeId === size.id ? (
                                  <Input
                                    type='number'
                                    step='0.1'
                                    value={editC}
                                    onChange={(e) => setEditC(e.target.value)}
                                    className='w-24'
                                  />
                                ) : (
                                  size.hazen_williams_c
                                )}
                              </TableCell>
                              {isAdmin && (
                                <TableCell className='text-right'>
                                  {editSizeId === size.id ? (
                                    <div className='flex justify-end gap-2'>
                                      <Button size='sm' onClick={() => handleUpdateSize(size.id)}>
                                        <Save className='h-4 w-4' />
                                      </Button>
                                      <Button size='sm' variant='outline' onClick={cancelEdit}>
                                        <X className='h-4 w-4' />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className='flex justify-end gap-2'>
                                      <Button
                                        size='sm'
                                        variant='ghost'
                                        onClick={() => startEditSize(size)}
                                      >
                                        <Edit className='h-4 w-4' />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            size='sm'
                                            variant='ghost'
                                            disabled={deleteLoading === size.id}
                                          >
                                            <Trash2 className='h-4 w-4 text-red-500' />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Pipe Size</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Delete nominal size {size.nominal_size}? This cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteSize(size.id)}
                                              className='bg-destructive text-white hover:bg-destructive/90'
                                            >
                                              {deleteLoading === size.id ? 'Deleting...' : 'Delete'}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Size Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Pipe Size — {selectedType?.name.replace(/_/g, ' ').replace(/@/g, '.')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Nominal Size</Label>
              <Input
                value={editNominal}
                onChange={(e) => setEditNominal(e.target.value)}
                placeholder='e.g. 50'
              />
            </div>
            <div className='space-y-2'>
              <Label>Internal Diameter (mm)</Label>
              <Input
                type='number'
                step='0.01'
                value={editID}
                onChange={(e) => setEditID(e.target.value)}
                placeholder='e.g. 42.4'
              />
            </div>
            <div className='space-y-2'>
              <Label>Hazen-Williams C</Label>
              <Input
                type='number'
                step='0.1'
                value={editC}
                onChange={(e) => setEditC(e.target.value)}
                placeholder='e.g. 147.1'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => { setIsDetailsOpen(false); cancelEdit(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedType && handleAddSize(selectedType.id)}
              disabled={!editNominal || !editID || !editC}
            >
              Add Size
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
