import PageContainer from '@/components/layout/page-container';
import { Separator } from '@/components/ui/separator';
import ManagePumpTypes from '@/features/pumps/pump-types';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Manage Pump Types'
};

export default function Page() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-6'>
        <Separator />
        <Suspense
          fallback={
            <div className='text-muted-foreground text-sm'>
              Loading Pump Type Management Page...
            </div>
          }
        >
          <ManagePumpTypes />
        </Suspense>
      </div>
    </PageContainer>
  );
}
