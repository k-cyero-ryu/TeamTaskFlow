import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Filter, 
  X, 
  Calendar, 
  DollarSign, 
  Building, 
  Clock,
  Upload,
  FileText,
  Download,
  Trash2
} from "lucide-react";
import { format, parseISO, startOfWeek, startOfMonth, isWithinInterval } from "date-fns";

// Types based on our schema
type Expense = {
  id: number;
  serviceName: string;
  beneficiary: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly";
  lastPaidDate: string | null;
  nextPaymentDate: string;
  status: string;
  description: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string | null;
  createdBy: {
    id: number;
    username: string;
  };
  receipts: ExpenseReceipt[];
};

type ExpenseReceipt = {
  id: number;
  expenseId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  paymentDate: string;
  amount: number;
  notes: string | null;
  uploadedById: number;
  createdAt: string;
  uploadedBy: {
    id: number;
    username: string;
  };
};

// Form schemas
const expenseFormSchema = z.object({
  serviceName: z.string().min(1, "Service name is required"),
  beneficiary: z.string().min(1, "Beneficiary is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  lastPaidDate: z.string().optional(),
  nextPaymentDate: z.string().min(1, "Next payment date is required"),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
  description: z.string().optional(),
});

const receiptFormSchema = z.object({
  paymentDate: z.string().min(1, "Payment date is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  notes: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;
type ReceiptFormData = z.infer<typeof receiptFormSchema>;

export default function ExpensesPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [serviceNameFilter, setServiceNameFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Data fetching
  const { data: expenses = [], isLoading, refetch } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    // Filter by service name
    if (serviceNameFilter) {
      filtered = filtered.filter(expense => 
        expense.serviceName.toLowerCase().includes(serviceNameFilter.toLowerCase()) ||
        expense.beneficiary.toLowerCase().includes(serviceNameFilter.toLowerCase())
      );
    }

    // Filter by date range (using next payment date)
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

      filtered = filtered.filter(expense => {
        const expenseDate = parseISO(expense.nextPaymentDate);
        return isWithinInterval(expenseDate, { start: startDate, end: endDate });
      });
    }

    return filtered;
  }, [expenses, serviceNameFilter, dateRange, customStartDate, customEndDate]);

  // Create expense form
  const createForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      serviceName: "",
      beneficiary: "",
      amount: 0,
      frequency: "monthly",
      lastPaidDate: "",
      nextPaymentDate: "",
      status: "active",
      description: "",
    },
  });

  // Receipt upload form
  const receiptForm = useForm<ReceiptFormData>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: {
      paymentDate: "",
      amount: 0,
      notes: "",
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const response = await apiRequest("POST", "/api/expenses", {
        ...data,
        amount: Math.round(data.amount * 100), // Convert to cents
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setShowCreateDialog(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Expense created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create expense",
        variant: "destructive",
      });
    },
  });

  // Upload receipt mutation
  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ expenseId, data, file }: { expenseId: number; data: ReceiptFormData; file: File }) => {
      const formData = new FormData();
      formData.append('receipt', file);
      formData.append('paymentDate', data.paymentDate);
      formData.append('amount', Math.round(data.amount * 100).toString()); // Convert to cents
      if (data.notes) formData.append('notes', data.notes);

      const response = await fetch(`/api/expenses/${expenseId}/receipts`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload receipt');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setShowReceiptDialog(false);
      receiptForm.reset();
      setSelectedFile(null);
      toast({
        title: "Success",
        description: "Receipt uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload receipt",
        variant: "destructive",
      });
    },
  });

  const handleCreateExpense = (data: ExpenseFormData) => {
    createExpenseMutation.mutate(data);
  };

  const handleUploadReceipt = (data: ReceiptFormData) => {
    if (!selectedExpense || !selectedFile) return;
    uploadReceiptMutation.mutate({
      expenseId: selectedExpense.id,
      data,
      file: selectedFile,
    });
  };

  const formatAmount = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "monthly": return "bg-blue-100 text-blue-800";
      case "quarterly": return "bg-green-100 text-green-800";
      case "yearly": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "paused": return "bg-yellow-100 text-yellow-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Loading expenses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track company fixed expenses and payment history</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Expense</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateExpense)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Internet, Rent, Insurance" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="beneficiary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beneficiary</FormLabel>
                      <FormControl>
                        <Input placeholder="Company or person receiving payment" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="nextPaymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Payment Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="lastPaidDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Paid Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes about this expense" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={createExpenseMutation.isPending} className="w-full">
                  {createExpenseMutation.isPending ? "Creating..." : "Create Expense"}
                </Button>
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
          {(serviceNameFilter || dateRange !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setServiceNameFilter("");
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
                <Label htmlFor="serviceNameFilter">Filter by Service/Beneficiary</Label>
                <Input
                  id="serviceNameFilter"
                  placeholder="Search services or beneficiaries..."
                  value={serviceNameFilter}
                  onChange={(e) => setServiceNameFilter(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateRange">Date Range (Next Payment)</Label>
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

      {/* Expenses Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredExpenses.map((expense) => (
          <Card key={expense.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{expense.serviceName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{expense.beneficiary}</p>
                </div>
                <div className="flex gap-1">
                  <Badge className={getFrequencyColor(expense.frequency)}>
                    {expense.frequency}
                  </Badge>
                  <Badge className={getStatusColor(expense.status)}>
                    {expense.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">${formatAmount(expense.amount)}</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Next: {format(parseISO(expense.nextPaymentDate), "MMM dd, yyyy")}</span>
                </div>
                {expense.lastPaidDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Last: {format(parseISO(expense.lastPaidDate), "MMM dd, yyyy")}</span>
                  </div>
                )}
              </div>

              {expense.description && (
                <p className="text-sm text-muted-foreground">{expense.description}</p>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Receipts ({expense.receipts.length})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedExpense(expense);
                      setShowReceiptDialog(true);
                    }}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </div>
                
                {expense.receipts.length > 0 && (
                  <div className="space-y-1">
                    {expense.receipts.slice(0, 3).map((receipt) => (
                      <div key={receipt.id} className="flex items-center justify-between text-xs bg-muted p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{receipt.fileName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>${formatAmount(receipt.amount)}</span>
                          <span className="text-muted-foreground">
                            {format(parseISO(receipt.paymentDate), "MMM dd")}
                          </span>
                        </div>
                      </div>
                    ))}
                    {expense.receipts.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center py-1">
                        +{expense.receipts.length - 3} more receipts
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredExpenses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No expenses found matching your filters.</p>
        </div>
      )}

      {/* Receipt Upload Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Receipt</DialogTitle>
            {selectedExpense && (
              <p className="text-sm text-muted-foreground">
                For {selectedExpense.serviceName} - {selectedExpense.beneficiary}
              </p>
            )}
          </DialogHeader>
          <Form {...receiptForm}>
            <form onSubmit={receiptForm.handleSubmit(handleUploadReceipt)} className="space-y-4">
              <div>
                <Label htmlFor="receiptFile">Receipt File</Label>
                <Input
                  id="receiptFile"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Accepted formats: Images (JPG, PNG, GIF) and PDF files
                </p>
              </div>

              <FormField
                control={receiptForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={receiptForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={receiptForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes about this payment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={uploadReceiptMutation.isPending || !selectedFile} 
                className="w-full"
              >
                {uploadReceiptMutation.isPending ? "Uploading..." : "Upload Receipt"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}