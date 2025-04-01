import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Server, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// SMTP settings schema
const smtpSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().int().positive("Port must be a positive number"),
  user: z.string().min(1, "SMTP username is required"),
  password: z.string().min(1, "SMTP password is required"),
  secure: z.boolean().default(false),
  fromEmail: z.string().email("Must be a valid email address"),
  fromName: z.string().min(1, "From name is required"),
});

// Notification preferences schema
const notificationPreferencesSchema = z.object({
  email: z.string().email("Must be a valid email address").optional(),
  notificationPreferences: z.object({
    taskAssigned: z.boolean().default(true),
    taskUpdated: z.boolean().default(true),
    taskCommented: z.boolean().default(true),
    mentionedInComment: z.boolean().default(true),
    privateMessage: z.boolean().default(true),
    groupMessage: z.boolean().default(false),
    taskDueReminder: z.boolean().default(true)
  }).optional(),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testEmailMessage, setTestEmailMessage] = useState("");

  // SMTP settings form
  const smtpForm = useForm({
    resolver: zodResolver(smtpSchema),
    defaultValues: {
      host: "",
      port: 587,
      user: "",
      password: "",
      secure: false,
      fromEmail: "noreply@teamcollaborator.com",
      fromName: "Team Collaborator",
    },
  });

  // Notification preferences form
  const notificationForm = useForm({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      email: user?.email || "",
      notificationPreferences: {
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

  // Query to get SMTP settings
  const { data: smtpSettings, isLoading: isLoadingSmtpSettings } = useQuery({
    queryKey: ['/api/email/smtp-settings'],
    onSuccess: (data) => {
      if (data) {
        smtpForm.reset(data);
      }
    },
    onError: (error) => {
      // It's okay if this fails initially as the settings might not exist yet
      console.error("Failed to load SMTP settings:", error);
    },
  });

  // Query to get user notification preferences
  const { data: userPreferences, isLoading: isLoadingUserPreferences } = useQuery({
    queryKey: ['/api/email/settings', user?.id],
    enabled: !!user?.id,
    onSuccess: (data) => {
      if (data) {
        notificationForm.reset({
          email: data.email || "",
          notificationPreferences: data.notificationPreferences || {
            taskAssigned: true,
            taskUpdated: true,
            taskCommented: true,
            mentionedInComment: true,
            privateMessage: true,
            groupMessage: false,
            taskDueReminder: true,
          },
        });
      }
    },
  });

  // Mutation to update SMTP settings
  const updateSmtpSettings = useMutation({
    mutationFn: async (data: z.infer<typeof smtpSchema>) => {
      const response = await apiRequest("PUT", "/api/email/smtp-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/smtp-settings'] });
      toast({
        title: "SMTP Settings Updated",
        description: "Email server configuration has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update SMTP settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to update user notification preferences
  const updateNotificationPreferences = useMutation({
    mutationFn: async (data: z.infer<typeof notificationPreferencesSchema>) => {
      const response = await apiRequest("PUT", "/api/email/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/settings', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Notification Settings Updated",
        description: "Your notification preferences have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update notification preferences: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Function to test SMTP settings
  const testEmailConnection = async () => {
    setTestEmailStatus('loading');
    setTestEmailMessage("");
    
    try {
      const response = await apiRequest("POST", "/api/email/test", smtpForm.getValues());
      const result = await response.json();
      
      if (response.ok) {
        setTestEmailStatus('success');
        setTestEmailMessage(result.message || "Test email sent successfully!");
      } else {
        setTestEmailStatus('error');
        setTestEmailMessage(result.error || "Failed to send test email.");
      }
    } catch (error) {
      setTestEmailStatus('error');
      setTestEmailMessage(error instanceof Error ? error.message : "An unknown error occurred");
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="user-notifications" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="user-notifications">Notification Preferences</TabsTrigger>
          <TabsTrigger value="smtp-settings">Email Server (SMTP) Settings</TabsTrigger>
        </TabsList>
        
        {/* User Notification Preferences */}
        <TabsContent value="user-notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how and when you receive notifications about tasks and messages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationForm}>
                <form 
                  onSubmit={notificationForm.handleSubmit((data) => updateNotificationPreferences.mutate(data))}
                  className="space-y-6"
                >
                  <FormField
                    control={notificationForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="your@email.com" 
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          We'll use this email address to send you notifications.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  <div>
                    <h3 className="text-lg font-medium mb-3">Email Notification Types</h3>
                    <div className="grid gap-4">
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.taskAssigned"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Task Assignment</FormLabel>
                              <FormDescription>
                                Receive a notification when a task is assigned to you
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.taskUpdated"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Task Updates</FormLabel>
                              <FormDescription>
                                Receive a notification when a task you're assigned to is updated
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.taskCommented"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Task Comments</FormLabel>
                              <FormDescription>
                                Receive a notification when someone comments on your task
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.mentionedInComment"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>@Mentions</FormLabel>
                              <FormDescription>
                                Receive a notification when you are mentioned in a comment
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.privateMessage"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Private Messages</FormLabel>
                              <FormDescription>
                                Receive a notification when you get a new private message
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.groupMessage"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Group Messages</FormLabel>
                              <FormDescription>
                                Receive a notification when there's a new message in a group channel
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={notificationForm.control}
                        name="notificationPreferences.taskDueReminder"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Due Date Reminders</FormLabel>
                              <FormDescription>
                                Receive a reminder when a task is approaching its due date
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={updateNotificationPreferences.isPending}
                    className="w-full sm:w-auto"
                  >
                    {updateNotificationPreferences.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Notification Preferences"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* SMTP Settings */}
        <TabsContent value="smtp-settings">
          <Card>
            <CardHeader>
              <CardTitle>Email Server Settings (SMTP)</CardTitle>
              <CardDescription>
                Configure the SMTP server settings for sending email notifications. These settings are global for the entire application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...smtpForm}>
                <form 
                  onSubmit={smtpForm.handleSubmit((data) => updateSmtpSettings.mutate(data))}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={smtpForm.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl>
                            <Input placeholder="smtp.example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smtpForm.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Port</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="587" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smtpForm.control}
                      name="user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Username</FormLabel>
                          <FormControl>
                            <Input placeholder="username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smtpForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smtpForm.control}
                      name="fromEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="noreply@yourcompany.com" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={smtpForm.control}
                      name="fromName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your Application Name" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={smtpForm.control}
                    name="secure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Use Secure Connection (SSL/TLS)</FormLabel>
                          <FormDescription>
                            Enable for secure SMTP over SSL/TLS (usually for port 465)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  {testEmailStatus === 'success' && (
                    <Alert className="bg-green-50 text-green-800 border-green-200">
                      <Mail className="h-4 w-4" />
                      <AlertTitle>Success!</AlertTitle>
                      <AlertDescription>{testEmailMessage}</AlertDescription>
                    </Alert>
                  )}
                  
                  {testEmailStatus === 'error' && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Test Failed</AlertTitle>
                      <AlertDescription>{testEmailMessage}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      type="submit" 
                      disabled={updateSmtpSettings.isPending}
                    >
                      {updateSmtpSettings.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save SMTP Settings"
                      )}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled={testEmailStatus === 'loading'}
                      onClick={testEmailConnection}
                    >
                      {testEmailStatus === 'loading' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Test Connection
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex-col items-start">
              <p className="text-sm text-muted-foreground mb-2">
                <Server className="h-4 w-4 inline-block mr-1" />
                <span>If you don't have an SMTP server, you can use services like SendGrid, Mailgun, or SMTP2GO.</span>
              </p>
              <p className="text-sm text-muted-foreground">
                In development mode, emails are intercepted and not actually sent. Check server logs for email previews.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}