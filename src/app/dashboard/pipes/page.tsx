import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import PipeLibraryPage from '@/features/pipes';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Pipework Library',
};

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex flex-1 flex-col space-y-6">
        <Heading
          title="Pipework Library"
                    description="Browse global pipe sizes, or create and manage your own custom pipe types and sizes."
        />
        <Separator />
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading pipe library...</div>}>
          <PipeLibraryPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
