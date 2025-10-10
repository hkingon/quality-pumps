import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import FrictionLossPage from '@/features/friction-loss-calc/components/friction-loss-calc-dashboard';
import { Suspense } from 'react';

export const metadata = {
    title: 'Dashboard: Friction Loss Calculator',
};

export default async function Page() {
    return (
        <PageContainer>
            <div className="flex flex-1 flex-col space-y-6">
                <Heading
                    title="Friction Loss Calculator"
                    description="Estimate friction loss and system duty for different pipe sizes and types."
                />
                <Separator />
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading calculator...</div>}>
                    <FrictionLossPage />
                </Suspense>
            </div>
        </PageContainer>
    );
}
