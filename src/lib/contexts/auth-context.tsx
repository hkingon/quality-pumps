'use client';

import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState
} from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // const supabase = createClient();
  const router = useRouter();

  // const fetchProfile = async (userId: string) => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('profiles')
  //       .select('*')
  //       .eq('id', userId)
  //       .single();

  //     if (error) throw error;
  //     setProfile(data);
  //   } catch (error) {
  //     console.error('Error fetching profile:', error);
  //     setProfile(null);
  //   }
  // };

  const refreshProfile = async () => {
    if (user) {
      // await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');

      // Clear local state first
      setUser(null);
      setProfile(null);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }

      // Force router refresh and redirect
      router.refresh();
      router.push('/auth/sign-in');

      console.log('Successfully signed out');
      toast('Successfully signed out');
    } catch (error) {
      console.error('Sign out failed:', error);
      // Even if there's an error, try to redirect
      router.push('/');
    }
  };

  useEffect(() => {
    let mounted = true;
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          return;
        }

        if (mounted) {
          setUser(session?.user ?? null);

          if (session?.user) {
            // await fetchProfile(session.user.id);
          }

          setLoading(false);
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);

        if (session?.user) {
          // await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        setUser,
        loading,
        signOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
