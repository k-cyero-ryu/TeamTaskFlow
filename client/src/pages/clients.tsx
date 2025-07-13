import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Edit, Trash2, Users, Search, Phone, Mail, MessageCircle, Building, User, Settings, Link } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Client, InsertClient, Service, ClientService, InsertClientService } from '@shared/schema';
import { format } from 'date-fns';

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
    contractFile: z.any().optional(),
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
      contractFile: undefined,
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
      console.log('Raw form data:', data);
      let contractFilePath = null;
      
      // Upload contract file if provided
      if (data.contractFile && data.contractFile instanceof File) {
        console.log('Uploading contract file:', data.contractFile.name);
        const formData = new FormData();
        formData.append('file', data.contractFile);
        
        const uploadResponse = await apiRequest('POST', '/api/uploads', formData);
        if (!uploadResponse.ok) {
          throw new Error(`File upload failed: ${uploadResponse.status}`);
        }
        const uploadResult = await uploadResponse.json();
        contractFilePath = uploadResult.path;
        console.log('Contract file uploaded to:', contractFilePath);
      } else {
        console.log('No contract file to upload, contractFile is:', typeof data.contractFile, data.contractFile);
      }
      
      const payload = {
        clientId: client.id,
        serviceId: data.serviceId,
        characteristics: data.characteristics,
        price: Math.round(data.price * 100), // Convert to cents
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate || null,
        notes: data.notes || null,
        contractFile: contractFilePath,
        isActive: data.isActive,
      };
      
      console.log('About to make service assignment request');
      console.log('Payload:', payload);
      const response = await apiRequest('POST', '/api/client-services', payload);
      console.log('Service assignment response:', response.status);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-services'] });
      toast({ title: 'Service assigned successfully' });
      onSuccess();
      form.reset();
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

        <FormField
          control={form.control}
          name="contractFile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contract File (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    console.log('File selected:', file ? file.name : 'none');
                    field.onChange(file || undefined);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

// Main Client Services Manager Component
function ClientServicesManager({ client, onClose }: { client: Client; onClose: () => void }) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clientServices = [], isLoading } = useQuery({
    queryKey: ['/api/client-services', client.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/client-services/client/${client.id}`);
      return response.json() as Promise<any[]>;
    }
  });

  const removeMutation = useMutation({
    mutationFn: (serviceId: number) => apiRequest('DELETE', `/api/client-services/${serviceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-services', client.id] });
      toast({ title: 'Service removed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error removing service', description: error.message, variant: 'destructive' });
    }
  });

  const handleRemoveService = (serviceId: number) => {
    if (confirm('Are you sure you want to remove this service assignment?')) {
      removeMutation.mutate(serviceId);
    }
  };

  const handleAssignSuccess = () => {
    setShowAssignForm(false);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading services...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Current Services */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Current Services</h3>
          <Button onClick={() => setShowAssignForm(!showAssignForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Assign Service
          </Button>
        </div>

        {clientServices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No services assigned to this client
          </div>
        ) : (
          <div className="space-y-3">
            {clientServices.map((item) => (
              <Card key={item.client_services.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{item.services?.name}</h4>
                      <Badge variant={item.client_services.isActive ? "default" : "secondary"}>
                        {item.client_services.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Characteristics:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(item.client_services.characteristics as string[]).map((char, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {char.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Price:</span> ${(item.client_services.price / 100).toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">Frequency:</span> {item.client_services.frequency}
                      </div>
                      <div>
                        <span className="font-medium">Start Date:</span> {format(new Date(item.client_services.startDate), 'MMM d, yyyy')}
                      </div>
                      {item.client_services.endDate && (
                        <div>
                          <span className="font-medium">End Date:</span> {format(new Date(item.client_services.endDate), 'MMM d, yyyy')}
                        </div>
                      )}
                      {item.client_services.contractFile && (
                        <div>
                          <span className="font-medium">Contract:</span>
                          <a 
                            href={`/api/uploads/${item.client_services.contractFile}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline ml-1"
                          >
                            Download
                          </a>
                        </div>
                      )}
                    </div>
                    {item.client_services.notes && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Notes:</span> {item.client_services.notes}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveService(item.client_services.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Assign New Service Form */}
      {showAssignForm && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Assign New Service</h3>
          <ServiceAssignmentForm client={client} onSuccess={handleAssignSuccess} />
        </div>
      )}
    </div>
  );
}

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false);
  const [selectedClientForServices, setSelectedClientForServices] = useState<Client | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients');
      return response.json() as Promise<Client[]>;
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
    setSelectedClientForServices(client);
    setServicesDialogOpen(true);
  };

  const handleServicesDialogClose = () => {
    setServicesDialogOpen(false);
    setSelectedClientForServices(null);
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
          <DialogContent className="sm:max-w-[600px]">
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

      {/* Service Assignment Dialog */}
      <Dialog open={servicesDialogOpen} onOpenChange={setServicesDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Services - {selectedClientForServices?.name}</DialogTitle>
            <DialogDescription>
              Assign and manage services for this client
            </DialogDescription>
          </DialogHeader>
          {selectedClientForServices && (
            <ClientServicesManager 
              client={selectedClientForServices} 
              onClose={handleServicesDialogClose} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}