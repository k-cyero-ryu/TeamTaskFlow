import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SendHorizontal, UserPlus, Users } from 'lucide-react';
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

type GroupChannel = {
  id: number;
  name: string;
  description: string | null;
  creatorId: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string | null;
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
    enabled: !!channelId,
  });

  // Fetch channel messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<GroupMessage[]>({
    queryKey: ['/api/channels', channelId, 'messages'],
    enabled: !!channelId,
  });

  // Fetch channel members
  const { data: members = [], isLoading: membersLoading } = useQuery<ChannelMember[]>({
    queryKey: ['/api/channels', channelId, 'members'],
    enabled: !!channelId,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: (content: string) => {
      return apiRequest(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'messages'] });
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
    mutationFn: (data: { userId: number, isAdmin?: boolean }) => {
      return apiRequest(`/api/channels/${channelId}/members`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
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
    mutationFn: (userId: number) => {
      return apiRequest(`/api/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage.mutate(message);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for new messages via custom events
  useEffect(() => {
    const handleGroupMessage = (event: CustomEvent) => {
      try {
        const message = event.detail;
        
        // Check if this is a group message event for this channel
        if (message.type === 'NEW_GROUP_MESSAGE' && message.data && message.data.channelId === channelId) {
          console.log('Received new message for this channel:', message.data);
          
          // Update the query cache to fetch the latest messages
          queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'messages'] });
          
          // Directly update the cache to avoid a network request and instantly show the message
          queryClient.setQueryData<GroupMessage[]>(['/api/channels', channelId, 'messages'], (oldData = []) => {
            // Check if the message is already in the cache to avoid duplicates
            const messageExists = oldData.some(msg => msg.id === message.data.id);
            
            if (!messageExists) {
              return [...oldData, message.data];
            }
            
            return oldData;
          });
        }
      } catch (error) {
        console.error('Error handling group message event:', error);
      }
    };

    const handleMembershipChange = (event: CustomEvent) => {
      try {
        const message = event.detail;
        
        // Only update if it's for this channel
        if (message.data && message.data.channelId === channelId) {
          console.log('Channel membership changed:', message.data);
          
          // Update the members list
          queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'members'] });
        }
      } catch (error) {
        console.error('Error handling membership change event:', error);
      }
    };

    // Add event listeners for the custom events
    window.addEventListener('groupMessage', handleGroupMessage as EventListener);
    window.addEventListener('channelMembershipChanged', handleMembershipChange as EventListener);

    // Clean up on unmount
    return () => {
      window.removeEventListener('groupMessage', handleGroupMessage as EventListener);
      window.removeEventListener('channelMembershipChanged', handleMembershipChange as EventListener);
    };
  }, [channelId, queryClient]);

  // Check if current user is admin
  const isAdmin = members?.some(
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
                Members ({members?.length || 0})
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
                            Enter the user ID to add to this channel.
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
                              <label htmlFor="userId">User ID</label>
                              <Input id="userId" name="userId" type="number" required />
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
                  {members?.map((member: ChannelMember) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {member.user?.username?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.user?.username || 'Unknown User'}</p>
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
        {messages?.length > 0 ? (
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
                    {msg.sender?.username?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`max-w-[80%] ${
                msg.sender?.id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
              } rounded-lg p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {msg.sender?.id === user?.id ? 'You' : msg.sender?.username || 'Unknown User'}
                  </span>
                  <span className="text-xs opacity-70">
                    {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
                <p className="break-words">{msg.content}</p>
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

      <CardFooter className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button type="submit" disabled={sendMessage.isPending || !message.trim()}>
            <SendHorizontal className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </CardFooter>
    </div>
  );
}