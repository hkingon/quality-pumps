import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import BasicRainwaterCalculator from '@/features/rainwater-runoff/basic';
import { Suspense } from 'react';
import rainfallData from '@/data/rainfallAUData.json';

export const metadata = {
    title: 'Dashboard: (Basic) Rain-Water Run-Off Calculator',
};

export default async function Page() {
    return (
        <PageContainer>
            <div className="flex flex-1 flex-col space-y-6">
                <Heading
                    title="(Basic) Rain-Water Run-Off Calculator"
                    description="Estimate friction loss and system duty for different pipe sizes and types."
                />
                <Separator />
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading calculator...</div>}>
                    <BasicRainwaterCalculator locationsData={rainfallData} />
                </Suspense>
            </div>
        </PageContainer>
    );
}
