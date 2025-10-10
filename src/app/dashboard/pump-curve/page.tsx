import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Suspense } from 'react';
// import { PumpCurveDashboard } from '@/features/pump-curve/components/curve-dashboard';
import { PumpCurveDashboard } from '@/features/npsh-curve/components/curve-dashboard';

export const metadata = {
  title: 'Dashboard: Pump Curve Generator'
};

export default async function Page() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <Heading
          title='Pump Curve Generator'
          description='Visualize pumps and system curves.'
        />
        <Separator />
        <Suspense fallback={<div>Loading...</div>}>
          <PumpCurveDashboard />
        </Suspense>
      </div>
    </PageContainer>
  );
}
