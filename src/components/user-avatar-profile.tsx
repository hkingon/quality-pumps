import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserAvatarProfileProps {
  className?: string;
  showInfo?: boolean;
  user: {
    avatar_url?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
}

export function UserAvatarProfile({
  className,
  showInfo = false,
  user
}: UserAvatarProfileProps) {
  const getUserInitials = () => {
    if (user?.full_name) {
      return user.full_name
        .split(' ')
        .map((name) => name[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className='flex items-center gap-2'>
      <Avatar className={className}>
        <AvatarImage src={user?.avatar_url || ''} alt={user?.full_name || ''} />
        <AvatarFallback className='rounded-lg'>
          {getUserInitials()}
        </AvatarFallback>
      </Avatar>

      {showInfo && (
        <div className='grid flex-1 text-left text-sm leading-tight'>
          <span className='truncate font-semibold'>
            {user?.full_name || ''}
          </span>
          <span className='text-muted-foreground truncate text-xs'>
            {user?.email || ''}
          </span>
          {user?.role && (
            <span className='text-muted-foreground truncate text-xs capitalize'>
              {user.role}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
