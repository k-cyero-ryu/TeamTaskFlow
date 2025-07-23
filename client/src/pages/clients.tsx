import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Edit, Trash2, Users, Search, Phone, Mail, MessageCircle, Building, User, Settings, Link, FileText, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Client, InsertClient, Service, ClientService, InsertClientService } from '@shared/schema';
import { format } from 'date-fns';

// File viewing component for different file types
function FileViewer({ filePath, onClose }: { filePath: string; onClose: () => void }) {
  const fileExtension = filePath.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');
  const isPDF = fileExtension === 'pdf';
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Contract File</DialogTitle>
          <DialogDescription>
            {filePath.split('/').pop()}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {isImage ? (
            <img 
              src={`/api/uploads/file/${filePath.replace('/uploads/', '')}`} 
              alt="Contract file" 
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
          ) : isPDF ? (
            <iframe 
              src={`/api/uploads/file/${filePath.replace('/uploads/', '')}`} 
              className="w-full h-[70vh] border-0"
              title="Contract PDF"
            />
          ) : (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Preview not available for this file type
              </p>
              <Button 
                onClick={() => window.open(`/api/uploads/file/${filePath.replace('/uploads/', '')}`, '_blank')}
                className="mr-2"
              >
                Open in New Tab
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              const link = document.createElement('a');
              link.href = `/api/uploads/file/${filePath.replace('/uploads/', '')}`;
              link.download = filePath.split('/').pop() || 'contract';
              link.click();
            }}
          >
            Download
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const contactInfoSchema = z.object({
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
}).optional();

const insertClientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  address: z.string().optional(),
  type: z.enum(['individual', 'company'], {
    required_error: 'Please select a client type'
  }),
  startDate: z.string().optional(),
  contactInfo: contactInfoSchema,
  isActive: z.boolean().default(true),
});

type ClientFormData = z.infer<typeof insertClientSchema>;

const clientTypeLabels = {
  individual: 'Individual',
  company: 'Company'
};

const clientTypeColors = {
  individual: 'bg-blue-100 text-blue-800',
  company: 'bg-purple-100 text-purple-800'
};

