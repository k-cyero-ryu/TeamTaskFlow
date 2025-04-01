import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Send, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { FileUpload, FileAttachment as FileAttachmentComponent } from "@/components/file-upload";
import { cn } from "@/lib/utils";

type FileAttachment = {
  id: number;
  filename: string;
  originalFilename: string;
  filepath: string;
  mimetype: string;
  size: number;
  uploaderId: number;
  createdAt: string;
};

type Message = {
  id: number;
  content: string;
  senderId: number;
  recipientId: number;
  createdAt: string;
  readAt: string | null;
  sender: {
    id: number;
    username: string;
  };
  attachments?: FileAttachment[];
};

export default function ChatConversation({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const otherUserId = parseInt(params.id);
  let reconnectAttempts = 0;

  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      console.log('Attempting WebSocket connection to:', wsUrl);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected successfully');
          setIsConnected(true);
          if (user?.id) {
            ws.send(JSON.stringify({
              type: 'identify',
              userId: user.id
            }));
          }
          reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);

            switch (data.type) {
              case "connection_status":
                console.log("Connection status:", data.status);
                if (data.status === "connected" && user?.id) {
                  ws.send(JSON.stringify({
                    type: 'identify',
                    userId: user.id
                  }));
                }
                break;
              case "identification_status":
                console.log("Identification status:", data.status);
                break;
              case "private_message":
                const messageData = data.data;
                queryClient.setQueryData<Message[]>(
                  [`/api/messages/${otherUserId}`],
                  (old) => {
                    if (!old) return [messageData];
                    if (old.some(m => m.id === messageData.id)) return old;
                    return [...old, messageData];
                  }
                );
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                break;
              case "error":
                console.error("WebSocket error from server:", data.message);
                toast({
                  title: "WebSocket Error",
                  description: data.message,
                  variant: "destructive",
                });
                break;
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket connection closed:', event.code, event.reason);
          setIsConnected(false);
          wsRef.current = null;

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          if (user?.id) {
            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Attempting reconnect in ${backoffDelay}ms`);
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, backoffDelay);
            reconnectAttempts++;
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket connection error:', error);
          setIsConnected(false);
          toast({
            title: "Connection Error",
            description: "Failed to connect to chat server. Retrying...",
            variant: "destructive",
          });
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setIsConnected(false);
      }
    };

    if (user?.id && otherUserId) {
      console.log('Initiating WebSocket connection...');
      connectWebSocket();
    }

    return () => {
      console.log('Cleaning up WebSocket connection');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user?.id, otherUserId, queryClient, toast]);

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const otherUser = users?.find(u => u.id === otherUserId);

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${otherUserId}`],
    enabled: !isNaN(otherUserId),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      const res = await fetch(`/api/messages/${otherUserId}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageContent,
          recipientId: otherUserId
        }),
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send message");
      }

      return res.json();
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData<Message[]>([`/api/messages/${otherUserId}`], (old) => {
        if (!old) return [newMessage];
        if (old.some(m => m.id === newMessage.id)) return old;
        return [...old, newMessage];
      });

      setMessage("");
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isNaN(otherUserId) || !otherUser) {
    setLocation("/chat");
    return null;
  }

  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleSendMessage = async () => {
    // If no message content and no files, don't send anything
    if (!message.trim() && selectedFiles.length === 0) return;
    
    // If there are file attachments, use the upload endpoint
    if (selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('content', message);
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        const response = await fetch(`/api/uploads/private-message/${otherUserId}`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update the UI and clear the form
        setMessage('');
        setSelectedFiles([]);
        
        // Update the query cache with the new message
        queryClient.setQueryData<Message[]>([`/api/messages/${otherUserId}`], (oldData) => {
          const currentMessages = Array.isArray(oldData) ? oldData : [];
          if (!currentMessages.some(m => m.id === data.id)) {
            return [...currentMessages, data];
          }
          return currentMessages;
        });
        
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (error) {
        toast({
          title: 'Failed to send message with attachments',
          description: error instanceof Error ? error.message : 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    } else {
      // Regular message without attachments
      sendMessageMutation.mutate(message);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b p-4">
        <div className="container mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/chat")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarFallback>
                {otherUser.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">{otherUser.username}</h2>
              {!isConnected && (
                <p className="text-sm text-muted-foreground">
                  Reconnecting...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="container mx-auto space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.senderId === user?.id;
            const showDate =
              index === 0 ||
              new Date(message.createdAt).toDateString() !==
                new Date(messages[index - 1].createdAt).toDateString();

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-full">
                      {format(new Date(message.createdAt), "MMMM d, yyyy")}
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-end gap-2 ${
                    isOwn ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>
                      {message.sender.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`group relative max-w-[70%] rounded-lg px-3 py-2 ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content && <p className="break-words">{message.content}</p>}
                    
                    {/* Display file attachments if any */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.attachments.map((attachment) => (
                          <FileAttachmentComponent
                            key={attachment.id}
                            filename={attachment.originalFilename}
                            size={attachment.size}
                            url={`/api/uploads/file/${attachment.filename}`}
                            className={cn(
                              isOwn 
                                ? "bg-primary-foreground border-primary/30" 
                                : "bg-background border-muted-foreground/20"
                            )}
                          />
                        ))}
                      </div>
                    )}
                    
                    <span className={`text-xs opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 ${isOwn ? 'left-0 translate-x-[-100%] pl-1' : 'right-0 translate-x-[100%] pr-1'}`}>
                      {format(new Date(message.createdAt), "p")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t p-4">
        <div className="container mx-auto">
          {selectedFiles.length > 0 && (
            <div className="mb-3">
              <FileUpload
                onFilesSelected={setSelectedFiles}
                onClearFiles={() => setSelectedFiles([])}
                selectedFiles={selectedFiles}
                maxFiles={5}
              />
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="resize-none pr-10"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isUploading) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  // Open file selection dialog if no files selected yet
                  if (selectedFiles.length === 0) {
                    document.getElementById('private-file-upload-input')?.click();
                  }
                }}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {/* Hidden file input for attachment button */}
              <input
                id="private-file-upload-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    const filesArray = Array.from(e.target.files);
                    if (filesArray.length > 5) {
                      toast({
                        title: "Too many files",
                        description: "You can only upload a maximum of 5 files.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setSelectedFiles(filesArray);
                  }
                }}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={(isUploading || sendMessageMutation.isPending) || (!message.trim() && selectedFiles.length === 0)}
            >
              {isUploading || sendMessageMutation.isPending ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}