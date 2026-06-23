'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Filter,
  Users,
  Clock,
  Activity,
  HardDrive,
  FileSpreadsheet,
  Eye,
  RefreshCw,
  Wrench,
  CheckCircle,
  XCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { PumpCategoryReview } from './pump-category-review';

interface DashboardUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  disclaimer_agreed_at: string | null;
  hours_this_week: number;
  private_pumps_count: number;
  private_pipe_sizes_count: number;
}

interface UserDetails {
  pumps: Array<{
    id: string;
    brand: string;
    model: string;
    kw: number;
    rpm: number;
    hz: number;
    created_at: string;
  }>;
  pipe_sizes: Array<{
    id: string;
    pipe_type_name: string;
    standard: string | null;
    nominal_size: string;
    internal_diameter_mm: number;
    hazen_williams_c: number;
    created_at: string;
  }>;
  usage_logs: Array<{
    week_start_date: string;
    hours: number;
  }>;
}

export default function AdminViewPage() {
  const searchParams = useSearchParams();
  const isMounted = useRef(false);
  const directoryRef = useRef<HTMLDivElement>(null);

  // Filter + scroll the directory to a specific user (from Pump Category Review).
  const handleLocateUser = (email: string) => {
    setSearchTerm(email);
    setDebouncedSearch(email);
    setCurrentPage(1);
    directoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [aggregatesLoading, setAggregatesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  const [disclaimerFilter, setDisclaimerFilter] = useState(() => searchParams.get('disclaimer') || 'all');
  const [activityFilter, setActivityFilter] = useState(() => searchParams.get('activity') || 'all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(page) ? 1 : page;
  });
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    return isNaN(limit) ? 10 : limit;
  });
  const [totalCount, setTotalCount] = useState(0);

  // Aggregated Statistics State
  const [aggregates, setAggregates] = useState<{
    total_users: number;
    active_this_week: number;
    private_pumps: number;
    private_pipe_sizes: number;
  } | null>(null);

  // Detail Modal State
  const [selectedUser, setSelectedUser] = useState<DashboardUser | null>(null);
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Sync state to URL query parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (disclaimerFilter !== 'all') params.set('disclaimer', disclaimerFilter);
    if (activityFilter !== 'all') params.set('activity', activityFilter);
    if (currentPage !== 1) params.set('page', String(currentPage));
    if (itemsPerPage !== 10) params.set('limit', String(itemsPerPage));

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [debouncedSearch, disclaimerFilter, activityFilter, currentPage, itemsPerPage]);

  // Reset page when filters change (ignoring the initial load to preserve query params page selection)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch, disclaimerFilter, activityFilter, itemsPerPage]);

  // Debounce search term input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const fetchDashboardData = async () => {
    setTableLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_users_dashboard', {
        p_search: debouncedSearch,
        p_disclaimer_filter: disclaimerFilter,
        p_activity_filter: activityFilter,
        p_limit: itemsPerPage,
        p_offset: (currentPage - 1) * itemsPerPage
      });
      if (error) throw error;
      setUsers(data || []);
      const count = data && data.length > 0 ? Number(data[0].total_count) : 0;
      setTotalCount(count);
    } catch (err: any) {
      console.error('Error fetching admin dashboard data:', err);
      toast.error(err.message || 'Failed to load user logs');
    } finally {
      setTableLoading(false);
    }
  };

  const fetchAggregates = async () => {
    setAggregatesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_aggregates');
      if (error) throw error;
      setAggregates(data);
    } catch (err: any) {
      console.error('Error fetching aggregates:', err);
      toast.error('Failed to load dashboard metrics');
    } finally {
      setAggregatesLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    setDetailsLoading(true);
    setDetails(null);
    try {
      const { data, error } = await supabase.rpc('get_admin_user_details', {
        p_user_id: userId
      });
      if (error) throw error;
      setDetails(data);
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      toast.error('Failed to load user detailed reports');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Run only on mount (or manual refresh) for total count cards
  useEffect(() => {
    fetchAggregates();
  }, []);

  // Run whenever search, filter, or page size changes (handles server-side pagination)
  useEffect(() => {
    fetchDashboardData();
  }, [debouncedSearch, disclaimerFilter, activityFilter, currentPage, itemsPerPage]);

  const handleRefresh = async () => {
    await Promise.all([fetchAggregates(), fetchDashboardData()]);
  };

  const handleViewDetails = (user: DashboardUser) => {
    setSelectedUser(user);
    setIsDetailsOpen(true);
    fetchUserDetails(user.user_id);
  };

  // Pagination Calculations
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + users.length;

  // Chart config format
  const chartData = details?.usage_logs
    ? [...details.usage_logs].reverse().map((log) => ({
        week: log.week_start_date,
        hours: log.hours
      }))
    : [];

  return (
    <div className='container mx-auto space-y-8 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Admin Control Center</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            Monitor platform usage, registered users, and custom asset creations.
          </p>
        </div>
        <Button variant='outline' onClick={handleRefresh} disabled={tableLoading || aggregatesLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${(tableLoading || aggregatesLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <PumpCategoryReview onLocateUser={handleLocateUser} />

      {/* Summary Cards */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {/* Total Users */}
        <Card className='shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Users</CardTitle>
            <Users className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {aggregatesLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-8 w-20' />
                <Skeleton className='h-4 w-28' />
              </div>
            ) : (
              <>
                <div className='text-2xl font-bold'>{aggregates?.total_users ?? 0}</div>
                <p className='text-muted-foreground text-xs'>Registered accounts in Database</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className='shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Users This Week</CardTitle>
            <Activity className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            {aggregatesLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-8 w-20' />
                <Skeleton className='h-4 w-28' />
              </div>
            ) : (
              <>
                <div className='text-2xl font-bold'>{aggregates?.active_this_week ?? 0}</div>
                <p className='text-muted-foreground text-xs'>Users with active session time this week</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Private Pumps */}
        <Card className='shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Private Pumps</CardTitle>
            <Wrench className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {aggregatesLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-8 w-20' />
                <Skeleton className='h-4 w-28' />
              </div>
            ) : (
              <>
                <div className='text-2xl font-bold'>{aggregates?.private_pumps ?? 0}</div>
                <p className='text-muted-foreground text-xs'>Private pumps added across all accounts</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Private Pipe Sizes */}
        <Card className='shadow-xs'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Private Pipe Sizes</CardTitle>
            <HardDrive className='text-muted-foreground h-4 w-4' />
          </CardHeader>
          <CardContent>
            {aggregatesLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-8 w-20' />
                <Skeleton className='h-4 w-28' />
              </div>
            ) : (
              <>
                <div className='text-2xl font-bold'>{aggregates?.private_pipe_sizes ?? 0}</div>
                <p className='text-muted-foreground text-xs'>Custom pipe sizes created by users</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className='shadow-xs scroll-mt-4' ref={directoryRef}>
        <CardHeader>
          <CardTitle>User Activity Directory</CardTitle>
          <CardDescription>
            Search, filter, and drill down into individual user statistics and usage.
          </CardDescription>
          {/* Controls */}
          <div className='mt-4 flex flex-col gap-4 sm:flex-row'>
            <div className='relative flex-1'>
              <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
              <Input
                placeholder='Search users by name or email...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>
            <Select value={disclaimerFilter} onValueChange={setDisclaimerFilter}>
              <SelectTrigger className='w-[190px]'>
                <SelectValue placeholder='Disclaimer Agreement' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Agreement Statuses</SelectItem>
                <SelectItem value='agreed'>Agreed to Terms</SelectItem>
                <SelectItem value='not_agreed'>Not Agreed Yet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Activity' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Usage Levels</SelectItem>
                <SelectItem value='active'>Active This Week</SelectItem>
                <SelectItem value='inactive'>Inactive This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {tableLoading ? (
            <div className='space-y-4'>
              <div className='border rounded-md overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Name</TableHead>
                      <TableHead>Email Address</TableHead>
                      <TableHead>System Role</TableHead>
                      <TableHead>Disclaimer Agreed</TableHead>
                      <TableHead className='text-center'>Hours (This Week)</TableHead>
                      <TableHead className='text-center'>Private Pumps</TableHead>
                      <TableHead className='text-center'>Private Pipe Sizes</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Skeleton className='h-5 w-28' /></TableCell>
                        <TableCell><Skeleton className='h-5 w-48' /></TableCell>
                        <TableCell><Skeleton className='h-5 w-16' /></TableCell>
                        <TableCell><Skeleton className='h-5 w-24' /></TableCell>
                        <TableCell className='text-center'><Skeleton className='h-5 w-16 mx-auto' /></TableCell>
                        <TableCell className='text-center'><Skeleton className='h-5 w-8 mx-auto' /></TableCell>
                        <TableCell className='text-center'><Skeleton className='h-5 w-8 mx-auto' /></TableCell>
                        <TableCell className='text-right'><Skeleton className='h-8 w-24 ml-auto' /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className='py-12 text-center text-muted-foreground'>
              No users found matching your search and filter criteria.
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='border rounded-md overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Name</TableHead>
                      <TableHead>Email Address</TableHead>
                      <TableHead>System Role</TableHead>
                      <TableHead>Disclaimer Agreed</TableHead>
                      <TableHead className='text-center'>Hours (This Week)</TableHead>
                      <TableHead className='text-center'>Private Pumps</TableHead>
                      <TableHead className='text-center'>Private Pipe Sizes</TableHead>
                      <TableHead className='text-right'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className='font-medium'>
                          {user.full_name || <span className='text-muted-foreground italic'>Not Set</span>}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className='capitalize'>
                            {user.role || 'user'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.disclaimer_agreed_at ? (
                            <div className='flex items-center gap-1.5 text-xs text-green-600 font-medium'>
                              <CheckCircle className='h-4 w-4' />
                              <span>{new Date(user.disclaimer_agreed_at).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <div className='flex items-center gap-1.5 text-xs text-amber-600 font-medium'>
                              <XCircle className='h-4 w-4' />
                              <span>Pending</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='text-center font-bold'>
                          <Badge variant='outline' className='bg-primary/5 border-primary/20 text-primary px-2.5 py-0.5'>
                            {user.hours_this_week} hrs
                          </Badge>
                        </TableCell>
                        <TableCell className='text-center font-semibold'>
                          {user.private_pumps_count}
                        </TableCell>
                        <TableCell className='text-center font-semibold'>
                          {user.private_pipe_sizes_count}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button variant='ghost' size='sm' onClick={() => handleViewDetails(user)}>
                            <Eye className='mr-1.5 h-4 w-4' />
                            View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className='flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row'>
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <span>Showing</span>
                  <span className='font-semibold'>{totalCount === 0 ? 0 : startIndex + 1}</span>
                  <span>to</span>
                  <span className='font-semibold'>{Math.min(endIndex, totalCount)}</span>
                  <span>of</span>
                  <span className='font-semibold'>{totalCount}</span>
                  <span>entries</span>
                </div>
                
                <div className='flex flex-col items-center gap-4 sm:flex-row sm:gap-6'>
                  {/* Items Per Page Selector */}
                  <div className='flex items-center gap-2'>
                    <span className='text-sm text-muted-foreground whitespace-nowrap'>Items per page:</span>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={(val) => {
                        setItemsPerPage(Number(val));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className='h-8 w-[70px]'>
                        <SelectValue placeholder={String(itemsPerPage)} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='5'>5</SelectItem>
                        <SelectItem value='10'>10</SelectItem>
                        <SelectItem value='20'>20</SelectItem>
                        <SelectItem value='50'>50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Page Navigation Buttons */}
                  <div className='flex items-center space-x-1.5'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-8 w-8 p-0'
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      title='First Page'
                    >
                      <ChevronsLeft className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-8 w-8 p-0'
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      title='Previous Page'
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                    <span className='text-xs font-medium px-2 whitespace-nowrap'>
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-8 w-8 p-0'
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      title='Next Page'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-8 w-8 p-0'
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      title='Last Page'
                    >
                      <ChevronsRight className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className='no-scrollbar max-h-[90vh] sm:max-w-5xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='text-2xl font-bold flex items-center gap-2'>
              <span>Activity Profile</span>
              <Separator orientation='vertical' className='h-6' />
              <span className='text-muted-foreground font-normal text-lg'>
                {selectedUser?.full_name || selectedUser?.email}
              </span>
            </DialogTitle>
            <DialogDescription>
              A granular audit of user logs, private pump configurations, and custom hydraulic dimensions.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className='space-y-8 py-4'>
              <div className='grid gap-6 md:grid-cols-3'>
                {/* Profile Card Skeleton */}
                <Card className='md:col-span-1 shadow-none border'>
                  <CardHeader className='pb-3'>
                    <Skeleton className='h-5 w-28' />
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                      <Skeleton className='h-3 w-16' />
                      <Skeleton className='h-4 w-24' />
                    </div>
                    <div className='space-y-2'>
                      <Skeleton className='h-3 w-20' />
                      <Skeleton className='h-4 w-36' />
                    </div>
                    <div className='space-y-2'>
                      <Skeleton className='h-3 w-24' />
                      <Skeleton className='h-5 w-16' />
                    </div>
                    <div className='space-y-2'>
                      <Skeleton className='h-3 w-28' />
                      <Skeleton className='h-4 w-28' />
                    </div>
                  </CardContent>
                </Card>

                {/* Usage Chart Skeleton */}
                <Card className='md:col-span-2 shadow-none border'>
                  <CardHeader className='pb-3'>
                    <div className='flex justify-between items-center'>
                      <div className='space-y-2'>
                        <Skeleton className='h-5 w-32' />
                        <Skeleton className='h-3 w-40' />
                      </div>
                      <Skeleton className='h-6 w-28' />
                    </div>
                  </CardHeader>
                  <CardContent className='pt-2'>
                    <div className='h-[200px] w-full flex items-end justify-between gap-2 px-4'>
                      <Skeleton className='h-[20%] w-full' />
                      <Skeleton className='h-[40%] w-full' />
                      <Skeleton className='h-[30%] w-full' />
                      <Skeleton className='h-[60%] w-full' />
                      <Skeleton className='h-[50%] w-full' />
                      <Skeleton className='h-[80%] w-full' />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Private Pumps List Skeleton */}
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <Skeleton className='h-6 w-48' />
                </div>
                <div className='border rounded-lg overflow-hidden'>
                  <Table>
                    <TableHeader className='bg-muted/50'>
                      <TableRow>
                        <TableHead><Skeleton className='h-4 w-12' /></TableHead>
                        <TableHead><Skeleton className='h-4 w-12' /></TableHead>
                        <TableHead className='text-center'><Skeleton className='h-4 w-16 mx-auto' /></TableHead>
                        <TableHead className='text-center'><Skeleton className='h-4 w-8 mx-auto' /></TableHead>
                        <TableHead className='text-center'><Skeleton className='h-4 w-8 mx-auto' /></TableHead>
                        <TableHead className='text-right'><Skeleton className='h-4 w-16 ml-auto' /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 2 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Skeleton className='h-5 w-16' /></TableCell>
                          <TableCell><Skeleton className='h-5 w-20' /></TableCell>
                          <TableCell className='text-center'><Skeleton className='h-5 w-12 mx-auto' /></TableCell>
                          <TableCell className='text-center'><Skeleton className='h-5 w-8 mx-auto' /></TableCell>
                          <TableCell className='text-center'><Skeleton className='h-5 w-8 mx-auto' /></TableCell>
                          <TableCell className='text-right'><Skeleton className='h-5 w-16 ml-auto' /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Private Pipe Sizes List Skeleton */}
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <Skeleton className='h-6 w-52' />
                </div>
                <div className='border rounded-lg overflow-hidden'>
                  <Table>
                    <TableHeader className='bg-muted/50'>
                      <TableRow>
                        <TableHead><Skeleton className='h-4 w-24' /></TableHead>
                        <TableHead><Skeleton className='h-4 w-16' /></TableHead>
                        <TableHead className='text-center'><Skeleton className='h-4 w-24 mx-auto' /></TableHead>
                        <TableHead className='text-center'><Skeleton className='h-4 w-20 mx-auto' /></TableHead>
                        <TableHead className='text-right'><Skeleton className='h-4 w-16 ml-auto' /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 2 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Skeleton className='h-5 w-28' /></TableCell>
                          <TableCell><Skeleton className='h-5 w-12' /></TableCell>
                          <TableCell className='text-center'><Skeleton className='h-5 w-16 mx-auto' /></TableCell>
                          <TableCell className='text-center'><Skeleton className='h-5 w-12 mx-auto' /></TableCell>
                          <TableCell className='text-right'><Skeleton className='h-5 w-16 ml-auto' /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className='space-y-8 py-4'>
              {/* Profile Card & Usage Chart Grid */}
              <div className='grid gap-6 md:grid-cols-3'>
                {/* Profile Card */}
                <Card className='md:col-span-1 shadow-none border'>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>User Credentials</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4 text-sm'>
                    <div>
                      <div className='text-muted-foreground text-xs font-semibold uppercase tracking-wider'>Full Name</div>
                      <div className='font-medium mt-0.5'>{selectedUser?.full_name || 'Not Set'}</div>
                    </div>
                    <div>
                      <div className='text-muted-foreground text-xs font-semibold uppercase tracking-wider'>Email Address</div>
                      <div className='font-medium mt-0.5 break-all'>{selectedUser?.email}</div>
                    </div>
                    <div>
                      <div className='text-muted-foreground text-xs font-semibold uppercase tracking-wider'>System Access Role</div>
                      <div className='mt-1'>
                        <Badge variant='outline' className='capitalize'>{selectedUser?.role || 'user'}</Badge>
                      </div>
                    </div>
                    <div>
                      <div className='text-muted-foreground text-xs font-semibold uppercase tracking-wider'>Agreement Accepted Date</div>
                      <div className='font-medium mt-0.5'>
                        {selectedUser?.disclaimer_agreed_at ? (
                          new Date(selectedUser.disclaimer_agreed_at).toLocaleString()
                        ) : (
                          <span className='text-amber-600 font-semibold'>Not accepted yet</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Usage Chart */}
                <Card className='md:col-span-2 shadow-none border'>
                  <CardHeader className='pb-3'>
                    <div className='flex justify-between items-center'>
                      <div>
                        <CardTitle className='text-base'>Usage Analysis</CardTitle>
                        <CardDescription className='text-xs'>Active session hours week-by-week</CardDescription>
                      </div>
                      <Badge className='bg-primary text-white'>{selectedUser?.hours_this_week}h logged this week</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className='pt-2'>
                    {chartData.length === 0 ? (
                      <div className='h-[200px] flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-lg'>
                        No weekly session logs logged yet.
                      </div>
                    ) : (
                      <div className='h-[200px] w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray='3 3' vertical={false} />
                            <XAxis
                              dataKey='week'
                              tickFormatter={(val) => {
                                const d = new Date(val);
                                return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                              }}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(value: any) => [`${value} hrs`, 'Active Usage']}
                              labelFormatter={(label) => {
                                const d = new Date(label);
                                return `Week of ${d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
                              }}
                            />
                            <Bar dataKey='hours' fill='var(--primary)' radius={[4, 4, 0, 0]} maxBarSize={45} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Private Pumps List */}
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Wrench className='h-5 w-5 text-muted-foreground' />
                    <span>Added Private Pumps ({details?.pumps?.length || 0})</span>
                  </h3>
                </div>
                {details?.pumps && details.pumps.length > 0 ? (
                  <div className='border rounded-lg overflow-hidden'>
                    <Table>
                      <TableHeader className='bg-muted/50'>
                        <TableRow>
                          <TableHead>Brand</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className='text-center'>Rating (kW)</TableHead>
                          <TableHead className='text-center'>RPM</TableHead>
                          <TableHead className='text-center'>Hz</TableHead>
                          <TableHead className='text-right'>Creation Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.pumps.map((pump) => (
                          <TableRow key={pump.id}>
                            <TableCell className='font-medium'>{pump.brand}</TableCell>
                            <TableCell>{pump.model}</TableCell>
                            <TableCell className='text-center'>{pump.kw} kW</TableCell>
                            <TableCell className='text-center'>{pump.rpm}</TableCell>
                            <TableCell className='text-center'>{pump.hz} Hz</TableCell>
                            <TableCell className='text-right text-muted-foreground text-xs'>
                              {new Date(pump.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className='text-center text-muted-foreground text-sm border-2 border-dashed py-8 rounded-lg'>
                    No private pumps added by this user.
                  </div>
                )}
              </div>

              {/* Private Pipe Sizes List */}
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <HardDrive className='h-5 w-5 text-muted-foreground' />
                    <span>Added Private Pipe Sizes ({details?.pipe_sizes?.length || 0})</span>
                  </h3>
                </div>
                {details?.pipe_sizes && details.pipe_sizes.length > 0 ? (
                  <div className='border rounded-lg overflow-hidden'>
                    <Table>
                      <TableHeader className='bg-muted/50'>
                        <TableRow>
                          <TableHead>Pipe Material/Standard</TableHead>
                          <TableHead>Nominal Size</TableHead>
                          <TableHead className='text-center'>Internal Diameter (mm)</TableHead>
                          <TableHead className='text-center'>Hazen-Williams C</TableHead>
                          <TableHead className='text-right'>Creation Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {details.pipe_sizes.map((size) => (
                          <TableRow key={size.id}>
                            <TableCell className='font-medium'>
                              {size.pipe_type_name.replace(/_/g, ' ').replace(/@/g, '.')}
                              {size.standard && (
                                <span className='ml-2 text-xs text-muted-foreground font-normal border px-1.5 py-0.5 rounded'>
                                  {size.standard}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className='font-semibold'>{size.nominal_size}</TableCell>
                            <TableCell className='text-center'>{size.internal_diameter_mm} mm</TableCell>
                            <TableCell className='text-center'>{size.hazen_williams_c}</TableCell>
                            <TableCell className='text-right text-muted-foreground text-xs'>
                              {new Date(size.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className='text-center text-muted-foreground text-sm border-2 border-dashed py-8 rounded-lg'>
                    No private pipe sizes added by this user.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className='border-t pt-4 mt-4'>
            <Button onClick={() => setIsDetailsOpen(false)}>Close Overview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
