'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Define interfaces for better type safety based on your schema and queries

// Interface for the user metadata structure
interface UserMetadata {
    id: string;
    full_name?: string | null; // Use optional chain as it might be null
    avatar_url?: string | null; // Use optional chain
}

// Interface for the current authenticated user
interface CurrentUser {
    id: string;
    email?: string | null; // Make nullable
    full_name?: string | null;
    avatar_url?: string | null;
    // Add other user properties from auth.users metadata if needed
}

// Interface for a channel member, including their user metadata
interface ChannelMember {
    user_id: string;
    user: { // This matches the 'user:user_id(...)' select structure
        user_metadata: UserMetadata | null; // user_metadata might be null
    } | null; // The entire joined 'user' object might be null
}

// Interface for a channel, including its members
interface Channel {
  id: string;
  last_message?: string | null; // Make nullable
  last_message_at?: string | null; // Make nullable
  created_at: string;
  members?: ChannelMember[] | null; // Members might be null or an empty array
}

// Interface for a message, including the sender's user metadata
interface Message {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    channel_id: string;
    user: { // This matches the 'user:sender_id(...)' select structure
        user_metadata: UserMetadata | null; // user_metadata might be null
    } | null; // The entire joined 'user' object might be null
    user_metadata?: UserMetadata | null; // Flattened user metadata for easier access in JSX
}


