'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { X, Plus, Loader2, Trash2, Edit2, Save, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PumpType {
  id: string;
  name: string;
  category: 'type' | 'configuration' | 'voltage';
  created_by: string;
  created_at: string;
}

const categoryLabels = {
  type: 'Pump Type',
  configuration: 'Configuration',
  voltage: 'Voltage'
};

const categoryColors = {
  type: 'bg-blue-500',
  configuration: 'bg-green-500',
  voltage: 'bg-purple-500'
};

const ManagePumpTypes = () => {
  const [pumpTypes, setPumpTypes] = useState<PumpType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add new type states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState<
    'type' | 'configuration' | 'voltage'
  >('type');

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchPumpTypes();
    }
  }, [isAdmin]);

  const fetchPumpTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pump_types')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setPumpTypes(data || []);
    } catch (err) {
      console.error('Error fetching pump types:', err);
      toast.error('Failed to load pump types');
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async () => {
    if (!newTypeName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('pump_types')
        .insert([
          {
            name: newTypeName.trim(),
            category: newTypeCategory,
            created_by: user?.id
          }
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('This option already exists');
        } else {
          throw error;
        }
        return;
      }

      setPumpTypes([...pumpTypes, data]);
      toast.success('Pump type added successfully');
      setShowAddDialog(false);
      setNewTypeName('');
      setNewTypeCategory('type');
    } catch (err) {
      console.error('Error adding pump type:', err);
      toast.error('Failed to add pump type');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateType = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      setSaving(true);

      // Return the row so we can replace the exact object
      const { data, error } = await supabase
        .from('pump_types')
        .update({ name: editName.trim() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') toast.error('This name already exists');
        else toast.error(error.message ?? 'Failed to update');
        throw error; // abort UI update
      }

      // `data` is the fresh row from the DB
      setPumpTypes((prev) => prev.map((pt) => (pt.id === id ? data : pt)));
      toast.success('Pump type updated');
      setEditingId(null);
      setEditName('');
    } catch (err) {
      console.error('Update error:', err);
      // UI stays in edit mode on error
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      setDeleting(id);

      const { error } = await supabase.from('pump_types').delete().eq('id', id);

      // <-- NEW: any error aborts the optimistic update
      if (error) throw error;

      // Only remove from UI when DB confirmed
      setPumpTypes((prev) => prev.filter((pt) => pt.id !== id));
      toast.success('Pump type deleted');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err?.message ?? 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (pumpType: PumpType) => {
    setEditingId(pumpType.id);
    setEditName(pumpType.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const filteredPumpTypes =
    filterCategory === 'all'
      ? pumpTypes
      : pumpTypes.filter((pt) => pt.category === filterCategory);

  const getCategoryCount = (category: string) => {
    if (category === 'all') return pumpTypes.length;
    return pumpTypes.filter((pt) => pt.category === category).length;
  };

  if (!isAdmin) {
    return (
      <div className='container mx-auto p-6'>
        <Alert variant='destructive'>
          <Shield className='h-4 w-4' />
          <AlertDescription>
            Access Denied. This page is only accessible to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='container mx-auto flex min-h-[400px] items-center justify-center p-6'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  return (
    <div className='container mx-auto space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='flex items-center gap-2 text-3xl font-bold'>
            <Shield className='h-8 w-8' />
            Manage Pump Types
          </h1>
          <p className='text-muted-foreground mt-1'>
            Add, edit, or remove pump types, configurations, and voltage options
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Add New Option
        </Button>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
        <Card
          className='hover:bg-accent cursor-pointer'
          onClick={() => setFilterCategory('all')}
        >
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              Total Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{getCategoryCount('all')}</div>
          </CardContent>
        </Card>

        <Card
          className='hover:bg-accent cursor-pointer'
          onClick={() => setFilterCategory('type')}
        >
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              Pump Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{getCategoryCount('type')}</div>
          </CardContent>
        </Card>

        <Card
          className='hover:bg-accent cursor-pointer'
          onClick={() => setFilterCategory('configuration')}
        >
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              Configurations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {getCategoryCount('configuration')}
            </div>
          </CardContent>
        </Card>

        <Card
          className='hover:bg-accent cursor-pointer'
          onClick={() => setFilterCategory('voltage')}
        >
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>
              Voltages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {getCategoryCount('voltage')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>All Options ({filteredPumpTypes.length})</CardTitle>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className='w-[200px]'>
                <SelectValue placeholder='Filter by category' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Categories</SelectItem>
                <SelectItem value='type'>Pump Types</SelectItem>
                <SelectItem value='configuration'>Configurations</SelectItem>
                <SelectItem value='voltage'>Voltages</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPumpTypes.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center'>
              No pump types found. Click &quot;Add New Option&quot; to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPumpTypes.map((pumpType) => (
                  <TableRow key={pumpType.id}>
                    <TableCell className='font-medium'>
                      {editingId === pumpType.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateType(pumpType.id);
                            }
                          }}
                          className='max-w-[300px]'
                          autoFocus
                        />
                      ) : (
                        pumpType.name
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={categoryColors[pumpType.category]}>
                        {categoryLabels[pumpType.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {new Date(pumpType.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        {editingId === pumpType.id ? (
                          <>
                            <Button
                              size='sm'
                              onClick={() => handleUpdateType(pumpType.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                              ) : (
                                <Save className='h-4 w-4' />
                              )}
                            </Button>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              <X className='h-4 w-4' />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() => startEdit(pumpType)}
                            >
                              <Edit2 className='h-4 w-4' />
                            </Button>
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() =>
                                handleDeleteType(pumpType.id, pumpType.name)
                              }
                              disabled={deleting === pumpType.id}
                            >
                              {deleting === pumpType.id ? (
                                <Loader2 className='h-4 w-4 animate-spin' />
                              ) : (
                                <Trash2 className='h-4 w-4 text-red-500' />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Option</DialogTitle>
            <DialogDescription>
              Create a new pump type, configuration, or voltage option that will
              be available to all users.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='category'>Category</Label>
              <Select
                value={newTypeCategory}
                onValueChange={(value: any) => setNewTypeCategory(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select category' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='type'>Pump Type</SelectItem>
                  <SelectItem value='configuration'>Configuration</SelectItem>
                  <SelectItem value='voltage'>Voltage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder={`Enter ${categoryLabels[newTypeCategory].toLowerCase()}`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddType();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowAddDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleAddType} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Option
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagePumpTypes;
