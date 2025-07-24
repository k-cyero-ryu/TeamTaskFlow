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
  expensePermissions?: {
    id: number;
    userId: number;
    canViewExpenses: boolean;
    canManageExpenses: boolean;
    canDeleteExpenses: boolean;
    canManageAccess: boolean;
    grantedById: number;
    createdAt: string;
  };
};

type PermissionUpdate = {
  canViewExpenses: boolean;
  canManageExpenses: boolean;
  canDeleteExpenses: boolean;
  canManageAccess: boolean;
};

export function ExpenseAccessDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/expenses/permissions"],
    enabled: open,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: PermissionUpdate }) => {
      await apiRequest(`/api/expenses/permissions/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(permissions),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/permissions"] });
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
            Expense Access Management
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
    canViewExpenses: user.expensePermissions?.canViewExpenses || false,
    canManageExpenses: user.expensePermissions?.canManageExpenses || false,
    canDeleteExpenses: user.expensePermissions?.canDeleteExpenses || false,
    canManageAccess: user.expensePermissions?.canManageAccess || false,
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
              <label className="text-sm font-medium">View Expenses</label>
              <Switch
                checked={isAdmin || permissions.canViewExpenses}
                onCheckedChange={(checked) => handlePermissionChange('canViewExpenses', checked)}
                disabled={isAdmin || isUpdating}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Manage Expenses</label>
              <Switch
                checked={isAdmin || permissions.canManageExpenses}
                onCheckedChange={(checked) => handlePermissionChange('canManageExpenses', checked)}
                disabled={isAdmin || isUpdating}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Delete Expenses</label>
              <Switch
                checked={isAdmin || permissions.canDeleteExpenses}
                onCheckedChange={(checked) => handlePermissionChange('canDeleteExpenses', checked)}
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