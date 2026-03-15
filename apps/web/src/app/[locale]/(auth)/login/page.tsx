'use client';

import { LoginForm } from '@/components/auth/LoginForm';
import { useRouter } from '@/i18n/routing';

export default function LoginPage() {
  const router = useRouter();

  function handleSuccess() {
    router.replace('/');
  }

  return <LoginForm onSuccess={handleSuccess} />;
}
