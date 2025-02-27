import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertWorkflowSchema, type InsertWorkflow, type Workflow } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: workflows = [], isLoading } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: InsertWorkflow) => {
      const response = await apiRequest("POST", "/api/workflows", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Success",
        description: "Workflow created successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Workflow creation error:", error);
      toast({
        title: "Error",
        description: "Failed to create workflow",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertWorkflow>({
    resolver: zodResolver(insertWorkflowSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
      metadata: null,
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Create New Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) =>
                    createWorkflowMutation.mutate(data)
                  )}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={createWorkflowMutation.isPending}
                  >
                    {createWorkflowMutation.isPending
                      ? "Creating..."
                      : "Create Workflow"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Existing Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflows?.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-accent"
                    onClick={() => setLocation(`/workflows/${workflow.id}`)}
                  >
                    <h3 className="font-medium">{workflow.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {workflow.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}