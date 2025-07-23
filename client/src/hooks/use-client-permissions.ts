import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

type ClientPermissions = {
  id: number;
  userId: number;
  canViewClients: boolean;
  canManageClients: boolean;
  canDeleteClients: boolean;
  canManageAccess: boolean;
  grantedById: number;
  createdAt: string;
} | null;

export function useClientPermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery<ClientPermissions>({
    queryKey: ["/api/clients/permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const response = await fetch(`/api/clients/permissions/${user.id}`);
        if (response.status === 403 || response.status === 401) {
          return null;
        }
        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }
        return response.json();
      } catch (error) {
        return null;
      }
    },
    enabled: !!user?.id,
    retry: false
  });

  // Admin (ID 1) always has all permissions
  const isAdmin = user?.id === 1;

  return {
    hasClientAccess: isAdmin || Boolean(permissions?.canViewClients),
    canViewClients: isAdmin || Boolean(permissions?.canViewClients),
    canManageClients: isAdmin || Boolean(permissions?.canManageClients),
    canDeleteClients: isAdmin || Boolean(permissions?.canDeleteClients),
    canManageAccess: isAdmin || Boolean(permissions?.canManageAccess),
    isLoading,
    permissions
  };
}