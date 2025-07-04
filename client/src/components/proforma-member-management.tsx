import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, X, Shield, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UserWithPermissions = {
  id: number;
  username: string;
  proformaPermissions?: {
    id: number;
    userId: number;
    canViewProformas: boolean;
    canManageProformas: boolean;
    canDeleteProformas: boolean;
    canManageAccess: boolean;
    grantedById: number;
    createdAt: string;
  } | null;
};

type PermissionUpdate = {
  canViewProformas: boolean;
  canManageProformas: boolean;
  canDeleteProformas: boolean;
  canManageAccess: boolean;
};

export default function ProformaMemberManagement() {
  const { toast } = useToast();
  const [pendingChanges, setPendingChanges] = useState<Record<number, PermissionUpdate>>({});

  // Fetch users with their proforma permissions
  const { data: users = [], isLoading, refetch } = useQuery<UserWithPermissions[]>({
    queryKey: ["/api/proformas/permissions"],
  });

  // Update user permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: PermissionUpdate }) => {
      const response = await apiRequest("POST", `/api/proformas/permissions/${userId}`, permissions);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas/permissions"] });
      
      // Remove from pending changes
      setPendingChanges(prev => {
        const newPending = { ...prev };
        delete newPending[variables.userId];
        return newPending;
      });

      toast({
        title: "Permissions updated",
        description: "User proforma permissions have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update permissions",
        description: error.message || "An error occurred while updating permissions.",
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (userId: number, permission: keyof PermissionUpdate, value: boolean) => {
    const currentPermissions = users.find(u => u.id === userId)?.proformaPermissions;
    const existingPending = pendingChanges[userId];
    
    const newPermissions = {
      canViewProformas: existingPending?.canViewProformas ?? currentPermissions?.canViewProformas ?? false,
      canManageProformas: existingPending?.canManageProformas ?? currentPermissions?.canManageProformas ?? false,
      canDeleteProformas: existingPending?.canDeleteProformas ?? currentPermissions?.canDeleteProformas ?? false,
      canManageAccess: existingPending?.canManageAccess ?? currentPermissions?.canManageAccess ?? false,
      [permission]: value,
    };

    setPendingChanges(prev => ({
      ...prev,
      [userId]: newPermissions
    }));
  };

  const savePermissions = (userId: number) => {
    const permissions = pendingChanges[userId];
    if (permissions) {
      updatePermissionsMutation.mutate({ userId, permissions });
    }
  };

  const cancelChanges = (userId: number) => {
    setPendingChanges(prev => {
      const newPending = { ...prev };
      delete newPending[userId];
      return newPending;
    });
  };

  const getEffectivePermissions = (user: UserWithPermissions): PermissionUpdate => {
    const pending = pendingChanges[user.id];
    const current = user.proformaPermissions;
    
    return {
      canViewProformas: pending?.canViewProformas ?? current?.canViewProformas ?? false,
      canManageProformas: pending?.canManageProformas ?? current?.canManageProformas ?? false,
      canDeleteProformas: pending?.canDeleteProformas ?? current?.canDeleteProformas ?? false,
      canManageAccess: pending?.canManageAccess ?? current?.canManageAccess ?? false,
    };
  };

  const hasPendingChanges = (userId: number) => {
    return userId in pendingChanges;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Grant proforma access permissions to team members. Admins automatically have full access.
      </div>

      <div className="space-y-4">
        {users.map((user) => {
          const isAdmin = user.id === 1;
          const effective = getEffectivePermissions(user);
          const hasChanges = hasPendingChanges(user.id);

          return (
            <div key={user.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <Shield className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{user.username}</span>
                  </div>
                  {isAdmin && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Admin</span>}
                  {hasChanges && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Pending Changes</span>}
                </div>
              </div>

              {!isAdmin && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`view-${user.id}`}
                        checked={effective.canViewProformas}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(user.id, 'canViewProformas', checked)
                        }
                      />
                      <Label htmlFor={`view-${user.id}`} className="text-sm">
                        View Proformas
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`manage-${user.id}`}
                        checked={effective.canManageProformas}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(user.id, 'canManageProformas', checked)
                        }
                      />
                      <Label htmlFor={`manage-${user.id}`} className="text-sm">
                        Create/Edit Proformas
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`delete-${user.id}`}
                        checked={effective.canDeleteProformas}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(user.id, 'canDeleteProformas', checked)
                        }
                      />
                      <Label htmlFor={`delete-${user.id}`} className="text-sm">
                        Delete Proformas
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`access-${user.id}`}
                        checked={effective.canManageAccess}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(user.id, 'canManageAccess', checked)
                        }
                      />
                      <Label htmlFor={`access-${user.id}`} className="text-sm">
                        Manage Access
                      </Label>
                    </div>
                  </div>

                  {hasChanges && (
                    <>
                      <Separator />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelChanges(user.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => savePermissions(user.id)}
                          disabled={updatePermissionsMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save Changes
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}

              {isAdmin && (
                <div className="text-sm text-muted-foreground">
                  Administrator has full access to all proforma features.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          No users found.
        </div>
      )}
    </div>
  );
}