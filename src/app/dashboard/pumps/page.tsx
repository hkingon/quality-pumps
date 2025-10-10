import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import PumpLibraryPage from '@/features/pumps';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Manage Pumps'
};

export default async function Page() {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-6'>
        {/* <Heading
                    title="(Advanced) Rain-Water Run-Off Calculator"
                    description="This tool is designed for engineers to perform a detailed runoff/detention assessment based on a hydrograph model. It calculates time of concentration, rainfall event intensity, hydrograph creation, and pump capacity comparison."
                /> */}
        {/* <Separator /> */}
        <Suspense
          fallback={
            <div className='text-muted-foreground text-sm'>
              Loading Pumps manager...
            </div>
          }
        >
          <PumpLibraryPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
