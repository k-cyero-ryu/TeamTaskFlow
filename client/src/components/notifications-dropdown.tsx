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
  isRead: boolean;
  readAt: Date | null;
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("PUT", `/api/email/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/notifications"] });
      toast({
        title: "Notification marked as read",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to mark as read: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mark notification as unread
  const markAsUnread = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("PUT", `/api/email/notifications/${notificationId}/unread`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/notifications"] });
      toast({
        title: "Notification marked as unread",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to mark as unread: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/email/notifications/mark-all-read");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/notifications"] });
      toast({
        title: "All notifications marked as read",
        description: `Marked ${data.updatedCount} notifications as read`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to mark all as read: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Count notifications by status
  const pendingCount = notifications.filter(n => n.status === "pending").length;
  const sentCount = notifications.filter(n => n.status === "sent").length;
  const failedCount = notifications.filter(n => n.status === "failed").length;
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const readCount = notifications.filter(n => n.isRead).length;

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
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-1 text-xs">
              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                {unreadCount} unread
              </Badge>
              <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                {readCount} read
              </Badge>
              {failedCount > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  {failedCount} failed
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>
          
          {unreadCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="justify-center cursor-pointer text-xs text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead.mutate();
                }}
                disabled={markAllAsRead.isPending}
              >
                {markAllAsRead.isPending ? "Marking all as read..." : `Mark all ${unreadCount} as read`}
              </DropdownMenuItem>
            </>
          )}
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
                  className={`flex flex-col items-start p-3 cursor-pointer ${
                    notification.isRead ? 'opacity-70' : 'bg-blue-50/50'
                  }`}
                  onClick={() => viewNotificationContent(notification)}
                >
                  <div className="flex w-full justify-between items-start gap-2">
                    <div className="flex items-start gap-2">
                      {getNotificationIcon(notification.type)}
                      <div>
                        <div className={`font-medium text-sm ${
                          notification.isRead ? 'text-muted-foreground' : 'text-foreground'
                        }`}>
                          {notification.subject}
                          {!notification.isRead && (
                            <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(notification.createdAt)}
                          {notification.isRead && notification.readAt && (
                            <span className="ml-2">• Read {formatDate(notification.readAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge
                        variant="outline"
                        className={getStatusColor(notification.status)}
                      >
                        {notification.status}
                      </Badge>
                      <div className="flex gap-1">
                        {notification.isRead ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              markAsUnread.mutate(notification.id);
                            }}
                            disabled={markAsUnread.isPending}
                          >
                            Mark Unread
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              markAsRead.mutate(notification.id);
                            }}
                            disabled={markAsRead.isPending}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </div>
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
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification?.subject}
              {selectedNotification && !selectedNotification.isRead && (
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
              )}
            </DialogTitle>
            <DialogDescription className="flex justify-between">
              <span>
                {selectedNotification?.type} ({selectedNotification?.status})
                {selectedNotification?.isRead ? " • Read" : " • Unread"}
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
              {selectedNotification?.readAt && (
                <span className="ml-2">• Read {formatDate(selectedNotification.readAt)}</span>
              )}
            </div>
            
            <div className="flex gap-2">
              {selectedNotification && (
                selectedNotification.isRead ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      markAsUnread.mutate(selectedNotification.id);
                      // Keep dialog open - don't close
                    }}
                    disabled={markAsUnread.isPending}
                  >
                    Mark as Unread
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      markAsRead.mutate(selectedNotification.id);
                      // Keep dialog open - don't close
                    }}
                    disabled={markAsRead.isPending}
                  >
                    Mark as Read
                  </Button>
                )
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsContentDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}