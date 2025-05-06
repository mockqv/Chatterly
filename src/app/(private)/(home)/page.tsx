'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface UserMetadata {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
}

interface CurrentUser {
    id: string;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
}

interface ChannelMember {
    user_id: string;
    profiles: UserMetadata | null;
}

interface Channel {
  id: string;
  last_message?: string | null;
  last_message_at?: string | null;
  created_at: string;
  members?: ChannelMember[] | null;
}

interface Message {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    channel_id: string;
    profiles: UserMetadata | null;
    user_metadata?: UserMetadata | null;
}


export default function MessagesPage() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [channelsLoading, setChannelsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChannels = useCallback(async () => {
    if (!currentUser?.id) {
        setChannels([]);
        setChannelsLoading(false);
        return;
    }

    console.log("Fetching channels for user:", currentUser.id);
    setChannelsLoading(true);

    const { data: channelMemberships, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', currentUser.id);

     if (memberError) {
         console.error("Error fetching user's channel memberships:", memberError);
         setChannels([]);
         setChannelsLoading(false);
         return;
     }

     if (!channelMemberships || channelMemberships.length === 0) {
         console.log("User is not a member of any channels.");
         setChannels([]);
         setChannelsLoading(false);
         return;
     }

     const channelIds = channelMemberships.map(member => member.channel_id);
     console.log("User is member of channel IDs:", channelIds);

    const { data: channelsData, error: channelsError } = await supabase
      .from('channels')
      .select(`
        id,
        last_message,
        last_message_at,
        created_at,
        members:channel_members (
          user_id,
          profiles (
            id,
            full_name,
            avatar_url
          )
        )
      `)
      .in('id', channelIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (channelsError) {
        console.error("Error fetching channels with members:", channelsError);
        setChannels([]);
        setChannelsLoading(false);
        return;
    }

    console.log("Fetched channels with raw members data:", channelsData);

    const dmChannels: Channel[] = channelsData
        ?.filter((channel: any) => channel.members && channel.members.length === 2)
        .map((channel: any) => ({
            ...channel,
            members: channel.members.map((member: any) => ({
                user_id: member.user_id,
                profiles: member.profiles || null
            }))
        })) || [];

     console.log("Filtered DM Channels:", dmChannels);

    setChannels(dmChannels);
    setChannelsLoading(false);
  }, [currentUser]);

  const fetchMessages = useCallback(async (channelId: string) => {
     if (!channelId) {
         setMessages([]);
         setMessagesLoading(false);
         return;
     }
    console.log("Fetching messages for channel:", channelId);
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
      .order('created_at', { ascending: true })

    if (error) {
        console.error(`Error fetching messages for channel ${channelId}:`, error);
        setMessages([]);
        setMessagesLoading(false);
        return;
    }

     console.log("Fetched raw messages:", data);

     const formattedMessages: Message[] = data?.map((msg: any) => ({
         ...msg,
         profiles: msg.profiles || null
     })) || [];

    setMessages(formattedMessages);
    setMessagesLoading(false);
  }, []);

  const handleSendMessage = async () => {
    console.log("handleSendMessage called");

    if (!newMessage.trim() || !selectedChannel?.id || !currentUser?.id) {
         console.warn("Cannot send message: empty, no channel, or no user.");
         return;
    }

    console.log("handleSendMessage passed initial checks");

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

    console.log("Optimistically adding message:", optimisticMessage);
    setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

    setNewMessage('');

    console.log("Sending message to channel (to DB):", channelId);

    const { data, error } = await supabase.from('messages').insert({
      content: messageContent,
      channel_id: channelId,
      sender_id: senderId,
    }).select('id').single();

    if (error) {
        console.error("Error inserting message into DB:", error);
        alert(`Failed to send message: ${error.message}`);
        setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessageId));
    } else {
        console.log("Message inserted into DB successfully. Real ID:", data?.id);
    }
  };

  const handleSelectUserChannel = useCallback(async (user: UserMetadata) => {
    if (!currentUser?.id) {
      console.error("Current user not loaded yet, cannot select/create channel.");
      return;
    }

    const currentUserId = currentUser.id;
    const targetUserId = user.id;

    console.log(`Attempting to select or create channel with user: ${targetUserId}`);
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);

    const { data: memberships, error: findError } = await supabase
      .from('channel_members')
      .select('channel_id, user_id')
      .in('user_id', [currentUserId, targetUserId])
      .order('channel_id')

    if (findError) {
        console.error("Error searching for existing channel members:", findError);
        alert(`Failed to search for existing channel: ${findError.message}`);
        return;
    }

    console.log("Found memberships for both users:", memberships);

    let existingChannelId: string | null = null;

    if (memberships && memberships.length > 0) {
        const channelMembershipMap = new Map<string, string[]>();
        for (const membership of memberships) {
            if (!channelMembershipMap.has(membership.channel_id)) {
                channelMembershipMap.set(membership.channel_id, []);
            }
            channelMembershipMap.get(membership.channel_id)?.push(membership.user_id);
        }

        for (const [channelId, memberIds] of channelMembershipMap.entries()) {
            if (memberIds.length === 2 && memberIds.includes(currentUserId) && memberIds.includes(targetUserId)) {
                existingChannelId = channelId;
                break;
            }
        }
    }


    if (existingChannelId) {
      console.log("Existing channel found via DB check:", existingChannelId);

       const { data: channelData, error: fetchChannelError } = await supabase
          .from('channels')
          .select(`
            id,
            last_message,
            last_message_at,
            created_at,
            members:channel_members (
              user_id,
              profiles (
                id,
                full_name,
                avatar_url
              )
            )
          `)
          .eq('id', existingChannelId)
          .single() as any;

      if (fetchChannelError || !channelData) {
           console.error("Error fetching existing channel details:", fetchChannelError);
           alert(`Failed to load existing channel details: ${fetchChannelError?.message || "Unknown error"}`);
           setSelectedChannel(null);
           return;
      }

       const formattedChannel: Channel = {
          ...channelData,
           members: channelData.members?.map((member: any) => ({
              user_id: member.user_id,
              profiles: member.profiles || null
           })) || []
       };

      setSelectedChannel(formattedChannel);
      console.log("Selected existing channel:", formattedChannel.id);

      fetchChannels();


    } else {
      console.log("No existing channel found via DB check, creating new one with user:", targetUserId);

      console.log("Checking auth state before creating new channel:");
      console.log("currentUser ID from hook:", currentUser?.id);
      try {
          const session = await supabase.auth.getSession();
          console.log("Supabase session:", session);
          console.log("Supabase session user ID:", session?.data?.session?.user?.id);
      } catch (e) {
          console.error("Error fetching Supabase session:", e);
      }


      const { data: newChannelData, error: createChannelError } = await supabase
        .from('channels')
        .insert({})
        .select('id')
        .single();


      if (createChannelError || !newChannelData) {
          console.error("Error creating new channel entry:", createChannelError || "No data returned");
          alert(`Failed to create new channel: ${createChannelError?.message || "Unknown error"}`);
          return;
      }

      const newChannelId = newChannelData.id;
      console.log("New channel entry created with ID:", newChannelId);


      const membersToInsert = [
          { channel_id: newChannelId, user_id: currentUserId },
          { channel_id: newChannelId, user_id: targetUserId },
      ];

      const { error: addMembersError } = await supabase
          .from('channel_members')
          .insert(membersToInsert);

      if (addMembersError) {
          console.error("Error adding members to new channel:", addMembersError);
          await supabase.from('channels').delete().eq('id', newChannelId);
          alert(`Failed to add members to channel: ${addMembersError.message}`);
          return;
      }

      console.log("Members added to channel:", newChannelId);

      fetchChannels();

       const tempNewChannel: Channel = {
           id: newChannelId,
           created_at: new Date().toISOString(),
           members: [
               { user_id: currentUserId, profiles: currentUser as UserMetadata },
               { user_id: targetUserId, profiles: user },
           ]
       };
       setSelectedChannel(tempNewChannel);
       console.log("Selected newly created channel:", tempNewChannel.id);
    }
  }, [currentUser, fetchChannels]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (!currentUser?.id) {
        console.warn("Current user not loaded, cannot perform search.");
        setSearchResults([]);
        setIsSearching(false);
        return;
    }

    const { data, error } = await supabase.from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${searchQuery}%`)
        .limit(20);

     if (error) {
        console.error("Error searching users in profiles table:", error);
        setSearchResults([]);
        setIsSearching(false);
        return;
     }

     console.log("Search results from profiles:", data);

    const formattedResults: UserMetadata[] = data?.map(user => ({
            id: user.id,
            full_name: user.full_name || 'Nome Desconhecido',
            avatar_url: user.avatar_url || null,
        }))
        .filter((user) => user.id !== currentUser.id) || [];

    setSearchResults(formattedResults);
    setIsSearching(false);

  }, [searchQuery, currentUser]);

  const getChannelName = useCallback((channel: Channel): string => {
    if (!currentUser || !channel.members) return 'Canal';

    const otherMember = channel.members.find(member =>
        member && member.user_id !== currentUser.id && member.profiles
    );

    return otherMember?.profiles?.full_name || 'Usuário Desconhecido';
  }, [currentUser]);

  const getOtherUserMetadata = useCallback((channel: Channel | null): UserMetadata | null => {
      if (!currentUser || !channel?.members) return null;

       const otherMember = channel.members.find(member =>
            member && member.user_id !== currentUser.id && member.profiles
       );

       return otherMember?.profiles || null;

  }, [currentUser]);


  useEffect(() => {
    if (currentUser) {
      fetchChannels();
    } else {
      setChannels([]);
      setSelectedChannel(null);
      setMessages([]);
    }
  }, [currentUser, fetchChannels]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, handleSearch]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id);
    } else {
      setMessages([]);
    }
  }, [selectedChannel, fetchMessages]);

  useEffect(() => {
    if (!selectedChannel?.id || !currentUser) {
        if (!currentUser && selectedChannel) console.log(`No current user, not subscribing to channel: messages:${selectedChannel.id}`);
        if (selectedChannel) {
            setMessages([]);
            setMessagesLoading(false);
        }
        return;
    }

    console.log(`Subscribing to channel: messages_${selectedChannel.id}`);

    const subscription = supabase
      .channel(`messages_channel_${selectedChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, (payload) => {
           console.log(">>> EVENTO REALTIME RECEBIDO! <<<", payload);
           console.log('New message received (realtime):', payload);
           if (payload.new.sender_id === currentUser.id) {
               console.log("Ignoring echoed message from current user.");
               return;
           }

           console.log("Processing non-echoed message");

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
                 console.log("Fetch message details result:", { data: newMessageData, error });
                 if (error) {
                     console.error("Error fetching new message for realtime update:", error);
                     return;
                 }
                 if (newMessageData) {
                     const formattedMessage: Message = {
                         ...newMessageData,
                         profiles: newMessageData.profiles || null
                     };
                     console.log("Adding message to state:", formattedMessage);
                     setMessages((prevMessages) => [...prevMessages, formattedMessage]);
                     console.log("State update attempted.");
                 } else {
                     console.warn("Fetched new message data is null or undefined.");
                 }
             })
             .catch(catchError => {
                 console.error("Catch block error fetching/processing new message:", catchError);
             });
        })
        .subscribe();

      return () => {
         console.log(`Unsubscribing from channel: messages_channel_${selectedChannel.id}`);
         if (subscription) {
            supabase.removeChannel(subscription);
         }
      };
    }, [selectedChannel?.id, currentUser]);

  useEffect(() => {
      if (messagesEndRef.current && messages.length > 0) {
           messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages]);

  if (userLoading) {
    return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Carregando usuário...</div>;
  }

  if (!currentUser) {
      return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Usuário não autenticado. Por favor, faça login.</div>;
  }

  const otherUserMetadata = getOtherUserMetadata(selectedChannel);


  return (
    <div className="flex items-center justify-center h-screen bg-[#111] text-white px-8 py-12">
      <div className="flex w-full max-w-screen-xl h-full bg-[#1a1a1a] rounded-lg shadow-lg overflow-hidden">
        <aside className="w-80 p-4 bg-[#2a2a2a] flex flex-col h-full flex-shrink-0">
          <h2 className="text-2xl font-bold mb-6 text-pink-500">Chatterly!</h2>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4 p-3 rounded-lg bg-[#333] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="Buscar usuários..."
            disabled={userLoading}
          />
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {channelsLoading ? (
                <p className="text-gray-500 text-sm">Carregando conversas...</p>
            ) : (
              isSearching || searchResults.length > 0 ? (
                isSearching ? (
                  <p className="text-gray-500 text-sm">Buscando usuários...</p>
                ) : (
                  searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="cursor-pointer p-3 rounded-lg bg-[#333] hover:bg-pink-500 hover:text-white transition"
                        onClick={() => handleSelectUserChannel(user)}
                      >
                        {user.full_name}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">
                       {searchQuery.trim() ? 'Nenhum usuário encontrado.' : 'Buscar usuários para iniciar conversa.'}
                    </p>
                  )
                )
              ) : (
                channels.length > 0 ? (
                  channels.map((channel) => (
                    <div
                      key={channel.id}
                      className={`cursor-pointer p-3 rounded-lg transition ${
                        selectedChannel?.id === channel.id
                          ? 'bg-pink-600 text-white'
                          : 'bg-[#333] hover:bg-[#444] text-gray-300 hover:text-white'
                      }`}
                      onClick={() => {
                        setSelectedChannel(channel);
                        setSearchQuery('');
                        setSearchResults([]);
                        setIsSearching(false);
                      }}
                    >
                      {getChannelName(channel)}
                    </div>
                  ))
                ) : (
                    <p className="text-gray-500 text-sm">Nenhuma conversa encontrada. Busque um usuário para iniciar.</p>
                )
              )
            )}
          </div>
        </aside>

        <section className="flex-1 flex flex-col bg-[#222] rounded-r-lg h-full">
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
             {selectedChannel ? (
                <div className="flex items-center gap-3">
                    {otherUserMetadata?.avatar_url ? (
                         <Image
                           src={otherUserMetadata.avatar_url}
                           alt={`${otherUserMetadata.full_name || 'Usuário'}'s Avatar`}
                           width={40}
                           height={40}
                           className="rounded-full object-cover border-2 border-pink-500 flex-shrink-0"
                         />
                    ) : (
                        <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {otherUserMetadata?.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}
                   <h2 className="text-xl font-semibold text-pink-500">
                     {getChannelName(selectedChannel)}
                   </h2>
                 </div>
             ) : (
                <h2 className="text-xl font-semibold text-pink-500">
                 Selecione uma conversa
               </h2>
             )}

            {currentUser?.avatar_url ? (
              <Image
                src={currentUser.avatar_url}
                alt="Seu Avatar"
                width={40}
                height={40}
                className="rounded-full object-cover border-2 border-pink-500 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {currentUser?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {messagesLoading ? (
                 <div className="flex-1 flex items-center justify-center text-gray-500">Carregando mensagens...</div>
            ) : selectedChannel ? (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs p-3 rounded-lg ${
                        isMe
                          ? 'bg-pink-600 text-white rounded-br-none'
                          : 'bg-[#3a3a3a] text-white rounded-bl-none'
                      } shadow-md`}
                    >
                       <p className="text-sm font-semibold mb-1">
                         {msg.profiles?.full_name || 'Usuário Desconhecido'}
                       </p>
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs text-gray-300 mt-1 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Selecione um canal na barra lateral para ver as mensagens.
            </div>
          )}
           <div ref={messagesEndRef} />
        </div>


        {selectedChannel && !isSearching && (
          <div className="flex p-4 border-t border-gray-700 gap-3 flex-shrink-0">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 p-3 rounded-lg bg-[#333] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Digite sua mensagem..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              disabled={!selectedChannel}
            />
            <button
              onClick={handleSendMessage}
              className="bg-pink-500 hover:bg-pink-600 px-6 py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!newMessage.trim() || !selectedChannel}
            >
                Enviar
            </button>
          </div>
        )}
      </section>
    </div>
  </div>
  );
}