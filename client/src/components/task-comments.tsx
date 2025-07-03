import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreVertical, Trash2, Edit2, Paperclip, Download, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { Comment, FileAttachment } from "@shared/schema";
// Utility function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface TaskCommentsProps {
  taskId: number;
}

export default function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingComment, setEditingComment] = useState<{
    id: number;
    content: string;
  } | null>(null);

  const { data: comments = [] } = useQuery<(Comment & { user: { id: number; username: string }, attachments?: FileAttachment[] })[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      try {
        if (files.length > 0) {
          // Use the file upload endpoint for comments with attachments
          const formData = new FormData();
          formData.append('content', content);
          
          files.forEach((file) => {
            formData.append('files', file);
          });
          
          const res = await fetch(`/api/uploads/comment/${taskId}`, {
            method: 'POST',
            body: formData,
          });
          
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to create comment: ${errorText}`);
          }
          
          return await res.json();
        } else {
          // Use the regular comment endpoint for text-only comments
          const payload = { content };
          const res = await apiRequest('POST', `/api/tasks/${taskId}/comments`, payload);
          
          const responseClone = res.clone();
          
          try {
            return await responseClone.json();
          } catch (jsonError) {
            console.error("Failed to parse comment response:", jsonError);
            const textResponse = await res.text();
            console.log("Raw response:", textResponse);
            throw new Error("Failed to create comment: Invalid response format");
          }
        }
      } catch (error) {
        console.error("Comment creation error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      setComment("");
      setSelectedFiles([]);
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
      // Use the apiRequest helper to ensure proper response handling
      const res = await apiRequest('PATCH', `/api/tasks/comments/${id}`, { content });
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
      // Use the apiRequest helper to ensure proper response handling
      return await apiRequest('DELETE', `/api/tasks/comments/${id}`);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const downloadFile = (filename: string) => {
    window.open(`/api/uploads/file/${filename}`, '_blank');
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (mimeType.includes('pdf')) {
      return '📄';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return '📝';
    } else if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return '📊';
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return '📈';
    } else {
      return '📎';
    }
  };

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
                <div className="space-y-2">
                  <p className="text-sm">{comment.content}</p>
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="grid grid-cols-1 gap-2">
                      {comment.attachments.map((attachment) => (
                        <div key={attachment.id} className="space-y-2">
                          {attachment.mimeType.startsWith('image/') ? (
                            <div className="space-y-2">
                              <img
                                src={`/api/uploads/file/${attachment.filename}`}
                                alt={attachment.originalFilename}
                                className="max-w-full h-auto max-h-64 rounded-md border"
                                loading="lazy"
                              />
                              <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getFileIcon(attachment.mimeType)}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {attachment.originalFilename}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(attachment.size)}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => downloadFile(attachment.filename)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                              <span className="text-lg">{getFileIcon(attachment.mimeType)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {attachment.originalFilename}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(attachment.size)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadFile(attachment.filename)}
                                className="h-8 w-8 p-0"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
          
          {/* File attachments */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="space-y-2">
                  {file.type.startsWith('image/') ? (
                    <div className="space-y-2">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="max-w-full h-auto max-h-32 rounded-md border"
                        onLoad={(e) => {
                          // Clean up the object URL after loading
                          URL.revokeObjectURL((e.target as HTMLImageElement).src);
                        }}
                      />
                      <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFileIcon(file.type)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <span className="text-lg">{getFileIcon(file.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 p-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="*/*"
              />
              {selectedFiles.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                </span>
              )}
            </div>
            <Button
              onClick={() => {
                if (comment.trim()) {
                  createCommentMutation.mutate({ content: comment, files: selectedFiles });
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
