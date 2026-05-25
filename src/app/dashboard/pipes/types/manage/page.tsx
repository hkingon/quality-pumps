import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import ManagePipeTypes from '@/features/pipes/pipe-types';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Manage Pipe Types',
};

export default async function Page() {
  return (
    <PageContainer>
      <div className="flex flex-1 flex-col space-y-6">
        <Heading
          title="Manage Pipe Types"
          description="Admin-only page to add, edit, or remove pipe material types and standards."
        />
        <Separator />
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
          <ManagePipeTypes />
        </Suspense>
      </div>
    </PageContainer>
  );
}
