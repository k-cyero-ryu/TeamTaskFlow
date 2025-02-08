import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("AuthPage - Auth state check:", {
      user: user ? { id: user.id, username: user.username } : null,
      isLoginPending: loginMutation.isPending,
      isRegisterPending: registerMutation.isPending
    });

    // Only redirect if we have a user and no pending mutations
    if (user && !loginMutation.isPending && !registerMutation.isPending) {
      console.log("AuthPage - User authenticated, redirecting to /");
      setLocation("/");
    }
  }, [user, loginMutation.isPending, registerMutation.isPending, setLocation]);

  // If user exists and no pending mutations, don't render anything while redirecting
  if (user && !loginMutation.isPending && !registerMutation.isPending) {
    console.log("AuthPage - Skipping render due to authenticated user");
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
                    console.log("AuthPage - Attempting login");
                    loginMutation.mutate(data);
                  }}
                  isPending={loginMutation.isPending}
                />
              </TabsContent>
              <TabsContent value="register">
                <AuthForm
                  mode="register"
                  onSubmit={(data) => {
                    console.log("AuthPage - Attempting registration");
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
  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit((data) => {
          console.log(`AuthForm - Submitting ${mode} form`);
          onSubmit(data);
        })} 
        className="space-y-4 mt-4"
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
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Loading..." : mode === "login" ? "Login" : "Register"}
        </Button>
      </form>
    </Form>
  );
}