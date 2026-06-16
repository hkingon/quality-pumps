import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminViewPage from '@/features/admin/components/admin-view-page';
import PageContainer from '@/components/layout/page-container';
import { Suspense } from 'react';

export const metadata = {
  title: 'Admin Console | Quality Pumps',
  description: 'Administrator overview of users, usage hours, private pumps, and private pipe sizes.'
};

export default async function Page() {
  const supabase = createClient();
  const { data: { user } } = await (await supabase).auth.getUser();

  if (!user || user.user_metadata?.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <PageContainer>
      <Suspense fallback={
        <div className='flex items-center justify-center min-h-[400px] text-muted-foreground'>
          Loading Admin Panel...
        </div>
      }>
        <AdminViewPage />
      </Suspense>
    </PageContainer>
  );
}
