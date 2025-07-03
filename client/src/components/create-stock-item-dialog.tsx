import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const createStockItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  cost: z.number().min(0, "Cost must be positive"),
  quantity: z.number().min(0, "Quantity must be positive"),
  assignedUserId: z.number().nullable().optional(),
});

type CreateStockItemForm = z.infer<typeof createStockItemSchema>;

interface CreateStockItemDialogProps {
  onClose: () => void;
}

export default function CreateStockItemDialog({ onClose }: CreateStockItemDialogProps) {
  const { toast } = useToast();
  const [costDisplay, setCostDisplay] = useState("");

  // Fetch users for assignment
  const { data: users = [] } = useQuery<{ id: number; username: string }[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<CreateStockItemForm>({
    resolver: zodResolver(createStockItemSchema),
    defaultValues: {
      name: "",
      description: "",
      cost: 0,
      quantity: 0,
      assignedUserId: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateStockItemForm) => {
      const res = await apiRequest("POST", "/api/stock/items", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/items"] });
      toast({
        title: "Success",
        description: "Stock item created successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create stock item",
        variant: "destructive",
      });
    },
  });

  const handleCostChange = (value: string) => {
    setCostDisplay(value);
    
    // Convert display value to cents
    const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(numericValue)) {
      form.setValue('cost', Math.round(numericValue * 100));
    }
  };

  const onSubmit = (data: CreateStockItemForm) => {
    createMutation.mutate({
      ...data,
      description: data.description || undefined,
    });
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add New Stock Item</DialogTitle>
        <DialogDescription>
          Create a new inventory item to track quantities and costs.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter item name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter item description (optional)"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost *</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="$0.00"
                      value={costDisplay}
                      onChange={(e) => handleCostChange(e.target.value)}
                      onBlur={() => {
                        if (costDisplay) {
                          const formatted = (form.getValues('cost') / 100).toFixed(2);
                          setCostDisplay(`$${formatted}`);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="assignedUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign to User</FormLabel>
                <FormControl>
                  <Select
                    value={field.value?.toString() || "none"}
                    onValueChange={(value) => 
                      field.onChange(value === "none" ? null : parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users.filter(u => u.id && u.username).map((user) => (
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Item"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}