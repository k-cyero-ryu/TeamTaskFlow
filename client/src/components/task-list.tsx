import { Task } from "@shared/schema";
import TaskCard from "./task-card";

interface TaskListProps {
  tasks: Task[];
  limit?: number;
}

export default function TaskList({ tasks, limit }: TaskListProps) {
  const displayTasks = limit ? tasks.slice(0, limit) : tasks;

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tasks found
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {displayTasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}
