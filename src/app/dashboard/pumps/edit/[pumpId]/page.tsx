import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import EditPump from '@/features/pumps/edit-pump';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Edit Pump'
};

export default async function Page() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-6'>
        {/* <Heading
                    title='Edit Pump Details'
                    description='Update specifications, adjust capacities, and manage pump configurations for efficient water system planning.'
                /> */}
        <Separator />
        <Suspense
          fallback={
            <div className='text-muted-foreground text-sm'>
              Loading Pump details...
            </div>
          }
        >
          <EditPump />
        </Suspense>
      </div>
    </PageContainer>
  );
}
