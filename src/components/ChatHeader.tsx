import Image from 'next/image';
import { Channel, UserMetadata } from '@/interfaces/IHome';

interface ChatHeaderProps {
  selectedChannel: Channel | null;
  currentUser: UserMetadata;
}

export const ChatHeader = ({ selectedChannel, currentUser }: ChatHeaderProps) => {
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

  const getOtherUserMetadata = (channel: Channel | null): UserMetadata | null => {
    if (!currentUser || !channel?.members) return null;

    const otherMember = channel.members.find(member =>
      member && member.user_id !== currentUser.id && member.profiles
    );

    return otherMember?.profiles || null;
  };

  const otherUserMetadata = getOtherUserMetadata(selectedChannel);

  return (
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
  );
}; 