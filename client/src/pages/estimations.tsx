import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, MapPin, User, DollarSign, Edit, Trash2, Package, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertEstimationSchema } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Estimation = {
  id: number;
  name: string;
  date: string;
  address: string;
  clientName: string;
  clientInformation: string | null;
  techniqueId: number | null;
  totalCost: number;
  createdAt: string;
  updatedAt: string | null;
  createdBy: {
    id: number;
    username: string;
  };
  items: Array<{
    id: number;
    quantity: number;
    unitCost: number;
    totalCost: number;
    stockItem: {
      id: number;
      name: string;
      cost: number;
    };
  }>;
};

type User = {
  id: number;
  username: string;
};

const estimationFormSchema = insertEstimationSchema.extend({
  date: z.preprocess((arg) => {
    if (arg === null || arg === undefined || arg === '') return null;
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return null;
  }, z.date()),
});

type EstimationFormData = z.infer<typeof estimationFormSchema>;

export default function EstimationsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEstimation, setSelectedEstimation] = useState<Estimation | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showItemsDialog, setShowItemsDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState(1);

  // Fetch estimations
  const { data: estimations = [], isLoading } = useQuery<Estimation[]>({
    queryKey: ["/api/estimations"],
  });

  // Fetch stock items for selection
  const { data: stockItems = [] } = useQuery<Array<{id: number; name: string; cost: number}>>({
    queryKey: ["/api/stock/items"],
  });

  // Fetch users for technique selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Keep selectedEstimation in sync with the latest data from the cache
  useEffect(() => {
    if (selectedEstimation && estimations.length > 0) {
      const updatedEstimation = estimations.find(est => est.id === selectedEstimation.id);
      if (updatedEstimation && JSON.stringify(updatedEstimation) !== JSON.stringify(selectedEstimation)) {
        setSelectedEstimation(updatedEstimation);
      }
    }
  }, [estimations]);

  // Create estimation form
  const createForm = useForm<EstimationFormData>({
    resolver: zodResolver(estimationFormSchema),
    defaultValues: {
      name: "",
      date: new Date(),
      address: "",
      clientName: "",
      clientInformation: "",
      techniqueId: undefined,
    },
  });

  // Edit estimation form
  const editForm = useForm<EstimationFormData>({
    resolver: zodResolver(estimationFormSchema),
  });

  // Create estimation mutation
  const createMutation = useMutation({
    mutationFn: async (data: EstimationFormData) => {
      const response = await apiRequest("POST", "/api/estimations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimations"] });
      setShowCreateDialog(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Estimation created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create estimation",
        variant: "destructive",
      });
    },
  });

  // Update estimation mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EstimationFormData & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PUT", `/api/estimations/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimations"] });
      setShowEditDialog(false);
      setSelectedEstimation(null);
      toast({
        title: "Success",
        description: "Estimation updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update estimation",
        variant: "destructive",
      });
    },
  });

  // Delete estimation mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/estimations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimations"] });
      setShowDeleteDialog(false);
      setSelectedEstimation(null);
      toast({
        title: "Success",
        description: "Estimation deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete estimation",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: EstimationFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (estimation: Estimation) => {
    setSelectedEstimation(estimation);
    editForm.reset({
      name: estimation.name,
      date: new Date(estimation.date),
      address: estimation.address,
      clientName: estimation.clientName,
      clientInformation: estimation.clientInformation || "",
      techniqueId: estimation.techniqueId,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = (data: EstimationFormData) => {
    if (!selectedEstimation) return;
    updateMutation.mutate({ ...data, id: selectedEstimation.id });
  };

  const handleDelete = (estimation: Estimation) => {
    setSelectedEstimation(estimation);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (!selectedEstimation) return;
    deleteMutation.mutate(selectedEstimation.id);
  };

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: { estimationId: number; stockItemId: number; quantity: number }) => {
      const response = await apiRequest("POST", `/api/estimations/${data.estimationId}/items`, {
        stockItemId: data.stockItemId,
        quantity: data.quantity,
      });
      return response.json();
    },
    onMutate: async ({ estimationId, stockItemId, quantity }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/estimations"] });

      // Snapshot previous value
      const previousEstimations = queryClient.getQueryData(["/api/estimations"]);

      // Get the stock item details
      const stockItem = stockItems.find(item => item.id === stockItemId);
      if (!stockItem) return { previousEstimations };

      // Optimistically update the cache
      queryClient.setQueryData(["/api/estimations"], (old: Estimation[] | undefined) => {
        if (!old) return old;
        return old.map(estimation => {
          if (estimation.id === estimationId) {
            const newItem = {
              id: Date.now(), // Temporary ID
              quantity,
              unitCost: stockItem.cost,
              totalCost: stockItem.cost * quantity,
              stockItem: {
                id: stockItem.id,
                name: stockItem.name,
                cost: stockItem.cost
              }
            };
            return {
              ...estimation,
              items: [...estimation.items, newItem]
            };
          }
          return estimation;
        });
      });

      return { previousEstimations };
    },
    onSuccess: () => {
      setShowAddItemDialog(false);
      setSelectedStockItem("");
      setItemQuantity(1);
      toast({
        title: "Success",
        description: "Item added to estimation",
      });
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEstimations) {
        queryClient.setQueryData(["/api/estimations"], context.previousEstimations);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to add item",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Delay refetch to allow optimistic update to be visible
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/estimations"] });
      }, 100);
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/estimations/${selectedEstimation?.id}/items/${itemId}`);
    },
    onMutate: async (itemId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/estimations"] });

      // Snapshot previous value
      const previousEstimations = queryClient.getQueryData(["/api/estimations"]);

      // Optimistically update the cache
      queryClient.setQueryData(["/api/estimations"], (old: Estimation[] | undefined) => {
        if (!old) return old;
        return old.map(estimation => {
          if (estimation.id === selectedEstimation?.id) {
            return {
              ...estimation,
              items: estimation.items.filter(item => item.id !== itemId)
            };
          }
          return estimation;
        });
      });

      return { previousEstimations };
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item removed from estimation",
      });
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEstimations) {
        queryClient.setQueryData(["/api/estimations"], context.previousEstimations);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to remove item",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Delay refetch to allow optimistic update to be visible
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/estimations"] });
      }, 100);
    },
  });

  // Update item quantity mutation
  const updateItemMutation = useMutation({
    mutationFn: async (data: { itemId: number; quantity: number }) => {
      const response = await apiRequest("PUT", `/api/estimations/${selectedEstimation?.id}/items/${data.itemId}`, {
        quantity: data.quantity,
      });
      return response.json();
    },
    onMutate: async ({ itemId, quantity }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/estimations"] });

      // Snapshot previous value
      const previousEstimations = queryClient.getQueryData(["/api/estimations"]);

      // Optimistically update the cache
      queryClient.setQueryData(["/api/estimations"], (old: Estimation[] | undefined) => {
        if (!old) return old;
        return old.map(estimation => {
          if (estimation.id === selectedEstimation?.id) {
            return {
              ...estimation,
              items: estimation.items.map(item => 
                item.id === itemId 
                  ? { ...item, quantity, totalCost: item.unitCost * quantity }
                  : item
              )
            };
          }
          return estimation;
        });
      });

      return { previousEstimations };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEstimations) {
        queryClient.setQueryData(["/api/estimations"], context.previousEstimations);
      }
      toast({
        title: "Error",
        description: err.message || "Failed to update item",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Delay refetch to allow optimistic update to be visible
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/estimations"] });
      }, 100);
    },
  });

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleAddItem = () => {
    if (!selectedEstimation || !selectedStockItem || itemQuantity <= 0) return;
    
    addItemMutation.mutate({
      estimationId: selectedEstimation.id,
      stockItemId: parseInt(selectedStockItem),
      quantity: itemQuantity,
    });
  };

  const handleRemoveItem = (itemId: number) => {
    removeItemMutation.mutate(itemId);
  };

  const handleUpdateItemQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) return;
    updateItemMutation.mutate({ itemId, quantity: newQuantity });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading estimations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estimations</h1>
          <p className="text-muted-foreground">
            Create and manage project estimations with stock items
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Estimation
        </Button>
      </div>

      {/* Estimations Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {estimations.map((estimation) => (
          <Card key={estimation.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-1">{estimation.name}</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <User className="mr-1 h-3 w-3" />
                    {estimation.clientName}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedEstimation(estimation);
                      setShowItemsDialog(true);
                    }}
                  >
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(estimation)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(estimation)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4" />
                <span className="line-clamp-1">{estimation.address}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm">
                  <Package className="mr-1 h-4 w-4" />
                  <span className="font-semibold">{estimation.items.length} items</span>
                </div>
                <Badge variant="secondary">
                  {formatDate(estimation.date)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Created {formatDistanceToNow(new Date(estimation.createdAt), { addSuffix: true })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {estimations.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No estimations yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first estimation to get started
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Estimation
          </Button>
        </div>
      )}

      {/* Create Estimation Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Estimation</DialogTitle>
            <DialogDescription>
              Create a new estimation. You can add items after creating it.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimation Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter estimation name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter client name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter project address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="techniqueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technique (Optional)</FormLabel>
                    <FormControl>
                      <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString() || ""}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a technique" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No technique selected</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="clientInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Information (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional client information" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Estimation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Estimation Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Estimation</DialogTitle>
            <DialogDescription>
              Update the estimation details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimation Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter estimation name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter client name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter project address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="techniqueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technique (Optional)</FormLabel>
                    <FormControl>
                      <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString() || ""}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a technique" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No technique selected</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="clientInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Information (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional client information" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update Estimation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Estimation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedEstimation?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Estimation Items</DialogTitle>
            <DialogDescription>
              Manage items for "{selectedEstimation?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Items</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedEstimation?.items.length || 0} items in estimation
                </p>
              </div>
              <Button onClick={() => setShowAddItemDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
            
            {selectedEstimation?.items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No items added yet</p>
                <p className="text-sm text-muted-foreground">Click "Add Item" to start building your estimation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEstimation?.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.stockItem.name}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="px-2 py-1 bg-muted rounded text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Item to Estimation</DialogTitle>
            <DialogDescription>
              Select a stock item and quantity to add to "{selectedEstimation?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stockItem">Stock Item</Label>
              <Select value={selectedStockItem} onValueChange={setSelectedStockItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a stock item" />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map((item) => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                  disabled={itemQuantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input 
                  id="quantity"
                  type="number"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-20 text-center"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setItemQuantity(itemQuantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem}
              disabled={!selectedStockItem || itemQuantity <= 0 || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}