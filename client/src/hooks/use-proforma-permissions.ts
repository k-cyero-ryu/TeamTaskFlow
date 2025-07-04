import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

type ProformaPermissions = {
  id: number;
  userId: number;
  canViewProformas: boolean;
  canManageProformas: boolean;
  canDeleteProformas: boolean;
  canManageAccess: boolean;
  grantedById: number;
  createdAt: string;
} | null;

export function useProformaPermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery<ProformaPermissions>({
    queryKey: ["/api/proformas/permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const response = await fetch(`/api/proformas/permissions/${user.id}`);
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
    hasProformaAccess: isAdmin || Boolean(permissions?.canViewProformas),
    canViewProformas: isAdmin || Boolean(permissions?.canViewProformas),
    canManageProformas: isAdmin || Boolean(permissions?.canManageProformas),
    canDeleteProformas: isAdmin || Boolean(permissions?.canDeleteProformas),
    canManageAccess: isAdmin || Boolean(permissions?.canManageAccess),
    isLoading,
    permissions
  };
}