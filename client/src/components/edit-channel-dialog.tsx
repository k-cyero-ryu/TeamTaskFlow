import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { GroupChannel } from "@shared/schema";

const editChannelSchema = z.object({
  name: z.string().min(1, "Channel name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  isPrivate: z.boolean(),
});

type EditChannelForm = z.infer<typeof editChannelSchema>;

interface EditChannelDialogProps {
  channel: GroupChannel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditChannelDialog({ channel, open, onOpenChange }: EditChannelDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditChannelForm>({
    resolver: zodResolver(editChannelSchema),
    defaultValues: {
      name: channel.name,
      description: channel.description || "",
      isPrivate: channel.isPrivate || false,
    },
  });

  const editChannelMutation = useMutation({
    mutationFn: async (data: EditChannelForm) => {
      const response = await apiRequest("PUT", `/api/channels/${channel.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({
        title: "Channel updated",
        description: "The channel has been updated successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update channel: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditChannelForm) => {
    editChannelMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Channel</DialogTitle>
          <DialogDescription>
            Update the channel settings. Only you as the creator can edit this channel.
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter channel description"
                      rows={3}
                      {...field}
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
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Private Channel</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Only invited members can see and join this channel
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={editChannelMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editChannelMutation.isPending}
              >
                {editChannelMutation.isPending ? "Updating..." : "Update Channel"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}