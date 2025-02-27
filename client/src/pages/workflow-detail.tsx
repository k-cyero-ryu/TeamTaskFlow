import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertWorkflowStageSchema,
  type InsertWorkflowStage,
  type WorkflowStage,
  type Workflow,
  type Task,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CreateTaskDialog from "@/components/create-task-dialog";

export default function WorkflowDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const workflowId = parseInt(params.id!);

  const { data: workflow } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${workflowId}`],
  });

  const { data: stages = [] } = useQuery<WorkflowStage[]>({
    queryKey: [`/api/workflows/${workflowId}/stages`],
  });

  // Query tasks for each stage individually
  const stageTasks = stages.map((stage) => {
    return useQuery<Task[]>({
      queryKey: [`/api/workflows/${workflowId}/stages/${stage.id}/tasks`],
      enabled: !!stage.id,
    });
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, stageId }: { taskId: number; stageId: number }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}/stage`, { stageId });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries for all stages to refresh the tasks
      stages.forEach((stage) => {
        queryClient.invalidateQueries({
          queryKey: [`/api/workflows/${workflowId}/stages/${stage.id}/tasks`],
        });
      });
      toast({
        title: "Success",
        description: "Task moved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
      });
    },
  });

  const form = useForm<InsertWorkflowStage>({
    resolver: zodResolver(insertWorkflowStageSchema),
    defaultValues: {
      name: "",
      description: "",
      order: 0,
      color: "#4444FF",
      metadata: null,
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: InsertWorkflowStage) => {
      const response = await apiRequest("POST", `/api/workflows/${workflowId}/stages`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workflows/${workflowId}/stages`] });
      toast({
        title: "Success",
        description: "Stage created successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to create stage",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{workflow?.name}</h1>
            <p className="text-muted-foreground">{workflow?.description}</p>
          </div>
          <CreateTaskDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  createStageMutation.mutate({ ...data, order: stages.length })
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
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input type="color" {...field} value={field.value || '#4444FF'} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={createStageMutation.isPending}
                >
                  {createStageMutation.isPending
                    ? "Creating..."
                    : "Add Stage"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="p-4 border rounded-lg"
                  style={{
                    borderLeftColor: stage.color || '#4444FF',
                    borderLeftWidth: '4px'
                  }}
                >
                  <h3 className="font-medium">{stage.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {stage.description}
                  </p>
                  <div className="mt-4 space-y-2">
                    {stageTasks[index]?.data?.map((task) => (
                      <div
                        key={task.id}
                        className="bg-background p-3 rounded border"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{task.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {task.description}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {stages.map((targetStage) =>
                              targetStage.id !== stage.id ? (
                                <Button
                                  key={targetStage.id}
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    moveTaskMutation.mutate({
                                      taskId: task.id,
                                      stageId: targetStage.id,
                                    })
                                  }
                                  disabled={moveTaskMutation.isPending}
                                >
                                  Move to {targetStage.name}
                                </Button>
                              ) : null
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}