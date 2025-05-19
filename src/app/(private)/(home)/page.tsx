'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useChannels } from '@/hooks/useChannels';
import { useMessages } from '@/hooks/useMessages';
import { Sidebar } from '../../../components/Sidebar';
import { ChatHeader } from '../../../components/ChatHeader';
import { MessageList } from '../../../components/MessageList';
import { MessageInput } from '../../../components/MessageInput';
import { UserProfile } from '../../../components/UserProfile';
import { Channel, Message, UserMetadata } from '@/interfaces/IHome';

export default function Home() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const router = useRouter();

  const {
    channels,
    channelsLoading,
    fetchChannels,
    setChannels
  } = useChannels(currentUser);

  const {
    messages,
    messagesLoading,
    messagesEndRef,
    handleSendMessage
  } = useMessages(selectedChannel, currentUser);

  const handleSelectUserChannel = async (user: UserMetadata) => {
    if (!currentUser?.id) {
      return;
    }

    const currentUserId = currentUser.id;
    const targetUserId = user.id;

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
        .single();

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
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      router.push('/sign-in');
    } else {
      console.error("Logout error:", error);
      alert("Falha ao desconectar.");
    }
  };

  if (userLoading) {
    return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Carregando usuário...</div>;
  }

  if (!currentUser) {
    return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Usuário não autenticado. Por favor, faça login.</div>;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#111] text-white px-8 py-12 relative">
      {currentUser && <UserProfile currentUser={currentUser} onLogout={handleLogout} />}

      <div className="flex w-full max-w-screen-xl h-full bg-[#1a1a1a] rounded-lg shadow-lg overflow-hidden">
        <Sidebar
          channels={channels}
          channelsLoading={channelsLoading}
          selectedChannel={selectedChannel}
          currentUser={currentUser}
          onSelectChannel={setSelectedChannel as (channel: Channel) => void}
          onSelectUser={handleSelectUserChannel as (user: UserMetadata) => void}
        />

        <section className="flex-1 flex flex-col bg-[#222] rounded-r-lg h-full">
          <ChatHeader selectedChannel={selectedChannel} currentUser={currentUser} />
          
          <MessageList
            messages={messages as Message[]}
            messagesLoading={messagesLoading}
            selectedChannel={selectedChannel}
            currentUser={currentUser}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
          />

          {selectedChannel && (
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={!selectedChannel}
            />
          )}
        </section>
      </div>
    </div>
  );
}