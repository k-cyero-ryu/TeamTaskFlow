import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { FileText, Plus, Edit, Trash2, MapPin, Building, Calendar, DollarSign, Eye, Printer, Users } from "lucide-react";
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
import { useProformaPermissions } from "@/hooks/use-proforma-permissions";
import ProformaMemberManagement from "@/components/proforma-member-management";

// Types
type Estimation = {
  id: number;
  name: string;
  date: string;
  address: string;
  clientName: string;
  clientInformation: string | null;
  totalCost: number;
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

type Proforma = {
  id: number;
  estimationId: number;
  proformaNumber: string;
  profitPercentage: number;
  totalCost: number;
  totalPrice: number;
  companyName: string;
  companyAddress: string;
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogo: string | null;
  status: string;
  notes: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string | null;
  estimation: {
    id: number;
    name: string;
    clientName: string;
    clientInformation?: string | null;
    address?: string;
  };
  createdBy: {
    id: number;
    username: string;
  };
  items: Array<{
    id: number;
    stockItemName: string;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    totalPrice: number;
    stockItem: {
      id: number;
      name: string;
    };
  }>;
};

const proformaFormSchema = z.object({
  estimationId: z.number().min(1, "Please select an estimation"),
  companyId: z.number().min(1, "Please select a company"),
  profitPercentage: z.number().min(0, "Profit percentage must be 0 or greater").max(1000, "Profit percentage cannot exceed 1000%"),
  notes: z.string().optional(),
  validUntil: z.date().optional(),
});

type ProformaFormData = z.infer<typeof proformaFormSchema>;

export default function ProformasPage() {
  const { toast } = useToast();
  const { canManageAccess } = useProformaPermissions();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedProforma, setSelectedProforma] = useState<Proforma | null>(null);

  // Data fetching
  const { data: proformas = [], isLoading, refetch } = useQuery<Proforma[]>({
    queryKey: ["/api/proformas"],
  });

  const { data: estimations = [] } = useQuery<Estimation[]>({
    queryKey: ["/api/estimations"],
  });

  const { data: companies = [] } = useQuery<Array<{
    id: number;
    name: string;
    address: string;
    phone: string | null;
    email: string | null;
    logo: string | null;
    isDefault: boolean | null;
  }>>({
    queryKey: ["/api/companies"],
  });

  // Find default company or use first company
  const defaultCompany = companies.find(c => c.isDefault) || companies[0];

  // Create proforma form
  const createForm = useForm<ProformaFormData>({
    resolver: zodResolver(proformaFormSchema),
    defaultValues: {
      estimationId: 0,
      companyId: defaultCompany?.id || 0,
      profitPercentage: 25,
      notes: "",
      validUntil: undefined,
    },
  });

  // Watch estimation and company selection to calculate preview
  const selectedEstimationId = createForm.watch("estimationId");
  const selectedCompanyId = createForm.watch("companyId");
  const profitPercentage = createForm.watch("profitPercentage");
  const selectedEstimation = estimations.find(e => e.id === selectedEstimationId);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Calculate preview totals
  const previewData = selectedEstimation ? {
    totalCost: selectedEstimation.totalCost / 100, // Convert from cents
    totalPrice: (selectedEstimation.totalCost * (1 + profitPercentage / 100)) / 100,
    profit: (selectedEstimation.totalCost * (profitPercentage / 100)) / 100,
  } : null;

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: ProformaFormData) => {
      const response = await apiRequest("POST", "/api/proformas", data);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setShowCreateDialog(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Proforma created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create proforma",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/proformas/${id}`);
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Success",
        description: "Proforma deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete proforma",
        variant: "destructive",
      });
    },
  });

  // Handler functions
  const handleCreate = (data: ProformaFormData) => {
    createMutation.mutate(data);
  };

  const handleView = (proforma: Proforma) => {
    setSelectedProforma(proforma);
    setShowViewDialog(true);
  };

  const handleDelete = (proforma: Proforma) => {
    if (confirm(`Are you sure you want to delete proforma "${proforma.proformaNumber}"?`)) {
      deleteMutation.mutate(proforma.id);
    }
  };

  const handlePrint = (proforma: Proforma) => {
    // Open print view in new window
    const printWindow = window.open(`/api/proformas/${proforma.id}/print`, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading proformas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Proformas</h1>
          <p className="text-muted-foreground">Create professional quotes based on estimations</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageAccess && (
            <Button variant="outline" onClick={() => setShowMembersDialog(true)}>
              <Users className="mr-2 h-4 w-4" />
              Manage Access
            </Button>
          )}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Proforma
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Proforma</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-6">
                <FormField
                  control={createForm.control}
                  name="estimationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Estimation</FormLabel>
                      <FormControl>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || "0"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an estimation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0" disabled>Select an estimation</SelectItem>
                            {estimations.map((estimation) => (
                              <SelectItem key={estimation.id} value={estimation.id.toString()}>
                                {estimation.name} - {estimation.clientName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedEstimation && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-3">Estimation Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div>
                        <p><strong>Client:</strong> {selectedEstimation.clientName}</p>
                        <p><strong>Items:</strong> {selectedEstimation.items.length}</p>
                      </div>
                      <div>
                        <p><strong>Address:</strong> {selectedEstimation.address}</p>
                        <p><strong>Total Cost:</strong> {formatCurrency(selectedEstimation.totalCost)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedCompany && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-3">Selected Company</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                      <div>
                        <p><strong>Name:</strong> {selectedCompany.name}</p>
                        <p><strong>Email:</strong> {selectedCompany.email || "Not provided"}</p>
                      </div>
                      <div>
                        <p><strong>Phone:</strong> {selectedCompany.phone || "Not provided"}</p>
                        <p><strong>Address:</strong> {selectedCompany.address}</p>
                      </div>
                    </div>
                  </div>
                )}

                <FormField
                  control={createForm.control}
                  name="profitPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profit Percentage (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="1000" 
                          step="0.1"
                          {...field} 
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          placeholder="Enter profit percentage" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {previewData && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <h4 className="font-medium mb-3">Price Preview</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="font-medium">{formatCurrency(previewData.totalCost * 100)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Profit ({profitPercentage}%)</p>
                        <p className="font-medium text-green-600">{formatCurrency(previewData.profit * 100)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Selling Price</p>
                        <p className="font-semibold text-lg">{formatCurrency(previewData.totalPrice * 100)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <FormField
                    control={createForm.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || "0"}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a company" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0" disabled>Select a company</SelectItem>
                              {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id.toString()}>
                                  {company.name} {company.isDefault && "(Default)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <h3 className="text-lg font-medium mb-4">Additional Information</h3>
                    <div className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="validUntil"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valid Until (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Internal notes" rows={4} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-8 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Proforma"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {proformas.map((proforma) => (
          <Card key={proforma.id} className="cursor-pointer hover:shadow-lg transition-shadow relative">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{proforma.proformaNumber}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building className="h-4 w-4" />
                    <span>{proforma.estimation.clientName}</span>
                  </div>
                </div>
                {proforma.companyLogo && (
                  <div className="flex-shrink-0 ml-4">
                    <img 
                      src={`/api/uploads/file${proforma.companyLogo}`}
                      alt={`${proforma.companyName} logo`}
                      className="w-16 h-12 object-contain rounded border bg-white"
                    />
                  </div>
                )}
                {!proforma.companyLogo && (
                  <div className="flex-shrink-0 ml-4 w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                    LOGO
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span>{proforma.estimation.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4" />
                  <span>Cost: {formatCurrency(proforma.totalCost)} | Price: {formatCurrency(proforma.totalPrice)} ({proforma.profitPercentage}% profit)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(proforma.createdAt), "MMM d, yyyy")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Status: <span className="capitalize">{proforma.status}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleView(proforma)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePrint(proforma)}
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(proforma)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Proforma Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProforma ? `Proforma ${selectedProforma.proformaNumber}` : "View Proforma"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedProforma && (
            <div className="space-y-6">
              {/* Company & Client Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Company Information</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>{selectedProforma.companyName}</strong></p>
                    <p>{selectedProforma.companyAddress}</p>
                    {selectedProforma.companyPhone && <p>Phone: {selectedProforma.companyPhone}</p>}
                    {selectedProforma.companyEmail && <p>Email: {selectedProforma.companyEmail}</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Client Information</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>{selectedProforma.estimation.clientName}</strong></p>
                    {selectedProforma.estimation.address && <p>{selectedProforma.estimation.address}</p>}
                    {selectedProforma.estimation.clientInformation && (
                      <p>{selectedProforma.estimation.clientInformation}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h3 className="font-semibold mb-2">Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">Item</th>
                        <th className="text-right p-3">Qty</th>
                        <th className="text-right p-3">Unit Cost</th>
                        <th className="text-right p-3">Unit Price</th>
                        <th className="text-right p-3">Total Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProforma.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">{item.stockItemName}</td>
                          <td className="text-right p-3">{item.quantity}</td>
                          <td className="text-right p-3 text-muted-foreground">{formatCurrency(item.unitCost)}</td>
                          <td className="text-right p-3">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-right p-3 font-medium">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted">
                      <tr>
                        <td colSpan={3} className="text-right p-3 font-medium">Total Cost:</td>
                        <td className="text-right p-3 font-medium text-muted-foreground">{formatCurrency(selectedProforma.totalCost)}</td>
                        <td className="text-right p-3"></td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="text-right p-3 font-medium">Total Profit:</td>
                        <td className="text-right p-3 font-medium text-green-600">{formatCurrency(selectedProforma.totalPrice - selectedProforma.totalCost)}</td>
                        <td className="text-right p-3"></td>
                      </tr>
                      <tr className="border-t-2">
                        <td colSpan={3} className="text-right p-3 font-semibold">Total Amount:</td>
                        <td className="text-right p-3"></td>
                        <td className="text-right p-3 font-semibold text-lg">{formatCurrency(selectedProforma.totalPrice)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p><strong>Profit Margin:</strong> {selectedProforma.profitPercentage}%</p>
                  <p><strong>Status:</strong> <span className="capitalize">{selectedProforma.status}</span></p>
                  {selectedProforma.validUntil && (
                    <p><strong>Valid Until:</strong> {format(new Date(selectedProforma.validUntil), "MMM d, yyyy")}</p>
                  )}
                </div>
                <div>
                  <p><strong>Created:</strong> {format(new Date(selectedProforma.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
                  <p><strong>Created by:</strong> {selectedProforma.createdBy.username}</p>
                </div>
              </div>

              {selectedProforma.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedProforma.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedProforma && (
              <Button onClick={() => handlePrint(selectedProforma)}>
                <Printer className="h-4 w-4 mr-2" />
                Print Proforma
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Management Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Manage Proforma Access</DialogTitle>
          </DialogHeader>
          <ProformaMemberManagement />
        </DialogContent>
      </Dialog>
    </div>
  );
}