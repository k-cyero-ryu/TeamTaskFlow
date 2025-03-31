import { useQuery, useMutation } from "@tanstack/react-query";
import { Workflow, WorkflowStage, InsertWorkflowStage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * A hook that provides workflow-related data fetching and mutations
 */
export function useWorkflows() {
  const { toast } = useToast();

  // Get all workflows
  const { 
    data: workflows = [], 
    isLoading: workflowsLoading,
    isError: workflowsError,
    error: workflowsErrorDetails,
  } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  // Get all stages
  const { 
    data: allStages = [], 
    isLoading: stagesLoading,
    isError: stagesError,
    error: stagesErrorDetails,
  } = useQuery<WorkflowStage[]>({
    queryKey: ["/api/stages"],
    enabled: workflows.length > 0,
  });

  // Get stages for a specific workflow
  const getWorkflowStages = (workflowId: number) => {
    return allStages.filter(stage => stage.workflowId === workflowId);
  };

  // Create a workflow stage mutation
  const createWorkflowStage = useMutation({
    mutationFn: async ({ workflowId, data }: { workflowId: number, data: InsertWorkflowStage }) => {
      const response = await apiRequest("POST", `/api/workflows/${workflowId}/stages`, data);
      return response.json();
    },
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/workflows/${workflowId}/stages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/stages"] });
      toast({
        title: "Success",
        description: "Stage created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create stage: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Get workflow by id
  const getWorkflowById = (id: number) => {
    return workflows.find(workflow => workflow.id === id);
  };

  // Get stage by id
  const getStageById = (workflowId: number, stageId: number) => {
    return allStages.find(stage => 
      stage.workflowId === workflowId && stage.id === stageId
    );
  };

  return {
    workflows,
    allStages,
    isLoading: workflowsLoading || stagesLoading,
    isError: workflowsError || stagesError,
    error: workflowsErrorDetails || stagesErrorDetails,
    getWorkflowStages,
    createWorkflowStage,
    getWorkflowById,
    getStageById
  };
}

/**
 * A hook that provides data fetching and mutations for a specific workflow
 */
export function useWorkflow(workflowId: number) {
  const { toast } = useToast();

  // Get specific workflow
  const { 
    data: workflow, 
    isLoading: workflowLoading,
    isError: workflowError,
    error: workflowErrorDetails
  } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${workflowId}`],
  });

  // Get stages for this workflow
  const { 
    data: stages = [], 
    isLoading: stagesLoading,
    isError: stagesError,
    error: stagesErrorDetails
  } = useQuery<WorkflowStage[]>({
    queryKey: [`/api/workflows/${workflowId}/stages`],
  });

  // Create workflow stage mutation
  const createStage = useMutation({
    mutationFn: async (data: InsertWorkflowStage) => {
      const response = await apiRequest("POST", `/api/workflows/${workflowId}/stages`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/workflows/${workflowId}/stages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/stages"] });
      toast({
        title: "Success",
        description: "Stage created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create stage: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    workflow,
    stages,
    isLoading: workflowLoading || stagesLoading,
    isError: workflowError || stagesError,
    error: workflowErrorDetails || stagesErrorDetails,
    createStage
  };
}