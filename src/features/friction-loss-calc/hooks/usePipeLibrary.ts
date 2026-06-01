import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { sortPipeSizesByNominal } from '@/lib/pipe-sort';

export interface PipeTypeOption {
  id: string;
  name: string;
  description: string | null;
  standard: string | null;
}

export interface PipeSizeOption {
  id: string;
  pipe_type_id: string;
  nominal_size: string;
  internal_diameter_mm: number;
  hazen_williams_c: number;
}

export interface PipeLookup {
  type: PipeTypeOption;
  sizes: PipeSizeOption[];
}

export function usePipeLibrary() {
  const [pipeTypes, setPipeTypes] = useState<PipeTypeOption[]>([]);
  const [pipeSizes, setPipeSizes] = useState<PipeSizeOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: types, error: typeErr } = await supabase
        .from('pipe_types')
        .select('id, name, description, standard')
        .order('name', { ascending: true });
      if (typeErr) throw typeErr;

      const { data: sizes, error: sizeErr } = await supabase
        .from('pipe_sizes')
        .select('id, pipe_type_id, nominal_size, internal_diameter_mm, hazen_williams_c')
        .order('nominal_size', { ascending: true });
      if (sizeErr) throw sizeErr;

      setPipeTypes(types || []);
      setPipeSizes(sortPipeSizesByNominal(sizes || []));
    } catch {
      toast.error('Failed to load pipe library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSizesForType = useCallback(
    (typeId: string) => pipeSizes.filter((s) => s.pipe_type_id === typeId),
    [pipeSizes]
  );

  const getPipeData = useCallback(
    (typeId: string, nominalSize: string) => {
      const size = pipeSizes.find(
        (s) => s.pipe_type_id === typeId && s.nominal_size === nominalSize
      );
      if (!size) return { id: 160, c: 150 };
      return { id: size.internal_diameter_mm, c: size.hazen_williams_c };
    },
    [pipeSizes]
  );

  return { pipeTypes, pipeSizes, loading, getSizesForType, getPipeData, refresh: fetchData };
}
