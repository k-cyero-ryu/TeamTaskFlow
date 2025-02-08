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
      // Only navigate if we need to and we're not already at the target location
      if (!user && location !== '/auth') {
        navigate('/auth');
      }
    }
  }, [user, isLoading, location, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If not loading and no user, render nothing while navigating
  if (!user) {
    return null;
  }

  return <>{children}</>;
}