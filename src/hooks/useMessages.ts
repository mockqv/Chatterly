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
    } else {
      const formattedMessages: Message[] = data?.map((msg: any) => ({
        ...msg,
        profiles: msg.profiles || null
      })) || [];
      setMessages(formattedMessages);
    }
    setMessagesLoading(false);
  }, []);

  const handleSendMessage = async (newMessage: string | File) => {
    if (!selectedChannel?.id || !currentUser?.id) return;

    let contentToSend = '';
    const channelId = selectedChannel.id;
    const senderId = currentUser.id;
    const tempMessageId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticTimestamp = new Date().toISOString();

    if (newMessage instanceof File) {
      const fileExt = newMessage.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${channelId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, newMessage);

      if (uploadError) {
        alert("Erro ao enviar arquivo.");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('files')
        .getPublicUrl(filePath);

      contentToSend = publicUrlData.publicUrl;
    } else if (typeof newMessage === 'string' && newMessage.trim() !== '') {
      contentToSend = newMessage.trim();
    } else {
      return;
    }

    const optimisticMessage: Message = {
      id: tempMessageId,
      content: contentToSend,
      created_at: optimisticTimestamp,
      sender_id: senderId,
      channel_id: channelId,
      profiles: {
        id: senderId,
        full_name: currentUser.full_name,
        avatar_url: currentUser.avatar_url,
      },
    };

    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert({
        content: contentToSend,
        channel_id: channelId,
        sender_id: senderId,
      })
      .select('id, created_at')
      .single();

    if (messageError) {
      console.error("Error inserting message into DB:", messageError);
      alert(`Failed to send message: ${messageError.message}`);
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
    } else {
      setMessages(prevMessages => prevMessages.map(msg =>
        msg.id === tempMessageId
          ? { ...msg, id: messageData.id, created_at: messageData.created_at }
          : msg
      ));

      const lastMessageText = contentToSend.startsWith('http')
        ? '[Arquivo]'
        : contentToSend.substring(0, 100);

      const { error: channelUpdateError } = await supabase
        .from('channels')
        .update({
          last_message: lastMessageText,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', channelId);

      if (channelUpdateError) {
        console.error("Error updating channel last message:", channelUpdateError);
      }
    }
  };

  useEffect(() => {
    if (selectedChannel?.id) {
      fetchMessages(selectedChannel.id);
    } else {
      setMessages([]);
    }
  }, [selectedChannel, fetchMessages]);

  useEffect(() => {
    if (!selectedChannel?.id) {
      return;
    }

    const subscription = supabase
      .channel(`messages_channel_${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, async (payload) => {
        const newMessageFromSubscription = payload.new as Message;

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', newMessageFromSubscription.sender_id)
          .single();

        if (profileError) {
          console.error("Error fetching profile for realtime message:", profileError);
          return;
        }

        const finalMessage: Message = {
          ...newMessageFromSubscription,
          profiles: profileData
        };

        setMessages((prevMessages) => {
          const messageExists = prevMessages.some(msg => msg.id === finalMessage.id);
          if (!messageExists) {
            return [...prevMessages, finalMessage];
          }
          return prevMessages;
        });
      })
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [selectedChannel?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  return {
    messages,
    messagesLoading,
    messagesEndRef,
    handleSendMessage
  };
};
