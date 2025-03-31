import TaskList from "@/components/task-list";
import CreateTaskDialog from "@/components/create-task-dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Main component with error boundary
export default function Tasks() {
  return (
    <ErrorBoundary 
      fallback={<TasksErrorState />}
      showToast={false} // We have a dedicated error UI
    >
      <TasksContent />
    </ErrorBoundary>
  );
}

// Error state for the entire page
function TasksErrorState() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Tasks</h1>
      
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>We encountered a problem while loading your tasks. This could be due to a network issue or a temporary server problem.</p>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to load tasks</AlertTitle>
            <AlertDescription>
              Please try refreshing the page. If the problem persists, contact support.
            </AlertDescription>
          </Alert>
          
          <div className="flex justify-end">
            <Button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh the page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Loading state with skeletons
function TasksLoadingState() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <Skeleton className="h-9 w-40" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      
      <div className="grid gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid gap-4">
            <Skeleton className="h-7 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-40 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main content component
function TasksContent() {
  const [search, setSearch] = useState("");
  const { tasks, isLoading, error } = useTasks();

  // Show loading skeleton 
  if (isLoading) {
    return <TasksLoadingState />;
  }

  // Handle explicit errors
  if (error) {
    return <TasksErrorState />;
  }

  // Filter tasks based on search
  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(search.toLowerCase())
  );

  // Group tasks by status
  const todoTasks = filteredTasks?.filter((t) => t.status === "todo") || [];
  const inProgressTasks = filteredTasks?.filter((t) => t.status === "in-progress") || [];
  const doneTasks = filteredTasks?.filter((t) => t.status === "done") || [];

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <div className="flex gap-4 w-full md:w-auto">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <CreateTaskDialog />
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">To Do</h2>
          <TaskList 
            tasks={todoTasks} 
            isLoading={isLoading}
            error={null}
          />
        </div>
        
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">In Progress</h2>
          <TaskList 
            tasks={inProgressTasks} 
            isLoading={isLoading}
            error={null}
          />
        </div>
        
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Done</h2>
          <TaskList 
            tasks={doneTasks} 
            isLoading={isLoading}
            error={null}
          />
        </div>
      </div>
    </div>
  );
}
