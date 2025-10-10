import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import AddPump from '@/features/pumps/add-pump';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Add Pump'
};

export default function Page() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-6'>
        {/* <Heading
          title='Add New Pump'
          description='Use this form to add a new pump with full specs and performance curves.'
        /> */}
        <Separator />
        <Suspense
          fallback={
            <div className='text-muted-foreground text-sm'>
              Loading Add Pump form...
            </div>
          }
        >
          <AddPump />
        </Suspense>
      </div>
    </PageContainer>
  );
}
