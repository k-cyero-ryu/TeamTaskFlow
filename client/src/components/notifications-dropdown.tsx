import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Check, AlertCircle, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";

// Type for an email notification
type EmailNotification = {
  id: number;
  userId: number;
  subject: string;
  content: string;
  type: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
  sentAt: Date | null;
  createdAt: Date;
};

export function NotificationsDropdown() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isContentDialogOpen, setIsContentDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<EmailNotification | null>(null);

  // Query for email notifications
  const { data: notifications = [], isLoading } = useQuery<EmailNotification[]>({
    queryKey: ["/api/email/notifications"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Send a test welcome email
  const sendWelcomeEmail = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/email/notifications/send-welcome");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/notifications"] });
      toast({
        title: "Welcome Email Sent",
        description: "A test welcome email has been queued for delivery.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to send welcome email: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Count notifications by status
  const pendingCount = notifications.filter(n => n.status === "pending").length;
  const sentCount = notifications.filter(n => n.status === "sent").length;
  const failedCount = notifications.filter(n => n.status === "failed").length;

  // Function to render appropriate icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "welcome":
        return <Mail className="h-4 w-4 text-blue-500" />;
      case "task_assigned":
        return <Check className="h-4 w-4 text-green-500" />;
      case "task_comment":
        return <Mail className="h-4 w-4 text-indigo-500" />;
      case "task_due":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Function to show notification content dialog
  const viewNotificationContent = (notification: EmailNotification) => {
    setSelectedNotification(notification);
    setIsContentDialogOpen(true);
  };

  // Format date for display
  const formatDate = (date: Date | string) => {
    try {
      if (date instanceof Date) {
        return format(date, "MMM d, yyyy h:mm a");
      }
      return format(new Date(date), "MMM d, yyyy h:mm a");
    } catch (e) {
      return String(date);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                {notifications.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-1 text-xs">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                {pendingCount} pending
              </Badge>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                {sentCount} sent
              </Badge>
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                {failedCount} failed
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <ScrollArea className="h-80">
            <DropdownMenuGroup>
              {isLoading && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              )}

              {!isLoading && notifications.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              )}

              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start p-3 cursor-pointer"
                  onClick={() => viewNotificationContent(notification)}
                >
                  <div className="flex w-full justify-between items-start gap-2">
                    <div className="flex items-start gap-2">
                      {getNotificationIcon(notification.type)}
                      <div>
                        <div className="font-medium text-sm">{notification.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={getStatusColor(notification.status)}
                    >
                      {notification.status}
                    </Badge>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </ScrollArea>

          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="justify-center cursor-pointer font-medium"
            onClick={() => sendWelcomeEmail.mutate()}
            disabled={sendWelcomeEmail.isPending}
          >
            {sendWelcomeEmail.isPending ? "Sending..." : "Send Test Welcome Email"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Email Content Dialog */}
      <Dialog open={isContentDialogOpen} onOpenChange={setIsContentDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.subject}</DialogTitle>
            <DialogDescription className="flex justify-between">
              <span>
                {selectedNotification?.type} ({selectedNotification?.status})
              </span>
              <span>{selectedNotification?.createdAt && formatDate(selectedNotification.createdAt)}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="border rounded-md p-4 bg-card">
            <div className="flex justify-between mb-3">
              <span className="text-sm text-muted-foreground">Notification ID: {selectedNotification?.id}</span>
              <Badge variant="outline" className={selectedNotification?.status ? getStatusColor(selectedNotification.status) : ""}>
                {selectedNotification?.status}
              </Badge>
            </div>
            
            <div className="border-t pt-3">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedNotification?.content || "" }} />
            </div>
          </div>

          {selectedNotification?.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              <div className="font-medium">Error:</div>
              <div>{selectedNotification.error}</div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              ID: {selectedNotification?.id}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsContentDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}