function ClientForm({ client, onSuccess }: { client?: Client; onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<ClientFormData>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: client?.name || '',
      address: client?.address || '',
      type: client?.type as ClientFormData['type'] || 'individual',
      startDate: client?.startDate ? new Date(client.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      contactInfo: {
        phone: (client?.contactInfo as any)?.phone || '',
        whatsapp: (client?.contactInfo as any)?.whatsapp || '',
        email: (client?.contactInfo as any)?.email || '',
      },
      isActive: client?.isActive ?? true,
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => apiRequest('POST', '/api/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({ title: 'Client created successfully' });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: 'Error creating client', description: error.message, variant: 'destructive' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: ClientFormData) => apiRequest('PUT', `/api/clients/${client?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({ title: 'Client updated successfully' });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: 'Error updating client', description: error.message, variant: 'destructive' });
    }
  });

  const onSubmit = (data: ClientFormData) => {
    if (client) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
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
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(clientTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Enter client address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <Label className="text-sm font-medium">Contact Information</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="contactInfo.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Phone number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactInfo.whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="WhatsApp number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactInfo.email"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="Email address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            {...form.register('isActive')}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="isActive">Active</Label>
        </div>

        <div className="flex gap-2">
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {client ? 'Update' : 'Create'} Client
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Service Assignment Form Component
function ServiceAssignmentForm({ client, onSuccess }: { client: Client; onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);

  const serviceAssignmentSchema = z.object({
    serviceId: z.number().min(1, 'Please select a service'),
    characteristics: z.array(z.enum(['remote', 'in_presence', 'one_time', 'short_term', 'long_term'])).min(1, 'Select at least one characteristic'),
    price: z.number().min(0, 'Price must be positive'),
    frequency: z.enum(['monthly', 'yearly', 'weekly', 'one_time'], {
      required_error: 'Please select frequency'
    }),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().default(true),
  });

  type ServiceAssignmentData = z.infer<typeof serviceAssignmentSchema>;

  const form = useForm<ServiceAssignmentData>({
    resolver: zodResolver(serviceAssignmentSchema),
    defaultValues: {
      serviceId: 0,
      characteristics: [],
      price: 0,
      frequency: 'monthly',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      notes: '',
      isActive: true,
    }
  });

  const { data: services = [] } = useQuery({
    queryKey: ['/api/services'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/services');
      return response.json() as Promise<Service[]>;
    }
  });

  const assignMutation = useMutation({
    mutationFn: async (data: ServiceAssignmentData) => {
      console.log('Assigning service with data:', data);
      
      const response = await apiRequest('POST', '/api/client-services', {
        clientId: client.id,
        serviceId: data.serviceId,
        characteristics: data.characteristics,
        price: data.price,
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate || null,
        notes: data.notes || null,
        contractFile: uploadedFilePath,
        isActive: data.isActive,
      });
      
      console.log('Service assignment response:', response.status);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-services'] });
      toast({ title: 'Service assigned successfully' });
      onSuccess();
      form.reset();
      setUploadedFilePath(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error assigning service', description: error.message, variant: 'destructive' });
    }
  });

  const onSubmit = (data: ServiceAssignmentData) => {
    console.log('Form submitted with data:', data);
    console.log('Form errors:', form.formState.errors);
    assignMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="serviceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service</FormLabel>
                <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="characteristics"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Characteristics</FormLabel>
                <div className="space-y-2">
                  {['remote', 'in_presence', 'one_time', 'short_term', 'long_term'].map((characteristic) => (
                    <div key={characteristic} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={characteristic}
                        checked={field.value.includes(characteristic)}
                        onChange={(e) => {
                          const newValue = e.target.checked
                            ? [...field.value, characteristic]
                            : field.value.filter(c => c !== characteristic);
                          field.onChange(newValue);
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={characteristic} className="text-sm capitalize">
                        {characteristic.replace('_', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price ($)</FormLabel>
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
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="one_time">One Time</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date (Optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Contract File (Optional)</label>
          <Input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  console.log('Uploading file:', file.name);
                  const formData = new FormData();
                  formData.append('file', file);
                  
                  const response = await apiRequest('POST', '/api/uploads', formData);
                  console.log('Upload response status:', response.status);
                  console.log('Upload response ok:', response.ok);
                  
                  if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                  }
                  
                  const result = await response.json();
                  console.log('Upload result:', result);
                  
                  if (result.path) {
                    setUploadedFilePath(result.path);
                    console.log('File uploaded successfully:', result.path);
                    toast({ title: 'File uploaded successfully' });
                  } else {
                    throw new Error('No file path returned from server');
                  }
                } catch (error) {
                  console.error('File upload failed:', error);
                  console.error('Error details:', error.message);
                  toast({ title: 'File upload failed', variant: 'destructive' });
                }
              }
            }}
          />
          {uploadedFilePath && (
            <p className="text-sm text-green-600">File uploaded: {uploadedFilePath.split('/').pop()}</p>
          )}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes about this service assignment" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="assignmentActive"
            {...form.register('isActive')}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="assignmentActive">Active</Label>
        </div>

        <Button type="submit" disabled={assignMutation.isPending}>
          {assignMutation.isPending ? 'Assigning...' : 'Assign Service'}
        </Button>
      </form>
    </Form>
  );
}

// Contract File Editor Component
function ContractFileEditor({ service, onClose, onSuccess }: { 
  service: any; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: { contractFile: string }) => {
      const response = await apiRequest('PUT', `/api/client-services/${service.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-services'] });
      toast({ title: 'Contract file updated successfully' });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error updating contract file', description: error.message, variant: 'destructive' });
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          setUploadedFilePath(result.path);
        } else {
          toast({ title: 'File upload failed', variant: 'destructive' });
        }
      } catch (error) {
        console.error('File upload failed:', error);
        toast({ title: 'File upload failed', variant: 'destructive' });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSubmit = () => {
    if (uploadedFilePath) {
      updateMutation.mutate({ contractFile: uploadedFilePath });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Contract File</DialogTitle>
          <DialogDescription>
            Replace the contract file for this service assignment
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <span className="font-medium">Current File:</span>
            <div className="mt-1 text-sm text-gray-600">
              {service.contractFile?.split('/').pop()}
            </div>
            {service.contractFileUploadDate && (
              <div className="text-xs text-gray-500 mt-1">
                Uploaded: {format(new Date(service.contractFileUploadDate), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="contractFile">New Contract File</Label>
            <Input
              id="contractFile"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            {uploadedFilePath && (
              <p className="text-sm text-green-600 mt-1">
                New file ready: {uploadedFilePath.split('/').pop()}
              </p>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!uploadedFilePath || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Contract'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ClientServicesManager component removed - moved to full page at /clients/:id

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients');
      return response.json() as Promise<Client[]>;
    }
  });

  // Fetch all client services for dashboard calculations
  const { data: allClientServices = [] } = useQuery({
    queryKey: ['/api/client-services'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/client-services');
      return response.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({ title: 'Client deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error deleting client', description: error.message, variant: 'destructive' });
    }
  });

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || client.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this client?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingClient(null);
  };

  const handleManageServices = (client: Client) => {
    setLocation(`/clients/${client.id}`);
  };

  // Calculate income statistics from client services
  const incomeStats = useMemo(() => {
    if (!allClientServices || allClientServices.length === 0) return null;

    const stats = {
      total: { count: 0, amount: 0 },
      monthly: { count: 0, amount: 0 },
      weekly: { count: 0, amount: 0 },
      yearly: { count: 0, amount: 0 },
      active: { count: 0, amount: 0 },
      inactive: { count: 0, amount: 0 }
    };

    allClientServices.forEach((item: any) => {
      if (item.client_services && item.services) {
        const price = item.client_services.price || 0;
        
        stats.total.count++;
        stats.total.amount += price;
        
        // By frequency - use frequency from client_services, fallback to service frequency
        const frequency = item.client_services.frequency || item.services.frequency || 'monthly';
        if (stats[frequency as keyof typeof stats]) {
          stats[frequency as keyof typeof stats].count++;
          stats[frequency as keyof typeof stats].amount += price;
        }
        
        // By status (active/inactive based on client service status)
        if (item.client_services.isActive) {
          stats.active.count++;
          stats.active.amount += price;
        } else {
          stats.inactive.count++;
          stats.inactive.amount += price;
        }
      }
    });

    return stats;
  }, [allClientServices]);

  const formatAmount = (amount: number) => {
    // Prices are stored as dollars in the database, not cents
    return amount.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-14 px-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-gray-600">Manage your company clients and contacts</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Edit Client' : 'Create New Client'}
              </DialogTitle>
              <DialogDescription>
                {editingClient ? 'Update client information' : 'Add a new client to your system'}
              </DialogDescription>
            </DialogHeader>
            <ClientForm client={editingClient || undefined} onSuccess={handleDialogClose} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Income Dashboard */}
      {incomeStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatAmount(incomeStats.total.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {incomeStats.total.count} service{incomeStats.total.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">${formatAmount(incomeStats.monthly.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {incomeStats.monthly.count} service{incomeStats.monthly.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Income</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${formatAmount(incomeStats.weekly.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {incomeStats.weekly.count} service{incomeStats.weekly.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Yearly Income</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">${formatAmount(incomeStats.yearly.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {incomeStats.yearly.count} service{incomeStats.yearly.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Overview */}
      {incomeStats && (
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Services Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${formatAmount(incomeStats.active.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {incomeStats.active.count} active service{incomeStats.active.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Services</CardTitle>
              <Users className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">${formatAmount(incomeStats.inactive.amount)}</div>
              <p className="text-xs text-muted-foreground">
                {incomeStats.inactive.count} inactive service{incomeStats.inactive.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(clientTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const contactInfo = client.contactInfo as any;
          return (
            <Card key={client.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {client.type === 'company' ? (
                        <Building className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      {client.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={clientTypeColors[client.type as keyof typeof clientTypeColors]}>
                        {clientTypeLabels[client.type as keyof typeof clientTypeLabels]}
                      </Badge>
                      <Badge variant={client.isActive ? "default" : "secondary"}>
                        {client.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleManageServices(client)}
                      title="Manage Services"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(client.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.address && (
                  <p className="text-gray-600 text-sm">{client.address}</p>
                )}
                
                {contactInfo && (
                  <div className="space-y-2">
                    <Separator />
                    <div className="space-y-1">
                      {contactInfo.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{contactInfo.phone}</span>
                        </div>
                      )}
                      {contactInfo.whatsapp && (
                        <div className="flex items-center gap-2 text-sm">
                          <MessageCircle className="h-3 w-3 text-gray-400" />
                          <span>{contactInfo.whatsapp}</span>
                        </div>
                      )}
                      {contactInfo.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span>{contactInfo.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  Started: {format(new Date(client.startDate), 'MMM d, yyyy')}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedType !== 'all' 
              ? 'No clients match your current filters' 
              : 'Get started by adding your first client'}
          </p>
          {!searchTerm && selectedType === 'all' && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Client
            </Button>
          )}
        </div>
      )}


    </div>
  );
}