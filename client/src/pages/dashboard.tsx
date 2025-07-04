import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import TaskList from "@/components/task-list";
import TaskCard from "@/components/task-card";
import CreateTaskDialog from "@/components/create-task-dialog";
import { Loader2, CheckCircle2, Circle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useWorkflows } from "@/hooks/use-workflows";
import { ExtendedTask } from "@/lib/types";
import { ErrorBoundary } from "@/components/error-boundary";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  return (
    <ErrorBoundary fallback={<DashboardErrorState />}>
      <DashboardContent />
    </ErrorBoundary>
  );
}

// Error fallback component
function DashboardErrorState() {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">{t("dashboard")}</h1>
      
      <div className="p-8 border rounded-lg bg-background space-y-6">
        <div className="text-center space-y-2">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-semibold">Unable to Load Dashboard</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            We encountered a problem while trying to load your dashboard. This could be due to connection issues or a temporary server problem.
          </p>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Could not retrieve dashboard data. Please check your network connection and try again.
          </AlertDescription>
        </Alert>
        
        <div className="flex justify-center">
          <Button 
            onClick={() => window.location.reload()}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Reload Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

// Main content component
function DashboardContent() {
  const { t } = useTranslation();
  
  // Use custom hooks for data fetching
  const { 
    tasks = [], 
    isLoading: tasksLoading, 
    isError: tasksError,
    error: tasksErrorDetails,
    getTaskStats 
  } = useTasks();
  
  const { 
    workflows = [], 
    allStages = [], 
    isLoading: workflowsLoading,
    isError: workflowsError,
    error: workflowsErrorDetails,
    getWorkflowStages
  } = useWorkflows();

  // Display loading state
  if (tasksLoading || workflowsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loadingDashboard")}</p>
        </div>
      </div>
    );
  }
  
  // Display error state
  if (tasksError || workflowsError) {
    const errorMessage = tasksErrorDetails?.message || workflowsErrorDetails?.message || "Unknown error occurred";
    
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">{t("dashboard")}</h1>
        
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {errorMessage}
          </AlertDescription>
        </Alert>
        
        <div className="flex mb-8">
          <Button 
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
        </div>
        
        {/* Render partial content if available */}
        {tasks.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Available Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList tasks={tasks} />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Get task statistics
  const { total: totalTasks, completed: completedTasks, inProgress: inProgressTasks, progressPercentage } = getTaskStats();

  // Group tasks by workflow
  const workflowTasks = tasks.filter(task => task.workflowId !== null);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t("dashboard")}</h1>
        <CreateTaskDialog />
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("totalTasks")}</CardTitle>
            <Circle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("inProgress")}</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("completed")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t("overallProgress")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {t("tasksCompleted", { completed: completedTasks, total: totalTasks })}
          </p>
        </CardContent>
      </Card>

      {/* Workflow Tasks Section */}
      {workflowTasks.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              {t("workflowTasks")}
              <span className="ml-2 text-sm text-muted-foreground">
                ({workflowTasks.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {workflows.map(workflow => {
                const workflowTasks = tasks.filter(task => task.workflowId === workflow.id);
                if (workflowTasks.length === 0) return null;

                const workflowStages = getWorkflowStages(workflow.id);
                
                // Prepare task data with workflow and stage information
                const tasksWithStages = workflowTasks.map(task => {
                  const stage = workflowStages.find(s => s.id === task.stageId);
                  return {
                    ...task as ExtendedTask,
                    workflow,
                    stage,
                  };
                });

                return (
                  <div key={workflow.id} className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      {workflow.name}
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({tasksWithStages.length})
                      </span>
                    </h3>
                    
                    {/* Use TaskList with a limit for workflows to maintain grid layout */}
                    <TaskList 
                      tasks={tasksWithStages} 
                      limit={6} // Use pagination for workflow tasks
                      isLoading={false}
                      error={null}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tasks Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {t("recentTasks")}
            {tasksLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />}
            <span className="ml-2 text-sm text-muted-foreground">
              (Showing {Math.min(tasks.length, 6)} of {tasks.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList 
            tasks={tasks} 
            limit={6} 
            isLoading={tasksLoading}
            error={tasksError ? tasksErrorDetails : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}