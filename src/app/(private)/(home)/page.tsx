'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRouter } from 'next/navigation';

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
  const [messages, setMessages] = useState<Message[]>([] as Message[]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLogoutOption, setShowLogoutOption] = useState(false);

  const [channelsLoading, setChannelsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchChannels = useCallback(async () => {
    if (!currentUser?.id) {
      setChannels([]);
      setChannelsLoading(false);
      return;
    }

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
      setChannels([]);
      setChannelsLoading(false);
      return;
    }

    const channelIds = channelMemberships.map(member => member.channel_id);

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

    const allUserChannels: Channel[] = channelsData
      ?.map((channel: any) => ({
        ...channel,
        members: channel.members.map((member: any) => ({
          user_id: member.user_id,
          profiles: member.profiles || null
        }))
      })) || [];

    setChannels(allUserChannels);
    setChannelsLoading(false);
  }, [currentUser]);

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
      .order('created_at', { ascending: true })

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

  const handleSendMessage = async () => {
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

    setNewMessage('');

    const { data: messageData, error: messageError } = await supabase.from('messages').insert({
      content: messageContent,
      channel_id: channelId,
      sender_id: senderId,
    }).select('id').single();

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
      } else {
        setChannels(prevChannels =>
          prevChannels.map(ch =>
            ch.id === channelId
              ? { ...ch, last_message: messageContent, last_message_at: timestamp }
              : ch
          ).sort((a, b) => {
            const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return dateB - dateA;
          })
        );
      }
    }
  };

  const handleSelectUserChannel = useCallback(async (user: UserMetadata) => {
    if (!currentUser?.id) {
      return;
    }

    const currentUserId = currentUser.id;
    const targetUserId = user.id;

    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);

    const { data: memberships, error: findError } = await supabase
      .from('channel_members')
      .select('channel_id, user_id')
      .in('user_id', [currentUserId, targetUserId])
      .order('channel_id');

    if (findError) {
      console.error("Error searching for existing channel members:", findError);
      alert(`Failed to search for existing channel: ${findError.message}`);
      return;
    }

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

      fetchChannels();

    } else {
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

      fetchChannels();

      const tempNewChannel: Channel = {
        id: newChannelId,
        created_at: new Date().toISOString(),
        members: [
          { user_id: currentUserId, profiles: currentUser as UserMetadata },
          { user_id: targetUserId, profiles: user },
        ],
        last_message: null,
        last_message_at: null,
      };
      setSelectedChannel(tempNewChannel);
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

    const otherMembers = channel.members.filter(member => member && member.user_id !== currentUser.id && member.profiles);

    if (otherMembers.length === 1) {
      return otherMembers[0].profiles?.full_name || 'Usuário Desconhecido';
    } else if (otherMembers.length > 1) {
      const names = otherMembers.map(member => member.profiles?.full_name || 'Usuário Desconhecido');
      return `${names.slice(0, 2).join(', ')}${names.length > 2 ? '...' : ''}`;
    } else {
      return 'Canal Vazio';
    }
  }, [currentUser]);

  const getOtherUserMetadata = useCallback((channel: Channel | null): UserMetadata | null => {
    if (!currentUser || !channel?.members) return null;

    const otherMember = channel.members.find(member =>
      member && member.user_id !== currentUser.id && member.profiles
    );

    return otherMember?.profiles || null;
  }, [currentUser]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      router.push('/login');
    } else {
      console.error("Logout error:", error);
      alert("Falha ao desconectar.");
    }
  };


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
    if (!currentUser?.id) {
      return;
    }

    const channelMembersSubscription = supabase
      .channel(`user_channel_members_${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'channel_members',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        fetchChannels();
      })
      .subscribe();

    return () => {
      if (channelMembersSubscription) {
        supabase.removeChannel(channelMembersSubscription);
      }
    };
  }, [currentUser, fetchChannels]);

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

              setChannels(prevChannels =>
                prevChannels.map(ch =>
                  ch.id === selectedChannel.id
                    ? { ...ch, last_message: newMessageData.content, last_message_at: newMessageData.created_at }
                    : ch
                ).sort((a, b) => {
                  const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                  const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                  return dateB - dateA;
                })
              );
            } else {
              console.warn("Fetched new message data is null or undefined.");
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

  if (userLoading) {
    return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Carregando usuário...</div>;
  }

  if (!currentUser) {
    return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Usuário não autenticado. Por favor, faça login.</div>;
  }

  const otherUserMetadata = getOtherUserMetadata(selectedChannel);

  return (
    <div className="flex items-center justify-center h-screen bg-[#111] text-white px-8 py-12 relative">
      {currentUser && (
        <div className="absolute top-4 right-8 z-10">
          <div className="relative">
            <button
              onClick={() => setShowLogoutOption(!showLogoutOption)}
              className="flex items-center gap-2 focus:outline-none rounded-full transition hover:opacity-80 cursor-pointer"
            >
              {currentUser.avatar_url ? (
                <Image
                  src={currentUser.avatar_url}
                  alt="Seu Avatar"
                  width={40}
                  height={40}
                  className="rounded-full object-cover border-2 border-pink-500"
                />
              ) : (
                <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                  {currentUser.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </button>
            {showLogoutOption && (
              <div
                className="absolute top-full right-0 mt-2 p-3 bg-gray-700 text-red-500 rounded-md shadow-lg cursor-pointer min-w-[160px] whitespace-nowrap"
                onClick={handleLogout}
              >
                Desconectar-se
              </div>
            )}
          </div>
        </div>
      )}

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
                        className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-[#333] hover:bg-pink-500 hover:text-white transition"
                        onClick={() => handleSelectUserChannel(user)}
                      >
                        {user?.avatar_url ? (
                          <div className="flex-shrink-0">
                            <Image
                              src={user.avatar_url}
                              alt={`${user.full_name || 'Usuário'}'s Avatar`}
                              width={40}
                              height={40}
                              className="rounded-full object-cover border-2 border-pink-500"
                            />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                            {user?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                          {user.full_name}
                        </div>
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
                  channels.map((channel) => {
                    const otherUser = channel.members?.find(member =>
                      member?.user_id !== currentUser?.id && member?.profiles
                    )?.profiles;

                    const lastMessagePreview = channel.last_message
                      ? channel.last_message.length > 30
                        ? `${channel.last_message.substring(0, 27)}...`
                        : channel.last_message
                      : 'Sem mensagens';

                    return (
                      <div
                        key={channel.id}
                        className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition ${selectedChannel?.id === channel.id
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
                        {otherUser?.avatar_url ? (
                          <div className="flex-shrink-0">
                            <Image
                              src={otherUser.avatar_url}
                              alt={`${otherUser.full_name || 'Usuário'}'s Avatar`}
                              width={40}
                              height={40}
                              className="rounded-full object-cover border-2 border-pink-500"
                            />
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                            {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}

                        <div className="flex-1 flex flex-col overflow-hidden">
                          <p className="text-sm font-semibold truncate">
                            {getChannelName(channel)}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {lastMessagePreview}
                          </p>
                        </div>
                      </div>
                    );
                  })
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

          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            {messagesLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">Carregando mensagens...</div>
            ) : selectedChannel ? (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id;
                const senderProfile = selectedChannel.members?.find(member => member.user_id === msg.sender_id)?.profiles;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-start gap-2`}
                  >
                    {!isMe && (
                      senderProfile?.avatar_url ? (
                        <Image
                          src={senderProfile.avatar_url}
                          alt={`${senderProfile.full_name || 'Usuário'}'s Avatar`}
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
                          {senderProfile?.full_name || 'Usuário Desconhecido'}
                        </p>
                      )}
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