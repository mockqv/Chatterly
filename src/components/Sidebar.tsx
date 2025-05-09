import Image from 'next/image';
import { Channel, UserMetadata } from '@/interfaces/IHome';
import { useUserSearch } from '@/hooks/useUserSearch';

interface SidebarProps {
  channels: Channel[];
  channelsLoading: boolean;
  selectedChannel: Channel | null;
  currentUser: UserMetadata;
  onSelectChannel: (channel: Channel) => void;
  onSelectUser: (user: UserMetadata) => void;
}

export const Sidebar = ({
  channels,
  channelsLoading,
  selectedChannel,
  currentUser,
  onSelectChannel,
  onSelectUser
}: SidebarProps) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    setSearchResults,
    setIsSearching
  } = useUserSearch(currentUser);

  const getChannelName = (channel: Channel): string => {
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
  };

  return (
    <aside className="w-80 p-4 bg-[#2a2a2a] flex flex-col h-full flex-shrink-0">
      <h2 className="text-2xl font-bold mb-6 text-pink-500">Chatterly!</h2>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-4 p-3 rounded-lg bg-[#333] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
        placeholder="Buscar usuários..."
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
                    onClick={() => onSelectUser(user)}
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
                      onSelectChannel(channel);
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
  );
}; 