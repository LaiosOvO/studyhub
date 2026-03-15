'use client';

import { RegisterForm } from '@/components/auth/RegisterForm';
import { useRouter } from '@/i18n/routing';

export default function RegisterPage() {
  const router = useRouter();

  function handleSuccess() {
    router.replace('/');
  }

  return <RegisterForm onSuccess={handleSuccess} />;
}
