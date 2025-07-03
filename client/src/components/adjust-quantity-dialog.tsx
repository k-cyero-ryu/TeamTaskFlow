import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const adjustQuantitySchema = z.object({
  quantity: z.number().min(0, "Quantity must be positive"),
  reason: z.string().optional(),
});

type AdjustQuantityForm = z.infer<typeof adjustQuantitySchema>;

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

interface AdjustQuantityDialogProps {
  item: StockItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}

export default function AdjustQuantityDialog({ 
  item, 
  open, 
  onOpenChange, 
  onClose 
}: AdjustQuantityDialogProps) {
  const { toast } = useToast();
  const [adjustmentType, setAdjustmentType] = useState<"set" | "add" | "remove">("set");

  const form = useForm<AdjustQuantityForm>({
    resolver: zodResolver(adjustQuantitySchema),
    defaultValues: {
      quantity: item.quantity,
      reason: "",
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: AdjustQuantityForm) => {
      let finalQuantity = data.quantity;
      
      if (adjustmentType === "add") {
        finalQuantity = item.quantity + data.quantity;
      } else if (adjustmentType === "remove") {
        finalQuantity = Math.max(0, item.quantity - data.quantity);
      }

      const res = await apiRequest("POST", `/api/stock/items/${item.id}/adjust`, {
        quantity: finalQuantity,
        reason: data.reason || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock/items"] });
      toast({
        title: "Success",
        description: "Stock quantity adjusted successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust stock quantity",
        variant: "destructive",
      });
    },
  });

  const calculateFinalQuantity = () => {
    const adjustValue = form.watch("quantity") || 0;
    
    switch (adjustmentType) {
      case "add":
        return item.quantity + adjustValue;
      case "remove":
        return Math.max(0, item.quantity - adjustValue);
      case "set":
      default:
        return adjustValue;
    }
  };

  const onSubmit = (data: AdjustQuantityForm) => {
    adjustMutation.mutate(data);
  };

  const handleTypeChange = (type: "set" | "add" | "remove") => {
    setAdjustmentType(type);
    // Reset quantity field when changing type
    if (type === "set") {
      form.setValue("quantity", item.quantity);
    } else {
      form.setValue("quantity", 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock Quantity</DialogTitle>
          <DialogDescription>
            Modify the quantity for "{item.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Item Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{item.name}</span>
              {item.quantity < 10 && (
                <Badge variant="destructive" className="text-xs">
                  Low Stock
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Current quantity: <span className="font-medium">{item.quantity}</span>
            </div>
            {item.assignedUser && (
              <div className="text-sm text-muted-foreground">
                Assigned to: <span className="font-medium">{item.assignedUser.username}</span>
              </div>
            )}
          </div>

          {/* Adjustment Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Adjustment Type</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustmentType === "set" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange("set")}
                className="flex-1"
              >
                <Package className="h-3 w-3 mr-1" />
                Set To
              </Button>
              <Button
                type="button"
                variant={adjustmentType === "add" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange("add")}
                className="flex-1"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Add
              </Button>
              <Button
                type="button"
                variant={adjustmentType === "remove" ? "default" : "outline"}
                size="sm"
                onClick={() => handleTypeChange("remove")}
                className="flex-1"
              >
                <TrendingDown className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {adjustmentType === "set" ? "New Quantity" : 
                       adjustmentType === "add" ? "Quantity to Add" : 
                       "Quantity to Remove"}
                    </FormLabel>
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

              {/* Preview */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                <div className="text-sm">
                  <span className="text-muted-foreground">Final quantity will be: </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {calculateFinalQuantity()}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({calculateFinalQuantity() > item.quantity ? "+" : ""}
                    {calculateFinalQuantity() - item.quantity})
                  </span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter reason for quantity adjustment..."
                        rows={3}
                        {...field}
                      />
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
                  disabled={adjustMutation.isPending}
                >
                  {adjustMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adjusting...
                    </>
                  ) : (
                    "Adjust Quantity"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}