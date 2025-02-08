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

type User = {
  id: number;
  username: string;
};

let ws: WebSocket | null = null;

export default function ChatConversation({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const otherUserId = parseInt(params.id);

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "private_message") {
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${otherUserId}`] });
      }
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [otherUserId, queryClient]);

  const { data: otherUser } = useQuery<User>({
    queryKey: ["/api/users", otherUserId],
  });

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: [`/api/messages/${otherUserId}`],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/messages/${otherUserId}`, {
        content,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData<Message[]>([`/api/messages/${otherUserId}`], (old) => [
        ...(old || []),
        newMessage,
      ]);

      // Send message through WebSocket
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "private_message",
          data: newMessage,
        }));
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

  // Mark messages as read
  useEffect(() => {
    if (messages.some((m) => m.senderId === otherUserId && !m.readAt)) {
      apiRequest("POST", `/api/messages/${otherUserId}/read`);
    }
  }, [messages, otherUserId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
                {otherUser?.username?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="font-semibold">{otherUser?.username}</h2>
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
                  if (message.trim()) {
                    sendMessageMutation.mutate(message);
                  }
                }
              }}
            />
            <Button
              onClick={() => {
                if (message.trim()) {
                  sendMessageMutation.mutate(message);
                }
              }}
              disabled={!message.trim() || sendMessageMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}