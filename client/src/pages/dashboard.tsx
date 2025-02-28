import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import TaskList from "@/components/task-list";
import TaskCard from "@/components/task-card";
import CreateTaskDialog from "@/components/create-task-dialog";
import { Task, Workflow, WorkflowStage } from "@shared/schema";
import { Loader2, CheckCircle2, Circle, Clock } from "lucide-react";

export default function Dashboard() {
  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  // Query all stages in a single request
  const { data: allStages = [], isLoading: stagesLoading } = useQuery<WorkflowStage[]>({
    queryKey: ["/api/stages"],
    enabled: workflows.length > 0,
  });

  if (tasksLoading || workflowsLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((task) => task.status === "done").length || 0;
  const inProgressTasks = tasks?.filter((task) => task.status === "in-progress").length || 0;
  const progressPercentage = totalTasks ? (completedTasks / totalTasks) * 100 : 0;

  // Group tasks by workflow
  const workflowTasks = tasks?.filter(task => task.workflowId !== null) || [];

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <CreateTaskDialog />
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Circle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {completedTasks} of {totalTasks} tasks completed
          </p>
        </CardContent>
      </Card>

      {/* Workflow Tasks Section */}
      {workflowTasks.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Workflow Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {workflows.map(workflow => {
                const workflowTasks = tasks?.filter(task => task.workflowId === workflow.id) || [];
                if (workflowTasks.length === 0) return null;

                const workflowStages = allStages.filter(stage => stage.workflowId === workflow.id);

                return (
                  <div key={workflow.id} className="space-y-4">
                    <h3 className="text-lg font-semibold">{workflow.name}</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {workflowTasks.map(task => {
                        const stage = workflowStages.find(s => s.id === task.stageId);
                        return (
                          <TaskCard
                            key={task.id}
                            task={{
                              ...task,
                              workflow,
                              stage,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={tasks || []} limit={5} />
        </CardContent>
      </Card>
    </div>
  );
}