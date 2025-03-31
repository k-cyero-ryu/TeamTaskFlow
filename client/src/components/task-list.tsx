import { Task } from "@shared/schema";
import TaskCard from "./task-card";
import { ErrorBoundary } from "./error-boundary";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExtendedTask } from "@/lib/types";

interface TaskListProps {
  tasks: ExtendedTask[];
  limit?: number;
  isLoading?: boolean;
  error?: Error | null;
}

// Main component wrapped with error boundary
export default function TaskList(props: TaskListProps) {
  return (
    <ErrorBoundary 
      fallback={<TaskListError />}
      showToast={false}
    >
      <TaskListContent {...props} />
    </ErrorBoundary>
  );
}

// Error state component
function TaskListError() {
  return (
    <div className="space-y-6 p-4 border rounded-lg bg-background">
      <div className="space-y-2 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h3 className="text-xl font-semibold">Unable to Load Tasks</h3>
        <p className="text-muted-foreground">
          We encountered a problem while trying to load your tasks. This could be due to a network issue or a temporary server problem.
        </p>
      </div>
      
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Connection Error</AlertTitle>
        <AlertDescription>
          The task list could not be retrieved. Please check your network connection and try again.
        </AlertDescription>
      </Alert>
      
      <div className="flex justify-center gap-4">
        <Button 
          onClick={() => window.location.reload()}
          variant="default"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Reload Page
        </Button>
      </div>
    </div>
  );
}

// Empty state component
function EmptyTaskList() {
  return (
    <div className="text-center p-8 border border-dashed rounded-lg">
      <div className="space-y-3">
        <div className="relative mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No Tasks Found</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          There are currently no tasks in this view. Create a new task to get started with your project.
        </p>
        <Button variant="outline" onClick={() => document.querySelector<HTMLButtonElement>('button:has(.h-4.w-4.mr-2)')?.click()}>
          Create Your First Task
        </Button>
      </div>
    </div>
  );
}

// Main content component with proper error states
function TaskListContent({ tasks, limit, isLoading, error }: TaskListProps) {
  // Handle explicit error from props
  if (error) {
    return <TaskListError />;
  }
  
  // Handle empty state 
  if (!isLoading && (!tasks || tasks.length === 0)) {
    return <EmptyTaskList />;
  }
  
  const displayTasks = limit ? tasks.slice(0, limit) : tasks;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {displayTasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
