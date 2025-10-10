'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ResetPasswordView() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // const supabase = createClient();

  useEffect(() => {
    const handlePasswordReset = async () => {
      // Get the code from URL parameters (PKCE flow)
      const code = searchParams.get('code');

      if (!code) {
        setError(
          'Invalid or expired reset link. Please request a new password reset.'
        );
        return;
      }

      try {
        // Exchange the code for a session using PKCE
        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Code exchange error:', error);
          setError(
            'Invalid or expired reset link. Please request a new password reset.'
          );
          return;
        }

        if (data.session) {
          console.log('Password reset session established successfully');
          // Session is now active and user can reset password
        }
      } catch (err) {
        console.error('Reset link error:', err);
        setError('Failed to verify reset link. Please try again.');
      }
    };

    handlePasswordReset();
  }, [searchParams, supabase.auth]);

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(true);
      toast.success('Password updated successfully!');

      // Redirect to sign in after a short delay
      setTimeout(() => {
        router.push('/auth/sign-in');
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Failed to update password');
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className='bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
        <Card className='w-full max-w-md'>
          <CardHeader className='space-y-1'>
            <div className='mb-4 flex justify-center'>
              <CheckCircle className='h-12 w-12 text-green-500' />
            </div>
            <CardTitle className='text-center text-2xl font-bold'>
              Password Updated!
            </CardTitle>
            <CardDescription className='text-center'>
              Your password has been successfully updated. You will be
              redirected to the sign in page shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-center'>
              <Link
                href='/auth/sign-in'
                className='text-primary inline-flex items-center text-sm hover:underline'
              >
                Continue to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8'>
      <Card className='w-full max-w-md'>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-center text-2xl font-bold'>
            Set new password
          </CardTitle>
          <CardDescription className='text-center'>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <form onSubmit={handleResetPassword} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='password'>New Password</Label>
              <div className='relative'>
                <Input
                  id='password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Enter your new password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>Confirm New Password</Label>
              <div className='relative'>
                <Input
                  id='confirmPassword'
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder='Confirm your new password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            <div className='text-muted-foreground space-y-1 text-xs'>
              <p>Password must contain:</p>
              <ul className='ml-4 space-y-1'>
                <li className={password.length >= 8 ? 'text-green-600' : ''}>
                  • At least 8 characters
                </li>
                <li
                  className={
                    /(?=.*[a-z])/.test(password) ? 'text-green-600' : ''
                  }
                >
                  • One lowercase letter
                </li>
                <li
                  className={
                    /(?=.*[A-Z])/.test(password) ? 'text-green-600' : ''
                  }
                >
                  • One uppercase letter
                </li>
                <li
                  className={/(?=.*\d)/.test(password) ? 'text-green-600' : ''}
                >
                  • One number
                </li>
              </ul>
            </div>

            {error && (
              <Alert variant='destructive'>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type='submit' className='w-full' disabled={loading}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Update Password
            </Button>
          </form>

          <div className='text-center'>
            <Link
              href='/auth/sign-in'
              className='text-primary inline-flex items-center text-sm hover:underline'
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
