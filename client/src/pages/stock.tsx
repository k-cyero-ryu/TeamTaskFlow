import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Filter, Package, DollarSign, Users, TrendingUp, Edit, Trash2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import CreateStockItemDialog from "@/components/create-stock-item-dialog";
import AdjustQuantityDialog from "@/components/adjust-quantity-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StockItem {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  quantity: number;
  assignedUserId: number | null;
  assignedUser?: {
    id: number;
    username: string;
  };
  createdAt: string;
  updatedAt: string | null;
}

interface UserStockPermission {
  id: number;
  userId: number;
  canViewStock: boolean;
  canManageStock: boolean;
  canAdjustQuantities: boolean;
  grantedById: number;
  createdAt: string;
}

export default function StockPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);

  // Check user permissions
  const { data: permissions } = useQuery<UserStockPermission>({
    queryKey: [`/api/stock/permissions/${user?.id}`],
    enabled: !!user && user.id !== 1,
  });

  const isAdmin = user?.id === 1;
  const canView = isAdmin || permissions?.canViewStock;
  const canManage = isAdmin || permissions?.canManageStock;
  const canAdjust = isAdmin || permissions?.canAdjustQuantities;

  // Fetch stock items
  const {
    data: stockItems = [],
    isLoading,
    error,
  } = useQuery<StockItem[]>({
    queryKey: ["/api/stock/items"],
    enabled: canView,
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery<{ id: number; username: string }[]>({
    queryKey: ["/api/users"],
    enabled: canView,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("DELETE", `/api/stock/items/${itemId}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/items"] });
      toast({
        title: "Success",
        description: "Stock item deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete stock item",
        variant: "destructive",
      });
    },
  });

  // Filter items based on search and assigned user
  const filteredItems = stockItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAssigned = assignedFilter === "all" ||
                           (assignedFilter === "unassigned" && !item.assignedUserId) ||
                           (assignedFilter === "assigned" && item.assignedUserId) ||
                           item.assignedUserId?.toString() === assignedFilter;
    
    return matchesSearch && matchesAssigned;
  });

  // Calculate summary stats
  const totalItems = stockItems.length;
  const totalValue = stockItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  const lowStockItems = stockItems.filter(item => item.quantity < 10).length;
  const assignedItems = stockItems.filter(item => item.assignedUserId).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); // Convert from cents
  };

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            You don't have permission to view stock items. Contact an administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load stock items. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Management</h1>
          <p className="text-muted-foreground">
            Manage inventory items and track quantities
          </p>
        </div>
        {canManage && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <CreateStockItemDialog onClose={() => setShowCreateDialog(false)} />
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Active stock items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Current inventory value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems}</div>
            <p className="text-xs text-muted-foreground">
              Items below 10 units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Items</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedItems}</div>
            <p className="text-xs text-muted-foreground">
              Items with assigned users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Items ({filteredItems.length})</CardTitle>
          <CardDescription>
            Manage your inventory items and quantities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No stock items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.description || "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(item.cost)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{item.quantity}</span>
                        {item.quantity < 10 && (
                          <Badge variant="destructive" className="text-xs">
                            Low
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.assignedUser ? (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.assignedUser.username}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(item.cost * item.quantity)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(canAdjust || item.assignedUserId === user?.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowAdjustDialog(true);
                            }}
                          >
                            Adjust
                          </Button>
                        )}
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // TODO: Implement edit dialog
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Adjust Quantity Dialog */}
      {selectedItem && (
        <AdjustQuantityDialog
          item={selectedItem}
          open={showAdjustDialog}
          onOpenChange={setShowAdjustDialog}
          onClose={() => {
            setShowAdjustDialog(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}