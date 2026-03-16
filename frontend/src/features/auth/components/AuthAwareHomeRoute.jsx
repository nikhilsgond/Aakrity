// src/features/auth/components/AuthAwareHomeRoute
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@features/auth/context/AuthProvider';
import Home from '@features/home/page/HomePage';

export default function AuthAwareHomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }

  return <Home />;
}