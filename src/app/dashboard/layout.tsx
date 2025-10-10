// import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
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
  const defaultOpen = cookieStore.get('sidebar:state')?.value === 'true';
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
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
