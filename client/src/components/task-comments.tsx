import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreVertical, Trash2, Edit2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { Comment } from "@shared/schema";

interface TaskCommentsProps {
  taskId: number;
}

export default function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [editingComment, setEditingComment] = useState<{
    id: number;
    content: string;
  } | null>(null);

  const { data: comments = [] } = useQuery<(Comment & { user: { id: number; username: string } })[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Only send content in the body, taskId is already in the URL
        body: JSON.stringify({ content }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to add comment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      setComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await fetch(`/api/tasks/comments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to update comment');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      setEditingComment(null);
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tasks/comments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to delete comment');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      toast({
        title: "Comment deleted",
        description: "The comment has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-4 group">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {comment.user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{comment.user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(comment.createdAt), "PPp")}
                  </span>
                  {comment.updatedAt && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>
                {user?.id === comment.userId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setEditingComment({
                            id: comment.id,
                            content: comment.content,
                          })
                        }
                        className="gap-2"
                      >
                        <Edit2 className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                        className="text-destructive gap-2"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {editingComment?.id === comment.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingComment.content}
                    onChange={(e) =>
                      setEditingComment((prev) =>
                        prev ? { ...prev, content: e.target.value } : null
                      )
                    }
                    className="min-h-[60px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingComment(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (editingComment.content.trim()) {
                          updateCommentMutation.mutate({
                            id: editingComment.id,
                            content: editingComment.content,
                          });
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm">{comment.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{user?.username?.[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[60px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (comment.trim()) {
                  createCommentMutation.mutate(comment);
                }
              }}
              disabled={!comment.trim() || createCommentMutation.isPending}
            >
              {createCommentMutation.isPending ? "Adding..." : "Add Comment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
