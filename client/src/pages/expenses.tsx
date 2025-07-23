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
import { useI18n } from "@/i18n";
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
  Trash2,
  CheckCircle,
  Edit
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
  const { t } = useI18n();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showReceiptViewer, setShowReceiptViewer] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
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

  // Edit expense form
  const editForm = useForm<ExpenseFormData>({
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

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ExpenseFormData }) => {
      const response = await apiRequest("PUT", `/api/expenses/${id}`, {
        ...data,
        amount: Math.round(data.amount * 100), // Convert to cents
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setShowEditDialog(false);
      editForm.reset();
      toast({
        title: "Success",
        description: "Expense updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update expense",
        variant: "destructive",
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/expenses/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      const response = await apiRequest("POST", `/api/expenses/${expenseId}/mark-paid`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: t('markedAsPaidSuccess'),
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    editForm.reset({
      serviceName: expense.serviceName,
      beneficiary: expense.beneficiary,
      amount: expense.amount / 100, // Convert from cents
      frequency: expense.frequency as "monthly" | "quarterly" | "yearly",
      lastPaidDate: expense.lastPaidDate ? format(parseISO(expense.lastPaidDate), "yyyy-MM-dd") : "",
      nextPaymentDate: format(parseISO(expense.nextPaymentDate), "yyyy-MM-dd"),
      status: expense.status as "active" | "paused" | "cancelled",
      description: expense.description || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdateExpense = (data: ExpenseFormData) => {
    if (selectedExpense) {
      updateExpenseMutation.mutate({ id: selectedExpense.id, data });
    }
  };

  const handleDeleteExpense = (expense: Expense) => {
    if (confirm(`Are you sure you want to delete the expense "${expense.serviceName}"? This action cannot be undone.`)) {
      deleteExpenseMutation.mutate(expense.id);
    }
  };

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

  // Calculate expense statistics
  const expenseStats = useMemo(() => {
    if (!expenses) return null;

    const stats = {
      total: { count: 0, amount: 0 },
      monthly: { count: 0, amount: 0 },
      quarterly: { count: 0, amount: 0 },
      yearly: { count: 0, amount: 0 },
      active: { count: 0, amount: 0 },
      paused: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 }
    };

    expenses.forEach(expense => {
      stats.total.count++;
      stats.total.amount += expense.amount;
      
      // By frequency
      stats[expense.frequency as keyof typeof stats].count++;
      stats[expense.frequency as keyof typeof stats].amount += expense.amount;
      
      // By status
      stats[expense.status as keyof typeof stats].count++;
      stats[expense.status as keyof typeof stats].amount += expense.amount;
    });

    return stats;
  }, [expenses]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-14">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">{t('loading')}...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('expenses')}</h1>
          <p className="text-muted-foreground">{t('expenseDescription')}</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('newExpense')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('createNewExpense')}</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateExpense)} className="space-y-6">
                {/* First row - Service Name and Beneficiary */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="serviceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('serviceName')}</FormLabel>
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
                        <FormLabel>{t('beneficiary')}</FormLabel>
                        <FormControl>
                          <Input placeholder="Company or person receiving payment" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Second row - Amount and Frequency */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('amount')} ($)</FormLabel>
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
                        <FormLabel>{t('frequency')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectFrequency')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">{t('monthly')}</SelectItem>
                            <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                            <SelectItem value="yearly">{t('yearly')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Third row - Payment dates */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="nextPaymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('nextPaymentDate')}</FormLabel>
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
                        <FormLabel>{t('lastPaidDate')} (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Description - full width */}
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('description')} (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes about this expense" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={createExpenseMutation.isPending} className="w-full">
                  {createExpenseMutation.isPending ? t('creating') : t('createExpense')}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Stats */}
      {expenseStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatAmount(expenseStats.total.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.total.count} expense{expenseStats.total.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">${formatAmount(expenseStats.monthly.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.monthly.count} expense{expenseStats.monthly.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quarterly</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${formatAmount(expenseStats.quarterly.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.quarterly.count} expense{expenseStats.quarterly.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yearly</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">${formatAmount(expenseStats.yearly.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.yearly.count} expense{expenseStats.yearly.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Overview */}
      {expenseStats && (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Expenses</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${formatAmount(expenseStats.active.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.active.count} active expense{expenseStats.active.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paused Expenses</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">${formatAmount(expenseStats.paused.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.paused.count} paused expense{expenseStats.paused.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cancelled Expenses</CardTitle>
              <X className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">${formatAmount(expenseStats.cancelled.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {expenseStats.cancelled.count} cancelled expense{expenseStats.cancelled.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Controls */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {t('filters')}
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
              {t('clearFilters')}
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="serviceNameFilter">{t('filterByServiceBeneficiary')}</Label>
                <Input
                  id="serviceNameFilter"
                  placeholder={t('searchServicesOrBeneficiaries')}
                  value={serviceNameFilter}
                  onChange={(e) => setServiceNameFilter(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateRange">{t('dateRangeNextPayment')}</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectDateRange')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allTime')}</SelectItem>
                    <SelectItem value="lastWeek">{t('lastWeek')}</SelectItem>
                    <SelectItem value="lastMonth">{t('lastMonth')}</SelectItem>
                    <SelectItem value="custom">{t('customRange')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === "custom" && (
                <>
                  <div>
                    <Label htmlFor="startDate">{t('startDate')}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">{t('endDate')}</Label>
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsPaidMutation.mutate(expense.id)}
                      disabled={markAsPaidMutation.isPending}
                    >
                      <CheckCircle className="mr-1 h-3 w-3" />
                      {markAsPaidMutation.isPending ? t('markingAsPaid') : t('markAsPaid')}
                    </Button>
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
                </div>
                
                {/* Edit and Delete buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditExpense(expense)}
                    className="flex-1"
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteExpense(expense)}
                    disabled={deleteExpenseMutation.isPending}
                    className="flex-1"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
                
                {expense.receipts.length > 0 && (
                  <div className="space-y-1">
                    {expense.receipts.slice(0, 3).map((receipt) => (
                      <div 
                        key={receipt.id} 
                        className="flex items-center justify-between text-xs bg-muted p-2 rounded cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => {
                          setSelectedReceipt(receipt);
                          setShowReceiptViewer(true);
                        }}
                      >
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
                      <div 
                        className="text-xs text-muted-foreground text-center py-1 cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => {
                          setSelectedExpense(expense);
                          setShowReceiptViewer(true);
                        }}
                      >
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

      {/* Edit Expense Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateExpense)} className="space-y-6">
              {/* First row - Service Name and Beneficiary */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
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
                  control={editForm.control}
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
              </div>

              {/* Second row - Amount and Frequency */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
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
                  control={editForm.control}
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
              </div>

              {/* Third row - Payment Dates */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
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
                  control={editForm.control}
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
              </div>

              {/* Fourth row - Status */}
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={editForm.control}
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

              <div className="flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateExpenseMutation.isPending}
                >
                  {updateExpenseMutation.isPending ? "Updating..." : "Update Expense"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={showReceiptViewer} onOpenChange={setShowReceiptViewer}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Receipt Viewer</DialogTitle>
            {selectedReceipt && (
              <p className="text-sm text-muted-foreground">
                {selectedReceipt.fileName} - ${formatAmount(selectedReceipt.amount)} on {format(parseISO(selectedReceipt.paymentDate), "MMM dd, yyyy")}
              </p>
            )}
            {selectedExpense && !selectedReceipt && (
              <p className="text-sm text-muted-foreground">
                All receipts for {selectedExpense.serviceName}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedReceipt ? (
              // Single receipt view
              <div className="space-y-4">
                {selectedReceipt.mimeType.startsWith('image/') ? (
                  <div className="flex justify-center">
                    <img 
                      src={`/api/uploads/file/${selectedReceipt.filePath}`} 
                      alt={selectedReceipt.fileName}
                      className="max-w-full max-h-[60vh] object-contain border rounded"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">{selectedReceipt.fileName}</p>
                    <p className="text-sm text-muted-foreground mb-4">PDF File</p>
                    <Button
                      onClick={() => window.open(`/api/uploads/file/${selectedReceipt.filePath}`, '_blank')}
                      variant="outline"
                    >
                      Open PDF
                    </Button>
                  </div>
                )}
                {selectedReceipt.notes && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Notes:</h4>
                    <p className="text-sm">{selectedReceipt.notes}</p>
                  </div>
                )}
              </div>
            ) : selectedExpense ? (
              // All receipts view
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {selectedExpense.receipts.map((receipt) => (
                  <div 
                    key={receipt.id}
                    className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                    <div className="aspect-square mb-2 border rounded overflow-hidden">
                      {receipt.mimeType.startsWith('image/') ? (
                        <img 
                          src={`/api/uploads/file/${receipt.filePath}`} 
                          alt={receipt.fileName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{receipt.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      ${formatAmount(receipt.amount)} - {format(parseISO(receipt.paymentDate), "MMM dd")}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}