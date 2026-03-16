'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ConversationList } from '@/components/community/ConversationList';
import { MessageInput } from '@/components/community/MessageInput';
import { MessageThread } from '@/components/community/MessageThread';
import type { ConversationListItem, MessageItem } from '@/lib/api/community';
import {
  fetchConversation,
  fetchConversations,
  markConversationRead,
  sendMessage,
} from '@/lib/api/community';
import { getAccessToken } from '@/lib/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function MessagesPage() {
  const t = useTranslations('community');
  const searchParams = useSearchParams();
  const toUserId = searchParams.get('to');

  const [conversations, setConversations] = useState<
    readonly ConversationListItem[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    toUserId,
  );
  const [messages, setMessages] = useState<readonly MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetchConversations();
      if (response.success) {
        setConversations(response.data);
      }
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, []);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (otherUserId: string) => {
    try {
      const response = await fetchConversation(otherUserId);
      if (response.success) {
        setMessages(response.data);
      }
      // Mark as read
      await markConversationRead(otherUserId);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedUserId) {
      loadMessages(selectedUserId);
    }
  }, [selectedUserId, loadMessages]);

  // Extract user ID from JWT for message alignment
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.sub || '');
      } catch {
        // Ignore
      }
    }
  }, []);

  // WebSocket connection for real-time messages
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const wsUrl = API_BASE_URL.replace('http', 'ws');
    const ws = new WebSocket(
      `${wsUrl}/api/v1/messages/ws?token=${token}`,
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.sender_id && data.content) {
          // New message received
          if (data.sender_id === selectedUserId) {
            // Append to current thread
            const newMsg: MessageItem = {
              id: data.id,
              sender_id: data.sender_id,
              recipient_id: currentUserId,
              content: data.content,
              read_at: null,
              created_at: data.created_at,
            };
            setMessages((prev) => [newMsg, ...prev]);
          }
          // Refresh conversation list
          loadConversations();
        }
      } catch {
        // Ignore parse errors
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [selectedUserId, currentUserId, loadConversations]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedUserId) return;

      const response = await sendMessage({
        recipient_id: selectedUserId,
        content,
      });

      if (response.success) {
        // Prepend sent message to thread
        setMessages((prev) => [response.data, ...prev]);
        loadConversations();
      }
    },
    [selectedUserId, loadConversations],
  );

  const handleSelectConversation = useCallback((userId: string) => {
    setSelectedUserId(userId);
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">
        {t('messages.title')}
      </h1>

      <div className="flex h-[600px] overflow-hidden rounded-lg border bg-white">
        {/* Left panel: conversations */}
        <div className="w-1/3 border-r">
          <div className="border-b p-3 text-sm font-medium text-gray-700">
            {t('messages.conversations')}
          </div>
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-400">
              Loading...
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedUserId={selectedUserId}
              onSelect={handleSelectConversation}
            />
          )}
        </div>

        {/* Right panel: messages */}
        <div className="flex flex-1 flex-col">
          {selectedUserId ? (
            <>
              <div className="flex-1 overflow-hidden">
                <MessageThread
                  messages={messages}
                  currentUserId={currentUserId}
                />
              </div>
              <MessageInput onSend={handleSend} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              {t('messages.noMessages')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
