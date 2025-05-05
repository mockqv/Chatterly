import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (user) {
        const metadata = user.user_metadata;
        setCurrentUser({
          id: user.id,
          email: user.email,
          full_name: metadata.full_name,
          avatar_url: metadata.avatar_url,
        });
      }

      setLoading(false);
    };

    fetchUser();
  }, []);

  return { currentUser, loading };
}