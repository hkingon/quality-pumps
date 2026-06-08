import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import BasicRainwaterCalculator from '@/features/rainwater-runoff/basic';
import { Suspense } from 'react';
import rainfallData from '@/data/rainfallAUData.json';

export const metadata = {
    title: 'Dashboard: Stormwater Pump Station Design - AS/NZS3500.3',
};

export default async function Page() {
    return (
        <PageContainer>
            <div className="flex flex-1 flex-col space-y-6">
                <Heading
                    title="Stormwater Pump Station Design - AS/NZS3500.3"
                    description="Calculate wet-well active storage and duty pump requirements as per AS/NZS 3500.3 Section 9 compliance."
                />
                <Separator />
                <Suspense fallback={<div className="text-sm text-muted-foreground">Loading calculator...</div>}>
                    <BasicRainwaterCalculator locationsData={rainfallData} />
                </Suspense>
            </div>
        </PageContainer>
    );
}
