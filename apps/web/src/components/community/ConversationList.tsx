'use client';

import { useTranslations } from 'next-intl';

import type { ConversationListItem } from '@/lib/api/community';

interface ConversationListProps {
  readonly conversations: readonly ConversationListItem[];
  readonly selectedUserId: string | null;
  readonly onSelect: (userId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function ConversationList({
  conversations,
  selectedUserId,
  onSelect,
}: ConversationListProps) {
  const t = useTranslations('community');

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        {t('messages.noConversations')}
      </div>
    );
  }

  return (
    <div className="max-h-[600px] overflow-y-auto">
      {conversations.map((conv) => {
        const isSelected = selectedUserId === conv.other_user_id;
        const initial = conv.other_user_name.charAt(0).toUpperCase();

        return (
          <button
            key={conv.other_user_id}
            type="button"
            onClick={() => onSelect(conv.other_user_id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${
              isSelected
                ? 'border-l-4 border-blue-500 bg-blue-50'
                : 'border-l-4 border-transparent'
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium text-gray-900">
                  {conv.other_user_name}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatRelativeTime(conv.last_message_at)}
                </span>
              </div>
              <p className="truncate text-xs text-gray-500">
                {conv.last_message.length > 50
                  ? `${conv.last_message.slice(0, 50)}...`
                  : conv.last_message}
              </p>
            </div>
            {conv.unread_count > 0 && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
