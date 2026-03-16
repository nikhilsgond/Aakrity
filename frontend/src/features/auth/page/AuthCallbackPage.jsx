import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@features/auth/context/AuthProvider';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    navigate(isAuthenticated ? '/dashboard' : '/login', { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-sm text-muted-foreground">Finishing sign-in...</div>
    </div>
  );
}
