'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { navItems } from '@/constants/data';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  IconBell,
  IconChevronRight,
  IconChevronsDown,
  IconCreditCard,
  IconLogout,
  IconPhotoUp,
  IconUserCircle
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Icons } from '../icons';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/contexts/auth-context';

export const company = {
  name: 'Quality Pumps',
  logo: IconPhotoUp,
  plan: 'Enterprise'
};

const tenants = [{ id: '1', name: 'Quality Pumps' }];

export default function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const { user, profile, signOut } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin';
  const router = useRouter();

  const activeTenant = tenants[0];

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='group px-4 py-3'>
        <div
          className={cn(
            'transition-all duration-200',
            'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0'
          )}
        >
          <Image
            src='/logo.png'
            alt='Company Logo'
            width={0}
            height={0}
            className='h-auto w-full object-contain'
            sizes='100vw'
            priority
          />
        </div>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              if (item.isAdminOnly && !isAdmin) return null;
              const filteredItems = item.items?.filter(subItem => !subItem.isAdminOnly || isAdmin) || [];
              const Icon = item.icon ? Icons[item.icon] : Icons.logo;
              return filteredItems.length > 0 ? (
                !isOpen ? (
                  <DropdownMenu key={item.title}>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className='cursor-pointer'
                          tooltip={item.title}
                          isActive={pathname === item.url}
                        >
                          {item.icon && <Icon />}
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side='right' align='start'>
                      {filteredItems.map((subItem) => {
                        const SubIcon = subItem.icon
                          ? Icons[subItem.icon]
                          : Icons.logo;
                        return (
                          <DropdownMenuItem
                            key={subItem.title}
                            onClick={() => router.push(subItem.url)}
                            className={
                              pathname === subItem.url
                                ? 'bg-muted cursor-pointer'
                                : 'cursor-pointer'
                            }
                          >
                            {subItem.icon && (
                              <SubIcon className='mr-2 h-4 w-4' />
                            )}
                            {subItem.title}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={item.isActive}
                    className='group/collapsible'
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={pathname === item.url}
                        >
                          {item.icon && <Icon />}
                          <span>{item.title}</span>
                          <IconChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {filteredItems.map((subItem) => {
                            const SubIcon = subItem.icon
                              ? Icons[subItem.icon]
                              : Icons.logo;
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === subItem.url}
                                >
                                  <Link href={subItem.url}>
                                    {subItem.icon && <SubIcon />}
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              ) : (
                item.url !== '#' && (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                  {profile && (
                    <UserAvatarProfile
                      className='h-8 w-8 rounded-lg'
                      showInfo
                      user={profile}
                    />
                  )}
                  <IconChevronsDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                {/* <DropdownMenuLabel className='p-0 font-normal'>
                  <div className='px-1 py-1.5'>
                    {profile && (
                      <UserAvatarProfile
                        className='h-8 w-8 rounded-lg'
                        showInfo
                        user={profile}
                      />
                    )}
                    {profile && (
                      <div className="mt-2 px-2">
                        <div className="font-medium">{profile.full_name}</div>
                        <div className="text-xs text-muted-foreground">{profile.email}</div>
                        <div className="text-xs text-muted-foreground capitalize">{profile.role}</div>
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator /> */}
                {/* <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => router.push('/dashboard/profile')}
                  >
                    <IconUserCircle className='mr-2 h-4 w-4' />
                    Profile
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator /> */}
                <DropdownMenuItem onClick={handleSignOut}>
                  <IconLogout className='mr-2 h-4 w-4' />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
