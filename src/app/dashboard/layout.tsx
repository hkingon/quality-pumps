// import KBar from '@/components/kbar';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { createClient } from '@/lib/supabase/server';
import { ActivityTracker } from '@/components/layout/activity-tracker';
// // import { supabase } from '@/lib/supabase/client';
// import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Quality Pumps',
  description: 'A comprehensive platform for hydrography tools and calculations'
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Persisting the sidebar state in the cookie.
  // const supabase = await createClient();

  //   const {
  //     data: { user }
  // } = await supabase.auth.getUser();

  // console.log("the fnsdfsdnk::", user);

  // if (!user) {
  //   redirect('/auth/sign-in');
  // }
  const cookieStore = await cookies();
  const supabase = createClient(); // Pass cookies for SSR

  const { data: { user } } = await (await supabase).auth.getUser();

  const defaultOpen = cookieStore.get('sidebar:state')?.value === 'true';
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <ActivityTracker />
      <DisclaimerModal userId={user?.id} email={user?.email} />
      <AppSidebar />
      <SidebarInset>
        <Header />
        {/* page main content */}
        {children}
        {/* page main content ends */}
      </SidebarInset>
    </SidebarProvider>
  );
}
