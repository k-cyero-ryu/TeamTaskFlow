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
  
  return (
    <Badge
      variant="secondary"
      className={cn(
        "transition-colors duration-300 flex items-center gap-1",
        config.color,
        className
      )}
    >
      <StatusIcon />
      {status}
    </Badge>
  );
}