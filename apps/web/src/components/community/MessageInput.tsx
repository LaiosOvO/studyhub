'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

interface MessageInputProps {
  readonly onSend: (content: string) => Promise<void>;
  readonly disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const t = useTranslations('community');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setContent('');
    } finally {
      setSending(false);
    }
  }, [content, sending, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-end gap-2 border-t bg-white p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('messages.placeholder')}
        disabled={disabled || sending}
        rows={1}
        className="max-h-24 min-h-[40px] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || sending || !content.trim()}
        className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {t('messages.send')}
      </button>
    </div>
  );
}
