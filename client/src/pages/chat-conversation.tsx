import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

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
};

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export default function ChatConversation({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const otherUserId = parseInt(params.id);

  // Connect to WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          reconnectAttempts = 0;

          // Send identify message
          if (user?.id && ws) {
            ws.send(JSON.stringify({
              type: 'identify',
              userId: user.id
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "private_message") {
              const messageData = data.data;
              if (
                (messageData.senderId === otherUserId && messageData.recipientId === user?.id) ||
                (messageData.senderId === user?.id && messageData.recipientId === otherUserId)
              ) {
                // Update messages optimistically
                queryClient.setQueryData<Message[]>([`/api/messages/${otherUserId}`], (old) => {
                  if (!old) return [messageData];
                  // Avoid duplicates
                  if (old.some(m => m.id === messageData.id)) return old;
                  return [...old, messageData];
                });
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, 1000 * Math.min(reconnectAttempts, 30));
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Error establishing WebSocket connection:', error);
        setIsConnected(false);
      }
    };

    if (user?.id) {
      connectWebSocket();
    }

    return () => {
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [otherUserId, queryClient, user?.id]);

  // Get the other user's data and messages with error boundaries
  const { data: users, isError: usersError } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const otherUser = users?.find(u => u.id === otherUserId);

  const { data: messages = [], isLoading: isLoadingMessages, isError: messagesError } = useQuery<Message[]>({
    queryKey: [`/api/messages/${otherUserId}`],
    enabled: !isNaN(otherUserId),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      const res = await apiRequest("POST", `/api/messages/${otherUserId}`, {
        content: messageContent,
        recipientId: otherUserId
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: (newMessage) => {
      // Update messages optimistically
      queryClient.setQueryData<Message[]>([`/api/messages/${otherUserId}`], (old) => {
        if (!old) return [newMessage];
        if (old.some(m => m.id === newMessage.id)) return old;
        return [...old, newMessage];
      });

      // Send message through WebSocket
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "private_message",
          data: newMessage,
        }));
      } else {
        toast({
          title: "WebSocket disconnected",
          description: "Message sent but real-time updates might be delayed.",
          variant: "default",
        });
      }

      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle errors
  if (usersError || messagesError) {
    toast({
      title: "Error",
      description: "Failed to load chat data. Please try again.",
      variant: "destructive",
    });
    return null;
  }

  if (isNaN(otherUserId)) {
    setLocation("/chat");
    return null;
  }

  if (!otherUser) {
    setLocation("/chat");
    return null;
  }

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
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

      {/* Messages */}
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
                    <p className="break-words">{message.content}</p>
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

      {/* Input */}
      <div className="border-t p-4">
        <div className="container mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
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