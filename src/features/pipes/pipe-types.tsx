'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { X, Plus, Loader2, Trash2, Edit2, Save, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/contexts/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

interface PipeType {
  id: string;
  name: string;
  description: string | null;
  standard: string | null;
  created_by: string | null;
  created_at: string;
}

export default function ManagePipeTypes() {
  const [pipeTypes, setPipeTypes] = useState<PipeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStandard, setNewStandard] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStandard, setEditStandard] = useState('');

  const { user } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';

  useEffect(() => {
    if (isAdmin) fetchPipeTypes();
  }, [isAdmin]);

  const fetchPipeTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pipe_types')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setPipeTypes(data || []);
    } catch {
      toast.error('Failed to load pipe types');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('pipe_types')
        .insert([
          {
            name: newName.trim(),
            description: newDesc.trim() || null,
            standard: newStandard.trim() || null,
            created_by: user?.id
          }
        ])
        .select()
        .single();
      if (error) {
        if (error.code === '23505') toast.error('This pipe type already exists');
        else throw error;
        return;
      }
      setPipeTypes([...pipeTypes, data]);
      toast.success('Pipe type added');
      setShowAddDialog(false);
      setNewName('');
      setNewDesc('');
      setNewStandard('');
    } catch {
      toast.error('Failed to add pipe type');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('pipe_types')
        .update({ name: editName.trim(), description: editDesc.trim() || null, standard: editStandard.trim() || null })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') toast.error('This name already exists');
        else toast.error(error.message ?? 'Failed to update');
        throw error;
      }
      setPipeTypes((prev) => prev.map((pt) => (pt.id === id ? data : pt)));
      toast.success('Pipe type updated');
      setEditingId(null);
      setEditName('');
      setEditDesc('');
      setEditStandard('');
    } catch {
      console.error('Update error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? All associated sizes will also be deleted.`)) return;
    try {
      setDeleting(id);
      const { error } = await supabase.from('pipe_types').delete().eq('id', id);
      if (error) throw error;
      setPipeTypes((prev) => prev.filter((pt) => pt.id !== id));
      toast.success('Pipe type deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (pt: PipeType) => {
    setEditingId(pt.id);
    setEditName(pt.name);
    setEditDesc(pt.description || '');
    setEditStandard(pt.standard || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setEditStandard('');
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
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='flex items-center gap-2 text-3xl font-bold'>
            <Shield className='h-8 w-8' />
            Manage Pipe Types
          </h1>
          <p className='text-muted-foreground mt-1'>Add, edit, or remove pipe material types and standards.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Add Pipe Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Types ({pipeTypes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pipeTypes.length === 0 ? (
            <div className='text-muted-foreground py-12 text-center'>
              No pipe types found. Click &quot;Add Pipe Type&quot; to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead className='text-right'>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipeTypes.map((pt) => (
                  <TableRow key={pt.id}>
                    <TableCell className='font-medium'>
                      {editingId === pt.id ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className='max-w-[200px]' autoFocus />
                      ) : (
                        pt.name
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === pt.id ? (
                        <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className='max-w-[300px]' />
                      ) : (
                        pt.description || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === pt.id ? (
                        <Input value={editStandard} onChange={(e) => setEditStandard(e.target.value)} className='max-w-[200px]' />
                      ) : (
                        pt.standard || '-'
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        {editingId === pt.id ? (
                          <>
                            <Button size='sm' onClick={() => handleUpdate(pt.id)} disabled={saving}>
                              {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
                            </Button>
                            <Button size='sm' variant='outline' onClick={cancelEdit} disabled={saving}>
                              <X className='h-4 w-4' />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size='sm' variant='ghost' onClick={() => startEdit(pt)}>
                              <Edit2 className='h-4 w-4' />
                            </Button>
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() => handleDelete(pt.id, pt.name)}
                              disabled={deleting === pt.id}
                            >
                              {deleting === pt.id ? (
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Pipe Type</DialogTitle>
            <DialogDescription>
              Create a new pipe material / standard category that will be available to all users.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Name (unique identifier)</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='e.g. PE_PN12@5' />
            </div>
            <div className='space-y-2'>
              <Label>Description</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder='e.g. Polyethylene PN12.5' />
            </div>
            <div className='space-y-2'>
              <Label>Standard</Label>
              <Input value={newStandard} onChange={(e) => setNewStandard(e.target.value)} placeholder='e.g. AS4130-2009' />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowAddDialog(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !newName.trim()}>
              {saving ? <><Loader2 className='mr-2 h-4 w-4 animate-spin' /> Adding...</> : <><Plus className='mr-2 h-4 w-4' /> Add Type</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
