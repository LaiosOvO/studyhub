'use client';

import { useEffect, useRef } from 'react';

import type { MessageItem } from '@/lib/api/community';

interface MessageThreadProps {
  readonly messages: readonly MessageItem[];
  readonly currentUserId: string;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageThread({ messages, currentUserId }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Reverse to show oldest at top (API returns newest first)
  const chronological = [...messages].reverse();

  return (
    <div className="flex max-h-[500px] flex-col gap-2 overflow-y-auto p-4">
      {chronological.map((msg) => {
        const isSent = msg.sender_id === currentUserId;

        return (
          <div
            key={msg.id}
            className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 ${
                isSent
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p
                className={`mt-1 text-right text-[10px] ${
                  isSent ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
