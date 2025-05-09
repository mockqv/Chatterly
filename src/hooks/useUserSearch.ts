import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { UserMetadata } from '@/interfaces/IHome';

export const useUserSearch = (currentUser: UserMetadata | null) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, handleSearch]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    setSearchResults,
    setIsSearching
  };
}; 