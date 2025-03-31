import { Badge } from "@/components/ui/badge";
import { taskStatusConfig, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, Circle } from "lucide-react";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

/**
 * A consistent badge component for displaying task status
 */
export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const config = taskStatusConfig[status];
  
  const StatusIcon = () => {
    switch (status) {
      case "todo":
        return <Circle className="h-3 w-3" />;
      case "in-progress":
        return <Clock className="h-3 w-3" />;
      case "done":
        return <CheckCircle className="h-3 w-3" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };
  
  // Status descriptions for screen readers
  const getStatusDescription = () => {
    switch (status) {
      case "todo":
        return "Task is in to-do state and hasn't been started yet";
      case "in-progress":
        return "Task is currently in progress";
      case "done":
        return "Task has been completed";
      default:
        return "Task status is unknown";
    }
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "transition-colors duration-300 flex items-center gap-1",
        config.color,
        className
      )}
      aria-label={`Status: ${status}`}
      role="status"
      title={getStatusDescription()}
    >
      <StatusIcon aria-hidden="true" />
      <span>{status}</span>
    </Badge>
  );
}