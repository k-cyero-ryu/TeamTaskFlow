import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useNavigation } from "./use-navigation";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigation();
  const [location] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      console.log('ProtectedRoute check:', {
        isLoading,
        isAuthenticated: !!user,
        currentLocation: location,
        fullPath: window.location.pathname,
        user: user ? { id: user.id, username: user.username } : null
      });

      // Always use absolute paths for navigation
      if (!user && location !== '/auth') {
        console.log('Protected route: Not authenticated, navigating to /auth');
        navigate('/auth');
      } else if (user && location === '/auth') {
        console.log('Protected route: Already authenticated, navigating to /');
        navigate('/');
      } else {
        console.log('Protected route: No navigation needed');
      }
    }
  }, [user, isLoading, location, navigate]);

  if (isLoading) {
    console.log('Protected route: Loading auth state...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    console.log('Protected route: Not authenticated, rendering null');
    return null;
  }

  console.log('Protected route: Authenticated, rendering protected content');
  return <>{children}</>;
}