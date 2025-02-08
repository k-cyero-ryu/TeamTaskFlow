import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useNavigation } from "@/lib/use-navigation";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const navigate = useNavigation();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login...");
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: async (user: SelectUser) => {
      console.log("Login successful, updating auth state...");

      // Set query data and invalidate in sequence
      queryClient.setQueryData(["/api/user"], user);
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      // Force a refetch to ensure we have fresh data
      await queryClient.refetchQueries({ queryKey: ["/api/user"] });

      console.log("Auth state fully updated after login");
      navigate("/");
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log("Attempting registration...");
      const res = await apiRequest("POST", "/api/register", credentials);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }
      return res.json();
    },
    onSuccess: async (user: SelectUser) => {
      console.log("Registration successful, updating auth state...");

      // Set query data and invalidate in sequence
      queryClient.setQueryData(["/api/user"], user);
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      // Force a refetch to ensure we have fresh data
      await queryClient.refetchQueries({ queryKey: ["/api/user"] });

      console.log("Auth state fully updated after registration");
      navigate("/");
    },
    onError: (error: Error) => {
      console.error("Registration failed:", error);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Attempting logout...");
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Logout failed");
      }
    },
    onSuccess: async () => {
      console.log("Logout successful, clearing auth state...");

      // First set the user to null
      queryClient.setQueryData(["/api/user"], null);

      // Then invalidate all queries
      await queryClient.invalidateQueries();

      // Finally clear the cache
      queryClient.clear();

      console.log("Auth state fully cleared after logout");
      navigate("/auth");
    },
    onError: (error: Error) => {
      console.error("Logout failed:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}