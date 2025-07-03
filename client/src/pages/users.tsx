import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { z } from "zod";

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      notificationPreferences: {
        taskAssigned: true,
        taskUpdated: true,
        taskCommented: true,
        mentionedInComment: true,
        privateMessage: true,
        groupMessage: false,
        taskDueReminder: true
      }
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; email?: string; notificationPreferences?: any }) => {
      const res = await apiRequest("POST", "/api/register", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create user");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      form.reset();
      setOpen(false);
      toast({
        title: "User created",
        description: "The user has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
    },
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
        <h1 className="text-3xl font-bold">Users</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createUserMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {users?.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-4 p-4 border rounded-lg"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarFallback>
                    {user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{user.username}</h3>
                  <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.email ? user.email : "No email set"}
                  </p>
                </div>
              </div>
              <EditUserDialog user={user} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Add a new component for editing users
type EditUserDialogProps = {
  user: User;
};

function EditUserDialog({ user }: EditUserDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(
      z.object({
        username: z.string().min(3).optional(),
        email: z.string().email().optional(),
        newPassword: z.string().min(6).optional().or(z.literal("")),
        confirmPassword: z.string().optional(),
        notificationPreferences: z.record(z.boolean()).optional(),
      }).refine((data) => {
        if (data.newPassword && data.newPassword.length > 0) {
          return data.newPassword === data.confirmPassword;
        }
        return true;
      }, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      })
    ),
    defaultValues: {
      username: user.username || "",
      email: user.email || "",
      newPassword: "",
      confirmPassword: "",
      notificationPreferences: user.notificationPreferences as Record<string, boolean> || {
        taskAssigned: true,
        taskUpdated: true,
        taskCommented: true,
        mentionedInComment: true,
        privateMessage: true,
        groupMessage: false,
        taskDueReminder: true,
      },
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { 
      username?: string; 
      email?: string; 
      newPassword?: string; 
      notificationPreferences?: Record<string, boolean> 
    }) => {
      // Remove empty password fields from the request
      const cleanData = { ...data };
      if (cleanData.newPassword === "") {
        delete cleanData.newPassword;
      }
      
      const res = await apiRequest("PUT", `/api/users/${user.id}`, cleanData);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to update user");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      form.reset();
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {user.username}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              // Remove confirmPassword from data before sending
              const { confirmPassword, ...updateData } = data;
              updateUserMutation.mutate(updateData);
            })}
            className="space-y-6 max-h-[70vh] overflow-y-auto"
          >
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Password Change */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Change Password</h3>
              <p className="text-sm text-muted-foreground">
                Leave empty to keep current password
              </p>
              
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notification Preferences */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notification Preferences</h3>
              
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: "taskAssigned", label: "Task Assigned" },
                  { key: "taskUpdated", label: "Task Updated" },
                  { key: "taskCommented", label: "Task Commented" },
                  { key: "mentionedInComment", label: "Mentioned in Comment" },
                  { key: "privateMessage", label: "Private Messages" },
                  { key: "groupMessage", label: "Group Messages" },
                  { key: "taskDueReminder", label: "Task Due Reminders" },
                ].map((pref) => (
                  <FormField
                    key={pref.key}
                    control={form.control}
                    name={`notificationPreferences.${pref.key}`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-normal">
                            {pref.label}
                          </FormLabel>
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
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update User"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}