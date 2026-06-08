import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import AdvancedRainwaterRunOffCalculator from '@/features/rainwater-runoff/advance';
import { Suspense } from 'react';

export const metadata = {
    title: 'Dashboard: Hyetograph-Based Rainfall-Runoff and Detention Routing',
};

export default async function Page() {
    return (
        <PageContainer>
            <div className="flex flex-1 flex-col space-y-6">
                <Heading
                    title="Hyetograph-Based Rainfall-Runoff and Detention Routing"
                    description="This tool is designed for engineers to perform a detailed runoff/detention assessment based on a hyetograph model. It calculates time of concentration, rainfall event intensity, hyetograph creation, and pump capacity comparison."
                />
                <Separator />
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading calculator...</div>}>
                    <AdvancedRainwaterRunOffCalculator/>
                </Suspense>
            </div>
        </PageContainer>
    );
}
