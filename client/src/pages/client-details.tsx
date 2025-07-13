import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  Building,
  User,
  FileText,
  Upload,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Service } from "@shared/schema";
import { format } from "date-fns";

// File viewing component for different file types
function FileViewer({
  filePath,
  onClose,
}: {
  filePath: string;
  onClose: () => void;
}) {
  const fileExtension = filePath.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(
    fileExtension || "",
  );
  const isPDF = fileExtension === "pdf";

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Contract File</DialogTitle>
          <DialogDescription>{filePath.split("/").pop()}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {isImage ? (
            <img
              src={`/api/uploads/file/${filePath.replace("/uploads/", "")}`}
              alt="Contract file"
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
          ) : isPDF ? (
            <iframe
              src={`/api/uploads/file/${filePath.replace("/uploads/", "")}`}
              className="w-full h-[70vh] border-0"
              title="Contract PDF"
            />
          ) : (
            <div className="text-center py-14">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Preview not available for this file type
              </p>
              <Button
                onClick={() =>
                  window.open(
                    `/api/uploads/file/${filePath.replace("/uploads/", "")}`,
                    "_blank",
                  )
                }
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
              const link = document.createElement("a");
              link.href = `/api/uploads/file/${filePath.replace("/uploads/", "")}`;
              link.download = filePath.split("/").pop() || "contract";
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

// Contract File Editor Component
function ContractFileEditor({
  service,
  onClose,
  onSuccess,
}: {
  service: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: { contractFile: string }) => {
      const response = await apiRequest(
        "PUT",
        `/api/client-services/${service.id}`,
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Contract file updated successfully" });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating contract file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiRequest("POST", "/api/uploads", formData);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      setUploadedFilePath(result.filePath);
      toast({ title: "File uploaded successfully" });
    } catch (error: any) {
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!uploadedFilePath) {
      toast({ title: "Please select a file first", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ contractFile: uploadedFilePath });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Contract File</DialogTitle>
          <DialogDescription>
            Replace the contract file for {service.services?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current File:</Label>
            <p className="text-sm text-gray-600">
              {service.contractFile?.split("/").pop() || "No file"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Upload New File:</Label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await handleFileUpload(file);
                }
              }}
              disabled={isUploading}
            />
            {uploadedFilePath && (
              <p className="text-sm text-green-600">
                ✓ New file uploaded: {uploadedFilePath.split("/").pop()}
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
              {updateMutation.isPending ? "Updating..." : "Update File"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Service Assignment Form Component
function ServiceAssignmentForm({
  client,
  onSuccess,
}: {
  client: Client;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);

  const serviceAssignmentSchema = z.object({
    serviceId: z.number().min(1, "Please select a service"),
    characteristics: z
      .array(
        z.enum([
          "remote",
          "in_presence",
          "one_time",
          "short_term",
          "long_term",
        ]),
      )
      .min(1, "Select at least one characteristic"),
    price: z.number().min(0, "Price must be positive"),
    frequency: z.enum(["monthly", "yearly", "weekly", "one_time"], {
      required_error: "Please select frequency",
    }),
    startDate: z.string().min(1, "Start date is required"),
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
      frequency: "monthly",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      notes: "",
      isActive: true,
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/services");
      return response.json() as Promise<Service[]>;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: ServiceAssignmentData) => {
      const response = await apiRequest("POST", "/api/client-services", {
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
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-services"] });
      toast({ title: "Service assigned successfully" });
      onSuccess();
      form.reset();
      setUploadedFilePath(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error assigning service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ServiceAssignmentData) => {
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
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem
                        key={service.id}
                        value={service.id.toString()}
                      >
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
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "remote",
                    "in_presence",
                    "one_time",
                    "short_term",
                    "long_term",
                  ].map((characteristic) => (
                    <div
                      key={characteristic}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        id={characteristic}
                        checked={field.value?.includes(characteristic as any)}
                        onChange={(e) => {
                          const newValue = e.target.checked
                            ? [...field.value, characteristic]
                            : field.value.filter((c) => c !== characteristic);
                          field.onChange(newValue);
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label
                        htmlFor={characteristic}
                        className="text-sm capitalize"
                      >
                        {characteristic.replace("_", " ")}
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
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
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
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
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
          <label className="text-sm font-medium">
            Contract File (Optional)
          </label>
          <Input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const formData = new FormData();
                  formData.append("file", file);

                  const response = await apiRequest(
                    "POST",
                    "/api/uploads",
                    formData,
                  );

                  if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                  }

                  const result = await response.json();
                  setUploadedFilePath(result.filePath);
                  toast({ title: "File uploaded successfully" });
                } catch (error: any) {
                  toast({
                    title: "Error uploading file",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }
            }}
          />
          {uploadedFilePath && (
            <p className="text-sm text-green-600">
              ✓ File uploaded: {uploadedFilePath.split("/").pop()}
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this service assignment"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="assignmentActive"
            {...form.register("isActive")}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="assignmentActive">Active</Label>
        </div>

        <Button type="submit" disabled={assignMutation.isPending}>
          {assignMutation.isPending ? "Assigning..." : "Assign Service"}
        </Button>
      </form>
    </Form>
  );
}

// Client type labels and colors
const clientTypeLabels = {
  individual: "Individual",
  company: "Company",
} as const;

const clientTypeColors = {
  individual: "bg-blue-100 text-blue-800",
  company: "bg-green-100 text-green-800",
} as const;

export default function ClientDetails({ params }: { params: { id: string } }) {
  const [, setLocation] = useLocation();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clientId = parseInt(params.id);

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/clients/${clientId}`);
      return response.json() as Promise<Client>;
    },
  });

  const { data: clientServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["/api/client-services", clientId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/client-services/client/${clientId}`,
      );
      return response.json() as Promise<any[]>;
    },
  });

  const removeMutation = useMutation({
    mutationFn: (serviceId: number) =>
      apiRequest("DELETE", `/api/client-services/${serviceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/client-services", clientId],
      });
      toast({ title: "Service removed successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveService = (serviceId: number) => {
    if (confirm("Are you sure you want to remove this service assignment?")) {
      removeMutation.mutate(serviceId);
    }
  };

  const handleAssignSuccess = () => {
    setShowAssignForm(false);
  };

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading client details...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Client not found</div>
      </div>
    );
  }

  const contactInfo = client.contactInfo as any;

  return (
    <div className="container mx-auto py-14 px-4 space-y-4">
      {/* Header - More compact */}
      <div className="flex items-center gap-4 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/clients")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {client.type === "company" ? (
              <Building className="h-6 w-6" />
            ) : (
              <User className="h-6 w-6" />
            )}
            {client.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              className={
                clientTypeColors[client.type as keyof typeof clientTypeColors]
              }
            >
              {clientTypeLabels[client.type as keyof typeof clientTypeLabels]}
            </Badge>
            <Badge variant={client.isActive ? "default" : "secondary"}>
              {client.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Client Information - More compact */}
      <Card className="bg-gray-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="font-medium">Start Date:</span>{" "}
              {format(new Date(client.startDate), "MMM d, yyyy")}
            </div>
            {contactInfo?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Email:</span> {contactInfo.email}
              </div>
            )}
            {contactInfo?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span className="font-medium">Phone:</span> {contactInfo.phone}
              </div>
            )}
            {contactInfo?.whatsapp && (
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span className="font-medium">WhatsApp:</span>{" "}
                {contactInfo.whatsapp}
              </div>
            )}
            {client.address && (
              <div className="md:col-span-3">
                <span className="font-medium">Address:</span> {client.address}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Services - More compact */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Assigned Services</CardTitle>
            <Button
              onClick={() => setShowAssignForm(!showAssignForm)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Service
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {servicesLoading ? (
            <div className="text-center py-14">Loading services...</div>
          ) : clientServices.length === 0 ? (
            <div className="text-center py-14 text-gray-500">
              No services assigned to this client
            </div>
          ) : (
            <div className="space-y-3">
              {clientServices.map((item) => (
                <Card
                  key={item.client_services.id}
                  className="p-3 border-l-4 border-l-blue-500"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-base">
                          {item.services?.name}
                        </h4>
                        <Badge
                          variant={
                            item.client_services.isActive
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {item.client_services.isActive
                            ? "Active"
                            : "Inactive"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Characteristics:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(
                              item.client_services.characteristics as string[]
                            ).map((char, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs px-1 py-0"
                              >
                                {char.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Price:</span> $
                          {item.client_services.price}
                        </div>
                        <div>
                          <span className="font-medium">Frequency:</span>{" "}
                          {item.client_services.frequency}
                        </div>
                        <div>
                          <span className="font-medium">Start Date:</span>{" "}
                          {format(
                            new Date(item.client_services.startDate),
                            "MMM d, yyyy",
                          )}
                        </div>
                        {item.client_services.endDate && (
                          <div>
                            <span className="font-medium">End Date:</span>{" "}
                            {format(
                              new Date(item.client_services.endDate),
                              "MMM d, yyyy",
                            )}
                          </div>
                        )}
                      </div>

                      {/* Contract File Section - More compact */}
                      {item.client_services.contractFile && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">Contract:</span>
                            <span className="text-gray-600 text-xs flex-1">
                              {item.client_services.contractFile
                                .split("/")
                                .pop()}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setViewingFile(
                                  item.client_services.contractFile,
                                )
                              }
                              className="h-7 text-xs px-2"
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditingService(item.client_services)
                              }
                              className="h-7 text-xs px-2"
                            >
                              Edit
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Notes Section - More compact */}
                      {item.client_services.notes && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="text-sm">
                            <span className="font-medium">Notes:</span>
                            <p className="text-gray-600 mt-1 text-xs">
                              {item.client_services.notes}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleRemoveService(item.client_services.id)
                      }
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign New Service Form - More compact */}
      {showAssignForm && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Assign New Service</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ServiceAssignmentForm
              client={client}
              onSuccess={handleAssignSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* File Viewer Dialog */}
      {viewingFile && (
        <FileViewer
          filePath={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Contract File Editor Dialog */}
      {editingService && (
        <ContractFileEditor
          service={editingService}
          onClose={() => setEditingService(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["/api/client-services", clientId],
            });
          }}
        />
      )}
    </div>
  );
}
