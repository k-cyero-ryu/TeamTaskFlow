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

export default function ChatConversation({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const otherUserId = parseInt(params.id);
  let reconnectAttempts = 0;

  // Update the WebSocket connection logic
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      // Get the current window location
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
            if (data.type === "private_message") {
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
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed');
          setIsConnected(false);
          wsRef.current = null;

          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          // Only attempt reconnect if we're still on the chat page and authenticated
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
        };
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setIsConnected(false);
      }
    };

    // Only attempt connection if we have a user and otherUserId
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
  }, [user?.id, otherUserId, queryClient]);

  // Get messages and user data
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const otherUser = users?.find(u => u.id === otherUserId);

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${otherUserId}`],
    enabled: !isNaN(otherUserId),
  });

  // Send message mutation
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

  // Handle navigation
  if (isNaN(otherUserId) || !otherUser) {
    setLocation("/chat");
    return null;
  }

  // Loading state
  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleSendMessage = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
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