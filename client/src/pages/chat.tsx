import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Check, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Chat() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/messages/conversations"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Messages</h1>
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
                    <Check
                      className={`h-4 w-4 flex-shrink-0 ${
                        lastMessage.readAt
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  )}
                  <p className="text-sm text-muted-foreground truncate">
                    {lastMessage.content}
                  </p>
                  {lastMessage.senderId !== user?.id && !lastMessage.readAt && (
                    <Badge variant="default" className="ml-auto">
                      New
                    </Badge>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto flex-shrink-0" />
                </div>
              </div>
            </div>
          </Card>
        ))}

        {conversations?.length === 0 && (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No messages yet</h3>
            <p className="text-muted-foreground mt-1">
              Start a conversation with someone to see messages here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
