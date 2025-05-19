import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Channel, UserMetadata } from '@/interfaces/IHome';

export const useChannels = (currentUser: UserMetadata | null) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);

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
      .order('last_message_at', { ascending: false, nullsFirst: false });

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

  useEffect(() => {
    if (currentUser) {
      fetchChannels();
    } else {
      setChannels([]);
    }
  }, [currentUser, fetchChannels]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channelMembersSubscription = supabase
      .channel(`user_channel_members_${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'channel_members',
        filter: `user_id=eq.${currentUser.id}`,
      }, () => {
        fetchChannels();
      })
      .subscribe();

    return () => {
      if (channelMembersSubscription) {
        supabase.removeChannel(channelMembersSubscription);
      }
    };
  }, [currentUser, fetchChannels]);

  return {
    channels,
    channelsLoading,
    fetchChannels,
    setChannels
  };
}; 