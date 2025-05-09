import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Message, Channel, UserMetadata } from '@/interfaces/IHome';

export const useMessages = (selectedChannel: Channel | null, currentUser: UserMetadata | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (channelId: string) => {
    if (!channelId) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender_id,
        channel_id,
        profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(`Error fetching messages for channel ${channelId}:`, error);
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    const formattedMessages: Message[] = data?.map((msg: any) => ({
      ...msg,
      profiles: msg.profiles || null
    })) || [];

    setMessages(formattedMessages);
    setMessagesLoading(false);
  }, []);

  const handleSendMessage = async (newMessage: string) => {
    if (!newMessage.trim() || !selectedChannel?.id || !currentUser?.id) {
      return;
    }

    const messageContent = newMessage.trim();
    const channelId = selectedChannel.id;
    const senderId = currentUser.id;
    const timestamp = new Date().toISOString();

    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: messageContent,
      created_at: timestamp,
      sender_id: senderId,
      channel_id: channelId,
      profiles: {
        id: senderId,
        full_name: currentUser.full_name,
        avatar_url: currentUser.avatar_url,
      },
      user_metadata: {
        id: senderId,
        full_name: currentUser.full_name,
        avatar_url: currentUser.avatar_url,
      }
    };

    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        content: messageContent,
        channel_id: channelId,
        sender_id: senderId,
      })
      .select('id')
      .single();

    if (messageError) {
      console.error("Error inserting message into DB:", messageError);
      alert(`Failed to send message: ${messageError.message}`);
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
    } else {
      const { error: channelUpdateError } = await supabase
        .from('channels')
        .update({
          last_message: messageContent,
          last_message_at: timestamp,
        })
        .eq('id', channelId);

      if (channelUpdateError) {
        console.error("Error updating channel last message:", channelUpdateError);
      }
    }
  };

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id);
    } else {
      setMessages([]);
    }
  }, [selectedChannel, fetchMessages]);

  useEffect(() => {
    if (!selectedChannel?.id || !currentUser) {
      return;
    }

    const subscription = supabase
      .channel(`messages_channel_${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, (payload) => {
        if (payload.new.sender_id === currentUser.id) {
          const isOptimisticallyAdded = messages.some(msg => msg.id === payload.new.id || msg.id.startsWith('temp-'));
          if (isOptimisticallyAdded) {
            setMessages(prevMessages => prevMessages.map(msg =>
              msg.id.startsWith('temp-') && msg.content === payload.new.content && msg.sender_id === payload.new.sender_id && msg.created_at.substring(0, 16) === payload.new.created_at.substring(0, 16)
                ? { ...msg, id: payload.new.id, created_at: payload.new.created_at, user_metadata: payload.new.profiles || msg.profiles, profiles: payload.new.profiles || msg.profiles }
                : msg
            ));
            return;
          }
        }

        supabase
          .from('messages')
          .select(`
            *,
            profiles (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('id', payload.new.id)
          .single()
          .then(({ data: newMessageData, error }) => {
            if (error) {
              console.error("Error fetching new message for realtime update:", error);
              return;
            }
            if (newMessageData) {
              const formattedMessage: Message = {
                ...newMessageData,
                profiles: newMessageData.profiles || null
              };
              setMessages((prevMessages) => [...prevMessages, formattedMessage]);
            }
          })
          //@ts-ignore
          .catch(catchError => {
            console.error("Catch block error fetching/processing new message:", catchError);
          });
      })
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [selectedChannel?.id, currentUser, messages]);

  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return {
    messages,
    messagesLoading,
    messagesEndRef,
    handleSendMessage
  };
}; 