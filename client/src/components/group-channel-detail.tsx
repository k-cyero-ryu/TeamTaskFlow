import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserSelector } from './user-selector';
import { FileUpload, FileAttachment as FileAttachmentComponent } from './file-upload';
import { 
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '@/hooks/use-websocket';
import { SendHorizontal, UserPlus, Users, Paperclip, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type GroupChannel = {
  id: number;
  name: string;
  description: string | null;
  creatorId: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string | null;
};

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

type GroupMessage = {
  id: number;
  content: string;
  channelId: number;
  senderId: number;
  createdAt: string;
  updatedAt: string | null;
  sender: {
    id: number;
    username: string;
  };
  attachments?: FileAttachment[];
};

type ChannelMember = {
  id: number;
  channelId: number;
  userId: number;
  isAdmin: boolean;
  joinedAt: string;
  user: {
    id: number;
    username: string;
  };
};

type GroupChannelDetailProps = {
  channelId: number;
};

export function GroupChannelDetail({ channelId }: GroupChannelDetailProps) {
  const [message, setMessage] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useWebSocket();

  // Fetch channel details
  const { data: channel, isLoading: channelLoading } = useQuery<GroupChannel>({
    queryKey: ['/api/channels', channelId],
    queryFn: async () => {
      console.log('Fetching channel details for', channelId);
      try {
        const response = await fetch(`/api/channels/${channelId}`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch channel: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Channel details loaded:', data);
        return data;
      } catch (error) {
        console.error('Error fetching channel details:', error);
        throw error;
      }
    },
    enabled: !!channelId,
    refetchOnMount: true
  });

  // Fetch channel messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<GroupMessage[]>({
    queryKey: ['/api/channels', channelId, 'messages'],
    queryFn: async () => {
      console.log('Fetching messages for channel', channelId);
      try {
        const response = await fetch(`/api/channels/${channelId}/messages`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Channel messages loaded:', data);
        
        // Make sure we handle the response properly
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching channel messages:', error);
        return [];
      }
    },
    enabled: !!channelId,
    // Make sure to refetch whenever the component is mounted, to get latest messages
    refetchOnMount: true, 
    refetchOnWindowFocus: true,
    staleTime: 0, // Always treat data as stale to ensure we get fresh data
  });

  // Fetch channel members
  const { data: members = [], isLoading: membersLoading } = useQuery<ChannelMember[]>({
    queryKey: ['/api/channels', channelId, 'members'],
    queryFn: async () => {
      console.log('Fetching members for channel', channelId);
      try {
        const response = await fetch(`/api/channels/${channelId}/members`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch members: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Channel members loaded:', data);
        
        // Make sure we handle the response properly
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Error fetching channel members:', error);
        return [];
      }
    },
    enabled: !!channelId,
    refetchOnMount: true
  });
  
  // Log members data when it changes
  useEffect(() => {
    if (members && members.length > 0) {
      console.log('Channel members loaded:', members);
    }
  }, [members]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      console.log('Sending message to channel', channelId, content);
      const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ 
          content,
          channelId    // Include the channelId in the request body as required by schema
        }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Clear the message input
      setMessage('');
      
      // Immediately update the cache with the new message
      // We do this in addition to the WebSocket update to ensure the UI updates instantly
      queryClient.setQueryData<GroupMessage[]>(['/api/channels', channelId, 'messages'], (oldData) => {
        // Ensure oldData is always an array
        const currentMessages = Array.isArray(oldData) ? oldData : [];
        // Handle the response data, ensuring it's properly typed
        if (data && typeof data === 'object' && 'id' in data) {
          const typedData = data as unknown as GroupMessage;
          if (!currentMessages.some(msg => msg.id === typedData.id)) {
            return [...currentMessages, typedData];
          }
        }
        return currentMessages;
      });
      
      // Scroll to bottom after sending a message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    onError: (error) => {
      toast({
        title: 'Failed to send message',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  // Add member mutation
  const addMember = useMutation({
    mutationFn: async (data: { userId: number, isAdmin?: boolean }) => {
      console.log('Adding member to channel', channelId, data);
      const response = await fetch(`/api/channels/${channelId}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add member: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Force refresh
      queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'members'] });
      toast({
        title: 'Member added',
        description: 'The user has been added to the channel.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add member',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (userId: number) => {
      console.log('Removing member from channel', channelId, userId);
      const response = await fetch(`/api/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to remove member: ${response.status} ${response.statusText}`);
      }
      
      return true;
    },
    onSuccess: () => {
      // Force refresh
      queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'members'] });
      toast({
        title: 'Member removed',
        description: 'The user has been removed from the channel.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove member',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  // Handle message submission
  // State for file attachments
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && selectedFiles.length === 0) {
      return;
    }
    
    // If there are file attachments, use the upload endpoint
    if (selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        // If no message content is provided, use a default empty string
        formData.append('content', message || ' ');
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
        
        const response = await fetch(`/api/uploads/group-message/${channelId}`, {
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
        queryClient.setQueryData<GroupMessage[]>(['/api/channels', channelId, 'messages'], (oldData) => {
          const currentMessages = Array.isArray(oldData) ? oldData : [];
          return [...currentMessages, data];
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
      sendMessage.mutate(message);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for new messages directly from WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleSocketMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data !== 'string') {
          console.error('Non-string message received:', event.data);
          return;
        }

        const message = JSON.parse(event.data);
        
        // Handle new group messages
        if (message.type === 'NEW_GROUP_MESSAGE' && message.data && message.data.channelId === channelId) {
          console.log('Received new message for this channel:', message.data);
          
          // Get the current messages from cache
          const cachedData = queryClient.getQueryData<GroupMessage[]>(['/api/channels', channelId, 'messages']);
          // Ensure we're working with an array
          const currentMessages = Array.isArray(cachedData) ? cachedData : [];
          
          // Check if message already exists in the cache
          const messageExists = currentMessages.some(msg => msg.id === message.data.id);
          
          // Only add if it doesn't exist already
          if (!messageExists) {
            // Create a proper copy of the messages array with the new message added
            const updatedMessages = [...currentMessages, message.data];
            
            // Update the cache with the new array
            queryClient.setQueryData<GroupMessage[]>(['/api/channels', channelId, 'messages'], updatedMessages);
            
            // Force a scroll to bottom on new message
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        }
        
        // Handle membership changes
        else if ((message.type === 'CHANNEL_MEMBER_ADDED' || message.type === 'CHANNEL_MEMBER_REMOVED') 
                && message.data && message.data.channelId === channelId) {
          console.log('Channel membership changed:', message.data);
          
          // Refresh the members list
          queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'members'] });
        }
      } catch (error) {
        console.error('Error handling WebSocket message in channel component:', error);
      }
    };

    // Add direct WebSocket event listener
    socket.addEventListener('message', handleSocketMessage);

    // Clean up on unmount
    return () => {
      socket.removeEventListener('message', handleSocketMessage);
    };
  }, [socket, channelId, queryClient, messagesEndRef]);

  // Check if current user is admin
  const isAdmin = Array.isArray(members) && members.some(
    (member: ChannelMember) => member.userId === user?.id && member.isAdmin
  );

  if (channelLoading || messagesLoading || membersLoading) {
    return <div className="p-4">Loading channel...</div>;
  }

  if (!channel) {
    return <div className="p-4 text-red-500">Channel not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <CardHeader className="border-b py-4 flex-row justify-between items-center">
        <div>
          <CardTitle className="text-xl">
            {channel?.isPrivate ? '🔒 ' : '# '}{channel?.name || 'Channel'}
          </CardTitle>
          {channel?.description && (
            <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover open={showMembers} onOpenChange={setShowMembers}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Members ({Array.isArray(members) ? members.length : 0})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Channel Members</h4>
                  {isAdmin && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Member to Channel</DialogTitle>
                          <DialogDescription>
                            Select a user to add to this channel.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const userId = Number(formData.get('userId'));
                          const isAdmin = Boolean(formData.get('isAdmin'));
                          
                          if (!isNaN(userId)) {
                            addMember.mutate({ userId, isAdmin });
                            (e.target as HTMLFormElement).reset();
                          }
                        }}>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <label htmlFor="userId">Select User</label>
                              <UserSelector id="userId" name="userId" />
                            </div>
                            <div className="flex items-center space-x-2">
                              <input type="checkbox" id="isAdmin" name="isAdmin" />
                              <label htmlFor="isAdmin">Make admin</label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={addMember.isPending}>
                              {addMember.isPending ? 'Adding...' : 'Add Member'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {Array.isArray(members) && members.map((member: ChannelMember) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.user && member.user.username ? member.user.username.charAt(0).toUpperCase() : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {member.user && member.user.username ? member.user.username : 'Unknown User'}
                          </p>
                          {member.isAdmin && (
                            <span className="text-xs text-muted-foreground">Admin</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && member.userId !== user?.id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeMember.mutate(member.userId)}
                          disabled={removeMember.isPending}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Array.isArray(messages) && messages.length > 0 ? (
          messages.map((msg: GroupMessage) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.sender?.id === user?.id ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender?.id !== user?.id && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {msg.sender && msg.sender.username ? msg.sender.username.charAt(0).toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`max-w-[80%] ${
                msg.sender?.id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
              } rounded-lg p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {msg.sender?.id === user?.id ? 'You' : (msg.sender && msg.sender.username ? msg.sender.username : 'Unknown User')}
                  </span>
                  <span className="text-xs opacity-70">
                    {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
                {msg.content && <p className="break-words">{msg.content}</p>}
                
                {/* Display file attachments if any */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.attachments.map((attachment) => (
                      <FileAttachmentComponent
                        key={attachment.id}
                        filename={attachment.originalFilename}
                        size={attachment.size}
                        url={`/api/uploads/file/${attachment.filename}`}
                        className={cn(
                          msg.sender?.id === user?.id 
                            ? "bg-primary-foreground border-primary/30" 
                            : "bg-background border-muted-foreground/20"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {msg.sender?.id === user?.id && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        ) : (
          <div className="text-center p-8">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <CardFooter className="border-t p-4 flex-col">
        {selectedFiles.length > 0 && (
          <div className="mb-3 w-full">
            <FileUpload
              onFilesSelected={setSelectedFiles}
              onClearFiles={() => setSelectedFiles([])}
              selectedFiles={selectedFiles}
              maxFiles={5}
            />
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <div className="relative flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                // Open file selection dialog if no files selected yet
                if (selectedFiles.length === 0) {
                  document.getElementById('file-upload-input')?.click();
                }
              }}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {/* Hidden file input for attachment button */}
            <input
              id="file-upload-input"
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
            type="submit" 
            disabled={(isUploading || sendMessage.isPending) || (!message.trim() && selectedFiles.length === 0)}
          >
            {isUploading ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⏳</span> Uploading...
              </span>
            ) : (
              <>
                <SendHorizontal className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </form>
      </CardFooter>
    </div>
  );
}