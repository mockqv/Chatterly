import Image from 'next/image';
import { Message, Channel, UserMetadata } from '@/interfaces/IHome';
import React, { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface MessageListProps {
  messages: Message[];
  messagesLoading: boolean;
  selectedChannel: Channel | null;
  currentUser: UserMetadata;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList = ({
  messages,
  messagesLoading,
  selectedChannel,
  currentUser,
  messagesEndRef
}: MessageListProps) => {
  useEffect(() => {
    if (!messagesLoading && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesLoading, messagesEndRef]);

  if (messagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Loading messages...
      </div>
    );
  }

  if (!selectedChannel) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a channel from the sidebar to view messages.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
      {messages.map((msg) => {
        const isMe = msg.sender_id === currentUser?.id;
        const senderProfile = selectedChannel.members?.find(
          member => member.user_id === msg.sender_id
        )?.profiles;

        const timestampString = msg.created_at;
        const hasTimeZone = /[+-]\d{2}:\d{2}$|Z$/.test(timestampString);
        const dateToParse = hasTimeZone ? timestampString : timestampString + 'Z';

        const utcDate = parseISO(dateToParse);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localDate = toZonedTime(utcDate, timeZone);
        const localTime = format(localDate, 'HH:mm');

        return (
          <div
            key={msg.id}
            className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-start gap-2`}
          >
            {!isMe && (
              senderProfile?.avatar_url ? (
                <Image
                  src={senderProfile.avatar_url}
                  alt={`${senderProfile.full_name || 'User'}'s Avatar`}
                  width={32}
                  height={32}
                  className="rounded-full object-cover border-2 border-pink-500 flex-shrink-0"
                />
              ) : (
                <div className="flex-shrink-0 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {senderProfile?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )
            )}
            <div
              className={`max-w-xs p-3 rounded-lg ${isMe
                ? 'bg-pink-600 text-white rounded-br-none'
                : 'bg-[#3a3a3a] text-white rounded-bl-none'
              } shadow-md`}
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
            >
              {!isMe && selectedChannel.members && selectedChannel.members.length > 2 && (
                <p className="text-sm font-semibold mb-1 text-pink-300">
                  {senderProfile?.full_name || 'Unknown User'}
                </p>
              )}
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs text-gray-300 mt-1 text-right">
                {localTime}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};