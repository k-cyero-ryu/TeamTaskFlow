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

  // Handle navigation after render using useEffect
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // If user exists, wait for the effect to handle navigation
  if (user) {
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
                  onSubmit={(data) => loginMutation.mutate(data)}
                  isPending={loginMutation.isPending}
                />
              </TabsContent>
              <TabsContent value="register">
                <AuthForm
                  mode="register"
                  onSubmit={(data) => registerMutation.mutate(data)}
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
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