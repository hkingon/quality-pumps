'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewRow {
  id: string;
  pump_id: string | null;
  pump_name: string | null;
  reason: string;
  old_values: Record<string, unknown> | null;
  suggested: Record<string, unknown> | null;
  status: string;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
}

interface PumpCategoryReviewProps {
  /** Filter + scroll the User Activity Directory to this owner's email. */
  onLocateUser?: (email: string) => void;
}

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
};

// Keys that are noise in the review diff
const HIDDEN_KEYS = new Set(['categories_migrated_at']);

function ValueList({
  title,
  values
}: {
  title: string;
  values: Record<string, unknown> | null;
}) {
  const entries = values
    ? Object.entries(values).filter(([k]) => !HIDDEN_KEYS.has(k))
    : [];
  return (
    <div className='bg-muted/40 rounded-md p-3'>
      <p className='text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide'>
        {title}
      </p>
      {entries.length === 0 ? (
        <p className='text-sm'>—</p>
      ) : (
        <dl className='space-y-1 text-sm'>
          {entries.map(([k, v]) => (
            <div key={k} className='flex flex-wrap gap-x-1'>
              <dt className='text-muted-foreground'>{k}:</dt>
              <dd className='break-words font-medium'>{fmt(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function PumpCategoryReview({ onLocateUser }: PumpCategoryReviewProps) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_pump_category_review');
    if (error) {
      toast.error('Failed to load pump category review queue');
    } else {
      setRows((data as ReviewRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const resolve = async (id: string) => {
    const { error } = await supabase
      .from('pump_category_review')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('Failed to resolve item');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success('Marked resolved');
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <div>
          <CardTitle className='flex items-center gap-2'>
            Pump Category Review
            {rows.length > 0 && <Badge variant='destructive'>{rows.length}</Badge>}
          </CardTitle>
          <CardDescription>
            Pumps flagged by the category migration that need a manual decision.
          </CardDescription>
        </div>
        <Button variant='outline' size='sm' onClick={fetchRows} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className='text-muted-foreground text-sm'>Loading…</p>
        ) : rows.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No open review items. 🎉</p>
        ) : (
          <div className='space-y-4'>
            {rows.map((r) => (
              <div key={r.id} className='rounded-lg border p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='font-semibold'>{r.pump_name || r.pump_id || '—'}</p>
                    <p className='text-muted-foreground mt-0.5 text-sm'>{r.reason}</p>
                    <div className='mt-1 flex items-center gap-1 text-sm'>
                      <span className='text-muted-foreground'>Owner:</span>
                      {r.owner_email && onLocateUser ? (
                        <Button
                          variant='link'
                          className='h-auto p-0 text-sm'
                          onClick={() => onLocateUser(r.owner_email!)}
                          title='Find this user in the directory below'
                        >
                          {r.owner_name || r.owner_email}
                        </Button>
                      ) : (
                        <span className='font-medium'>
                          {r.owner_name || r.owner_email || '—'}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size='sm'
                    variant='outline'
                    className='shrink-0'
                    onClick={() => resolve(r.id)}
                  >
                    <CheckCircle className='mr-1 h-4 w-4' />
                    Resolve
                  </Button>
                </div>
                <div className='mt-3 grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <ValueList title='Before' values={r.old_values} />
                  <ValueList title='Suggested' values={r.suggested} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
