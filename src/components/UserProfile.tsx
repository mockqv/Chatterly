import Image from 'next/image';
import { UserMetadata } from '@/interfaces/IHome';
import { useState } from 'react';

interface UserProfileProps {
  currentUser: UserMetadata;
  onLogout: () => void;
}

export const UserProfile = ({ currentUser, onLogout }: UserProfileProps) => {
  const [showLogoutOption, setShowLogoutOption] = useState(false);

  return (
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
            onClick={onLogout}
          >
            Desconectar-se
          </div>
        )}
      </div>
    </div>
  );
}; 