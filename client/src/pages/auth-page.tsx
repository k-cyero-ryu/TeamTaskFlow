import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";

// Main page component with error boundary
export default function AuthPage() {
  return (
    <ErrorBoundary 
      fallback={<AuthErrorState />}
      showToast={false} // We'll show UI errors instead
    >
      <AuthPageContent />
    </ErrorBoundary>
  );
}

// Error fallback for the auth page
function AuthErrorState() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-[400px] border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Authentication Error
          </CardTitle>
          <CardDescription>
            We encountered a problem with the authentication system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert 
            variant="destructive" 
            className="mb-4"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>System Error</AlertTitle>
            <AlertDescription>
              There was a problem loading the authentication system. This could be due to a network issue
              or a temporary server problem.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2"
            aria-label="Refresh the page to try again"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Refresh the page</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Main content component
function AuthPageContent() {
  const { user, loginMutation, registerMutation } = useAuth();

  const loginError = loginMutation.error ? handleQueryError(loginMutation.error) : null;
  const registerError = registerMutation.error ? handleQueryError(registerMutation.error) : null;

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
            {(loginError || registerError) && (
              <Alert 
                variant="destructive" 
                className="mt-4"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Authentication Failed</AlertTitle>
                <AlertDescription>
                  {loginError || registerError}
                </AlertDescription>
              </Alert>
            )}
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
                  error={loginError}
                />
              </TabsContent>
              <TabsContent value="register">
                <AuthForm
                  mode="register"
                  onSubmit={(data) => {
                    registerMutation.mutate(data);
                  }}
                  isPending={registerMutation.isPending}
                  error={registerError}
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
  error,
}: {
  mode: "login" | "register";
  onSubmit: (data: InsertUser) => void;
  isPending: boolean;
  error: string | null;
}) {
  // Use our enhanced validation schema
  const authSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });
  
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  // Update general error when error prop changes
  useEffect(() => {
    if (error) {
      setGeneralError(error);
    }
  }, [error]);
  
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
    <ErrorBoundary 
      fallback={
        <div className="space-y-4 mt-4 p-4 border border-destructive rounded-md bg-destructive/5">
          <Alert 
            variant="destructive"
            role="alert"
            aria-live="assertive"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Form Error</AlertTitle>
            <AlertDescription>
              Something went wrong with the authentication form. Please reload the page and try again.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            aria-label="Reload the page to fix form error"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Reload</span>
          </Button>
        </div>
      }
      showToast={false}
    >
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
          
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isPending}
            aria-busy={isPending}
            aria-label={
              isPending 
                ? (mode === "login" ? "Logging in..." : "Creating account...") 
                : (mode === "login" ? "Login to your account" : "Create a new account")
            }
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>{mode === "login" ? "Logging in..." : "Creating account..."}</span>
              </span>
            ) : (
              <span>{mode === "login" ? "Login" : "Register"}</span>
            )}
          </Button>
        </form>
      </Form>
    </ErrorBoundary>
  );
}