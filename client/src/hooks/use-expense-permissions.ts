import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

type ExpensePermissions = {
  id: number;
  userId: number;
  canViewExpenses: boolean;
  canManageExpenses: boolean;
  canDeleteExpenses: boolean;
  canManageAccess: boolean;
  grantedById: number;
  createdAt: string;
} | null;

export function useExpensePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading } = useQuery<ExpensePermissions>({
    queryKey: ["/api/expenses/permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const response = await fetch(`/api/expenses/permissions/${user.id}`);
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
    hasExpenseAccess: isAdmin || Boolean(permissions?.canViewExpenses),
    canViewExpenses: isAdmin || Boolean(permissions?.canViewExpenses),
    canManageExpenses: isAdmin || Boolean(permissions?.canManageExpenses),
    canDeleteExpenses: isAdmin || Boolean(permissions?.canDeleteExpenses),
    canManageAccess: isAdmin || Boolean(permissions?.canManageAccess),
    isLoading,
    permissions
  };
}