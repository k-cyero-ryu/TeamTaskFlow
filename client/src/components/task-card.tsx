import { useAuth } from "@/hooks/use-auth";
import { Task } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function TaskCard({ task }: { task: Task }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task updated",
        description: "The task status has been updated successfully.",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    },
  });

  const statusColors = {
    todo: "bg-slate-500",
    "in-progress": "bg-blue-500",
    done: "bg-green-500",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Badge
          variant="secondary"
          className={`${statusColors[task.status as keyof typeof statusColors]}`}
        >
          {task.status}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate("todo")}
              disabled={task.status === "todo"}
            >
              Mark as Todo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate("in-progress")}
              disabled={task.status === "in-progress"}
            >
              Mark as In Progress
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate("done")}
              disabled={task.status === "done"}
            >
              Mark as Done
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteTaskMutation.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold">{task.title}</h3>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {task.assigneeId ? "A" : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm">
              Created {format(new Date(task.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
