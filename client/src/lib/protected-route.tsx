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
      const currentPath = location.split('/').pop() || '';
      if (!user && currentPath !== "auth") {
        console.log('User not authenticated, redirecting to /auth');
        navigate("/auth");
      } else if (user && currentPath === "auth") {
        console.log('User authenticated, redirecting to /');
        navigate("/");
      }
    }
  }, [user, isLoading, location, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}