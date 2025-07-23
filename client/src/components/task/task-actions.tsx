import { useState } from "react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Trash2, CheckCircle, Clock, Circle, Edit2 } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { TaskStatus, ExtendedTask } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import EditTaskDialog from "@/components/edit-task-dialog";

interface TaskActionsProps {
  taskId: number;
  currentStatus: TaskStatus;
  onOpenTaskDetail?: () => void;
  task?: ExtendedTask;
}

/**
 * A reusable component for task actions (status changes, deletion)
 */
export function TaskActions({ taskId, currentStatus, onOpenTaskDetail, task }: TaskActionsProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { updateTaskStatus, deleteTask, getTaskById } = useTasks();
  const { user } = useAuth();
  
  // Get task data for edit permission check
  const taskData = task || getTaskById(taskId);
  
  // Check if user can edit this task (creator, responsible, or admin)
  const canEdit = taskData && user && (
    taskData.creatorId === user.id || 
    taskData.responsibleId === user.id || 
    user.isAdmin
  );

  // Wrap the status update with transitioning state for UI feedback
  const handleStatusUpdate = (status: TaskStatus) => {
    setIsTransitioning(true);
    updateTaskStatus.mutate(
      { id: taskId, status },
      {
        onSettled: () => {
          setIsTransitioning(false);
        }
      }
    );
  };

  // Handle task deletion
  const handleDelete = () => {
    setIsTransitioning(true);
    deleteTask.mutate(taskId, {
      onSettled: () => {
        setIsTransitioning(false);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={() => handleStatusUpdate("todo")}
          disabled={currentStatus === "todo" || isTransitioning}
          className="gap-2"
        >
          <Circle className="h-4 w-4" /> Mark as Todo
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusUpdate("in-progress")}
          disabled={currentStatus === "in-progress" || isTransitioning}
          className="gap-2"
        >
          <Clock className="h-4 w-4" /> Mark as In Progress
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleStatusUpdate("done")}
          disabled={currentStatus === "done" || isTransitioning}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4" /> Mark as Done
        </DropdownMenuItem>
        {onOpenTaskDetail && (
          <DropdownMenuItem
            onClick={onOpenTaskDetail}
            disabled={isTransitioning}
            className="gap-2"
          >
            View Details
          </DropdownMenuItem>
        )}
        {canEdit && taskData && (
          <EditTaskDialog task={taskData} trigger={
            <DropdownMenuItem
              onClick={(e) => e.preventDefault()}
              disabled={isTransitioning}
              className="gap-2"
            >
              <Edit2 className="h-4 w-4" /> Edit Task
            </DropdownMenuItem>
          } />
        )}
        <DropdownMenuItem
          className="text-destructive gap-2"
          onClick={handleDelete}
          disabled={isTransitioning}
        >
          <Trash2 className="h-4 w-4" /> Delete Task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}