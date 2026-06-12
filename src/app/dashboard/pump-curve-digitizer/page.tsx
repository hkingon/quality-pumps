import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Suspense } from 'react';
import PumpCurveDigitizer from '@/features/pump-curve-digitizer/components/curve-digitizer';

export const metadata = {
  title: 'Dashboard: Pump Curve Digitizer'
};

export default async function Page() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <Heading
          title='Pump Curve Digitizer'
          description='Extract pump curve data from images and PDF documents using AI, and save them to spreadsheets.'
        />
        <Separator />
        <Suspense fallback={<div className='text-sm text-muted-foreground'>Loading digitizer interface...</div>}>
          <PumpCurveDigitizer />
        </Suspense>
      </div>
    </PageContainer>
  );
}
