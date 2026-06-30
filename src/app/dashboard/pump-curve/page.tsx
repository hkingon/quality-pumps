import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Suspense } from 'react';
import { PumpCurveDashboard } from '@/features/npsh-curve/components/curve-dashboard';
import { GuestBanner } from '@/components/auth/guest-banner';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Dashboard: Pump Curve Generator'
};

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        {!user && <GuestBanner />}
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
