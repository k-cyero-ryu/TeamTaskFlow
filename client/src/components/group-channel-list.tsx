import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Users } from 'lucide-react';
import { useLocation } from 'wouter';

// Schema for creating a new channel
const createChannelSchema = z.object({
  name: z.string().min(3, { message: 'Channel name must be at least 3 characters' }),
  description: z.string().optional(),
  isPrivate: z.boolean().default(false),
});

type GroupChannel = {
  id: number;
  name: string;
  description: string | null;
  creatorId: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export function GroupChannelList() {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user's channels
  const { data: channels = [], isLoading, error } = useQuery<GroupChannel[]>({
    queryKey: ['/api/channels'],
    staleTime: 30000,
  });

  // Form for creating a new channel
  const form = useForm<z.infer<typeof createChannelSchema>>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: '',
      description: '',
      isPrivate: false,
    },
  });

  // Create channel mutation
  const createChannel = useMutation({
    mutationFn: (values: z.infer<typeof createChannelSchema>) => {
      return apiRequest('POST', '/api/channels', values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      toast({
        title: 'Channel created',
        description: 'Your new channel has been created successfully.',
      });
      setIsOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Failed to create channel',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    },
  });

  // Submit handler for the form
  function onSubmit(values: z.infer<typeof createChannelSchema>) {
    createChannel.mutate(values);
  }

  // Handle channel selection
  function handleChannelClick(channelId: number) {
    navigate(`/channels/${channelId}`);
  }

  if (isLoading) {
    return <div className="p-4">Loading channels...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error loading channels: {error instanceof Error ? error.message : 'An unexpected error occurred'}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Channels</h2>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new channel</DialogTitle>
              <DialogDescription>
                Create a new channel to chat with your team members.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter channel name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the purpose of this channel" 
                          {...field} 
                          value={field.value || ''} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isPrivate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Private Channel</FormLabel>
                        <FormDescription>
                          Only invited members can join private channels
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createChannel.isPending}
                  >
                    {createChannel.isPending ? 'Creating...' : 'Create Channel'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {channels && channels.length > 0 ? (
        <div className="grid gap-4">
          {channels.map((channel: GroupChannel) => (
            <Card 
              key={channel.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleChannelClick(channel.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {channel.isPrivate ? '🔒 ' : '# '}{channel.name}
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>
                  {channel.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-background">
          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <h3 className="font-medium">No channels yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a new channel to start chatting with your team
          </p>
          <Button
            variant="outline"
            onClick={() => setIsOpen(true)}
          >
            Create Your First Channel
          </Button>
        </div>
      )}
    </div>
  );
}