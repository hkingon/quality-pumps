'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import PageContainer from '@/components/layout/page-container';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Droplets,
  Calculator,
  Wrench,
  TrendingUp,
  PlusCircle,
  Activity,
  Zap,
  Gauge,
  Waves,
  CloudRain,
  Scan
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface PumpData {
  id: string;
  maxHead: number;
  maxFlow: number;
  name?: string;
  oldSpeed?: number;
  newSpeed?: number;
  lastModified?: string;
}

interface RecentPipe {
  type: string;
  size: string;
  project: string;
  date: string;
}

export default function DashboardPage() {
  const { profile, user, loading } = useAuth();
  const router = useRouter();
  const [recentPumps, setRecentPumps] = useState<PumpData[]>([]);
  const [recentPipes, setRecentPipes] = useState<RecentPipe[]>([]);
  const [totalPumpCount, setTotalPumpCount] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/sign-in');
    }
  }, [user, loading, router]);

  // useEffect(() => {
  //   // Load recent pumps from localStorage or API
  //   const savedPumps = localStorage.getItem('recentPumps');
  //   if (savedPumps) {
  //     setRecentPumps(JSON.parse(savedPumps).slice(0, 3));
  //   }

  //   // Mock recent pipes data - replace with actual data
  //   setRecentPipes([
  //     {
  //       type: 'PVC PN12',
  //       size: '100mm',
  //       project: 'Commercial Site A',
  //       date: '2025-06-05'
  //     },
  //     {
  //       type: 'PE PN16',
  //       size: '63mm',
  //       project: 'Residential Dev',
  //       date: '2025-06-04'
  //     },
  //     {
  //       type: 'Copper Type B',
  //       size: '25mm',
  //       project: 'Office Building',
  //       date: '2025-06-03'
  //     }
  //   ]);
  // }, []);
  useEffect(() => {
    const fetchRecentPumps = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('pumps')
          .select('id, brand, model, created_at, pvsq')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;

        const formatted = (data || []).map(
          (pump: {
            id: string;
            brand: string;
            model: string;
            created_at: string;
            pvsq: { flow: number; head: number }[];
          }) => {
            const maxHead = pump.pvsq?.reduce(
              (max: number, point: { head: number }) =>
                point.head > max ? point.head : max,
              0
            );

            const maxFlow = pump.pvsq?.reduce(
              (max: number, point: { flow: number }) =>
                point.flow > max ? point.flow : max,
              0
            );

            return {
              id: pump.id,
              name: `${pump.brand} ${pump.model}`,
              maxHead,
              maxFlow,
              lastModified: new Date(pump.created_at).toLocaleDateString()
            };
          }
        );

        setRecentPumps(formatted);

        const { count, error: countError } = await supabase
          .from('pumps')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) throw countError;

        setTotalPumpCount(count ?? 0);
      } catch (err) {
        console.error('Failed to fetch recent pumps:', err);
      }
    };

    fetchRecentPumps();
  }, [user]);

  if (loading) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center'>
        <div className='flex items-center gap-2'>
          <Activity className='h-5 w-5 animate-pulse' />
          Loading dashboard...
        </div>
      </div>
    );
  }

  const isAdmin = user?.user_metadata?.role === 'admin';

  const displayedTools = [
    {
      title: 'Pump Curve Generator',
      description: 'Visualize pump and system curves, and manage saved data',
      icon: Gauge,
      route: '/dashboard/pump-curve',
      color: 'bg-blue-500',
      featured: true
    },
    {
      title: 'Friction Loss Calculator',
      description:
        'Estimate friction loss and system duty for different pipe sizes and types',
      icon: Calculator,
      route: '/dashboard/friction-loss-calc',
      color: 'bg-green-500',
      featured: true
    },
    {
      title: 'Stormwater Pump Station Design - AS/NZS3500.3',
      description:
        'Calculate wet-well active storage and duty pump requirements as per AS/NZS 3500.3 Section 9 compliance',
      icon: CloudRain,
      route: '/dashboard/rain-water-run-off-basic',
      color: 'bg-cyan-500',
      featured: false
    },
    {
      title: 'Hyetograph-Based Rainfall-Runoff and Detention Routing',
      description:
        'Detailed runoff/detention assessment with routing modeling',
      icon: Waves,
      route: '/dashboard/rain-water-run-off-advanced',
      color: 'bg-purple-500',
      featured: true
    },
    ...(isAdmin
      ? [
          {
            title: 'Pump Curve Digitizer',
            description:
              'Extract pump performance curves from images or PDF documents using AI',
            icon: Scan,
            route: '/dashboard/pump-curve-digitizer',
            color: 'bg-indigo-500',
            featured: false
          }
        ]
      : [])
  ];

  return (
    <PageContainer>
      <div className='flex flex-col gap-8'>
        {/* Header */}
        <div>
          <Heading
            title={`Welcome back ${profile?.full_name ? `, ${profile.full_name}!` : ' User'}`}
            description='Access your hydrology tools, manage pump curves, and analyze water systems. Your engineering workspace awaits.'
          />
          <Separator className='mt-4' />
        </div>

        {/* Stats Overview */}
        <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
          <Card>
            <CardContent className='flex items-center gap-4 p-6'>
              <div className='rounded-lg bg-blue-100 p-2'>
                <Gauge className='h-6 w-6 text-blue-600' />
              </div>
              <div>
                <p className='text-2xl font-bold'>
                  {totalPumpCount !== null ? totalPumpCount : '...'}
                </p>
                <p className='text-muted-foreground text-sm'>Saved Pumps</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='flex items-center gap-4 p-6'>
              <div className='rounded-lg bg-green-100 p-2'>
                <Wrench className='h-6 w-6 text-green-600' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{recentPipes.length}</p>
                <p className='text-muted-foreground text-sm'>Recent Pipes</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='flex items-center gap-4 p-6'>
              <div className='rounded-lg bg-purple-100 p-2'>
                <TrendingUp className='h-6 w-6 text-purple-600' />
              </div>
              <div>
                <p className='text-2xl font-bold'>4</p>
                <p className='text-muted-foreground text-sm'>Active Tools</p>
              </div>
            </CardContent>
          </Card>

          {/* <Card>
            <CardContent className='flex items-center gap-4 p-6'>
              <div className='rounded-lg bg-cyan-100 p-2'>
                <Droplets className='h-6 w-6 text-cyan-600' />
              </div>
              <div>
                <p className='text-2xl font-bold'>12</p>
                <p className='text-muted-foreground text-sm'>Projects</p>
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* Main Content Grid */}
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
          {/* Hydrology Tools */}
          <div className='lg:col-span-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Zap className='h-5 w-5' />
                  Hydrology Tools
                </CardTitle>
                <CardDescription>
                  Professional water system analysis and design tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  {displayedTools.map((tool, index) => {
                    const IconComponent = tool.icon;
                    return (
                      <div
                        key={index}
                        className='group relative cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md'
                        onClick={() => router.push(tool.route)}
                      >
                        <div className='flex items-start gap-3'>
                          <div
                            className={`p-2 ${tool.color} rounded-lg text-white`}
                          >
                            <IconComponent className='h-5 w-5' />
                          </div>
                          <div className='flex-1'>
                            <div className='flex items-center gap-2'>
                              <h3 className='group-hover:text-primary text-sm font-semibold transition-colors'>
                                {tool.title}
                              </h3>
                              {tool.featured && (
                                <Badge variant='secondary' className='text-xs'>
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <p className='text-muted-foreground mt-1 line-clamp-2 text-xs'>
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className='space-y-6'>
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <PlusCircle className='h-5 w-5' />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Button
                  className='w-full justify-start'
                  onClick={() => router.push('/dashboard/pumps/add')}
                >
                  <Gauge className='mr-2 h-4 w-4' />
                  Add New Pump
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  onClick={() => router.push('/dashboard/friction-loss-calc')}
                >
                  <Calculator className='mr-2 h-4 w-4' />
                  Calculate Friction Loss
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  onClick={() =>
                    router.push('/dashboard/rain-water-run-off-advanced')
                  }
                >
                  <Waves className='mr-2 h-4 w-4' />
                  Runoff Analysis
                </Button>
              </CardContent>
            </Card>

            {/* Recent Pumps */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Gauge className='h-5 w-5' />
                  Recent Pumps
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentPumps.length > 0 ? (
                  <div className='space-y-3'>
                    {recentPumps.map((pump) => (
                      <div
                        key={pump.id}
                        className='flex items-center justify-between rounded border p-2'
                      >
                        <div className='flex-1'>
                          <p className='text-sm font-medium'>
                            {pump.name || `Pump ${pump.id.slice(0, 8)}`}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {pump.maxHead}m @ {pump.maxFlow}L/s
                          </p>
                        </div>
                        <Badge variant='outline' className='text-xs'>
                          {pump.lastModified || 'Recent'}
                        </Badge>
                      </div>
                    ))}
                    <Button
                      variant='ghost'
                      size='sm'
                      className='w-full'
                      onClick={() => router.push('/dashboard/pumps')}
                    >
                      View All Pumps
                    </Button>
                  </div>
                ) : (
                  <div className='py-4 text-center'>
                    <p className='text-muted-foreground mb-3 cursor-pointer text-sm'>
                      No pumps saved yet
                    </p>
                    <Button
                      size='sm'
                      onClick={() => router.push('/dashboard/pumps')}
                    >
                      <PlusCircle className='mr-2 h-4 w-4' />
                      Add Your First Pump
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Pipes */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Wrench className='h-5 w-5' />
                  Recent Pipe Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {recentPipes.map((pipe, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between rounded border p-2'
                    >
                      <div className='flex-1'>
                        <p className='text-sm font-medium'>
                          {pipe.type} - {pipe.size}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {pipe.project}
                        </p>
                      </div>
                      <Badge variant='outline' className='text-xs'>
                        {pipe.date}
                      </Badge>
                    </div>
                  ))}
                  <Button
                    variant='ghost'
                    size='sm'
                    className='w-full'
                    onClick={() => router.push('/dashboard/friction-loss-calc')}
                  >
                    Analyze New Pipe
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Getting Started */}
        <Card className='border-dashed'>
          <CardContent className='flex items-center justify-between p-6'>
            <div>
              <h3 className='mb-1 font-semibold'>New to Hydrology Analysis?</h3>
              <p className='text-muted-foreground text-sm'>
                Start with our Pump Curve Generator or explore the Friction Loss
                Calculator for quick results.
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/pump-curve')}>
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
