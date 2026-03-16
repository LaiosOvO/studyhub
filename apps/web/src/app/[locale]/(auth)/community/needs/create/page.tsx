'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { NeedForm } from '@/components/community/NeedForm';
import type { ResearchNeedCreate } from '@/lib/api/community';
import { createNeed } from '@/lib/api/community';

export default function CreateNeedPage() {
  const t = useTranslations('community');
  const router = useRouter();

  const handleSubmit = useCallback(
    async (data: ResearchNeedCreate) => {
      const response = await createNeed(data);
      if (response.success) {
        router.push('../needs');
      } else {
        throw new Error(response.error);
      }
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {t('needs.create')}
      </h1>
      <div className="rounded-lg border bg-white p-6">
        <NeedForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
