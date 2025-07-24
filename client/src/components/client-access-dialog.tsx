import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, User, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  clientPermissions?: {
    id: number;
    userId: number;
    canViewClients: boolean;
    canManageClients: boolean;
    canDeleteClients: boolean;
    canManageAccess: boolean;
    grantedById: number;
    createdAt: string;
  };
};

type PermissionUpdate = {
  canViewClients: boolean;
  canManageClients: boolean;
  canDeleteClients: boolean;
  canManageAccess: boolean;
};

export function ClientAccessDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/clients/permissions"],
    enabled: open,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: PermissionUpdate }) => {
      await apiRequest(
        "POST",
        `/api/clients/permissions/${userId}`,
        permissions
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/permissions"] });
      toast({
        title: "Success",
        description: "User permissions updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update permissions: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updatePermissions = (userId: number, permissions: PermissionUpdate) => {
    updatePermissionsMutation.mutate({ userId, permissions });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Manage Access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Client Access Management
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 p-1">
            {isLoading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : (
              users?.map((user) => (
                <UserPermissionCard
                  key={user.id}
                  user={user}
                  onUpdatePermissions={updatePermissions}
                  isUpdating={updatePermissionsMutation.isPending}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function UserPermissionCard({ 
  user, 
  onUpdatePermissions, 
  isUpdating 
}: { 
  user: User; 
  onUpdatePermissions: (userId: number, permissions: PermissionUpdate) => void;
  isUpdating: boolean;
}) {
  const [permissions, setPermissions] = useState<PermissionUpdate>({
    canViewClients: user.clientPermissions?.canViewClients || false,
    canManageClients: user.clientPermissions?.canManageClients || false,
    canDeleteClients: user.clientPermissions?.canDeleteClients || false,
    canManageAccess: user.clientPermissions?.canManageAccess || false,
  });

  const handlePermissionChange = (field: keyof PermissionUpdate, value: boolean) => {
    const updatedPermissions = { ...permissions, [field]: value };
    setPermissions(updatedPermissions);
    onUpdatePermissions(user.id, updatedPermissions);
  };

  const isAdmin = user.id === 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {user.username}
            {isAdmin && <Badge variant="secondary">Admin</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">View Clients</label>
              <Switch
                checked={isAdmin || permissions.canViewClients}
                onCheckedChange={(checked) => handlePermissionChange('canViewClients', checked)}
                disabled={isAdmin || isUpdating}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Manage Clients</label>
              <Switch
                checked={isAdmin || permissions.canManageClients}
                onCheckedChange={(checked) => handlePermissionChange('canManageClients', checked)}
                disabled={isAdmin || isUpdating}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Delete Clients</label>
              <Switch
                checked={isAdmin || permissions.canDeleteClients}
                onCheckedChange={(checked) => handlePermissionChange('canDeleteClients', checked)}
                disabled={isAdmin || isUpdating}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Manage Access</label>
              <Switch
                checked={isAdmin || permissions.canManageAccess}
                onCheckedChange={(checked) => handlePermissionChange('canManageAccess', checked)}
                disabled={isAdmin || isUpdating}
              />
            </div>
          </div>
        </div>
        
        {isAdmin && (
          <p className="text-xs text-muted-foreground">
            Admin users automatically have all permissions
          </p>
        )}
      </CardContent>
    </Card>
  );
}