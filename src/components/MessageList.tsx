import Image from 'next/image';
import { Message, Channel, UserMetadata, MessageListProps } from '@/interfaces/IHome';
import React, { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Download } from 'lucide-react';

const isImageUrl = (url: string) => {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
};

const isUrl = (text: string) => {
    try {
        new URL(text);
        return true;
    } catch (_) {
        return false;
    }
}

const MessageContent = ({ content }: { content: string }) => {
  if (isUrl(content)) {
    if (isImageUrl(content)) {
      return (
        <a href={content} target="_blank" rel="noopener noreferrer">
          <Image
            src={content}
            alt="Imagem enviada"
            width={300}
            height={200}
            className="rounded-lg object-cover mt-2"
          />
        </a>
      );
    }

    return (
      <a
        href={content}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-pink-300 hover:underline"
      >
        <Download size={16} />
        <span>Arquivo (clique para ver)</span>
      </a>
    );
  }

  return <p className="text-sm">{content}</p>;
};


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

  if (messagesLoading) { /* ... */ }
  if (!selectedChannel) { /* ... */ }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
      {messages.map((msg: any) => {
        const isMe = msg.sender_id === currentUser?.id;
        const senderProfile = selectedChannel!.members?.find(
          //@ts-ignore
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
              <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0">
                {senderProfile?.avatar_url ? (
                  <Image
                    src={senderProfile.avatar_url}
                    alt={senderProfile.full_name || 'Avatar'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : null}
              </div>
            )}
            
            <div
              className={`max-w-xs p-3 rounded-lg ${isMe
                ? 'bg-pink-600 text-white rounded-br-none'
                : 'bg-[#3a3a3a] text-white rounded-bl-none'
              } shadow-md`}
              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
            >
              {!isMe && selectedChannel!.members && selectedChannel!.members.length > 2 && (
                <p className="text-sm font-semibold mb-1 text-pink-300">
                  {senderProfile?.full_name || 'Unknown User'}
                </p>
              )}
              
              <MessageContent content={msg.content} />

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