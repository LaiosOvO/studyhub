'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useAuthStore } from '@/stores/auth-store';

interface RegisterFormProps {
  readonly onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { register, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    setClientError(null);

    if (password.length < 8) {
      setClientError(t('passwordTooShort'));
      return;
    }

    await register(email, password, fullName);

    const state = useAuthStore.getState();
    if (state.isAuthenticated && onSuccess) {
      onSuccess();
    }
  }

  const displayError = clientError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-center text-2xl font-bold">{t('registerTitle')}</h2>

      {displayError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {displayError}
        </div>
      )}

      <div>
        <label
          htmlFor="register-fullname"
          className="block text-sm font-medium text-gray-700"
        >
          {tc('fullName')}
        </label>
        <input
          id="register-fullname"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="register-email"
          className="block text-sm font-medium text-gray-700"
        >
          {tc('email')}
        </label>
        <input
          id="register-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="block text-sm font-medium text-gray-700"
        >
          {tc('password')}
        </label>
        <input
          id="register-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
        <p className="mt-1 text-xs text-gray-500">{t('passwordTooShort')}</p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? tc('loading') : tc('register')}
      </button>

      <p className="text-center text-sm text-gray-600">
        {t('registerPrompt')}{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          {t('loginLink')}
        </Link>
      </p>
    </form>
  );
}
