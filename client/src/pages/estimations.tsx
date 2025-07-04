import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfWeek, startOfMonth, isWithinInterval, parseISO } from "date-fns";
import { Calendar, Plus, Edit, Trash2, MapPin, User, Package, Minus, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Types
type StockItem = {
  id: number;
  name: string;
  cost: number;
};

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
  technique?: {
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

const estimationFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  date: z.date(),
  address: z.string().min(1, "Address is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientInformation: z.string().optional(),
  techniqueId: z.number().optional(),
});

type EstimationFormData = z.infer<typeof estimationFormSchema>;

export default function EstimationsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [selectedEstimation, setSelectedEstimation] = useState<Estimation | null>(null);
  const [selectedStockItem, setSelectedStockItem] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState(1);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Data fetching
  const { data: estimations = [], isLoading, refetch } = useQuery<Estimation[]>({
    queryKey: ["/api/estimations"],
  });

  // Filter estimations
  const filteredEstimations = useMemo(() => {
    let filtered = estimations;

    // Filter by name
    if (nameFilter) {
      filtered = filtered.filter(estimation => 
        estimation.name.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
      let endDate = now;

      switch (dateRange) {
        case "lastWeek":
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          break;
        case "lastMonth":
          startDate = startOfMonth(now);
          break;
        case "custom":
          if (customStartDate && customEndDate) {
            startDate = parseISO(customStartDate);
            endDate = parseISO(customEndDate);
          } else {
            return filtered;
          }
          break;
        default:
          return filtered;
      }

      filtered = filtered.filter(estimation => {
        const estimationDate = parseISO(estimation.date);
        return isWithinInterval(estimationDate, { start: startDate, end: endDate });
      });
    }

    return filtered;
  }, [estimations, nameFilter, dateRange, customStartDate, customEndDate]);

  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ["/api/stock/items"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

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
    defaultValues: {
      name: "",
      date: new Date(),
      address: "",
      clientName: "",
      clientInformation: "",
      techniqueId: undefined,
    },
  });

  // Mutations with immediate refresh
  const createMutation = useMutation({
    mutationFn: async (data: EstimationFormData) => {
      const response = await apiRequest("POST", "/api/estimations", data);
      return response.json();
    },
    onSuccess: () => {
      refetch();
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

  const updateMutation = useMutation({
    mutationFn: async (data: EstimationFormData & { id: number }) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PUT", `/api/estimations/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      refetch();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/estimations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      refetch();
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

  const addItemMutation = useMutation({
    mutationFn: async (data: { estimationId: number; stockItemId: number; quantity: number }) => {
      const response = await apiRequest("POST", `/api/estimations/${data.estimationId}/items`, {
        stockItemId: data.stockItemId,
        quantity: data.quantity,
      });
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setShowAddItemDialog(false);
      setSelectedStockItem("");
      setItemQuantity(1);
      toast({
        title: "Success",
        description: "Item added to estimation",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to add item",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await apiRequest("DELETE", `/api/estimations/items/${itemId}`);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Success",
        description: "Item removed from estimation",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to remove item",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { itemId: number; quantity: number }) => {
      if (!selectedEstimation) throw new Error("No estimation selected");
      const response = await apiRequest("PUT", `/api/estimations/${selectedEstimation.id}/items/${data.itemId}`, {
        quantity: data.quantity,
      });
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Success",
        description: "Item quantity updated",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  // Handler functions
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
      techniqueId: estimation.techniqueId || undefined,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = (data: EstimationFormData) => {
    if (!selectedEstimation) return;
    updateMutation.mutate({ ...data, id: selectedEstimation.id });
  };

  const handleDelete = (estimation: Estimation) => {
    if (confirm(`Are you sure you want to delete "${estimation.name}"?`)) {
      deleteMutation.mutate(estimation.id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading estimations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Estimations</h1>
          <p className="text-muted-foreground">Create and manage project estimations with stock items</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Estimation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Estimation</DialogTitle>
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
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                        />
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
                  name="techniqueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technique (Optional)</FormLabel>
                      <FormControl>
                        <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} value={field.value?.toString() || "none"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a technique" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No technique selected</SelectItem>
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
                        <Textarea {...field} value={field.value || ""} placeholder="Additional client information" rows={3} />
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
      </div>

      {/* Filter Controls */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          {(nameFilter || dateRange !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNameFilter("");
                setDateRange("all");
                setCustomStartDate("");
                setCustomEndDate("");
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="nameFilter">Filter by Name</Label>
                <Input
                  id="nameFilter"
                  placeholder="Search estimations..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateRange">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="lastWeek">Last Week</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === "custom" && (
                <>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEstimations.map((estimation) => (
          <Card key={estimation.id} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{estimation.name}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{estimation.technique?.username || 'No technique assigned'}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{estimation.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  <span>{estimation.items.length} items</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(estimation.date), "MMM d, yyyy")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created {format(new Date(estimation.createdAt), "MMM d 'at' h:mm a")}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedEstimation(estimation);
                    setShowAddItemDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(estimation)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(estimation)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Estimation</DialogTitle>
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
                        value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
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
                name="techniqueId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technique (Optional)</FormLabel>
                    <FormControl>
                      <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} value={field.value?.toString() || "none"}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a technique" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No technique selected</SelectItem>
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
                      <Textarea {...field} value={field.value || ""} placeholder="Additional client information" rows={3} />
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

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedEstimation ? `Manage Items - ${selectedEstimation.name}` : "Manage Items"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="stock-item">Stock Item</Label>
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
              <div className="w-24">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddItem} disabled={!selectedStockItem || addItemMutation.isPending}>
                  {addItemMutation.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>

            {selectedEstimation && selectedEstimation.items.length > 0 && (
              <div className="mt-6">
                <Label>Current Items</Label>
                <div className="mt-2 space-y-2">
                  {selectedEstimation.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.stockItem.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updateItemMutation.isPending}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                          disabled={updateItemMutation.isPending}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={removeItemMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAddItemDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}