'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import Image from 'next/image';

const TOOL_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/pumps': 'Pump Management',
  '/dashboard/friction-loss-calc': 'Friction Loss Calculator',
  '/dashboard/rain-water-run-off-basic': 'Stormwater Pump Station Design',
  '/dashboard/rain-water-run-off-advanced': 'Hyetograph-Based Rainfall-Runoff Analysis',
  '/dashboard/convertor': 'Unit Converter',
  '/dashboard/npsh-curve': 'NPSH Curve Tool',
  '/dashboard/pipes': 'Pipework Library',
  '/dashboard/admin': 'Admin Console'
};

function AccessRequiredContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = searchParams.get('from') ?? '';

  const toolName = TOOL_LABELS[from] ?? (from ? 'this tool' : 'this page');

  return (
    <div className='bg-background flex min-h-screen flex-col items-center justify-center px-4'>
      <div className='mb-8 w-full max-w-xs'>
        <Image
          src='/logo.png'
          alt='Quality Pumps'
          width={0}
          height={0}
          className='h-auto w-full object-contain'
          sizes='100vw'
          priority
        />
      </div>

      <Card className='w-full max-w-md shadow-lg'>
        <CardHeader className='items-center pb-2 text-center'>
          <div className='bg-primary/10 mb-3 flex h-14 w-14 items-center justify-center rounded-full'>
            <Lock className='text-primary h-7 w-7' />
          </div>
          <CardTitle className='text-xl'>Free account required</CardTitle>
        </CardHeader>

        <CardContent className='space-y-5 text-center'>
          <p className='text-muted-foreground text-sm'>
            Create a free account to access{' '}
            <span className='text-foreground font-semibold'>{toolName}</span>{' '}
            and all other Quality Pumps tools.
          </p>

          <div className='bg-muted rounded-md border px-4 py-3 text-left text-sm'>
            <p className='text-foreground mb-2 font-semibold'>
              What you get for free:
            </p>
            <ul className='text-muted-foreground ml-4 list-disc space-y-1 text-xs'>
              <li>Full access to all hydrology tools</li>
              <li>Save and manage pump curves</li>
              <li>Generate and download PDF reports</li>
              <li>Friction loss and stormwater calculations</li>
            </ul>
          </div>

          <div className='flex flex-col gap-2'>
            <Button className='w-full' onClick={() => router.push('/auth/sign-up')}>
              Create Free Account
            </Button>
            <Button
              variant='outline'
              className='w-full'
              onClick={() =>
                router.push(`/auth/sign-in?redirect=${encodeURIComponent(from)}`)
              }
            >
              Sign In
            </Button>
          </div>

          <p className='text-muted-foreground text-xs'>
            Or{' '}
            <button
              className='text-primary underline underline-offset-2 hover:opacity-80'
              onClick={() => router.push('/dashboard/pump-curve')}
            >
              continue as a guest
            </button>{' '}
            with the Pump Curve Generator
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccessRequiredPage() {
  return (
    <Suspense>
      <AccessRequiredContent />
    </Suspense>
  );
}