export default function MessagesPage() {
  const { currentUser, loading: userLoading } = useCurrentUser(); // currentUser should be CurrentUser type
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserMetadata[]>([]); // search results are UserMetadata
  const [isSearching, setIsSearching] = useState(false);

  // Add loading states for channels and messages
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false); // Start as false as no channel is selected initially


  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch channels the current user is a member of
  // Use useCallback to memoize the function
  const fetchChannels = useCallback(async () => {
    if (!currentUser?.id) { // Ensure currentUser ID is available
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
        members:channel_members (user_id, user:user_id(user_metadata))
      `) as any;

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
                user: { // Maintain the 'user' nested structure from select
                    user_metadata: member.user?.user_metadata || null
                }
            }))
        })) || [];

     console.log("Filtered DM Channels:", dmChannels);


    setChannels(dmChannels);
    setChannelsLoading(false);
  }, [currentUser]); // Dependency on currentUser


  // Fetch messages for a specific channel
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
        user:sender_id (user_metadata)
      `) as any; // Use any temporarily
      // Or refine interfaces/select to match perfectly

    if (error) {
        console.error(`Error fetching messages for channel ${channelId}:`, error);
        setMessages([]);
        setMessagesLoading(false);
        return;
    }

     console.log("Fetched raw messages:", data);

     const formattedMessages: Message[] = data?.map((msg: any) => ({
         ...msg,
         user_metadata: msg.user?.user_metadata || null // Flatten metadata
     })) || [];

    setMessages(formattedMessages);
    setMessagesLoading(false);
  }, []); // No external dependencies for fetchMessages itself


  // Send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel?.id || !currentUser?.id) {
         console.warn("Cannot send message: empty, no channel, or no user.");
         return;
    }

    console.log("Sending message to channel:", selectedChannel.id);

    const { error } = await supabase.from('messages').insert({
      content: newMessage,
      channel_id: selectedChannel.id,
      sender_id: currentUser.id,
    });

    if (error) {
        console.error("Error sending message:", error);
        alert(`Failed to send message: ${error.message}`);
    } else {
        setNewMessage('');
        console.log("Message sent successfully.");
    }
  };

  // Select an existing channel or create a new DM channel with a user
  const handleSelectUserChannel = async (user: UserMetadata) => { // User is UserMetadata
    if (!currentUser?.id) {
      console.error("Current user not loaded yet, cannot select/create channel.");
      // Maybe redirect to login or show error
      return;
    }

    const currentUserId = currentUser.id;
    const targetUserId = user.id;

    console.log(`Attempting to select or create channel with user: ${targetUserId}`);
    setIsSearching(false); // Exit search view immediately

    // Find existing DM channel with exactly these two members
    // Ensure channel.members and channel.members[i].user_id are checked
    const existingChannel = channels.find(channel => {
        const memberIds = channel.members
            ?.filter(member => member && member.user_id) // Filter out null/undefined members
            .map(member => member.user_id) || [];
        return memberIds.length === 2 && memberIds.includes(currentUserId) && memberIds.includes(targetUserId);
    });


    if (existingChannel) {
      console.log("Existing channel found:", existingChannel.id);
      setSelectedChannel(existingChannel);
    } else {
      console.log("No existing channel found, creating new one with user:", targetUserId);
      // Create new channel entry
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

      // Add members to the channel_members table
      const membersToInsert = [
          { channel_id: newChannelId, user_id: currentUserId },
          { channel_id: newChannelId, user_id: targetUserId },
      ];

      const { error: addMembersError } = await supabase
          .from('channel_members')
          .insert(membersToInsert);

      if (addMembersError) {
          console.error("Error adding members to new channel:", addMembersError);
           // Attempt to clean up the orphaned channel entry
          await supabase.from('channels').delete().eq('id', newChannelId);
          alert(`Failed to add members to channel: ${addMembersError.message}`);
          return;
      }

      console.log("Members added to channel:", newChannelId);

      // After creating, refetch the channel list to include the new channel
      fetchChannels();

       // Temporarily set the selected channel to the newly created one
       // This is an optimistic update; the full channel data will be available after fetchChannels
       const tempNewChannel: Channel = {
           id: newChannelId,
           created_at: new Date().toISOString(), // Use current time
           members: [ // Include temporary member info for display
               { user_id: currentUserId, user: { user_metadata: currentUser as UserMetadata } }, // Match ChannelMember structure, cast currentUser
               { user_id: targetUserId, user: { user_metadata: user } }, // Match ChannelMember structure
           ]
       };
       setSelectedChannel(tempNewChannel);
       setSearchQuery('');
       setSearchResults([]); // Clear search results
    }

  };

  // Handle user search
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
        return;
    }

    // Querying the 'profiles' table (recommended approach)
    // Make sure you have the 'profiles' table set up with RLS allowing select for 'authenticated'
    const { data, error } = await supabase.from('profiles')
        .select('id, full_name, avatar_url') // Select directly from profiles
        .ilike('full_name', `%${searchQuery}%`) // Filter directly on full_name
        .limit(20); // Limit search results

     if (error) {
        console.error("Error searching users in profiles table:", error);
         // RLS issues on the 'profiles' table would cause this empty error object {}.
         // Check RLS policies on your 'profiles' table.
        setSearchResults([]);
        return;
     }

     console.log("Search results from profiles:", data);

    // Format results to match UserMetadata interface
    const formattedResults: UserMetadata[] = data?.map(user => ({
            id: user.id,
            full_name: user.full_name || 'Nome Desconhecido',
            avatar_url: user.avatar_url || null,
        }))
        .filter((user) => user.id !== currentUser.id) || []; // Filter out the current user

    setSearchResults(formattedResults);
  }, [searchQuery, currentUser]); // Dependency on searchQuery and currentUser


  // Get the display name for a channel
  const getChannelName = useCallback((channel: Channel): string => {
    if (!currentUser || !channel.members) return 'Canal';

    // Find the other member in a DM channel
    // Safely access nested user_metadata
    const otherMember = channel.members.find(member =>
        member && member.user_id !== currentUser.id && member.user?.user_metadata
    );

    return otherMember?.user?.user_metadata?.full_name || 'Usuário Desconhecido';
  }, [currentUser]); // Dependency on currentUser

  // Get the other user's metadata for displaying their avatar/name in the header
  const getOtherUserMetadata = useCallback((channel: Channel | null): UserMetadata | null => {
      if (!currentUser || !channel?.members) return null;

      // Find the other member
       const otherMember = channel.members.find(member =>
            member && member.user_id !== currentUser.id && member.user?.user_metadata
       );

       return otherMember?.user?.user_metadata || null;

  }, [currentUser]);


  // Fetch channels when currentUser is loaded
  useEffect(() => {
    if (currentUser) {
      fetchChannels();
    } else {
      setChannels([]);
    }
  }, [currentUser, fetchChannels]); // Dependency on currentUser and fetchChannels

  // Handle search when searchQuery changes (with debounce)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, handleSearch]); // Dependency on searchQuery and handleSearch

  // Fetch messages when selectedChannel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id);
    } else {
      setMessages([]);
    }
    // Dependency on selectedChannel and fetchMessages
  }, [selectedChannel, fetchMessages]);


  // Realtime messages subscription
  useEffect(() => {
    if (!selectedChannel?.id || !currentUser) { // Check for selectedChannel.id
        if (!currentUser && selectedChannel) console.log(`No current user, not subscribing to channel: messages:${selectedChannel.id}`);
        if (selectedChannel) { // Clear messages and stop loading if channel is deselected
            setMessages([]);
            setMessagesLoading(false);
        }
        return;
    }

    console.log(`Subscribing to channel: messages:${selectedChannel.id}`);

    // Use 'postgres_changes' for modern realtime
    const subscription = supabase
      .channel(`messages_channel_${selectedChannel.id}`) // Use a unique channel name
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${selectedChannel.id}`,
      }, (payload) => {
         console.log('New message received (realtime):', payload);
         // Prevent adding the message if it's from the current user
         // Supabase realtime often echoes inserts from the client that made them.
         if (payload.new.sender_id === currentUser.id) {
             console.log("Ignoring echoed message from current user.");
             return;
         }

         // Fetch the new message with sender's user metadata using a separate query
         // Realtime payload does not include joined data by default
         supabase
           .from('messages')
           .select('*, user:sender_id (user_metadata)') // Join sender's user metadata from profiles
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
                       user_metadata: newMessageData.user?.user_metadata || null
                   };
                   setMessages((prevMessages) => [...prevMessages, formattedMessage]);
               }
           });
      })
      .subscribe();

    return () => {
       console.log(`Unsubscribing from channel: messages_channel_${selectedChannel.id}`);
       if (subscription) {
          supabase.removeChannel(subscription);
       }
    };
  }, [selectedChannel?.id, currentUser]); // Depend on selectedChannel.id and currentUser


   // Scroll to bottom when messages change
  useEffect(() => {
      // Check if the ref is available and there are messages
      if (messagesEndRef.current && messages.length > 0) {
           messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages]); // Dependency on messages


  if (userLoading) {
    return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Carregando usuário...</div>;
  }

  if (!currentUser) {
      // Consider redirecting to login page here
      return <div className="flex h-screen bg-[#111] text-white items-center justify-center">Usuário não autenticado. Por favor, faça login.</div>;
  }

  // Get the other user's metadata for the header
  const otherUserMetadata = getOtherUserMetadata(selectedChannel);


  return (
    // Main container with dark background, fills screen, adds padding to shrink inner box
    // Increased vertical padding (py-12) to decrease inner box height more
    // Increased horizontal padding (px-8) to allow inner box to be wider
    <div className="flex items-center justify-center h-screen bg-[#111] text-white px-8 py-12">
      {/* Centered box container */}
      {/* Increased max-w-screen-xl for even wider box */}
      <div className="flex w-full max-w-screen-xl h-full bg-[#1a1a1a] rounded-lg shadow-lg overflow-hidden">
        {/* Sidebar */}
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

          {/* Channel and Search Results List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {channelsLoading ? (
                <p className="text-gray-500 text-sm">Carregando conversas...</p>
            ) : !isSearching ? (
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
                  }}
                >
                  {getChannelName(channel)}
                </div>
              ))
            ) : searchResults.length > 0 ? (
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
            )}
          </div>
        </aside>

        {/* Área de mensagens */}
        <section className="flex-1 flex flex-col bg-[#222] rounded-r-lg h-full">
          <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              {/* Other user's avatar and name */}
             {selectedChannel ? (
                <div className="flex items-center gap-3"> {/* Container for avatar and name */}
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
                     {getChannelName(selectedChannel)} {/* Display the other user's name */}
                   </h2>
                 </div>
             ) : (
                <h2 className="text-xl font-semibold text-pink-500">
                 Selecione uma conversa
               </h2>
             )}


            {/* Current user's avatar */}
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

          {/* Messages Display Area */}
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
                         {msg.user_metadata?.full_name || 'Usuário Desconhecido'}
                       </p>
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs text-gray-300 mt-1 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : isSearching ? (
             <div className="flex-1 flex items-center justify-center text-gray-500">
              Pesquise um usuário para iniciar ou encontrar uma conversa.
            </div>
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
              className="bg-pink-500 hover:bg-pink-600 px-6 py-3 rounded-lg font-semibold transition duration-200"
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