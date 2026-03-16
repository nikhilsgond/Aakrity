import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@features/auth/context/AuthProvider';

export default function Error404Page() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      navigate(isAuthenticated ? '/dashboard' : '/', { replace: true });
    }
  }, [countdown, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-5xl font-black mb-4">404</h1>
        <p className="text-lg font-semibold mb-2">Page not found</p>
        <p className="text-muted-foreground">
          The page you requested does not exist or has been moved.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
}