import { useMemo } from 'react';
import { useAuth } from '@features/auth/context/AuthProvider';
import { getUserColor } from '@shared/lib/userUtils';

export function useRoomIdentity() {
  const { user, profile, displayName } = useAuth();

  return useMemo(() => {
    const userId = user?.id || null;
    return {
      userId,
      username: profile?.name || displayName,
      userColor: profile?.color || getUserColor(userId || 'guest'),
    };
  }, [displayName, profile?.color, profile?.name, user?.id]);
}
