'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserPlus, X } from 'lucide-react';
import { useState } from 'react';

export function GuestBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className='flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm'>
      <div className='flex items-center gap-2 text-blue-800'>
        <UserPlus className='h-4 w-4 shrink-0' />
        <span>
          You&apos;re using the Pump Curve Generator as a guest. Sign up to save
          your work, access all tools, and download reports.
        </span>
      </div>
      <div className='ml-4 flex shrink-0 items-center gap-2'>
        <Button
          size='sm'
          className='h-7 text-xs'
          onClick={() => router.push('/auth/sign-up')}
        >
          Create Free Account
        </Button>
        <button
          className='text-blue-500 hover:text-blue-700'
          onClick={() => setDismissed(true)}
          aria-label='Dismiss'
        >
          <X className='h-4 w-4' />
        </button>
      </div>
    </div>
  );
}
