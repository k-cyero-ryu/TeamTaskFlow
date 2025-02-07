import { useQuery } from "@tanstack/react-query";
import { Task } from "@shared/schema";
import TaskList from "@/components/task-list";
import CreateTaskDialog from "@/components/create-task-dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function Tasks() {
  const [search, setSearch] = useState("");
  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const filteredTasks = tasks?.filter((task) =>
    task.title.toLowerCase().includes(search.toLowerCase())
  );

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
          <TaskList tasks={filteredTasks?.filter((t) => t.status === "todo") || []} />
        </div>
        
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">In Progress</h2>
          <TaskList tasks={filteredTasks?.filter((t) => t.status === "in-progress") || []} />
        </div>
        
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Done</h2>
          <TaskList tasks={filteredTasks?.filter((t) => t.status === "done") || []} />
        </div>
      </div>
    </div>
  );
}
