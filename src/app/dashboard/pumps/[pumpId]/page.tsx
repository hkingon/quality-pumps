import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import PumpDetailView from '@/features/pumps/pump-details-view';
import { Suspense } from 'react';

export const metadata = {
    title: 'Dashboard: View Pump'
};

export default async function Page() {
    return (
        <PageContainer>
            <div className='flex flex-1 flex-col space-y-6'>
                <Heading
                    title="Pump Details"
                    description="View complete specifications, performance metrics, and configuration details for the selected pump."
                />
                <Separator />
                <Suspense
                    fallback={
                        <div className='text-muted-foreground text-sm'>
                            Loading Pump details...
                        </div>
                    }
                >
                    <PumpDetailView />
                </Suspense>
            </div>
        </PageContainer>
    );
}
