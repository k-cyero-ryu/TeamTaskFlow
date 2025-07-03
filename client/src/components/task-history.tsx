import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, User, Edit, Plus, CheckCircle2, XCircle, Calendar, AlertCircle, Flag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface TaskHistoryEntry {
  id: number;
  taskId: number;
  userId: number;
  action: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
  };
}

interface TaskHistoryProps {
  taskId: number;
}

export default function TaskHistory({ taskId }: TaskHistoryProps) {
  const {
    data: history = [],
    isLoading,
    error,
  } = useQuery<TaskHistoryEntry[]>({
    queryKey: [`/api/tasks/${taskId}/history`],
    enabled: !!taskId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">History</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">History</h3>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load task history. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'status_changed':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'due_date_changed':
        return <Calendar className="h-4 w-4 text-purple-600" />;
      case 'subtask_completed':
      case 'step_completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'subtask_uncompleted':
      case 'step_uncompleted':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'assigned':
      case 'unassigned':
        return <User className="h-4 w-4 text-indigo-600" />;
      case 'priority_changed':
        return <Flag className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionText = (entry: TaskHistoryEntry) => {
    const { action, oldValue, newValue, details, user } = entry;
    
    switch (action) {
      case 'created':
        return `${user.username} created this task`;
      case 'status_changed':
        return `${user.username} changed status from "${oldValue}" to "${newValue}"`;
      case 'due_date_changed':
        if (!oldValue && newValue) {
          return `${user.username} set due date to ${format(new Date(newValue), "PPP")}`;
        } else if (oldValue && !newValue) {
          return `${user.username} removed due date`;
        } else if (oldValue && newValue) {
          return `${user.username} changed due date from ${format(new Date(oldValue), "PPP")} to ${format(new Date(newValue), "PPP")}`;
        }
        return `${user.username} updated the due date`;
      case 'subtask_completed':
        return `${user.username} completed subtask "${details}"`;
      case 'subtask_uncompleted':
        return `${user.username} uncompleted subtask "${details}"`;
      case 'step_completed':
        return `${user.username} completed step "${details}"`;
      case 'step_uncompleted':
        return `${user.username} uncompleted step "${details}"`;
      case 'assigned':
        return `${user.username} assigned this task to ${newValue}`;
      case 'unassigned':
        return `${user.username} unassigned ${oldValue} from this task`;
      case 'priority_changed':
        return `${user.username} changed priority from "${oldValue}" to "${newValue}"`;
      case 'commented':
        return `${user.username} added a comment`;
      default:
        return `${user.username} performed action: ${action}`;
    }
  };

  if (history.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">History</h3>
        <div className="text-center py-6 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No history available for this task yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">History</h3>
      <div className="space-y-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 p-3 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              {getActionIcon(entry.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                {getActionText(entry)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <time className="text-xs text-muted-foreground">
                  {format(new Date(entry.createdAt), "PPP 'at' p")}
                </time>
                {entry.action !== 'created' && (
                  <Badge variant="outline" className="text-xs">
                    {entry.action.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}