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
          description="Browse pipe sizes by material and standard. Admin users can add and edit pipe sizes for all users."
        />
        <Separator />
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading pipe library...</div>}>
          <PipeLibraryPage />
        </Suspense>
      </div>
    </PageContainer>
  );
}
