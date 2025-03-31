import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { useEffect, useState } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormGeneralError } from "@/components/ui/form-error";
import { FormField as CustomFormField } from "@/components/ui/form-field";
import { useFormError } from "@/hooks/use-form-error";
import { ErrorBoundary } from "@/components/error-boundary";
import { handleQueryError } from "@/lib/error-utils";
import { z } from "zod";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();

  useEffect(() => {
    // If authenticated and no pending mutations, force navigation to dashboard
    if (user && !loginMutation.isPending && !registerMutation.isPending) {
      window.location.href = "/";
    }
  }, [user, loginMutation.isPending, registerMutation.isPending]);

  // If user exists and no pending mutations, don't render anything while redirecting
  if (user && !loginMutation.isPending && !registerMutation.isPending) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Welcome to TaskMaster</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <AuthForm
                  mode="login"
                  onSubmit={(data) => {
                    loginMutation.mutate(data);
                  }}
                  isPending={loginMutation.isPending}
                />
              </TabsContent>
              <TabsContent value="register">
                <AuthForm
                  mode="register"
                  onSubmit={(data) => {
                    registerMutation.mutate(data);
                  }}
                  isPending={registerMutation.isPending}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center text-primary-foreground">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold mb-6">TaskMaster</h1>
          <p className="text-lg">
            Your all-in-one solution for task management and team collaboration.
          </p>
        </div>
      </div>
    </div>
  );
}

function AuthForm({
  mode,
  onSubmit,
  isPending,
}: {
  mode: "login" | "register";
  onSubmit: (data: InsertUser) => void;
  isPending: boolean;
}) {
  // Use our enhanced validation schema
  const authSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });
  
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  const form = useForm<InsertUser>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Use our custom form error hook
  const { getFieldError, clearFormErrors } = useFormError(form);

  // Enhanced onSubmit that handles errors
  const handleSubmit = async (data: InsertUser) => {
    try {
      clearFormErrors();
      setGeneralError(null);
      onSubmit(data);
    } catch (error) {
      const errorMessage = handleQueryError(error);
      setGeneralError(errorMessage || "An error occurred during authentication");
    }
  };

  return (
    <ErrorBoundary fallback={<p>Something went wrong with the authentication form.</p>}>
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(handleSubmit)} 
          className="space-y-4 mt-4"
        >
          {generalError && <FormGeneralError error={generalError} />}
          
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <CustomFormField
                id="username"
                label="Username"
                error={getFieldError("username")}
                required
              >
                <Input 
                  id="username"
                  placeholder="Enter your username" 
                  autoComplete="username"
                  {...field} 
                />
              </CustomFormField>
            )}
          />
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <CustomFormField
                id="password"
                label="Password"
                error={getFieldError("password")}
                required
              >
                <Input 
                  id="password"
                  type="password" 
                  placeholder={mode === "login" ? "Enter your password" : "Create a password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  {...field} 
                />
              </CustomFormField>
            )}
          />
          
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Loading..." : mode === "login" ? "Login" : "Register"}
          </Button>
        </form>
      </Form>
    </ErrorBoundary>
  );
}