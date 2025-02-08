import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import type { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type Conversation = {
  user: {
    id: number;
    username: string;
  };
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
    readAt: string | null;
  };
};

export default function Chat() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    onError: (error: Error) => {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const isLoading = conversationsLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const otherUsers = users?.filter(u => u.id !== user?.id) || [];

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Messages</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a Conversation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {otherUsers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No other users available
                </div>
              ) : (
                otherUsers.map((otherUser) => (
                  <Card
                    key={otherUser.id}
                    className="p-4 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setLocation(`/chat/${otherUser.id}`);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {otherUser.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium">{otherUser.username}</h3>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {conversations?.map(({ user: otherUser, lastMessage }) => (
          <Card
            key={otherUser.id}
            className="p-4 hover:bg-secondary/50 cursor-pointer transition-colors"
            onClick={() => setLocation(`/chat/${otherUser.id}`)}
          >
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarFallback>
                  {otherUser.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold truncate">
                    {otherUser.username}
                  </h3>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(lastMessage.createdAt), "p")}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {lastMessage.senderId === user?.id && (
                    <svg
                      className={`h-4 w-4 flex-shrink-0 ${
                        lastMessage.readAt
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                      fill="none"
                      height="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <p className="text-sm text-muted-foreground truncate">
                    {lastMessage.content}
                  </p>
                  {lastMessage.senderId !== user?.id && !lastMessage.readAt && (
                    <Badge variant="default" className="ml-auto">
                      New
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {!conversations?.length && (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No messages yet</h3>
            <p className="text-muted-foreground mt-1">
              Start a conversation with someone using the "New Message" button above
            </p>
          </div>
        )}
      </div>
    </div>
  );
}