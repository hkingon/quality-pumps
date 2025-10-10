import { Metadata } from 'next';
// import SignUpViewPage from '@/features/auth/components/sign-up-view';
// import { SignUpView } from '@/components/sign-up-view';
// import { ForgotPasswordView } from '@/components/password-forgot-view';
import { ResetPasswordView } from '@/components/reset-password-view';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page for authentication.'
};

export default async function Page() {
  return <ResetPasswordView />;
}
